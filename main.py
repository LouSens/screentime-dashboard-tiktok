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

# Load environment variables from .env file
env_path = Path('.') / '.env'
load_dotenv(dotenv_path=env_path)

# --- CONFIGURATION ---
TIMEZONE = 'Asia/Kuala_Lumpur'
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Debug prints
print(f"📁 .env file exists: {env_path.exists()}")
print(f"📁 .env file path: {env_path.absolute()}")
if GEMINI_API_KEY:
    print(f"🔑 API Key loaded: Yes ({GEMINI_API_KEY[:15]}...)")
else:
    print(f"🔑 API Key loaded: ❌ NO - Check your .env file!")

# Configure logging BEFORE trying to use it
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configure Gemini with better error handling
llm_client = None
GEMINI_AVAILABLE = False

try:
    from google import genai

    logger.info("✓ google-genai package imported (NEW API)")

    if GEMINI_API_KEY and len(GEMINI_API_KEY) > 10:
        # New API uses Client()
        llm_client = genai.Client(api_key=GEMINI_API_KEY)

        # Test with available models
        model_names = [
            'gemini-2.5-flash-lite'
        ]

        working_model = None
        for model_name in model_names:
            try:
                logger.info(f"Testing model: {model_name}")
                test_response = llm_client.models.generate_content(
                    model=model_name,
                    contents="Say OK"
                )
                logger.info(f"✓ Model '{model_name}' works!")
                working_model = model_name
                GEMINI_AVAILABLE = True
                break
            except Exception as model_error:
                logger.warning(f"✗ Model '{model_name}' failed: {str(model_error)[:100]}")
                continue

        if working_model:
            logger.info(f"✓ Gemini AI Ready with model: {working_model}")
        else:
            logger.error("✗ No working Gemini models found")
    else:
        logger.warning(f"⚠ Gemini API Key issue - Length: {len(GEMINI_API_KEY)}")
except ImportError as e:
    logger.warning(f"⚠ google-genai package not found: {e}")
    logger.warning("   Install with: pip install google-genai")
except Exception as e:
    logger.error(f"✗ Gemini initialization failed: {e}")

