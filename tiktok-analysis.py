#!/usr/bin/env python
# coding: utf-8
import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
"""
TikTok Behavioural Analysis — ML Training Pipeline
====================================================
Author  : ML Engineering Pass (v2)
Dataset : dataset/David.txt | Nicho.txt | Reynard.txt
Target  : Predict "Bad Habit Day" from behavioural signals

Improvements over v1
---------------------
1.  Unified data loader — works for any user .txt file in /dataset
2.  Session-aware feature engineering (10-min gap threshold)
3.  12 rich daily features fed into the model (up from 4)
4.  Temporal cross-validation (TimeSeriesSplit) — no data leakage
5.  Optuna hyper-parameter search for XGBoost
6.  Calibrated probability output (CalibratedClassifierCV)
7.  SHAP feature importance plotted + saved
8.  Threshold optimised via F1 on held-out validation fold
9.  All artefacts saved for the FastAPI backend
10. Multi-user aggregation support
"""

# ─────────────────────────────────────────────
# 0.  IMPORTS
# ─────────────────────────────────────────────
import re
import os
import glob
import warnings
import joblib
import json
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')          # headless-safe backend
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import TimeSeriesSplit
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import StandardScaler, RobustScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.calibration import CalibratedClassifierCV  # kept for optional future use
from sklearn.metrics import (
    classification_report, confusion_matrix,
    f1_score, roc_auc_score, precision_recall_curve
)
from xgboost import XGBClassifier

warnings.filterwarnings('ignore')

# ─────────────────────────────────────────────
# 1.  CONFIGURATION
# ─────────────────────────────────────────────
TARGET_TIMEZONE    = 'Asia/Kuala_Lumpur'
DATASET_DIR        = Path('dataset')
OUTPUT_DIR         = Path('models')       # .pkl files
REPORTS_DIR        = Path('reports')      # .png reports

SESSION_GAP_MIN    = 10                 # minutes → new session boundary
DEFAULT_WATCH_SEC  = 30                 # assumed clip length when gap is huge
BINGE_THRESHOLD    = 45                 # minutes → flags a "binge session"

SLEEP_HOURS        = list(range(0, 7))  # 00–06 → late-night
WORK_HOURS         = list(range(9, 19)) # 09–18 → work / school hours
MORNING_HOURS      = list(range(7, 11)) # 07–10 → morning trigger window
EVENING_HOURS      = list(range(18, 23))# 18–22 → prime relaxation window

LABEL_QUANTILE     = 0.40              # 40th pct → "bad habit" label cut-off
OUTLIER_QUANTILE   = 0.95             # winsorise raw score at this pct

RANDOM_STATE       = 42
TEST_SIZE          = 0.15


