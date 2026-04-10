# LEIS Realtime Agent Backend (Simple)

This backend is intentionally simple and readable.

It provides a realtime OSINT pipeline with these agents:
- Collector Agent: Tavily + Brave + NewsAPI + RSS fetch
- Cleaner Agent: de-duplicate weak/duplicate records
- Analyzer Agent: classify category/sentiment/keywords
- Predictor Agent: risk, confidence, impact, actions
- Reporter Agent (CrewAI): multi-agent intelligence briefing

## 1) Install

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

## 2) Add API keys

Open `.env` and add whichever keys you have.

Minimum useful setup:
- `NEWSAPI_KEY` OR `TAVILY_API_KEY` OR `BRAVE_API_KEY`
- RSS works even without keys

CrewAI summary mode:
- Add `OPENAI_API_KEY` for full CrewAI report generation.
- Without it, backend still works using deterministic fallback summary.

## 3) Run server

```powershell
uvicorn app.main:app --reload --port 8000
```

## 4) Endpoints

- `GET /health`
- `GET /api/realtime/sources`
- `POST /api/realtime/topic`
- `GET /api/realtime/stream?topic=...&max_items=...` (SSE)

## 5) Example request

```bash
curl -X POST http://127.0.0.1:8000/api/realtime/topic \
  -H "Content-Type: application/json" \
  -d "{\"topic\":\"mumbai protest traffic unrest\",\"max_items\":20}"
```
