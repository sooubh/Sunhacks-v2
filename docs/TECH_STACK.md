# Tech Stack Documentation

## 1) High-Level Stack

### Frontend
- React 19
- TypeScript 6
- Vite 8
- Zustand (state management)
- React Router DOM 7 (routing)
- Recharts (analytics visualizations)
- date-fns (time formatting)
- Framer Motion (UI animation capabilities)
- Tailwind CSS 4 + PostCSS + Autoprefixer (styling toolchain)
- Firebase SDK (configured dependency for integrations/auth extensions)

### Backend
- Python
- FastAPI
- Uvicorn
- Pydantic v2
- python-dotenv
- Requests
- feedparser
- CrewAI

---

## 2) API and Protocol Choices

- REST endpoints for request/response operations.
- Server-Sent Events (SSE) for pipeline stage streaming.
- JSON payload contracts enforced through Pydantic models.

---

## 3) Frontend Build and Dev Tooling

- ESLint 9 with TypeScript and React hooks plugins.
- Vite plugin for React.
- Type checking through `tsc -b` in production build script.

Common scripts:
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run preview`

---

## 4) Backend Runtime and Dependency Model

Backend dependencies are intentionally minimal and directly focused on:
- API service hosting (`fastapi`, `uvicorn`)
- schema validation (`pydantic`)
- secrets/env handling (`python-dotenv`)
- HTTP + feed ingestion (`requests`, `feedparser`)
- AI report orchestration (`crewai`)

---

## 5) External Integrations (Config-Driven)

The backend is designed to optionally use these connectors via environment keys:
- Tavily search
- Brave search
- NewsAPI
- RSS feeds (works even without API keys)
- OpenAI key for CrewAI-enabled richer briefing generation

---

## 6) Why This Stack Fits a Hackathon

- Fast setup and iteration speed.
- Strong type safety across client and server payloads.
- Built-in API docs/testing ergonomics from FastAPI.
- Clear realtime storytelling via SSE + visual pipeline page.
- Easy extensibility for future data sources and model upgrades.

---

## 7) Suggested Future Stack Extensions

- Add persistent storage (PostgreSQL + SQLModel/SQLAlchemy).
- Add background workers (Celery/RQ/Temporal).
- Add Redis cache for hot topic results.
- Add proper auth (Firebase Auth/OIDC/JWT gateway).
- Containerize with Docker Compose for one-command boot.
