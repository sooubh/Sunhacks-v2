# Tech Stack Documentation

## 1) High-Level Stack

### Frontend
- React 19
- TypeScript 6
- Vite 8
- Zustand (state management)
- React Router DOM 7
- Recharts (dashboard charts)
- Leaflet + leaflet.heat (map and heat-layer visualization)
- date-fns (date formatting)
- Framer Motion (UI animation)
- Firebase SDK (Auth + Firestore integration)
- Tailwind CSS 4 + PostCSS + Autoprefixer

### Backend
- Python 3.10+
- FastAPI
- Uvicorn
- Pydantic v2
- python-dotenv
- requests
- feedparser
- beautifulsoup4
- google-genai
- langchain-ollama
- langchain-community

## 2) API and Realtime Protocols

- REST for synchronous request/response operations.
- Server-Sent Events (SSE) for pipeline stage streaming.
- WebSocket for live bidirectional voice session.
- JSON payload contracts validated with Pydantic.

## 3) Frontend Tooling and Scripts

Build and quality tooling:
- ESLint 9 with TypeScript and React plugins
- Vite React plugin
- TypeScript project build (tsc -b)

Common scripts:
- npm run dev
- npm run build
- npm run lint
- npm run preview

## 4) Backend Dependency Roles

Core runtime:
- fastapi, uvicorn: API hosting
- pydantic: request/response schema validation
- python-dotenv: environment loading

Collection and parsing:
- requests: HTTP calls to source providers
- feedparser: RSS parsing utilities
- beautifulsoup4: HTML scraping helpers

AI integrations:
- google-genai: Gemini text and live voice support
- langchain-ollama and langchain-community: Ollama local reasoning support

## 5) External Integrations (Config-Driven)

Supported source/AI providers through environment keys and settings:
- NewsAPI
- NewsData.io
- GNews
- Tavily
- Gemini API (reporting and live voice)
- Ollama local runtime (report reasoning)

Also implemented in code for extension workflows:
- RSS feed collection helpers
- HTML web scraper helpers
- Google News RSS helper

## 6) Why This Stack Fits the Project

- Fast local setup and iteration speed.
- Strong contract safety across frontend/backend models.
- Realtime UX through SSE and WebSocket voice flows.
- Flexible AI runtime strategy with provider routing and fallback behavior.
- Modular service design for incremental source and model upgrades.

## 7) Suggested Future Enhancements

- Add persistent backend database for canonical run history.
- Add queue/worker layer for heavy asynchronous processing.
- Add centralized observability (metrics, tracing, alerting).
- Harden auth and role-based access at backend API boundary.
