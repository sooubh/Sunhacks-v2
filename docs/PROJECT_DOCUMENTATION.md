# Project Documentation: Sunhacks-v2 (LEIS Realtime OSINT)

## 1) Purpose and Audience

This document explains the full system architecture and behavior in plain language.

Who this is for:
- Developers who need to maintain or extend the codebase.
- Analysts and operators who need to understand how alerts are produced.
- Judges/reviewers/hackathon evaluators who need a complete technical overview.

What this system is:
- A local-first, full-stack intelligence dashboard for open-source signal monitoring.

What this system is not:
- Not a guaranteed fact checker.
- Not a replacement for human analyst verification.
- Not a social media platform ingestion engine (current collectors focus on APIs, RSS, search, scraping).

## 2) Functional Summary

Core capabilities:
- Topic-based OSINT collection from multiple source types.
- Multi-stage processing pipeline with stage-level status tracking.
- Explainable alert objects with evidence, risk, confidence, and recommended actions.
- Operational report generation using Gemini (or deterministic fallback).
- Realtime UI updates via Server-Sent Events (SSE).

## 3) Architecture Overview

## 3.1 High-Level Components

- Backend: FastAPI service in `backend/app`.
- Frontend: React + TypeScript app in `frontend/src`.
- Data pipeline: 5 logical stages executed in backend orchestrator.

Flow summary:
1. User enters topic in UI.
2. Frontend calls backend sync API or stream API.
3. Backend runs pipeline:
- collector
- cleaner
- analyzer
- predictor
- reporter
4. Backend returns `TopicResult` containing stages, alerts, report, and metadata.
5. Frontend maps backend payload to UI models and updates cards/charts/logs.

## 3.2 Pipeline Stage Semantics

The pipeline stages are modeled as:
- `collector`: Fetches raw signals from source integrations.
- `cleaner`: Removes duplicate/noisy signals.
- `analyzer`: Infers category/sentiment/location/keywords.
- `predictor`: Computes confidence, risk, impact, escalation, and actions.
- `reporter`: Produces operational briefing text.

Each stage tracks:
- `status`: IDLE, RUNNING, DONE, ERROR
- `items_processed`
- `processing_time` (ms)
- `last_run`

## 4) Backend Design

## 4.1 Entry Points and API Layer

Primary backend file:
- `backend/app/main.py`

Exposed routes:
- `GET /health`: service and integration readiness flags.
- `GET /api/realtime/sources`: active source config details.
- `POST /api/realtime/topic`: full run, single response.
- `GET /api/realtime/stream`: SSE stage-by-stage progress + final result.

Behavioral notes:
- CORS uses `CORS_ALLOW_ORIGINS` from env.
- Stream endpoint emits named events (`stage`, `result`, `error`).
- Errors are logged and returned in a structured format when possible.

## 4.2 Configuration Model

Config file:
- `backend/app/config.py`

`Settings` loads from env and provides:
- API keys (`TAVILY_API_KEY`, `NEWSAPI_KEY`, `NEWSDATA_API_KEY`, `GNEWS_API_KEY`, `GEMINI_API_KEY`)
- LLM model selection (`GEMINI_MODEL`)
- Collection behavior (`TAVILY_RECENT_DAYS`, `REQUEST_TIMEOUT_SECONDS`)
- CORS origins (`CORS_ALLOW_ORIGINS`)
- Source lists (`RSS_FEEDS`, `WEB_SCRAPER_URLS`)

Defaults are included for RSS and scraper URLs, so the backend can run with minimal config.

## 4.3 Data Models

Model file:
- `backend/app/models.py`

Important models:
- `TopicRequest`: input (`topic`, `max_items`).
- `SourceSignal`: normalized collected item from any source.
- `PipelineStage`: stage telemetry.
- `AlertOut`: explainable alert payload.
- `TopicResult`: final response object.

Design intent:
- Keep source-specific data normalized quickly into a common schema.
- Keep responses strongly typed for frontend compatibility.

## 4.4 Collection Layer

Collector file:
- `backend/app/services/collectors.py`

Implemented source methods:
- NewsAPI (`_collect_newsapi`)
- NewsData.io (`_collect_newsdata`)
- GNews (`_collect_gnews`)
- Tavily (`_collect_tavily`)
- Configured RSS feeds (`_collect_rss`)
- Dynamic Google News RSS by query (`_collect_google_news_rss`)
- HTML scraper over configured websites (`_collect_web_scraper`)

Collection strategy:
- Computes `per_source` budget from `max_items`.
- Collects from all integrations with graceful failure behavior.
- De-duplicates by URL and trims to max requested items.

Robustness:
- External calls are wrapped in safe HTTP helpers.
- Failures from one integration do not stop whole pipeline.

## 4.5 Orchestration and Alert Construction

Orchestrator file:
- `backend/app/services/orchestrator.py`

Responsibilities:
- Executes stages in order.
- Emits stream events per stage.
- Performs additional dedupe pass by domain + normalized title.
- Converts analyzed signals into ranked alert list.

