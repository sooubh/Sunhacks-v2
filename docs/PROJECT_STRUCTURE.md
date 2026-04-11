# Project Structure Documentation

This repository is organized as a full-stack realtime OSINT platform with clear separation between frontend, backend, and docs.

## 1) Top-Level Layout

```text
Sunhacks-v2/
├── backend/
│   ├── app/
│   │   ├── services/
│   │   ├── cities.py
│   │   ├── config.py
│   │   ├── main.py
│   │   └── models.py
│   ├── API_KEYS_GUIDE.md
│   ├── requirements.txt
│   └── README.md
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── config/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── store/
│   │   └── types/
│   ├── package.json
│   └── README.md
├── docs/
│   ├── API_REFERENCE.md
│   ├── ARCHITECTURE.md
│   ├── GLOSSARY.md
│   ├── PROJECT_DETAILS.md
│   ├── PROJECT_DOCUMENTATION.md
│   ├── PROJECT_INFORMATION.md
│   ├── PROJECT_STRUCTURE.md
│   ├── SETUP_AND_RUN.md
│   └── TECH_STACK.md
└── README.md
```

## 2) Backend Breakdown

### backend/app/main.py
- FastAPI app bootstrap and middleware setup
- Route registration for health, topic runs, stream runs, voice assistant, and live voice websocket
- Wiring of pipeline orchestrator and service dependencies

### backend/app/config.py
- Environment-backed settings model
- API key, model, timeout, CORS, and collector defaults
- AI provider-order selection logic

### backend/app/models.py
- Pydantic contracts for requests, responses, stages, alerts, and voice payloads

### backend/app/cities.py
- Shared city scope aliases and normalization helpers

### backend/app/services/collectors.py
- Source collection adapters and helper parsers
- Active default collection path currently uses API collectors

### backend/app/services/scoring.py
- Rule-based risk/category/sentiment/location/confidence heuristics

### backend/app/services/orchestrator.py
- Five-stage pipeline execution and result assembly
- Stage telemetry emission for streaming endpoint

### backend/app/services/crew_pipeline.py
- Report generation router (Ollama/Gemini/fallback)

### backend/app/services/voice_assistant.py
- Dashboard-aware smart assistant response generation

### backend/app/services/live_voice_ws.py
- Gemini live voice websocket relay implementation

## 3) Frontend Breakdown

### frontend/src/App.tsx
- App routes and private-route wrapper

### frontend/src/store/useAppStore.ts
- Zustand global state for auth, alerts, dashboard, pipeline, and auto-monitoring

### frontend/src/services/realtimeApi.ts
- Backend API client for sync, stream, and voice endpoints
- snake_case to camelCase mapping boundary

### frontend/src/services/liveVoiceSession.ts
- Browser-side live voice websocket/audio helpers

### frontend/src/services/firebaseDataService.ts
- Firestore persistence helpers for runs, alerts, snapshots, and transcripts

### frontend/src/components/
- UI modules for layout, alert explainability, mapping, and voice assistant dialog

### frontend/src/pages/
- Login, dashboard, alerts system, pipeline visualization, and audit pages

## 4) Documentation Folder Purpose

The docs folder is intentionally split by concern:
- PROJECT_DOCUMENTATION.md: canonical deep technical documentation
- API_REFERENCE.md: endpoint contracts and examples
- SETUP_AND_RUN.md: local setup and troubleshooting
- TECH_STACK.md: dependency and protocol overview
- PROJECT_INFORMATION.md: product-level context and roadmap

## 5) Ownership Guidance

- Frontend contributors: frontend/src
- Backend contributors: backend/app
- Documentation contributors: docs

This ownership split supports parallel work with lower merge-conflict risk.
