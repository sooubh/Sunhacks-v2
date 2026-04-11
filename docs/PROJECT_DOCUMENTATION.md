# Sunhacks-v2 Final Project Documentation

Last updated: 2026-04-11  
Status: Final detailed documentation for the current repository implementation.

## 1) Executive Summary

Sunhacks-v2 is a local-first, full-stack OSINT monitoring platform for rapid situational awareness.

At runtime, the system:
- collects open-source signals from API-backed sources,
- processes them through a five-stage intelligence pipeline,
- produces explainable alerts (risk, confidence, impact, evidence, actions),
- generates an operational report using configurable AI providers with deterministic fallback,
- streams stage-by-stage progress to the frontend in realtime.

The product is optimized for demo and hackathon workflows while preserving clean extension points for production hardening.

## 2) Goals and Non-Goals

### Goals
- Turn noisy public data into prioritized, explainable intelligence alerts.
- Provide realtime analyst visibility into pipeline progression.
- Preserve graceful fallback behavior when external AI or source integrations fail.
- Keep local setup fast and simple (non-Docker workflow).

### Non-Goals (Current Scope)
- No guaranteed fact-verification engine.
- No persistent backend database for canonical alert history.
- No finalized enterprise authentication and authorization model.

## 3) System Architecture

### 3.1 High-Level Components

- Frontend: React + TypeScript dashboard in frontend/src.
- Backend: FastAPI API service in backend/app.
- Pipeline engine: orchestrator + collector + scoring + reporter services.
- Optional persistence: frontend writes selected run artifacts to Firestore.

### 3.2 End-to-End Flow

1. User enters topic and city scope from the frontend UI.
2. Frontend triggers either:
   - synchronous run: POST /api/realtime/topic
   - streaming run: GET /api/realtime/stream (SSE)
3. Backend orchestrator executes stages:
   - collector -> cleaner -> analyzer -> predictor -> reporter
4. Backend returns TopicResult with stages, alerts, report, and metadata.
5. Frontend maps backend snake_case fields into camelCase UI models and updates dashboard, cards, logs, and report panes.

## 4) Backend Architecture

### 4.1 API Entry Points

Primary app: backend/app/main.py

Exposed endpoints:
- GET /health
- GET /api/realtime/sources
- POST /api/realtime/topic
- GET /api/realtime/stream
- POST /api/voice/assistant
- WS /ws/voice/live

Important behavior:
- CORS is controlled by CORS_ALLOW_ORIGINS.
- Stream endpoint emits event names: stage, result, error.
- Errors are logged and returned as structured HTTP or stream payloads.

### 4.2 Configuration Model

Config implementation: backend/app/config.py

Settings include:
- Source API keys: TAVILY_API_KEY, NEWSAPI_KEY, NEWSDATA_API_KEY, GNEWS_API_KEY
- AI keys/models: GEMINI_API_KEY, GEMINI_MODEL, GEMINI_LIVE_MODEL
- AI routing: AI_REASONING_PROVIDER_ORDER, OLLAMA_* settings
- Runtime behavior: REQUEST_TIMEOUT_SECONDS, TAVILY_RECENT_DAYS
- CORS and source defaults: CORS_ALLOW_ORIGINS, RSS_FEEDS, WEB_SCRAPER_URLS

Defaults are loaded from backend/.env plus in-code fallback values.

### 4.3 Data Contracts

Core models: backend/app/models.py

Key request and response entities:
- TopicRequest
- TopicResult
- PipelineStage
- AlertOut
- SourceSignal
- VoiceAssistantRequest / VoiceAssistantResponse

Contract notes:
- Stages carry status, processed counts, processing times, and last_run.
- Alerts include evidence, source validity, impact, why_triggered, and recommended_actions.
- TopicResult.meta stores execution diagnostics and AI provider outcome.

### 4.4 Pipeline Orchestration

Implementation: backend/app/services/orchestrator.py

Stage responsibilities:
1. collector: fetch raw source signals
2. cleaner: de-duplicate records
3. analyzer: infer category/sentiment/location/keywords/confidence
4. predictor: compute risk, escalation, impact, actions, and build alerts
5. reporter: generate final report text

Output behavior:
- Alerts are ranked by risk then confidence.
- Up to 30 top alerts are returned.
- If fewer than 8 alerts are produced and a city is known, continuity alerts are synthesized to maintain operational signal continuity.

### 4.5 Collection Layer

Implementation: backend/app/services/collectors.py

Currently active in collect():
- NewsAPI
- NewsData.io
- GNews
- Tavily

Implemented helper collectors (not currently called by collect() default path):
- RSS feeds
- Google News RSS by query
- HTML web scraping

This means API collection is active by default today, while RSS/scraper methods are available for extension.

### 4.6 Scoring and Heuristics

Implementation: backend/app/services/scoring.py

The scoring layer is rule-based and deterministic:
- infer_risk from keyword dictionaries
- infer_category from token rules
- infer_sentiment from sentiment markers
- infer_location from city aliases and fallback city scope
- confidence_score from domain trust + metadata + suspicious markers

Derived labels:
- source_validity: VERIFIED, MIXED, UNVERIFIED
- impact: LOW, MEDIUM, HIGH, CRITICAL
- escalation_probability: integer percentage

### 4.7 Report Generation Strategy

Implementation: backend/app/services/crew_pipeline.py (service name retained; implementation is provider-router logic)

Report provider order is configurable:
- default: ollama -> gemini
- optional: gemini -> ollama
- deterministic fallback if all providers fail

