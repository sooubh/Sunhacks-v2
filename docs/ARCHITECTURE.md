# Architecture Documentation

## 1) System Architecture Overview

The application follows a **frontend-backend split** with event-driven updates:

1. User interacts with React dashboard.
2. Frontend calls FastAPI endpoints.
3. Backend orchestrates multi-stage OSINT pipeline.
4. Pipeline stage events stream back to frontend via SSE.
5. Final structured result updates charts, alerts, and report panels.

---

## 2) Logical Components

### Client Layer (Frontend)
- UI pages for command center, alerts, pipeline visualization, and logs.
- Centralized state store (Zustand).
- API adapter layer that normalizes backend payloads.

### API Layer (FastAPI)
- Exposes health, source introspection, sync run, and stream run endpoints.
- Performs request validation and response shaping through Pydantic models.

### Intelligence Processing Layer
- `PipelineOrchestrator` controls deterministic stage progression.
- Collectors gather multi-source OSINT signals.
- Scoring/classification functions compute risk intelligence.
- Reporter builds readable operational briefing text.

---

## 3) Detailed Request Flow

### Synchronous flow (`POST /api/realtime/topic`)
- Request: `{ topic, max_items }`
- Orchestrator executes all stages in-process.
- Response: full `TopicResult` object.

### Streaming flow (`GET /api/realtime/stream`)
- Query params: `topic`, `max_items`
- Emits SSE events:
  - `stage` for intermediate stage progress
  - `result` with final payload
  - `error` if exception occurs

Frontend subscribes with `EventSource`, incrementally updates stage cards, and finalizes state on `result`.

---

## 4) Data Model Architecture

### Core domain entities
- `SourceSignal` (raw collected signal)
- `PipelineStage` (status/telemetry of each processing stage)
- `AlertOut` (fully enriched alert record)
- `TopicResult` (top-level response envelope)

### Mapping boundary
Backend uses snake_case fields.
Frontend maps into camelCase UI models for React ergonomics.

---

## 5) Pipeline Internal Design

### Stage sequence
`collector -> cleaner -> analyzer -> predictor -> reporter`

### Stage responsibilities
- **Collector**: fetch and normalize source items.
- **Cleaner**: deduplicate similar entries.
- **Analyzer**: infer semantics (category/sentiment/location/keywords).
- **Predictor**: assign risk, confidence, impact, escalation, recommendations.
- **Reporter**: synthesize human-readable intelligence briefing.

### Determinism and observability
- Stage execution time measured in milliseconds.
- Items processed tracked per stage.
- `last_run` timestamp captured for each stage.

---

## 6) Reliability and Fault Handling

- Backend wraps run failures with HTTP 500 and error detail.
- SSE stream emits `error` event payloads upon failures.
- Frontend has fallback behavior to preserve UX when backend or keys are unavailable.

---

## 7) Security and Ops Notes (Current State)

- CORS controlled via environment settings.
- API keys loaded from environment variables.
- No persistent auth/token session enforcement in backend endpoints yet.
- No database persistence layer currently represented.

This is suitable for prototype/demo mode and can be hardened for production later.

---

## 8) Architecture Evolution Path

1. Introduce persistence (alerts, runs, audit logs).
2. Split orchestrator stages into queue-based worker jobs.
3. Add source quality scoring with feedback loop.
4. Introduce model registry for multiple classifier versions.
5. Add RBAC and API auth enforcement.