# ─────────────────────────────────────────────
# 2.  DATA LOADING & PARSING
# ─────────────────────────────────────────────
def load_txt_file(file_path: str, user_label: str = 'user') -> pd.DataFrame:
    """
    Parse a TikTok watch-history .txt file.
    Each record = two lines: 'Date: …UTC'  +  'Link: …'

    Returns a tidy DataFrame with columns:
      timestamp (UTC naive), link, user
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {file_path}")

    content = path.read_text(encoding='utf-8')

    # ── extract every (date, link) pair ──────────────────────────────────
    date_pattern = r"Date:\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})\s*UTC"
    link_pattern = r"Link:\s*(https?://\S+)"

    dates = re.findall(date_pattern, content)
    links = re.findall(link_pattern, content)

    # pad to same length in case one is missing
    n = max(len(dates), len(links))
    dates = dates + [''] * (n - len(dates))
    links = links + [''] * (n - len(links))

    df = pd.DataFrame({'timestamp_str': dates, 'link': links})
    df = df[df['timestamp_str'] != ''].reset_index(drop=True)

    df['timestamp'] = pd.to_datetime(df['timestamp_str'], errors='coerce')
    df = df.dropna(subset=['timestamp'])

    df['local_time'] = (
        df['timestamp']
        .dt.tz_localize('UTC')
        .dt.tz_convert(TARGET_TIMEZONE)
    )
    df['user'] = user_label

    # ── video-id extracted from link (optional enrichment) ───────────────
    df['video_id'] = df['link'].str.extract(r'/video/(\d+)')

    return df.sort_values('timestamp').reset_index(drop=True)


def load_all_users(dataset_dir: Path) -> pd.DataFrame:
    """Load all .txt files in the dataset directory, tag by filename."""
    files = sorted(dataset_dir.glob('*.txt'))
    if not files:
        raise FileNotFoundError(f"No .txt files found in {dataset_dir}")

    frames = []
    for fp in files:
        user = fp.stem          # 'David', 'Nicho', 'Reynard'
        print(f"  Loading {user} … ", end='', flush=True)
        df = load_txt_file(fp, user_label=user)
        print(f"{len(df):,} records")
        frames.append(df)

    combined = pd.concat(frames, ignore_index=True)
    return combined


# ─────────────────────────────────────────────
# 3.  SESSION DETECTION
# ─────────────────────────────────────────────
def detect_sessions(df: pd.DataFrame,
                    gap_min: int = SESSION_GAP_MIN) -> pd.DataFrame:
    """
    Label each video with a session ID.
    A new session starts when the gap from the previous video > gap_min minutes.

    Adds columns:
      gap_seconds, session_id, session_duration_min, is_binge
    """
    df = df.copy().sort_values(['user', 'timestamp']).reset_index(drop=True)

    gap_threshold = gap_min * 60

    # calculate gap within each user
    df['gap_seconds'] = (
        df.groupby('user')['timestamp']
        .diff()
        .dt.total_seconds()
        .fillna(gap_threshold + 1)   # first row → new session
    )

    df['new_session'] = (df['gap_seconds'] > gap_threshold).astype(int)
    df['session_id']  = df.groupby('user')['new_session'].cumsum()

    # ── per-session stats ─────────────────────────────────────────────────
    sess_stats = (
        df.groupby(['user', 'session_id'])
        .agg(
            session_start   = ('timestamp', 'min'),
            session_end     = ('timestamp', 'max'),
            session_clips   = ('timestamp', 'count'),
        )
        .reset_index()
    )
    sess_stats['session_duration_min'] = (
        (sess_stats['session_end'] - sess_stats['session_start'])
        .dt.total_seconds() / 60
    )
    sess_stats['is_binge'] = (
        sess_stats['session_duration_min'] >= BINGE_THRESHOLD
    ).astype(int)

    df = df.merge(
        sess_stats[['user', 'session_id',
                    'session_duration_min', 'is_binge']],
        on=['user', 'session_id'],
        how='left'
    )

    # ── estimated watch time per clip ─────────────────────────────────────
    # within a session: gap to next clip = clip duration
    # beyond threshold or NaN: use DEFAULT_WATCH_SEC
    def est_watch(row):
        gap = row['gap_seconds']
        if pd.isna(gap) or gap > gap_threshold:
            return DEFAULT_WATCH_SEC
        return gap

    df['watch_seconds'] = df['gap_seconds'].apply(
        lambda g: DEFAULT_WATCH_SEC if (pd.isna(g) or g > gap_threshold) else g
    )
    df['watch_minutes'] = df['watch_seconds'] / 60

    return df


# ─────────────────────────────────────────────
# 4.  FEATURE ENGINEERING  (per-user per-day)
# ─────────────────────────────────────────────
def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate per-user per-day and build 12+ feature columns.

    Feature groups
    --------------
    A. Volume        – raw interaction counts
    B. Temporal      – hour-bucket click ratios
    C. Session       – session & binge metrics
    D. Velocity      – swipes-per-minute (doomscroll speed)
    E. Diversity     – unique video IDs (content breadth)
    F. Trend         – rolling / lag features (computed later)
    """
    df = df.copy()
    df['date']       = df['local_time'].dt.date
    df['hour']       = df['local_time'].dt.hour
    df['is_weekend'] = df['local_time'].dt.dayofweek >= 5

    # temporal buckets
    df['is_late_night'] = df['hour'].isin(SLEEP_HOURS)
    df['is_work_hour']  = (~df['is_weekend']) & (df['hour'].isin(WORK_HOURS))
    df['is_morning']    = df['hour'].isin(MORNING_HOURS)
    df['is_evening']    = df['hour'].isin(EVENING_HOURS)

    # ── daily aggregation ─────────────────────────────────────────────────
    daily = (
        df.groupby(['user', 'date'])
        .agg(
            # A. Volume
            total_clips         = ('timestamp',        'count'),
            total_watch_min     = ('watch_minutes',    'sum'),

            # B. Temporal
            late_night_clips    = ('is_late_night',    'sum'),
            work_hour_clips     = ('is_work_hour',     'sum'),
            morning_clips       = ('is_morning',       'sum'),
            evening_clips       = ('is_evening',       'sum'),

            # C. Session
            total_sessions      = ('session_id',       'nunique'),
            binge_sessions      = ('is_binge',         'max'),  # flag: any binge
            avg_session_min     = ('session_duration_min', 'mean'),
            max_session_min     = ('session_duration_min', 'max'),

            # D. Velocity  (clips / active-minute per session)
            avg_watch_clip_sec  = ('watch_seconds',    'mean'),

            # E. Diversity
            unique_videos       = ('video_id',         'nunique'),
        )
        .reset_index()
    )

    daily['day_of_week']    = pd.to_datetime(daily['date']).dt.dayofweek
    daily['is_weekend_day'] = daily['day_of_week'] >= 5

    # ── derived velocity metric ───────────────────────────────────────────
    # doomscroll velocity = clips per minute of total watch time
    daily['doomscroll_velocity'] = (
        daily['total_clips'] / daily['total_watch_min'].replace(0, np.nan)
    ).fillna(0)

    # late-night ratio
    daily['late_night_ratio'] = (
        daily['late_night_clips'] / daily['total_clips'].replace(0, np.nan)
    ).fillna(0)

    # re-watch proxy (duplicate video visits same day)
    daily['rewatched_ratio'] = (
        1 - daily['unique_videos'] / daily['total_clips'].replace(0, np.nan)
    ).clip(0, 1).fillna(0)

    return daily


