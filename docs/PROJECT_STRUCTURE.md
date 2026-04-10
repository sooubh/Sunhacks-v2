# Project Structure Documentation

This repository is organized as a **full-stack realtime OSINT intelligence platform** with two primary apps:

- `frontend/` → React + TypeScript analyst dashboard
- `backend/` → FastAPI + CrewAI intelligence pipeline API

---

## 1) Top-Level Directory Layout

```text
Sunhacks-v2/
├── backend/
│   ├── app/
│   │   ├── services/
│   │   ├── config.py
│   │   ├── main.py
│   │   └── models.py
│   ├── requirements.txt
│   ├── API_KEYS_GUIDE.md
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── config/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── store/
│   │   └── types/
│   ├── public/
│   ├── package.json
│   └── README.md
└── docs/
    ├── PROJECT_STRUCTURE.md
    ├── PROJECT_DETAILS.md
    ├── TECH_STACK.md
    ├── ARCHITECTURE.md
    ├── PROJECT_INFORMATION.md
    └── HACKATHON_PPT_GUIDE.md
```

---

## 2) Backend Folder Breakdown

### `backend/app/main.py`
- FastAPI app bootstrap.
- Configures CORS.
- Registers endpoints (`/health`, `/api/realtime/topic`, `/api/realtime/stream`, etc.).
- Initializes `PipelineOrchestrator` with:
  - `OSINTCollector`
  - `CrewReporter`

### `backend/app/models.py`
Contains all API and domain contracts:
- Request/response schemas (`TopicRequest`, `TopicResult`)
- Pipeline stage model (`PipelineStage`)
- Alert/evidence/entity/source models

### `backend/app/config.py`
- Environment-based settings.
- API key and feature toggles.
- RSS feed and CORS origin configuration.

### `backend/app/services/`
Core processing logic:
- `collectors.py` → source collection adapters (RSS, Tavily, Brave, NewsAPI)
- `orchestrator.py` → end-to-end 5-stage workflow controller
- `scoring.py` → heuristic AI scoring + classification
- `crew_pipeline.py` → CrewAI report generation/fallback report mode

### `backend/requirements.txt`
Python dependency lock surface for backend runtime.

---

## 3) Frontend Folder Breakdown

### `frontend/src/App.tsx`
- Main route tree and auth-gated app shell.
- Maps app routes:
  - `/dashboard`
  - `/alerts`
  - `/pipeline`
  - `/audit`

### `frontend/src/store/useAppStore.ts`
- Global state with Zustand.
- Handles:
  - authentication state
  - alert state and filtering
  - dashboard stats
  - pipeline run + SSE streaming consumption
  - audit logs and latest report text

### `frontend/src/services/realtimeApi.ts`
- Backend API adapter.
- Runs topic via POST endpoint.
- Connects EventSource stream for stage-by-stage pipeline updates.
- Maps backend snake_case payloads to frontend camelCase models.

### `frontend/src/pages/`
Primary user workflows:
- `LoginPage.tsx`
- `CommandCenterPage.tsx`
- `AlertsSystemPage.tsx`
- `PipelineVisualizationPage.tsx`
- `AuditLogsPage.tsx`

### `frontend/src/components/`
Reusable UI widgets (layout, explainable alert card, voice assistant dialog).

### `frontend/src/types/`
Type-safe contracts used across UI state and API mapping.

---

## 4) Documentation Folder Purpose

All documentation requested for this project is centralized in `docs/` and split by topic so each stakeholder can quickly find the right level of detail:

- Structure (how files are organized)
- Details (what the product does)
- Tech stack (what tools are used)
- Architecture (how everything works together)
- Project information (goals, users, status)
- Hackathon PPT guide (pitch-ready content)

---

## 5) Suggested Ownership Model

- **Frontend Team** owns `frontend/src/{pages,components,store,services}`
- **Backend/AI Team** owns `backend/app/{services,models,config,main}`
- **Product/Presentation Team** owns `docs/HACKATHON_PPT_GUIDE.md`

This split helps parallel work during hackathons while minimizing merge conflicts.
