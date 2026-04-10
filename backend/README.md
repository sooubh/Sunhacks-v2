# Backend: LEIS Realtime Agent API

This backend provides the realtime OSINT pipeline and API consumed by the frontend command center.

Pipeline stages:
- Collector: gathers signals from NewsAPI, NewsData, GNews, Tavily, RSS, Google News RSS, and web scraping.
- Cleaner: removes duplicate/noisy records.
- Analyzer: infers category, sentiment, keywords, and location.
- Predictor: computes risk, confidence, impact, escalation, and actions.
- Reporter: generates final intelligence briefing with Ollama-first reasoning, Gemini fallback, then deterministic fallback.

## Install

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

## Environment Keys

In `backend/.env`, fill keys as available:
- `TAVILY_API_KEY`
- `NEWSAPI_KEY`
- `NEWSDATA_API_KEY`
- `GNEWS_API_KEY`
- `GEMINI_API_KEY`

Useful options:
- `TAVILY_RECENT_DAYS` (default `3`)
- `GEMINI_MODEL` (default `gemini-flash-latest`)
- `GEMINI_LIVE_MODEL` (default `models/gemini-3.1-flash-live-preview`)
- `AI_REASONING_PROVIDER_ORDER` (`ollama_first` or `gemini_first`, default `ollama_first`)
- `OLLAMA_ENABLED` (default `true`)
- `OLLAMA_BASE_URL` (default `http://127.0.0.1:11434`)
- `OLLAMA_ROUTE` (`fast` uses mistral, any other value uses llama)
- `OLLAMA_LLAMA_MODEL` (default `llama3:8b`)
- `OLLAMA_MISTRAL_MODEL` (default `mistral:7b`)
- `OLLAMA_REQUEST_TIMEOUT_SECONDS` (default `120`)
- `OLLAMA_MODEL` (optional backward-compatible alias for `OLLAMA_LLAMA_MODEL`)
- `CORS_ALLOW_ORIGINS` (default from env template)
- `REQUEST_TIMEOUT_SECONDS`
- `RSS_FEEDS`
- `WEB_SCRAPER_URLS`

Minimum useful setup:
- `NEWSAPI_KEY` or `TAVILY_API_KEY`
- For AI report reasoning, run Ollama (`OLLAMA_ENABLED=true` and reachable `OLLAMA_BASE_URL`)
- For voice assistant with Gemini live model, set `GEMINI_API_KEY`
- RSS can still work without external keys

Live voice websocket notes:
- Endpoint: `ws://127.0.0.1:8000/ws/voice/live`
- First message must be JSON with `type=start` and optional `dashboard_context`
- Audio chunks must be mono PCM16 base64 (`audio/pcm`) at 16kHz input
- Model returns streamed PCM16 audio at 24kHz and optional text chunks

## Run

```powershell
uvicorn app.main:app --reload --port 8000
```

## API Endpoints

- `GET /health`
- `GET /api/realtime/sources`
- `POST /api/realtime/topic`
- `POST /api/voice/assistant`
- `WS /ws/voice/live`
- `GET /api/realtime/stream?topic=...&max_items=...` (SSE)

## Quick Test

```powershell
curl -X POST http://127.0.0.1:8000/api/realtime/topic -H "Content-Type: application/json" -d "{\"topic\":\"mumbai protest traffic unrest\",\"max_items\":20}"
```

## Documentation Links

- `../README.md`
- `../docs/PROJECT_DOCUMENTATION.md`
- `../docs/API_REFERENCE.md`
- `../docs/SETUP_AND_RUN.md`
- `API_KEYS_GUIDE.md`