app = FastAPI(title="Dopamine Defense API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Models with better error handling
model_data = {}
MODEL_LOADED = False

try:
    model_data['model'] = joblib.load('tiktok_voting_model.pkl')
    model_data['scaler'] = joblib.load('tiktok_scaler.pkl')
    model_data['robust_thresh'] = joblib.load('robust_threshold.pkl')
    model_data['decision_thresh'] = joblib.load('decision_threshold.pkl')
    MODEL_LOADED = True
    logger.info("✓ ML Models Loaded Successfully")
except FileNotFoundError as e:
    logger.warning(f"⚠ Model files not found: {e}. Using fallback values.")
    model_data['robust_thresh'] = 250
    model_data['decision_thresh'] = 0.5
except Exception as e:
    logger.error(f"✗ Model loading error: {e}")
    model_data['robust_thresh'] = 250
    model_data['decision_thresh'] = 0.5


@app.get("/", response_class=HTMLResponse)
async def read_root():
    try:
        with open("index.html", "r", encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        return "<h1>Error: index.html not found in current directory.</h1>"


@app.get("/health")
async def health_check():
    """Health check endpoint to verify API status"""
    return {
        "status": "healthy",
        "gemini_available": GEMINI_AVAILABLE,
        "model_loaded": MODEL_LOADED,
        "api_key_configured": bool(GEMINI_API_KEY),
        "timestamp": datetime.now().isoformat()
    }


@app.post("/analyze")
async def analyze_file(file: UploadFile = File(...)):
    try:
        # Read file content
        content = await file.read()
        content_str = content.decode('utf-8', errors='ignore')

        # 0. GET CURRENT LOCAL CONTEXT
        now_utc = pd.Timestamp.now(tz='UTC')
        now_local = now_utc.tz_convert(TIMEZONE)
        today_name = now_local.day_name()
        tomorrow_name = (now_local + pd.Timedelta(days=1)).day_name()

        # 1. PARSE TIMESTAMPS
        matches = re.findall(r"Date:\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})\s*UTC", content_str)
        if not matches:
            raise HTTPException(400, "Invalid file format. No UTC timestamps found in file.")

        logger.info(f"Parsed {len(matches)} events from uploaded file")

        df = pd.DataFrame(matches, columns=['timestamp'])
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df['local_time'] = df['timestamp'].dt.tz_localize('UTC').dt.tz_convert(TIMEZONE)

        # 2. FEATURE ENGINEERING
        df['date'] = df['local_time'].dt.date
        df['hour'] = df['local_time'].dt.hour
        df['day_of_week'] = df['local_time'].dt.dayofweek  # 0=Mon, 6=Sun
        df['is_weekend'] = df['day_of_week'] >= 5

        df['is_sleep_sabotage'] = df['hour'].isin([2, 3, 4, 5, 6, 7])
        df['is_work_sabotage'] = (~df['is_weekend']) & (df['hour'].between(9, 18))

        # Daily Aggregation
        daily = df.groupby('date').agg(
            total_clicks=('timestamp', 'count'),
            late_night_clicks=('is_sleep_sabotage', 'sum'),
            work_hour_clicks=('is_work_sabotage', 'sum'),
            morning_clicks=('hour', lambda x: x.isin([7, 8, 9, 10]).sum())
        ).reset_index()
        daily['day_of_week'] = pd.to_datetime(daily['date']).dt.dayofweek

        # Scoring Algorithm
        def calculate_score(row):
            sleep_penalty = row['late_night_clicks'] * 3.0
            if row['day_of_week'] >= 5:
                return sleep_penalty + (row['total_clicks'] * 0.2)
            else:
                return sleep_penalty + (row['work_hour_clicks'] * 2.0) + (row['total_clicks'] * 0.05)

        daily['raw_score'] = daily.apply(calculate_score, axis=1)

        # Smoothing with outlier capping
        cap = daily['raw_score'].quantile(0.95)
        daily['smoothed'] = np.where(daily['raw_score'] > cap, cap, daily['raw_score'])
        daily['smoothed'] = daily['smoothed'].ewm(span=3).mean()
        daily['is_bad'] = (daily['smoothed'] >= model_data.get('robust_thresh', 250)).astype(int)

        # 3. RISK PREDICTION
        risk_score = 0.5  # Default fallback
        if MODEL_LOADED and 'model' in model_data:
            try:
                last = daily.iloc[-1]
                volatility = daily['smoothed'].rolling(5).std().iloc[-1]
                if pd.isna(volatility):
                    volatility = 0

                # Predict tomorrow's risk
                X_new = pd.DataFrame([[
                    (last['day_of_week'] + 1) % 7,
                    last['smoothed'],
                    daily['morning_clicks'].mean(),
                    volatility
                ]], columns=['day_of_week', 'prev_score', 'morning_clicks', 'volatility'])

                risk_score = float(model_data['model'].predict_proba(
                    model_data['scaler'].transform(X_new)
                )[0][1])
                logger.info(f"Predicted risk score: {risk_score:.3f}")
            except Exception as e:
                logger.error(f"Prediction error: {e}")
                risk_score = 0.5

        # 4. PREPARE CHART DATA

        # A. Heatmap Matrix (7 days × 24 hours)
        heatmap_df = df.groupby(['day_of_week', 'hour']).size().unstack(fill_value=0)
        heatmap_df = heatmap_df.reindex(index=range(7), columns=range(24), fill_value=0)
        z_matrix = heatmap_df.values.tolist()

        # B. Radar Chart (Average score per weekday)
        radar_stats = daily.groupby('day_of_week')['smoothed'].mean()
        radar_stats = radar_stats.reindex(range(7), fill_value=0).tolist()

        # C. Statistics for AI prompt
        bad_ratio = daily['is_bad'].mean()
        worst_day = int(np.argmax(radar_stats))
        total_events = len(df)
        avg_daily = daily['total_clicks'].mean()
        peak_hour = df['hour'].mode()[0] if len(df) > 0 else 0

        # 5. GEMINI AI RECOMMENDATION
        ai_recommendation = "🤖 AI strategist is currently unavailable. Check your API key configuration."

        if GEMINI_AVAILABLE and llm_client:
            try:
                day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

                prompt = f"""You are a social media behavioral addiction analyst. Analyze this TikTok usage data:

📊 KEY METRICS:
- Total Events Tracked: {total_events}
- Average Daily Usage: {avg_daily:.1f} events
- Unproductive Days: {bad_ratio:.1%}
- Tomorrow's Relapse Risk: {risk_score:.1%}
- Most Vulnerable Day: {day_names[worst_day]}
- Peak Usage Hour: {peak_hour}:00
- **Current Time**: {now_local.strftime('%Y-%m-%d %H:%M')} ({today_name})
- **Prediction Target**: {tomorrow_name}

TASK: Provide a clinical yet actionable assessment in exactly 3 parts:
**Pattern Recognition** 
The most concerning behavioral pattern (1 sentence)
**Risk Factor**
Why tomorrow is specifically risky (1 sentence)
**Intervention**
One concrete action for the next 24 hours (1 sentence)

Be direct and evidence-based. Maximum 60 words total."""

                logger.info("Sending request to Gemini API (NEW)...")

                # Use NEW API syntax
                response = llm_client.models.generate_content(
                    model='gemini-2.5-flash-lite',  # Try latest model first
                    contents=prompt
                )

                if response and hasattr(response, 'text') and response.text:
                    ai_recommendation = response.text.strip()
                    logger.info(f"✓ Gemini response received ({len(ai_recommendation)} chars)")
                else:
                    logger.warning("Gemini returned empty response")
                    ai_recommendation = "⚠️ AI analysis returned empty response. This may be a temporary API issue."

            except Exception as e:
                logger.error(f"Gemini API error: {type(e).__name__}: {str(e)}")

                # Try fallback model if first fails
                try:
                    logger.info("Trying fallback model: gemini-1.5-flash")
                    response = llm_client.models.generate_content(
                        model='gemini-2.5-flash',
                        contents=prompt
                    )
                    if response and response.text:
                        ai_recommendation = response.text.strip()
                        logger.info("✓ Fallback model succeeded")
                    else:
                        raise Exception("Fallback returned empty")
                except Exception as fallback_error:
                    logger.error(f"Fallback also failed: {fallback_error}")

                    # Provide specific error messages
                    if "429" in str(e):
                        ai_recommendation = "⚠️ Rate limit exceeded. Please wait a moment and try again."
                    elif "quota" in str(e).lower():
                        ai_recommendation = "⚠️ API quota exceeded. Check your Gemini API usage at https://aistudio.google.com"
                    elif "api_key" in str(e).lower() or "401" in str(e):
                        ai_recommendation = "⚠️ Invalid API key. Please verify your GEMINI_API_KEY in .env file."
                    elif "404" in str(e):
                        ai_recommendation = f"⚠️ Model not found. Error: {str(e)[:200]}"
                    else:
                        ai_recommendation = f"⚠️ AI analysis failed: {str(e)[:150]}"
        else:
            # Fallback rule-based recommendation when Gemini is unavailable
            day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

            if risk_score > 0.6:
                ai_recommendation = f"""**1. Pattern Recognition** Your usage shows critical addiction markers with {bad_ratio:.0%} unproductive days and peak activity at {peak_hour}:00.

**2. Risk Factor** Tomorrow ({tomorrow_name}) has {risk_score:.0%} relapse probability based on historical patterns and current local date ({today_name}).

**3. Intervention** Close the TikTok app tonight and replace it with a 30-minute walk or hobby activity during your peak usage hour."""
            elif risk_score > 0.3:
                ai_recommendation = f"""**1. Pattern Recognition** Moderate addiction pattern detected with elevated usage on {day_names[worst_day]}s and during hour {peak_hour}.

**2. Risk Factor** Tomorrow is ({tomorrow_name}), shows {risk_score:.0%} risk based on weekly patterns and recent behavior trends.

**3. Intervention** Set a 15-minute timer before opening TikTok tomorrow, and use website blockers during work hours."""
            else:
                ai_recommendation = f"""**1. Pattern Recognition** Controlled usage pattern with {bad_ratio:.0%} problematic days, showing good self-regulation.

**2. Risk Factor** Tomorrow has low risk ({risk_score:.0%}), but maintain awareness during peak hour ({peak_hour}:00).

**3. Intervention** Continue current habits and track weekly patterns to prevent regression."""

        # 6. RETURN COMPLETE ANALYSIS
        return {
            "status": "success",
            "forecast": {
                "risk_score": round(risk_score, 4),
                "risk_level": "high" if risk_score > 0.6 else ("medium" if risk_score > 0.3 else "low")
            },
            "statistics": {
                "total_events": total_events,
                "date_range": {
                    "start": str(daily['date'].min()),
                    "end": str(daily['date'].max())
                },
                "bad_days": int(daily['is_bad'].sum()),
                "bad_ratio": round(bad_ratio, 3)
            },
            "charts": {
                "dates": daily['date'].astype(str).tolist(),
                "scores": [round(x, 2) for x in daily['smoothed'].tolist()],
                "threshold": float(model_data.get('robust_thresh', 250)),
                "heatmap_z": z_matrix,
                "radar_values": [round(x, 2) for x in radar_stats]
            },
            "gemini": ai_recommendation,
            "metadata": {
                "gemini_available": GEMINI_AVAILABLE,
                "model_loaded": MODEL_LOADED,
                "analyzed_at": datetime.now().isoformat()
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Critical analysis error: {e}", exc_info=True)
        raise HTTPException(500, f"Analysis failed: {str(e)}")


if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("🧠 DOPAMINE DEFENSE API SERVER")
    print("=" * 50)
    print(f"Gemini AI: {'✓ Enabled' if GEMINI_AVAILABLE else '✗ Disabled'}")
    print(f"ML Models: {'✓ Loaded' if MODEL_LOADED else '✗ Using Defaults'}")
    print("=" * 50 + "\n")

    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")