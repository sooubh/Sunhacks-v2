# Setup and Run Guide (Local Development)

This guide covers complete local setup without Docker.

## 1) Prerequisites

Required:
- Python 3.10+
- Node.js 18+ (Node.js 20 LTS recommended)
- npm 9+
- Internet access for API-backed collectors

Optional but recommended:
- News/data provider API keys
- Gemini API key for LLM briefing mode

## 2) Clone and Open

From your project root, you should have:

```text
backend/
frontend/
```

## 3) Backend Setup

Run in PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Start backend:

```powershell
uvicorn app.main:app --reload --port 8000
```

Verify:
- Open `http://127.0.0.1:8000/health`

## 4) Backend Environment Variables

File:
- `backend/.env`

Main variables:
- `TAVILY_API_KEY`: Tavily search integration key.
- `NEWSAPI_KEY`: NewsAPI integration key.
- `NEWSDATA_API_KEY`: NewsData.io integration key.
- `GNEWS_API_KEY`: GNews integration key.
- `TAVILY_RECENT_DAYS`: recency window for Tavily news mode.
- `GEMINI_API_KEY`: enables Gemini report generation.
- `GEMINI_MODEL`: preferred Gemini model, default `gemini-flash-latest`.
- `CORS_ALLOW_ORIGINS`: comma-separated frontend origins or `*`.
- `REQUEST_TIMEOUT_SECONDS`: timeout for external HTTP calls.
- `RSS_FEEDS`: comma-separated RSS feed URLs.
- `WEB_SCRAPER_URLS`: optional comma-separated website URLs for scraping.

Notes:
- You can run with partial keys; missing sources are skipped.
- RSS defaults exist even if no key is provided.
- Gemini automatically falls back if key/sdk/runtime fails.

## 5) Frontend Setup

Open a new terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Default frontend URL:
- `http://127.0.0.1:5173`

## 6) Frontend Environment Variables

File:
- `frontend/.env`

Variable:
- `VITE_BACKEND_URL=http://127.0.0.1:8000`

If backend runs elsewhere, update this value accordingly.

## 7) First Run Walkthrough

1. Open frontend at `http://127.0.0.1:5173`.
2. Use login form (demo simulated auth flow).
3. Navigate to Command Center.
4. Click `Collect Intelligence` to trigger sync topic run.
5. Navigate to AI Pipeline and click `Run Full Pipeline` to observe stage streaming.
6. Open Alerts System to inspect explainable alert cards.

## 8) API Smoke Tests

Health:

```powershell
curl http://127.0.0.1:8000/health
```

Topic run:

```powershell
curl -X POST http://127.0.0.1:8000/api/realtime/topic -H "Content-Type: application/json" -d "{\"topic\":\"mumbai protest traffic unrest\",\"max_items\":20}"
```

Stream run:

```powershell
curl "http://127.0.0.1:8000/api/realtime/stream?topic=mumbai+protest&max_items=20"
```

## 9) Common Troubleshooting

Backend fails to start:
- Confirm virtual environment is activated.
- Confirm dependencies installed from `requirements.txt`.
- Check syntax or import errors in terminal logs.

Frontend cannot reach backend:
- Verify backend is running on configured host/port.
- Check `frontend/.env` value for `VITE_BACKEND_URL`.
- Ensure backend CORS allows frontend origin.

No Gemini report:
- Check `GEMINI_API_KEY` in backend env.
- Confirm `google-genai` installed.
- Review backend logs for fallback reason in `meta.reason`.

No/low alert volume:
- Add at least one news/search API key.
- Increase `max_items` for test run.
- Try broader topic keywords.

Scraper returns little data:
- External site HTML structure may have changed.
- Update `WEB_SCRAPER_URLS` to stable content pages.

## 10) Development Commands Summary

Backend:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

Frontend:

```powershell
cd frontend
npm run dev
```

## 11) Production Readiness Checklist (Recommended)

Before production deployment, implement:
- Real authentication and role-based authorization
- Persistent alert/audit storage
- Structured secrets management
- Monitoring and alerting for upstream source failures
- Legal/compliance review for data handling and retention
