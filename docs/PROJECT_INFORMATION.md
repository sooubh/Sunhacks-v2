# Project Information Documentation

## 1) Project Identity

Product identity:
- LEIS Realtime Agent Platform (Sunhacks-v2)

Category:
- Realtime OSINT intelligence and AI-assisted risk triage

Project type:
- Full-stack web application (React frontend + FastAPI backend)

## 2) Vision

Convert high-volume public signals into:
- actionable alerts,
- explainable risk insight,
- and concise operational briefings,

with realtime visibility suitable for analysts and command workflows.

## 3) Mission Objectives

- Reduce time-to-awareness for emerging events.
- Standardize risk prioritization with transparent scoring outputs.
- Keep operations resilient under partial integration and AI failures.
- Provide a strong end-to-end demo narrative for evaluation and onboarding.

## 4) Key Use Cases

1. Daily monitoring
   - Analyst runs topic and city-scoped intelligence scans.
2. Escalation triage
   - Team prioritizes HIGH-risk alerts with evidence and action recommendations.
3. Realtime pipeline visibility
   - Operators inspect stage progress and processing telemetry during live runs.
4. Voice-assisted command support
   - User queries current dashboard state through chat or live voice.
5. Multi-city monitoring
   - Auto-agent cycle runs repeated scans across configured city scopes.

## 5) Stakeholders

- Primary: analysts and monitoring operators
- Secondary: command supervisors and response coordinators
- Review audience: mentors, judges, technical evaluators

## 6) Current Feature Inventory

- Topic-based intelligence run (sync and stream modes)
- Five-stage OSINT pipeline with stage telemetry
- Explainable alerts (risk/confidence/evidence/actions)
- AI report generation with provider-routing fallback
- Dashboard KPIs, charts, and map-oriented views
- Voice assistant (smart chat + live voice websocket)
- Firestore persistence for runs, alerts, snapshots, and transcripts
- Auto-monitor cycle for multiple cities

## 7) Demo Readiness Checklist

- [ ] Backend running and reachable at local API URL
- [ ] Frontend running and connected to backend
- [ ] At least one source key configured (or expected low-signal fallback)
- [ ] AI runtime prepared:
  - [ ] Ollama reachable for local report reasoning, or
  - [ ] Gemini key configured for cloud reasoning/voice
- [ ] Test topic prepared for live walkthrough
- [ ] Backup fallback story prepared (deterministic mode and mock UI fallback)

## 8) Constraints and Risks

- External API quota/rate limits and provider downtime
- Variability in source quality and timeliness
- Heuristic scoring limitations for nuanced context
- No canonical backend database for persistent historical analytics

## 9) Success Metrics (Suggested)

- Time to first actionable alert
- % alerts with usable evidence links
- % runs completed without hard failure
- Analyst confidence in recommendation quality
- Demo completion reliability under degraded provider conditions

## 10) Post-Hackathon Roadmap

- Enable richer source mix in default collector strategy
- Add durable backend data persistence and query layer
- Add backend authentication/authorization enforcement
- Add analyst feedback loop for risk calibration
- Expand multilingual and entity intelligence depth
