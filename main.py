from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import re
import joblib
import uvicorn
import logging
from datetime import datetime
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path('.') / '.env')

TIMEZONE = 'Asia/Kuala_Lumpur'
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

print(f"📁 .env file exists: {(Path('.') / '.env').exists()}")
print(f"🔑 API Key loaded: {'Yes' if GEMINI_API_KEY else '❌ NO'}")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ── Gemini ─────────────────────────────────────────────────────────────────
llm_client = None
GEMINI_AVAILABLE = False
working_model = None
try:
    from google import genai
    if GEMINI_API_KEY and len(GEMINI_API_KEY) > 10:
        llm_client = genai.Client(api_key=GEMINI_API_KEY)
        for mn in ['gemini-2.5-flash-lite']:
            try:
                llm_client.models.generate_content(model=mn, contents="Say OK")
                working_model = mn
                GEMINI_AVAILABLE = True
                logger.info(f"✓ Gemini ready: {mn}")
                break
            except Exception:
                continue
except Exception as e:
    logger.warning(f"Gemini unavailable: {e}")

# ── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(title="Neural Void — Behaviour Analysis API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Load ML artefacts ───────────────────────────────────────────────────────
model_data = {}
MODEL_LOADED = False
FEATURE_NAMES = []
try:
    model_data['model']   = joblib.load('tiktok_voting_model.pkl')
    model_data['scaler']  = joblib.load('tiktok_scaler.pkl')
    model_data['d_thresh'] = joblib.load('decision_threshold.pkl')
    try:
        FEATURE_NAMES = joblib.load('feature_names.pkl')
    except Exception:
        import json
        with open('feature_names.json') as f:
            FEATURE_NAMES = json.load(f)
    MODEL_LOADED = True
    logger.info(f"✓ Model loaded — {len(FEATURE_NAMES)} features")
except Exception as e:
    logger.warning(f"⚠ Model load: {e}")
    model_data['d_thresh'] = 0.5

# ── Constants matching tiktok-analysis.py ──────────────────────────────────
SESSION_GAP_MIN   = 10
DEFAULT_WATCH_SEC = 30
BINGE_THRESHOLD   = 45
SLEEP_HOURS       = list(range(0, 7))
WORK_HOURS        = list(range(9, 19))
MORNING_HOURS     = list(range(7, 11))
EVENING_HOURS     = list(range(18, 23))
LABEL_QUANTILE    = 0.40
OUTLIER_QUANTILE  = 0.95