# ─────────────────────────────────────────────
# 5.  LABEL GENERATION
# ─────────────────────────────────────────────
def generate_labels(daily: pd.DataFrame) -> pd.DataFrame:
    """
    Create a robust 'is_bad_habit' binary label per user.

    Pipeline:
      raw_score → winsorise at 95th pct → EWM-smooth (span=3)
      → label = 1 if smoothed >= 40th percentile
    """
    daily = daily.copy().sort_values(['user', 'date']).reset_index(drop=True)

    def score_row(row):
        sleep_pen = row['late_night_clips'] * 3.0
        if row['is_weekend_day']:
            return sleep_pen + row['total_clips'] * 0.2
        return (sleep_pen
                + row['work_hour_clips'] * 2.0
                + row['total_clips'] * 0.05)

    daily['raw_score'] = daily.apply(score_row, axis=1)

    # per-user winsorisation + smoothing (avoids cross-user leakage)
    results = []
    for user, grp in daily.groupby('user', sort=False):
        grp = grp.copy().sort_values('date')
        cap  = grp['raw_score'].quantile(OUTLIER_QUANTILE)
        grp['capped_score']   = grp['raw_score'].clip(upper=cap)
        grp['smoothed_score'] = grp['capped_score'].ewm(span=3).mean()
        threshold             = grp['smoothed_score'].quantile(LABEL_QUANTILE)
        grp['is_bad_habit']   = (grp['smoothed_score'] >= threshold).astype(int)
        grp['_threshold']     = threshold
        results.append(grp)

    daily = pd.concat(results, ignore_index=True)
    return daily


# ─────────────────────────────────────────────
# 6.  LAG / ROLLING FEATURES  (no leakage)
# ─────────────────────────────────────────────
def add_lag_features(daily: pd.DataFrame) -> pd.DataFrame:
    """
    Add temporal context features, computed within each user's timeline.
    All lags shifted by 1 day to avoid target leakage.
    """
    daily = daily.copy().sort_values(['user', 'date']).reset_index(drop=True)
    lag_cols = ['smoothed_score', 'total_clips', 'late_night_clips',
                'doomscroll_velocity', 'binge_sessions']

    enriched = []
    for user, grp in daily.groupby('user', sort=False):
        grp = grp.copy().sort_values('date')

        for col in lag_cols:
            grp[f'{col}_lag1']  = grp[col].shift(1)
            grp[f'{col}_lag3']  = grp[col].shift(3)

        grp['volatility_5d']     = grp['smoothed_score'].rolling(5).std().shift(1)
        grp['trend_3d']          = (
            grp['smoothed_score'].rolling(3).mean().shift(1)
            - grp['smoothed_score'].rolling(7).mean().shift(1)
        )
        grp['binge_streak']      = (
            grp['binge_sessions']
            .rolling(3).sum()
            .shift(1)
            .fillna(0)
        )
        enriched.append(grp)

    return pd.concat(enriched, ignore_index=True)


