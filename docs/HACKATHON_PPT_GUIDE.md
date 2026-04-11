# Hackathon PPT Documentation Guide

This file is a ready-to-use outline for creating your hackathon presentation deck.

---

## 1) Recommended Deck Length

- **8 to 12 slides** total
- 5–7 minutes main pitch
- 2–3 minutes live demo + Q&A

---

## 2) Slide-by-Slide Structure

### Slide 1 — Title Slide
Include:
- Project name: **ConflictSense / LEIS Realtime Agent**
- One-line tagline (example):
  - *"From OSINT noise to explainable realtime intelligence."*
- Team member names and roles
- Hackathon name + date

---

### Slide 2 — Problem Statement
Show pain points clearly:
- Too many unstructured public signals
- Slow manual triage
- Inconsistent risk prioritization
- Lack of explainable outputs for decisions

Tip: Use a small workflow graphic to show current manual bottleneck.

---

### Slide 3 — Solution Overview
Present what your product does in one visual:
- Collect → Clean → Analyze → Predict → Report
- Realtime dashboard + explainable alerts + AI briefing

Include a single architecture snapshot image for clarity.

---

### Slide 4 — Product Demo Screens
Show 3 key screens:
1. Command Center
2. Alerts System
3. Pipeline Visualization

Annotate each screenshot with 1–2 callouts so judges see value instantly.

---

### Slide 5 — Technical Architecture
Include:
- Frontend (React, TypeScript, Zustand)
- Backend (FastAPI, Pydantic)
- Data sources (RSS + APIs)
- Realtime channel (SSE)
- Ollama/Gemini reporting module with deterministic fallback

Keep this slide visual (boxes/arrows) and avoid dense text.

---

### Slide 6 — AI/Scoring Logic
Explain your intelligence layer:
- Category inference
- Sentiment/risk estimation
- Confidence + impact + escalation scoring
- Explainable action recommendations

Mention this is modular and can be upgraded with stronger models.

---

### Slide 7 — Why It Matters (Impact)
Possible impact statements:
- Faster response prioritization
- Better analyst confidence with explainability
- Improved monitoring coverage with multi-source OSINT
- Useful for public safety / operations intelligence contexts

Use one simple KPI table or before-vs-after comparison.

---

### Slide 8 — Differentiation
List what is unique:
- Realtime pipeline transparency (not black-box)
- Explainability-first alert objects
- End-to-end integrated reporting in one flow
- Hackathon-ready extensibility

---

### Slide 9 — Roadmap
Near-term roadmap examples:
- Persistent database + historical analytics
- Secure auth + RBAC
- Human feedback loop for model tuning
- Geospatial and multilingual expansion

---

### Slide 10 — Ask / Closing
End with:
- The core value proposition in one sentence
- What support you need (mentorship, pilots, credits, partnerships)
- Thank you + Q&A

---

## 3) Live Demo Script (2–3 Minutes)

1. Enter topic in dashboard and trigger collection.
2. Open pipeline page and run full streaming pipeline.
3. Highlight stage transitions and timing.
4. Open top critical alert and explain evidence + recommendations.
5. Show final AI-generated briefing summary.

Backup plan:
- If network/API fails, use fallback behavior and explain resilience.

---

## 4) Judge-Focused Talking Points

- **Innovation:** realtime explainable OSINT pipeline
- **Technical depth:** typed frontend-backend contracts + streaming events
- **Practicality:** immediate triage utility
- **Scalability:** modular collectors and scoring services
- **Feasibility:** can be productionized with persistence + auth hardening

---

## 5) PPT Design Tips

- Use dark UI screenshots matching product theme.
- Keep each slide to 3–5 bullets max.
- Prefer diagrams and callouts over long paragraphs.
- Put strongest novelty in first 3 slides.
- Keep fonts readable from back-row seating.

---

## 6) Suggested Appendix Slides (Optional)

- Data model snapshot (Alert schema)
- API endpoint list
- Pipeline timing metrics
- Risk scoring rubric summary

These help if judges ask technical follow-up questions.