Metadata added to TopicResult.meta includes mode/model/reason diagnostics so UI can explain success vs fallback states.

### 4.8 Voice Assistant Services

#### Dashboard-aware text/voice endpoint

File: backend/app/services/voice_assistant.py  
Route: POST /api/voice/assistant

Behavior:
- attempts Gemini first for smart response generation,
- falls back to deterministic local summary if Gemini is unavailable.

#### Live bidirectional voice websocket

File: backend/app/services/live_voice_ws.py  
Route: WS /ws/voice/live

Behavior:
- establishes Gemini Live session,
- relays PCM16 audio/text between client and model,
- streams ready/audio/text/turn_complete/error messages.

## 5) Frontend Architecture

### 5.1 Routing and App Shell

Main file: frontend/src/App.tsx

Routes:
- /login
- /dashboard
- /alerts
- /pipeline
- /audit

Protected views use a private route wrapper based on isAuthenticated state.

### 5.2 State Management

Store: frontend/src/store/useAppStore.ts

Centralized state includes:
- user/auth session
- alerts and filters
- dashboard stats
- pipeline stage telemetry
- voice UI state
- report metadata and activity feed
- auto-monitor cycle state

Key actions:
- triggerCollect(): sync topic run
- runPipeline(): SSE streaming run
- runAutoAgentCycle(): periodic city monitoring cycle
- resolveAlert()/updateAlertStatus(): local + Firestore update behavior

### 5.3 API Mapping Layer

Client mapper: frontend/src/services/realtimeApi.ts

Responsibilities:
- calls backend APIs and stream endpoints,
- maps backend snake_case to frontend camelCase,
- normalizes dates and typed enums,
- surfaces AI mode diagnostics in logs and UI state.

### 5.4 Voice UX

Main component: frontend/src/components/VoiceAssistantDialog.tsx

Capabilities:
- Smart Chat mode (context-rich textual response flow)
- Direct Voice mode (live websocket audio flow)
- local speech synthesis playback
- local fallback summaries when live AI channels are unavailable

### 5.5 Persistence Integration

Service: frontend/src/services/firebaseDataService.ts

Writes to Firestore collections:
- pipeline_runs
- alerts
- dashboard_snapshots
- voice_transcripts

Auth behavior in UI:
- tries Firebase email/password and Google sign-in,
- supports demo fallback accounts for offline/demo reliability.

## 6) Runtime Modes and Failure Handling

### 6.1 Report generation modes

Common meta.mode values:
- ollama
- gemini
- fallback
- empty

### 6.2 Reliability patterns

- Missing API keys degrade gracefully to available sources.
- AI provider routing retries model candidates and falls back deterministically.
- SSE streams emit explicit error events on failure.
- Frontend triggerCollect falls back to mock alerts if backend run fails.

## 7) Configuration Reference

Backend environment file: backend/.env

Core keys:
- TAVILY_API_KEY
- NEWSAPI_KEY
- NEWSDATA_API_KEY
- GNEWS_API_KEY
- GEMINI_API_KEY
- GEMINI_MODEL
- GEMINI_LIVE_MODEL
- AI_REASONING_PROVIDER_ORDER
- OLLAMA_ENABLED
- OLLAMA_BASE_URL
- OLLAMA_ROUTE
- OLLAMA_LLAMA_MODEL
- OLLAMA_MISTRAL_MODEL
- OLLAMA_REQUEST_TIMEOUT_SECONDS
- CORS_ALLOW_ORIGINS
- REQUEST_TIMEOUT_SECONDS
- TAVILY_RECENT_DAYS

Frontend environment file: frontend/.env

Core key:
- VITE_BACKEND_URL

## 8) Local Runbook (No Docker)

Backend:
1. cd backend
2. python -m venv .venv
3. .\.venv\Scripts\Activate.ps1
4. pip install -r requirements.txt
5. Copy-Item .env.example .env
6. uvicorn app.main:app --reload --port 8000

Frontend (new terminal):
1. cd frontend
2. npm install
3. Copy-Item .env.example .env
4. npm run dev

Health checks:
- GET http://127.0.0.1:8000/health
- Open frontend at http://127.0.0.1:5173

## 9) Security and Compliance Notes

Current state:
- API keys are environment-based.
- CORS is configurable.
- Frontend includes demo-friendly auth fallback.
- Firestore persistence is enabled from frontend services.

Production hardening recommendations:
- enforce backend auth and role-based authorization,
- move all sensitive runtime config to secure secret management,
- add server-side audit persistence and immutable logs,
- apply formal source compliance and retention policy review.

## 10) Known Limitations

- Scoring is heuristic, not model-trained classification.
- Collector default path currently uses API collectors only.
- No canonical backend relational/document database for long-term run history.
- Voice and report quality depends on external provider/runtime availability.

## 11) Extension Roadmap

- Enable and tune RSS/scraper collection paths in default collector strategy.
- Add persistence-backed incident history and query APIs.
- Introduce RBAC, signed sessions, and backend authorization middleware.
- Add analyst feedback loop for confidence/risk calibration.
- Expand multilingual extraction and richer geospatial intelligence overlays.

## 12) Related Documentation

- docs/API_REFERENCE.md
- docs/SETUP_AND_RUN.md
- docs/ARCHITECTURE.md
- docs/TECH_STACK.md
- docs/PROJECT_STRUCTURE.md
- docs/PROJECT_INFORMATION.md