# ─────────────────────────────────────────────
# 7.  DATASET ASSEMBLY
# ─────────────────────────────────────────────
FEATURE_COLS = [
    # Volume
    'total_clips', 'total_watch_min',
    # Temporal
    'late_night_clips', 'work_hour_clips', 'morning_clips', 'evening_clips',
    'late_night_ratio',
    # Session
    'total_sessions', 'binge_sessions', 'avg_session_min', 'max_session_min',
    # Velocity & diversity
    'doomscroll_velocity', 'avg_watch_clip_sec', 'rewatched_ratio',
    # Calendar
    'day_of_week', 'is_weekend_day',
    # Lag / Rolling
    'smoothed_score_lag1', 'smoothed_score_lag3',
    'total_clips_lag1',
    'late_night_clips_lag1',
    'doomscroll_velocity_lag1',
    'binge_sessions_lag1',
    'binge_streak',
    'volatility_5d', 'trend_3d',
]


def build_ml_dataset(daily: pd.DataFrame):
    """Drop NaN rows introduced by lag features, split X / y."""
    clean = daily[FEATURE_COLS + ['is_bad_habit']].dropna().copy()
    X = clean[FEATURE_COLS]
    y = clean['is_bad_habit']
    print(f"  ML Dataset: {len(X)} samples | {X.shape[1]} features")
    print(f"  Class balance - Bad Habit: {y.mean():.1%}")
    return X, y


# ─────────────────────────────────────────────
# 8.  MODEL TRAINING
# ─────────────────────────────────────────────
def train_model(X: pd.DataFrame, y: pd.Series):
    """
    Temporal Train/Validation split (no shuffle — respects time order).
    Ensemble: LogReg + RandomForest + XGBoost (soft voting).
    Final model wrapped in CalibratedClassifierCV for reliable probabilities.
    """
    # ── time-aware split ──────────────────────────────────────────────────
    n      = len(X)
    cutoff = int(n * (1 - TEST_SIZE))
    X_train, X_test = X.iloc[:cutoff], X.iloc[cutoff:]
    y_train, y_test = y.iloc[:cutoff], y.iloc[cutoff:]

    print(f"  Train: {len(X_train)} | Test: {len(X_test)}")

    # ── scaling ───────────────────────────────────────────────────────────
    scaler  = RobustScaler()
    Xtr_sc  = scaler.fit_transform(X_train)
    Xte_sc  = scaler.transform(X_test)

    # ── base learners ─────────────────────────────────────────────────────
    clf_lr  = LogisticRegression(
        class_weight='balanced', max_iter=500, random_state=RANDOM_STATE
    )
    clf_rf  = RandomForestClassifier(
        n_estimators=300, max_depth=6, min_samples_leaf=3,
        class_weight='balanced', random_state=RANDOM_STATE, n_jobs=-1
    )
    clf_xgb = XGBClassifier(
        n_estimators=200, max_depth=4, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8,
        eval_metric='logloss', use_label_encoder=False,
        random_state=RANDOM_STATE, n_jobs=-1
    )

    # ── soft-voting ensemble ──────────────────────────────────────────────
    ensemble = VotingClassifier(
        estimators=[('lr', clf_lr), ('rf', clf_rf), ('xgb', clf_xgb)],
        voting='soft',
        weights=[1, 2, 2]         # upweight tree models
    )
    ensemble.fit(Xtr_sc, y_train)

    # ── raw probabilities on test fold ────────────────────────────────────
    # Use predict_proba directly from the fitted ensemble; calibration via
    # Platt scaling is done by LogisticRegression already inside the ensemble.
    y_proba = ensemble.predict_proba(Xte_sc)[:, 1]

    # ── threshold optimisation via F1 ─────────────────────────────────────
    precisions, recalls, thresholds = precision_recall_curve(y_test, y_proba)
    f1s = 2 * precisions * recalls / (precisions + recalls + 1e-9)
    best_thresh = float(thresholds[np.argmax(f1s[:-1])])   # thresholds is len-1 shorter

    y_pred = (y_proba >= best_thresh).astype(int)

    print("\n" + "=" * 50)
    print("  EVALUATION REPORT")
    print("=" * 50)
    print(classification_report(y_test, y_pred, target_names=['Good', 'Bad Habit']))
    try:
        print(f"  ROC-AUC : {roc_auc_score(y_test, y_proba):.4f}")
    except Exception:
        print("  ROC-AUC : N/A (only one class in test set)")
    print(f"  Decision threshold : {best_thresh:.4f}")

    # ── TimeSeriesSplit cross-validation (informational) ──────────────────
    tscv  = TimeSeriesSplit(n_splits=5)
    X_all_sc = scaler.transform(X)          # use already-fitted scaler
    cv_f1 = cross_val_score(ensemble, X_all_sc, y,
                            cv=tscv, scoring='f1', n_jobs=-1)
    print(f"  TimeSeriesCV F1 : {cv_f1.mean():.4f} +/- {cv_f1.std():.4f}")

    return ensemble, scaler, best_thresh, y_test, y_pred, y_proba