# ── Core feature engineering (mirrors tiktok-analysis.py) ──────────────────
def full_feature_pipeline(content_str: str):
    """
    Parse text → sessions → per-day 25-feature table → prediction.
    Returns (daily_df, raw_df, feature_vector_today)
    """
    matches = re.findall(r"Date:\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})\s*UTC", content_str)
    links   = re.findall(r"Link:\s*(https?://\S+)", content_str)
    if not matches:
        raise ValueError("No UTC timestamps found in file.")

    # ── build raw df ──────────────────────────────────────────────────────
    df = pd.DataFrame({'timestamp': matches})
    df['timestamp']  = pd.to_datetime(df['timestamp'])
    df['link']       = (links + [''] * len(matches))[:len(matches)]
    df['video_id']   = df['link'].str.extract(r'/video/(\d+)')
    df = df.sort_values('timestamp').reset_index(drop=True)
    df['local_time'] = df['timestamp'].dt.tz_localize('UTC').dt.tz_convert(TIMEZONE)

    # ── session detection ─────────────────────────────────────────────────
    gap_thresh = SESSION_GAP_MIN * 60
    df['gap_sec']     = df['timestamp'].diff().dt.total_seconds().fillna(gap_thresh + 1)
    df['new_session'] = (df['gap_sec'] > gap_thresh).astype(int)
    df['session_id']  = df['new_session'].cumsum()

    sess = df.groupby('session_id').agg(
        s_start=('timestamp', 'min'),
        s_end  =('timestamp', 'max'),
        s_clips=('timestamp', 'count'),
    ).reset_index()
    sess['session_duration_min'] = (sess['s_end'] - sess['s_start']).dt.total_seconds() / 60
    sess['is_binge'] = (sess['session_duration_min'] >= BINGE_THRESHOLD).astype(int)
    df = df.merge(sess[['session_id','session_duration_min','is_binge']], on='session_id', how='left')

    df['watch_sec'] = df['gap_sec'].apply(
        lambda g: DEFAULT_WATCH_SEC if (pd.isna(g) or g > gap_thresh) else g
    )
    df['watch_min'] = df['watch_sec'] / 60

    # ── temporal flags ────────────────────────────────────────────────────
    df['date']        = df['local_time'].dt.date
    df['hour']        = df['local_time'].dt.hour
    df['day_of_week'] = df['local_time'].dt.dayofweek   # 0=Mon … 6=Sun
    df['is_weekend']  = df['day_of_week'] >= 5

    df['is_late_night'] = df['hour'].isin(SLEEP_HOURS)
    df['is_work_hour']  = (~df['is_weekend']) & (df['hour'].isin(WORK_HOURS))
    df['is_morning']    = df['hour'].isin(MORNING_HOURS)
    df['is_evening']    = df['hour'].isin(EVENING_HOURS)

    # ── daily aggregation ─────────────────────────────────────────────────
    daily = df.groupby('date').agg(
        total_clips        =('timestamp',             'count'),
        total_watch_min    =('watch_min',             'sum'),
        late_night_clips   =('is_late_night',         'sum'),
        work_hour_clips    =('is_work_hour',          'sum'),
        morning_clips      =('is_morning',            'sum'),
        evening_clips      =('is_evening',            'sum'),
        total_sessions     =('session_id',            'nunique'),
        binge_sessions     =('is_binge',              'max'),
        avg_session_min    =('session_duration_min',  'mean'),
        max_session_min    =('session_duration_min',  'max'),
        avg_watch_clip_sec =('watch_sec',             'mean'),
        unique_videos      =('video_id',              'nunique'),
    ).reset_index()

    daily['day_of_week']    = pd.to_datetime(daily['date']).dt.dayofweek
    daily['is_weekend_day'] = daily['day_of_week'] >= 5

    daily['doomscroll_velocity'] = (
        daily['total_clips'] / daily['total_watch_min'].replace(0, np.nan)
    ).fillna(0)
    daily['late_night_ratio'] = (
        daily['late_night_clips'] / daily['total_clips'].replace(0, np.nan)
    ).fillna(0)
    daily['rewatched_ratio'] = (
        1 - daily['unique_videos'] / daily['total_clips'].replace(0, np.nan)
    ).clip(0, 1).fillna(0)

    # ── label / smoothed score ────────────────────────────────────────────
    def score_row(r):
        sp = r['late_night_clips'] * 3.0
        if r['is_weekend_day']:
            return sp + r['total_clips'] * 0.2
        return sp + r['work_hour_clips'] * 2.0 + r['total_clips'] * 0.05

    daily['raw_score']     = daily.apply(score_row, axis=1)
    cap                    = daily['raw_score'].quantile(OUTLIER_QUANTILE)
    daily['capped_score']  = daily['raw_score'].clip(upper=cap)
    daily['smoothed_score']= daily['capped_score'].ewm(span=3).mean()
    threshold              = daily['smoothed_score'].quantile(LABEL_QUANTILE)
    daily['is_bad_habit']  = (daily['smoothed_score'] >= threshold).astype(int)

    # ── lag / rolling features ────────────────────────────────────────────
    for col in ['smoothed_score','total_clips','late_night_clips',
                'doomscroll_velocity','binge_sessions']:
        daily[f'{col}_lag1'] = daily[col].shift(1)
        daily[f'{col}_lag3'] = daily[col].shift(3)

    daily['volatility_5d'] = daily['smoothed_score'].rolling(5).std().shift(1)
    daily['trend_3d']      = (
        daily['smoothed_score'].rolling(3).mean().shift(1) -
        daily['smoothed_score'].rolling(7).mean().shift(1)
    )
    daily['binge_streak']  = daily['binge_sessions'].rolling(3).sum().shift(1).fillna(0)

    return daily, df, sess


@app.get("/", response_class=HTMLResponse)
async def read_root():
    return "<h1>Neural Void API is running.</h1>"


@app.get("/health")
async def health_check():
    return {"status": "healthy", "model_loaded": MODEL_LOADED, "gemini": GEMINI_AVAILABLE}


