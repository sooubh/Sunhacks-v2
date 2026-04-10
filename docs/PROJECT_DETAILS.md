# Project Details Documentation

## 1) Project Summary

This project implements a **realtime OSINT intelligence platform** designed for operational monitoring, alert generation, and explainable decision support.

The product collects public data signals, processes them through an AI-style multi-stage pipeline, and presents prioritized alerts to analysts in a live dashboard.

It combines:
- real-time ingestion,
- structured risk assessment,
- explainable alerts,
- and automated narrative reporting.

---

## 2) Core Problem It Solves

Teams monitoring public-safety or instability-related events often face:
- too many noisy sources,
- delayed manual triage,
- poor explainability of severity decisions,
- and fragmented reporting.

This platform addresses those gaps by:
1. Aggregating from multiple open-source channels.
2. Normalizing and deduplicating raw signals.
3. Assigning category, sentiment, risk, confidence, and impact.
4. Generating standardized, action-oriented alerts.
5. Producing a briefing report for operations teams.

---

## 3) Major Features

### A) Realtime Topic Analysis
- Analyst enters a topic query.
- Backend runs the full OSINT pipeline.
- Returns structured alerts plus a synthesized report.

### B) Streaming Pipeline Visualization
- Uses Server-Sent Events (SSE).
- Frontend receives stage-level updates (`collector`, `cleaner`, `analyzer`, `predictor`, `reporter`).
- UI displays processing time and processed-item counts live.

### C) Explainable Alerts
Every alert includes:
- why the alert triggered,
- confidence score,
- escalation probability,
- supporting evidence URLs/snippets,
- recommended next actions.

### D) Dashboard Intelligence Views
- Command center KPIs (risk split, active alerts, confidence).
- Risk trend charts.
- Category distribution charts.
- Top critical alerts.

### E) Audit & Traceability Support
- Alert status updates and logs are represented in UI state.
- Alert fields preserve source references and timestamps.

---

## 4) Pipeline Stages (Functional Behavior)

1. **Collector**
   - Queries RSS and optional API-backed sources.
   - Produces raw source signals.

2. **Cleaner**
   - Removes weak duplicates by normalized title-domain key.

3. **Analyzer**
   - Derives category, sentiment, inferred location, keywords.
   - Computes confidence and validity labels.

4. **Predictor**
   - Calculates risk level, impact, escalation probability.
   - Builds final alert objects with action recommendations.

5. **Reporter**
   - Generates final intelligence briefing (CrewAI or fallback deterministic report).

---

## 5) End Users

- **Analysts**: monitor risks and examine explainable evidence.
- **Operations leads**: prioritize incidents and mitigation actions.
- **Hackathon judges/demo audience**: understand end-to-end AI + product integration quickly.

---

## 6) Data and Output Artifacts

Input:
- User topic text
- Optional max item count

Outputs:
- Stage telemetry
- Structured alert list
- Final intelligence narrative report
- Meta diagnostics (source counts and run metadata)

---

## 7) Non-Functional Characteristics

- **Modular**: collection, scoring, reporting are isolated service modules.
- **Resilient UI**: frontend can fallback to mock data if backend is unavailable.
- **Demo-friendly**: staged visualization and charts communicate value quickly.
- **Extensible**: new data sources can be added in collector service.

---

## 8) Current Scope and Limitations

- Primary focus is on fast hackathon-friendly workflows.
- Scoring logic is heuristic/rule-based (not a fully trained ML model pipeline).
- Data persistence appears in-memory in frontend state; no durable DB integration shown in current code.
- Authentication is demo-style local state rather than production IAM.

These choices are practical for rapid prototyping and demos.