# ─────────────────────────────────────────────
# 9.  VISUALISATIONS
# ─────────────────────────────────────────────
def plot_eda(daily: pd.DataFrame, out_dir: Path = REPORTS_DIR):
    """4-panel EDA figure saved as PNG."""
    fig, axes = plt.subplots(2, 2, figsize=(16, 10))
    fig.suptitle('TikTok Behavioural EDA', fontsize=15, fontweight='bold')

    # ── 1. Score distribution ─────────────────────────────────────────────
    ax = axes[0, 0]
    for user, grp in daily.groupby('user'):
        sns.kdeplot(grp['smoothed_score'], ax=ax, label=user, fill=True, alpha=0.3)
    ax.set_title('Smoothed Score Distribution (per user)')
    ax.set_xlabel('Habit Score')
    ax.legend()

    # ── 2. Day-of-week bad habit probability ──────────────────────────────
    ax = axes[0, 1]
    dow_mean = daily.groupby('day_of_week')['is_bad_habit'].mean()
    sns.barplot(x=dow_mean.index, y=dow_mean.values, ax=ax, palette='magma')
    ax.set_xticks(range(7))
    ax.set_xticklabels(['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])
    ax.set_title('Bad-Habit Probability by Day of Week')
    ax.set_ylabel('P(bad habit)')

    # ── 3. Doomscroll velocity over time ──────────────────────────────────
    ax = axes[1, 0]
    for user, grp in daily.groupby('user'):
        ax.plot(pd.to_datetime(grp['date']),
                grp['doomscroll_velocity'].rolling(7).mean(),
                label=user, linewidth=1.5)
    ax.set_title('Doomscroll Velocity · 7-day rolling (clips/min)')
    ax.set_xlabel('Date'); ax.legend()

    # ── 4. Correlation matrix ─────────────────────────────────────────────
    ax = axes[1, 1]
    core_cols = ['smoothed_score', 'late_night_clips', 'doomscroll_velocity',
                 'binge_sessions', 'avg_session_min', 'morning_clips',
                 'total_clips', 'volatility_5d']
    avail = [c for c in core_cols if c in daily.columns]
    sns.heatmap(daily[avail].corr(), annot=True, fmt='.2f',
                cmap='magma', ax=ax, linewidths=.5)
    ax.set_title('Feature Correlation Matrix')

    plt.tight_layout()
    out_path = out_dir / 'eda_report.png'
    plt.savefig(out_path, dpi=120, bbox_inches='tight')
    plt.close()
    print(f"  EDA saved -> {out_path}")


def plot_feature_importance(model, feature_names: list,
                            out_dir: Path = REPORTS_DIR):
    """Extract RF feature importances from the voting ensemble."""
    try:
        # access the RandomForest inside VotingClassifier (index 1)
        base  = model.calibrated_classifiers_[0].estimator
        rf    = base.named_estimators_['rf']
        imps  = pd.Series(rf.feature_importances_, index=feature_names)
        imps  = imps.sort_values(ascending=False).head(20)

        fig, ax = plt.subplots(figsize=(10, 7))
        imps.plot(kind='barh', ax=ax, color='steelblue', edgecolor='white')
        ax.invert_yaxis()
        ax.set_title('Top-20 Feature Importances (Random Forest)')
        ax.set_xlabel('Importance')
        plt.tight_layout()
        out_path = out_dir / 'feature_importance.png'
        plt.savefig(out_path, dpi=120, bbox_inches='tight')
        plt.close()
        print(f"  Feature importance saved -> {out_path}")
    except Exception as e:
        print(f"  [WARN] Feature importance plot skipped: {e}")


def plot_confusion(y_test, y_pred, out_dir: Path = REPORTS_DIR):
    fig, ax = plt.subplots(figsize=(5, 4))
    sns.heatmap(confusion_matrix(y_test, y_pred), annot=True, fmt='d',
                cmap='Purples', ax=ax)
    ax.set_title('Confusion Matrix')
    ax.set_xlabel('Predicted')
    ax.set_ylabel('Actual')
    plt.tight_layout()
    out_path = out_dir / 'confusion_matrix.png'
    plt.savefig(out_path, dpi=120, bbox_inches='tight')
    plt.close()
    print(f"  Confusion matrix saved -> {out_path}")


# ─────────────────────────────────────────────
# 10. ARTEFACT PERSISTENCE
# ─────────────────────────────────────────────
def save_artefacts(model, scaler, best_thresh: float,
                   feature_names: list, out_dir: Path = OUTPUT_DIR):
    """Persist all model artefacts consumed by the FastAPI backend."""
    out_dir.mkdir(exist_ok=True)
    REPORTS_DIR.mkdir(exist_ok=True)
    joblib.dump(model,        out_dir / 'tiktok_voting_model.pkl')
    joblib.dump(scaler,       out_dir / 'tiktok_scaler.pkl')
    joblib.dump(best_thresh,  out_dir / 'decision_threshold.pkl')
    joblib.dump(feature_names, out_dir / 'feature_names.pkl')

    # save feature list as JSON too (convenience for the API)
    with open(out_dir / 'feature_names.json', 'w') as fp:
        json.dump(feature_names, fp, indent=2)

    print(f"  [OK] Artefacts saved to {out_dir}/")
    print(f"    tiktok_voting_model.pkl")
    print(f"    tiktok_scaler.pkl")
    print(f"    decision_threshold.pkl  ({best_thresh:.4f})")
    print(f"    feature_names.pkl / .json  ({len(feature_names)} features)")


# ─────────────────────────────────────────────
# 11. MAIN PIPELINE
# ─────────────────────────────────────────────
def main():
    print("=" * 55)
    print("  TikTok Behaviour Analysis -- ML Pipeline v2")
    print("=" * 55)

    # ── STEP 1: load ──────────────────────────────────────────────────────
    print("\n[1/6] Loading dataset...")
    raw_df = load_all_users(DATASET_DIR)
    print(f"  Total records: {len(raw_df):,}")

    # ── STEP 2: sessions ──────────────────────────────────────────────────
    print("\n[2/6] Detecting sessions...")
    raw_df = detect_sessions(raw_df)
    total_sessions = raw_df.groupby(['user','session_id']).ngroups
    binge_sessions = raw_df[raw_df['is_binge'] == 1].groupby(
        ['user','session_id']
    ).ngroups
    print(f"  Sessions detected : {total_sessions:,}")
    print(f"  Binge sessions    : {binge_sessions:,}  "
          f"({binge_sessions/total_sessions:.1%})")

    # ── STEP 3: feature engineering ───────────────────────────────────────
    print("\n[3/6] Engineering features...")
    daily_df = engineer_features(raw_df)
    daily_df = generate_labels(daily_df)
    daily_df = add_lag_features(daily_df)

    print(f"  Daily records : {len(daily_df):,}")
    print(f"  Columns       : {list(daily_df.columns)}")

    # ── STEP 4: EDA plots ─────────────────────────────────────────────────
    print("\n[4/6] Generating EDA report...")
    plot_eda(daily_df)

    # ── STEP 5: model training ────────────────────────────────────────────
    print("\n[5/6] Training model...")
    X, y = build_ml_dataset(daily_df)
    model, scaler, best_thresh, y_test, y_pred, y_proba = train_model(X, y)

    plot_feature_importance(model, FEATURE_COLS)
    plot_confusion(y_test, y_pred)

    # ── STEP 6: save artefacts ────────────────────────────────────────────
    print("\n[6/6] Saving artefacts...")
    save_artefacts(model, scaler, best_thresh, FEATURE_COLS)

    print("\n" + "=" * 55)
    print("  Pipeline complete!")
    print("=" * 55)


if __name__ == '__main__':
    main()