@app.post("/analyze")
async def analyze_file(file: UploadFile = File(...)):
    try:
        content_str = (await file.read()).decode('utf-8', errors='ignore')

        daily, raw_df, sess = full_feature_pipeline(content_str)

        # ── prediction ────────────────────────────────────────────────────
        risk_score = 0.5
        FEATURE_COLS = [
            'total_clips','total_watch_min',
            'late_night_clips','work_hour_clips','morning_clips','evening_clips',
            'late_night_ratio',
            'total_sessions','binge_sessions','avg_session_min','max_session_min',
            'doomscroll_velocity','avg_watch_clip_sec','rewatched_ratio',
            'day_of_week','is_weekend_day',
            'smoothed_score_lag1','smoothed_score_lag3',
            'total_clips_lag1',
            'late_night_clips_lag1',
            'doomscroll_velocity_lag1',
            'binge_sessions_lag1',
            'binge_streak',
            'volatility_5d','trend_3d',
        ]

        if MODEL_LOADED and 'model' in model_data:
            try:
                clean = daily.dropna(subset=FEATURE_COLS)
                if len(clean) > 0:
                    last_row = clean.iloc[-1][FEATURE_COLS].values.reshape(1, -1)
                    X_scaled = model_data['scaler'].transform(last_row)
                    risk_score = float(model_data['model'].predict_proba(X_scaled)[0][1])
            except Exception as e:
                logger.warning(f"Prediction error: {e}")

        # ── aggregate stats ───────────────────────────────────────────────
        total_sessions  = int(sess['session_id'].count())
        binge_count     = int(sess['is_binge'].sum())
        avg_sess_min    = float(sess['session_duration_min'].mean()) if len(sess) else 0
        max_sess_min    = float(sess['session_duration_min'].max())  if len(sess) else 0
        avg_velocity    = float(daily['doomscroll_velocity'].mean())
        total_watch_hrs = float(daily['total_watch_min'].sum()) / 60
        bad_days_ratio  = float(daily['is_bad_habit'].mean())
        avg_late_night  = float(daily['late_night_clips'].mean())
        avg_morning     = float(daily['morning_clips'].mean())
        avg_rewatched   = float(daily['rewatched_ratio'].mean())

        # peak hour
        hour_counts     = raw_df['hour'].value_counts()
        peak_hour       = int(hour_counts.idxmax()) if len(hour_counts) else 0
        peak_day_idx    = daily.groupby('day_of_week')['total_clips'].mean().idxmax()
        day_names       = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
        peak_day        = day_names[int(peak_day_idx)]

        # binge streak (consecutive binge days)
        binge_streak_max = int(daily['binge_streak'].max()) if 'binge_streak' in daily.columns else 0

        # trend direction (last 7 days vs previous 7)
        if len(daily) >= 14:
            recent  = daily['smoothed_score'].iloc[-7:].mean()
            earlier = daily['smoothed_score'].iloc[-14:-7].mean()
            trend   = "worsening" if recent > earlier else "improving"
        else:
            trend = "insufficient data"

        # ── chart data ────────────────────────────────────────────────────
        # Trend area chart (daily smoothed score)
        trend_dates  = daily['date'].astype(str).tolist()
        trend_scores = [round(x, 2) for x in daily['smoothed_score'].tolist()]
        trend_clips  = daily['total_clips'].tolist()
        trend_watch  = [round(x, 1) for x in daily['total_watch_min'].tolist()]
        trend_velocity = [round(x, 2) for x in daily['doomscroll_velocity'].tolist()]

        # Radar: per-day pattern
        radar_values = daily.groupby('day_of_week')['smoothed_score'].mean()\
                            .reindex(range(7), fill_value=0).tolist()
        radar_clips  = daily.groupby('day_of_week')['total_clips'].mean()\
                            .reindex(range(7), fill_value=0).tolist()

        # Heatmap (hour × day)
        heatmap = raw_df.groupby(['day_of_week','hour']).size()\
                        .unstack(fill_value=0)\
                        .reindex(index=range(7), columns=range(24), fill_value=0)
        z_matrix = heatmap.values.tolist()

        # Weekly bar — clips per day-of-week
        weekly_bar = [round(x, 1) for x in daily.groupby('day_of_week')['total_clips']
                      .mean().reindex(range(7), fill_value=0).tolist()]

        # Session distribution: binge vs normal
        session_dist = {
            "binge":  binge_count,
            "normal": total_sessions - binge_count
        }

        # ── Gemini prompt with all 25 features ───────────────────────────
        ai_recommendation = "AI insights unavailable."
        if GEMINI_AVAILABLE and llm_client:
            try:
                prompt = f"""You are a clinical-grade digital wellness analyst for the Neural Void platform.

BEHAVIOURAL METRICS (25 ML features extracted):
- Total watch events: {len(raw_df):,}
- Est. total watch time: {total_watch_hrs:.1f} hours
- Total sessions: {total_sessions} | Binge sessions (>45m): {binge_count} ({binge_count/max(total_sessions,1):.0%})
- Avg session: {avg_sess_min:.1f} min | Longest: {max_sess_min:.1f} min
- Doomscroll velocity: {avg_velocity:.2f} clips/min
- Late-night usage avg: {avg_late_night:.1f} clips/day
- Morning trigger avg: {avg_morning:.1f} clips/day
- Re-watch ratio: {avg_rewatched:.1%}
- Bad-habit days: {bad_days_ratio:.0%} of tracked period
- Peak day: {peak_day} | Peak hour: {peak_hour:02d}:00
- Relapse risk score: {risk_score:.0%} ({('HIGH' if risk_score > 0.6 else 'MEDIUM' if risk_score > 0.3 else 'LOW')})
- Behaviour trend: {trend}
- Max consecutive binge sessions: {binge_streak_max}

Write a professional, data-driven assessment in exactly 3 labelled parts:
**Behavioral Diagnosis:** (1 sentence referencing velocity, binge rate, and sleep impact)
**Risk Forecast:** (1 sentence on tomorrow's relapse probability and the primary risk driver)
**Intervention Protocol:** (1 actionable sentence: a specific hour-range or session-cap recommendation)
Be clinical and precise. Max 75 words total."""

                resp = llm_client.models.generate_content(model=working_model, contents=prompt)
                if resp and hasattr(resp, 'text') and resp.text:
                    ai_recommendation = resp.text.strip()
            except Exception as e:
                ai_recommendation = f"Analysis error: {e}"

        return {
            "status": "success",
            "forecast": {
                "risk_score": round(risk_score, 4),
                "risk_level": "high" if risk_score > 0.6 else ("medium" if risk_score > 0.3 else "low"),
                "trend": trend,
            },
            "statistics": {
                # Volume
                "total_events":           len(raw_df),
                "total_watch_hours":      round(total_watch_hrs, 1),
                # Sessions
                "total_sessions":         total_sessions,
                "binge_sessions":         binge_count,
                "binge_rate":             round(binge_count / max(total_sessions, 1), 3),
                "avg_session_minutes":    round(avg_sess_min, 1),
                "longest_session_minutes":round(max_sess_min, 1),
                "max_binge_streak":       binge_streak_max,
                # Velocity & behaviour
                "avg_velocity":           round(avg_velocity, 2),
                "avg_late_night_clips":   round(avg_late_night, 1),
                "avg_morning_clips":      round(avg_morning, 1),
                "rewatched_ratio":        round(avg_rewatched, 3),
                "bad_days_ratio":         round(bad_days_ratio, 3),
                # Peaks
                "peak_hour":              peak_hour,
                "peak_day":               peak_day,
            },
            "charts": {
                "dates":          trend_dates,
                "scores":         trend_scores,
                "clips":          trend_clips,
                "watch_minutes":  trend_watch,
                "velocity":       trend_velocity,
                "radar_values":   [round(x, 2) for x in radar_values],
                "radar_clips":    [round(x, 1) for x in radar_clips],
                "heatmap_z":      z_matrix,
                "weekly_bar":     weekly_bar,
                "session_dist":   session_dist,
            },
            "gemini": ai_recommendation,
        }

    except ValueError as ve:
        raise HTTPException(400, str(ve))
    except Exception as e:
        logger.error(f"Critical error: {e}", exc_info=True)
        raise HTTPException(500, f"Analysis failed: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")