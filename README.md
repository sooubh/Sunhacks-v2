# Sunhacks-v2: LEIS Realtime OSINT Intelligence Platform

Sunhacks-v2 is a full-stack intelligence dashboard that collects open-source signals (news APIs, RSS feeds, web search, and scraping), scores their risk, and shows explainable alerts in a command center UI.

This documentation is written for both technical and non-technical readers. If you are new to intelligence tooling, start with the glossary:
- [docs/GLOSSARY.md](docs/GLOSSARY.md)

## What This Project Does

In simple terms:
- It gathers public information related to a topic (example: "Delhi protest traffic unrest").
- It cleans and de-duplicates that information.
- It classifies each signal by category, sentiment, location, and risk.
- It generates operational alerts with confidence and recommended actions.
- It produces a report using Gemini when available, with a fallback summary when Gemini is unavailable.

## System Overview

The project has two main apps:
- `backend/`: FastAPI service that runs the OSINT collection and analysis pipeline.
- `frontend/`: React + TypeScript dashboard for command center, alerts, pipeline status, and audit logs.

High-level flow:
1. User enters a query in the frontend.
2. Frontend calls backend API (`POST /api/realtime/topic`) or SSE stream (`GET /api/realtime/stream`).
3. Backend pipeline runs 5 stages: collector, cleaner, analyzer, predictor, reporter.
4. Backend returns structured alerts and a report.
5. Frontend renders explainable alert cards and operational dashboard stats.

## Quick Start (Local, No Docker)

## Prerequisites

- Python 3.10+
- Node.js 18+ (Node.js 20 LTS recommended)
- npm 9+
- Windows PowerShell (commands below are PowerShell-friendly)

## 1) Start Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

Backend health check:
- Open `http://127.0.0.1:8000/health`

## 2) Start Frontend

Open a second terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Frontend URL:
- `http://127.0.0.1:5173`

## 3) Minimal API Key Setup

Backend can run with partial keys.

Minimum useful setup in `backend/.env`:
- One of: `NEWSAPI_KEY` or `TAVILY_API_KEY`
- Optional but recommended: `GEMINI_API_KEY`

Even with no external API keys, RSS sources can still provide signals.

For full key setup details:
- [backend/API_KEYS_GUIDE.md](backend/API_KEYS_GUIDE.md)

## Main API Endpoints

- `GET /health`
- `GET /api/realtime/sources`
- `POST /api/realtime/topic`
- `GET /api/realtime/stream?topic=...&max_items=...` (Server-Sent Events)

Detailed endpoint docs:
- [docs/API_REFERENCE.md](docs/API_REFERENCE.md)

## Frontend Pages

- `/login`: Mock sign-in page (currently simulated auth flow).
- `/dashboard`: Command center stats and charts.
- `/alerts`: Explainable alerts with evidence and actions.
- `/pipeline`: Live stage-by-stage pipeline visualization.
- `/audit`: Searchable audit logs with CSV export.

## Documentation Index

- [docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md) - Full architecture and behavior
- [docs/SETUP_AND_RUN.md](docs/SETUP_AND_RUN.md) - Step-by-step local setup and troubleshooting
- [docs/API_REFERENCE.md](docs/API_REFERENCE.md) - Endpoint request/response reference
- [docs/GLOSSARY.md](docs/GLOSSARY.md) - Plain-language definitions of project terms
- [backend/README.md](backend/README.md) - Backend-specific quick guide
- [frontend/README.md](frontend/README.md) - Frontend-specific guide

## Repository Structure

```text
backend/
  app/
    main.py                # FastAPI app and routes
    config.py              # env-backed settings
    models.py              # Pydantic request/response models
    services/
      collectors.py        # OSINT source collection
      orchestrator.py      # 5-stage pipeline control
      scoring.py           # risk/category/confidence heuristics
      crew_pipeline.py     # Gemini/fallback report generation
frontend/
  src/
    pages/                 # Dashboard screens
    components/            # Reusable UI components
    services/realtimeApi.ts# Backend API client + SSE handling
    store/useAppStore.ts   # Central application state (Zustand)
docs/
  PROJECT_DOCUMENTATION.md
  SETUP_AND_RUN.md
  API_REFERENCE.md
  GLOSSARY.md
```

## Current Implementation Notes

- Login currently uses simulated authentication in frontend state.
- Backend analysis is heuristic + source-driven; it is not a guaranteed truth engine.
- Gemini report generation automatically falls back to deterministic mode when unavailable.
- CORS is configurable with `CORS_ALLOW_ORIGINS` in backend env.

## License and Use

Before production use, review legal/compliance requirements for your jurisdiction, especially around source usage, data retention, and operational decision policies.
