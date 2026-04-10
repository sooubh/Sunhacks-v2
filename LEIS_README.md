# 🛡️ LEIS — Law Enforcement Intelligence System

> **"A multi-agent AI system that converts real-time data into reliable, explainable, and actionable intelligence for law enforcement operations."**

---

## 📌 Overview

**LEIS** is an AI-powered multi-agent intelligence system designed exclusively for law enforcement agencies.

It continuously monitors open-source intelligence (OSINT), processes and verifies incoming data, and generates **real-time, explainable, and actionable alerts** to support rapid operational decision-making.

> LEIS is not a search or reporting tool — it is an **autonomous intelligence pipeline** that transforms fragmented information into structured, verified, and prioritized insights.

---

## 🎯 Objectives

- Detect early signs of law-and-order disturbances
- Reduce information overload from multiple intelligence sources
- Improve response time through actionable, pre-processed intelligence
- Enhance institutional trust via explainable and verifiable AI outputs

---

## 👮 Target Users

| User Type | Role |
|---|---|
| Police Control Room Officers | Primary consumers of real-time alerts |
| District Command Units | Operational planning and resource deployment |
| Intelligence Analysts | Deep-dive review and trend analysis |
| Field Coordination Teams | On-ground response execution |

> ⚠️ This system is strictly designed for **internal law enforcement use** and does not target public users.

---

## 🧠 Core Concept — Multi-Agent Pipeline

LEIS operates as a **modular multi-agent AI system**, where each agent performs a specialized, isolated task in the intelligence pipeline. This ensures scalability, clarity, fault isolation, and reliability.

```
Collector → Cleaner → Analyzer → Predictor → Reporter
```

---

## 🤖 Agent Architecture

### 1. 🔍 Collector Agent
- Fetches data from multiple OSINT sources in parallel
  - News APIs (e.g., NewsData.io, GNews)
  - Tavily Web Search
  - RSS Feeds
- Outputs raw, unprocessed intelligence data to the pipeline

---

### 2. 🧹 Cleaner Agent
- Removes duplicates and irrelevant content
- Groups related incidents into unified events
- Extracts structured fields: `location`, `timestamp`, `event_type`, `entities`

---

### 3. 📊 Analyzer Agent
- Performs NLP-based analysis:
  - Sentiment analysis
  - Keyword and entity extraction
  - Event classification: `protest`, `unrest`, `violence`, `accident`
- Detects intensity patterns and emerging trends

---

### 4. 🔮 Predictor Agent
- Generates:
  - **Risk Score** — `LOW` / `MEDIUM` / `HIGH`
  - **Confidence Score** — percentage reliability of the assessment
  - **Escalation Likelihood** — probability of situation worsening

---

### 5. 📋 Reporter Agent
- Produces a human-readable **Intelligence Brief**
- Each brief includes:
  - Why the alert was triggered
  - Supporting evidence and data references
  - Specific recommended actions for law enforcement

---

## ⚙️ Key Features

### 1. Real-Time Intelligence Ingestion
- Continuous, automated monitoring of multiple OSINT sources
- No manual queries required — fully autonomous

### 2. Multi-Source Verification System
- Cross-source validation and conflict detection
- Source credibility scoring
- Alert labels: `✅ Verified` / `⚠️ Unverified` / `🔴 Conflicting`

### 3. AI-Based Risk Assessment
- Dynamic risk scoring with confidence estimation
- Trend-based escalation detection

### 4. Explainable Intelligence (XAI)
- Every alert includes a transparent reasoning chain
- Source references included for human review

### 5. Actionable Recommendations
| Risk Level | Suggested Action |
|---|---|
| HIGH | Deploy patrol units immediately |
| MEDIUM | Monitor area, prepare rapid response |
| LOW | No immediate action required |

### 6. Scenario Simulation (What-If Analysis)
- Predicts possible outcomes under different conditions
- Supports proactive operational planning

### 7. Alert Prioritization
- Only top-critical alerts surfaced to the dashboard
- Reduces alert fatigue for control room officers

### 8. Historical Intelligence Tracking
- Persistent storage of past alerts
- Tracks escalation patterns and resolution status over time

---

## 🖥️ Dashboard Design

### Main Dashboard
- Top 3 critical alerts
- System-wide risk overview
- Last update timestamp

### Alert Detail View
- Location | Risk Score | Confidence Score
- Plain-language explanation
- Source list | Recommended actions

