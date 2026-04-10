# Project Information Documentation

## 1) Project Identity

**Working Product Identity:** ConflictSense / LEIS Realtime Agent Platform

**Category:** Realtime OSINT Intelligence + AI-assisted risk triage

**Project Type:** Full-stack web application (frontend dashboard + backend API intelligence pipeline)

---

## 2) Vision Statement

Enable teams to transform noisy, high-volume open-source information into:
- actionable alerts,
- explainable risk insights,
- and concise operational briefings,

in near real time.

---

## 3) Mission Objectives

- Improve speed of incident awareness.
- Improve quality and consistency of risk prioritization.
- Provide explainable outputs that analysts can verify.
- Demonstrate an end-to-end AI architecture suitable for hackathon judging and rapid iteration.

---

## 4) Key Use Cases

1. **Daily Monitoring**
   - Analyst enters a watch topic.
   - System returns prioritized alert list and trend insights.

2. **Escalation Triage**
   - Team reviews HIGH-risk alerts with evidence and recommendations.

3. **Situation Briefing**
   - Operations lead reviews generated AI narrative to summarize current state.

4. **Demo/Judging Flow**
   - Presenter shows pipeline stages in realtime with visual confidence and risk outputs.

---

## 5) Stakeholders

- **Primary users:** security analysts / monitoring operators
- **Secondary users:** supervisors, response coordinators
- **Evaluation audience:** hackathon mentors and judges

---

## 6) Feature Inventory (Current)

- Topic-based run trigger.
- Realtime stage updates.
- Structured explainable alerts.
- Dashboard KPIs and charts.
- Pipeline visualization interface.
- Audit/log view in frontend workflow.
- CrewAI report generation (when configured).

---

## 7) Demo Readiness Checklist

- [ ] Backend started and reachable.
- [ ] Frontend running in browser.
- [ ] At least one data source key configured (or RSS-only fallback).
- [ ] Optional OpenAI key for richer CrewAI report.
- [ ] Test topic prepared for live run.
- [ ] Backup mock/fallback path understood if external APIs fail.

---

## 8) Risks and Constraints

- External API rate limits or downtime.
- Signal quality variability across sources.
- Heuristic scoring may need tuning for domain specificity.
- No persistent database means run state is session-scoped.

---

## 9) Future Roadmap (Post-Hackathon)

- Persist runs and alerts in a database.
- Add user roles and secure auth.
- Build source reliability analytics.
- Add geospatial visualization for incidents.
- Add model-assisted entity extraction and multilingual support.
- Add feedback loop for analyst-confirmed alert quality.

---

## 10) Success Metrics (Suggested)

- Time to generate first actionable alert.
- Percentage of alerts with usable evidence links.
- Analyst trust score for recommendations.
- Reduction in manual triage time.
- Demo completion reliability under poor network/API conditions.