Alert ranking:
- Sorts by risk level (HIGH > MEDIUM > LOW), then confidence.
- Produces up to 30 alerts from analyzed items.

Alert content includes:
- title, summary, location, category, sentiment
- confidence, escalation probability, impact
- explainability (`why_triggered`)
- evidence and source references
- recommended actions

## 4.6 Scoring and Heuristics

Scoring file:
- `backend/app/services/scoring.py`

Rule-based inference:
- `infer_risk` from keyword dictionaries.
- `infer_category` from rule sets.
- `infer_sentiment` from sentiment markers.
- `infer_location` from known city list.
- `extract_keywords` from filtered token extraction.

Confidence model:
- Starts from base score.
- Adds trust points for known domains and metadata quality.
- Penalizes suspicious rumor markers.
- Clamps final score to valid range.

Output quality signals:
- `validity_label` as VERIFIED / MIXED / UNVERIFIED.
- impact and escalation calculations based on risk + confidence.

## 4.7 Reporter (Gemini + Fallback)

Reporter file:
- `backend/app/services/crew_pipeline.py`

Modes:
- `gemini`: uses Google GenAI client and candidate model fallback order.
- `fallback`: deterministic report if SDK/key/runtime/model response fails.
- `empty`: no alerts available.

Runtime metadata in `TopicResult.meta`:
- `mode`
- `model` (when Gemini works)
- `reason` and `model_errors` (when fallback occurs)

This metadata is consumed by frontend for debug/operator awareness.

## 5) Frontend Design

## 5.1 App Shell and Routing

Routing file:
- `frontend/src/App.tsx`

Route behavior:
- Public route: `/login`.
- Private routes wrapped by `PrivateRoute`:
- `/dashboard`
- `/alerts`
- `/pipeline`
- `/audit`

Private route checks in-memory auth flag (`isAuthenticated`) from Zustand store.

## 5.2 State Management

Store file:
- `frontend/src/store/useAppStore.ts`

Key store domains:
- Auth state (`user`, `isAuthenticated`)
- Alerts and filters
- Dashboard statistics
- Pipeline stage state
- Audit logs
- Voice assistant state
- Last backend report metadata

Important actions:
- `triggerCollect()`: calls sync backend endpoint and merges alerts.
- `runPipeline()`: opens SSE stream and updates stages in realtime.
- `resolveAlert()` / `updateAlertStatus()`: local state mutation.

Resilience behavior:
- If backend request fails in `triggerCollect`, UI falls back to generated mock alerts.

## 5.3 API Client and Mapping

Client file:
- `frontend/src/services/realtimeApi.ts`

Responsibilities:
- Build backend request URLs using `VITE_BACKEND_URL`.
- Map backend snake_case payloads into frontend camelCase models.
- Handle sync and streaming modes.
- Emit client-side debug logs for run status and fallback mode detection.

## 5.4 Main UI Screens

- `CommandCenterPage`: top-level risk overview and trend visualizations.
- `AlertsSystemPage`: searchable/filterable explainable alert cards.
- `PipelineVisualizationPage`: stage progress, source cards, report preview.
- `AuditLogsPage`: filterable history table + CSV export.
- `LoginPage`: simulated sign-in flow for demo operation.

Supporting components:
- `Layout`: sidebar/topbar/nav + voice assistant mount point.
- `ExplainableAlertCard`: expandable explainability-focused alert UI.
- `VoiceAssistantDialog`: text/voice query panel with backend + local fallback response logic.

## 6) Data Contract Between Backend and Frontend

Backend to frontend mapping is centralized in:
- `frontend/src/services/realtimeApi.ts`

Examples:
- `risk_level` -> `riskLevel`
- `recommended_actions` -> `recommendedActions`
- `created_at` -> `createdAt` as `Date`
- `stages[].items_processed` -> `stages[].itemsProcessed`

This mapping isolates UI from raw API shape and reduces coupling.

## 7) Operational Behavior and Reliability

Observed reliability patterns in code:
- Partial source/key support: pipeline can run even if some integrations are unavailable.
- Reporter fallback mode prevents total failure when LLM is down.
- Stream endpoint sends incremental stage updates for long-running operations.
- Collector and reporter both use exception handling to avoid hard-crash behavior.

## 8) Security and Compliance Notes

Current state:
- Authentication is currently simulated in frontend.
- API keys are env-based and should never be committed.
- CORS defaults are permissive if `*` is used.

For production hardening, add:
- Real auth (for example Firebase Auth or equivalent).
- Role-based access control and route-level authorization.
- Structured audit persistence (database-backed).
- Secret manager integration and key rotation process.

## 9) Known Limits and Practical Caveats

- Rule-based NLP is lightweight and may miss nuanced context.
- Location inference currently depends on a known city list.
- Scraper quality depends on external site markup stability.
- No persistent backend database currently used for pipeline history.

## 10) Suggested Extension Points

Natural next enhancements:
- Replace mock auth with real identity provider integration.
- Add persistent storage for alerts and audit logs.
- Add richer entity extraction and multilingual support.
- Add source reliability scoring learned from historical outcomes.
- Add test coverage for collectors, mapping, and stream handling.