### Intelligence Feed
- Grouped incidents by category and region
- Timeline-based event view

### History Panel
- Past alerts with status: `Active`, `Resolved`, `Escalated`

---

## ⚠️ Edge Case Handling

| Scenario | System Behavior |
|---|---|
| Single-source data only | Low confidence label applied |
| Multiple source confirmations | High confidence, verified alert |
| Conflicting reports | Conflict warning surfaced to analyst |
| No relevant data found | `No Actionable Intelligence` state |
| Rapid spike in incidents | Escalation alert triggered |
| High uncertainty in data | Confidence score + caution label |

---

## 🛡️ Reliability & Safety Mechanisms

- **Confidence Scoring System** — every output carries a reliability score
- **Source Traceability** — all claims are linked to their origin
- **Multi-Source Validation** — no alert is generated from a single signal alone
- **AI Explainability** — reasoning is always visible to the human operator
- **Human-in-the-Loop Model** — the system supports decisions, it does not replace human judgment

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────┐
│         Data Sources (OSINT Layer)      │
│   News APIs  |  Tavily  |  RSS Feeds    │
└────────────────────┬────────────────────┘
                     ↓
┌─────────────────────────────────────────┐
│         Preprocessing Layer             │
│   Deduplication | Filtering | Parsing   │
└────────────────────┬────────────────────┘
                     ↓
┌─────────────────────────────────────────┐
│         Verification Layer              │
│   Source Trust | Cross-Validation       │
└────────────────────┬────────────────────┘
                     ↓
┌─────────────────────────────────────────┐
│       Multi-Agent AI Pipeline           │
│  Collector → Cleaner → Analyzer         │
│         → Predictor → Reporter          │
└────────────────────┬────────────────────┘
                     ↓
┌─────────────────────────────────────────┐
│    Structured Intelligence Output       │
│  Risk Score | Confidence | Rec. Actions │
└────────────────────┬────────────────────┘
                     ↓
┌─────────────────────────────────────────┐
│         Police Dashboard (Flutter)      │
└────────────────────┬────────────────────┘
                     ↓
┌─────────────────────────────────────────┐
│        Firebase Firestore (DB)          │
└─────────────────────────────────────────┘
```

---

## 🧰 Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | Flutter (Dart) |
| **Backend** | FastAPI (Python) |
| **Multi-Agent Orchestration** | CrewAI |
| **Prompt Chaining & Workflows** | LangChain |
| **LLM Inference** | Ollama (local) |
| **Web Intelligence** | Tavily Search API |
| **Database** | Firebase Firestore |

---

## 📁 Repository Structure

```
leis/
├── backend/
│   ├── main.py                  # FastAPI entry point
│   ├── agents/
│   │   ├── collector_agent.py
│   │   ├── cleaner_agent.py
│   │   ├── analyzer_agent.py
│   │   ├── predictor_agent.py
│   │   └── reporter_agent.py
│   ├── pipeline/
│   │   └── orchestrator.py      # CrewAI pipeline runner
│   ├── services/
│   │   ├── tavily_service.py
│   │   ├── rss_service.py
│   │   └── firebase_service.py
│   └── models/
│       └── schemas.py           # Pydantic data models
├── frontend/
│   └── lib/
│       ├── screens/
│       │   ├── dashboard_screen.dart
│       │   ├── alert_detail_screen.dart
│       │   └── history_screen.dart
│       ├── models/
│       └── services/
├── README.md
└── requirements.txt
```

---

## 🚀 Key Differentiators

| Feature | Traditional Tools | LEIS |
|---|---|---|
| Operation Mode | Manual query-based | Fully autonomous |
| Architecture | Monolithic | Modular multi-agent |
| Output Type | Raw data or reports | Explainable + actionable briefs |
| Verification | None or manual | Automated cross-source validation |
| Risk Assessment | Static rules | AI-driven, confidence-scored |
| Explainability | None | Built-in reasoning chain |

---

## 🏆 Conclusion

LEIS is not a generic AI application. It is a **domain-specific intelligence system** built for the operational realities of law enforcement.

It transforms fragmented, unstructured data into:
- ✅ **Verified signals** — with cross-source validation
- 💡 **Interpretable insights** — with explainable AI reasoning
- ⚡ **Actionable decisions** — with prioritized recommendations

---

*Built for Hackathon — Domain: Public Safety & Law Enforcement AI*
