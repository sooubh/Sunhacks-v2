# Frontend: LEIS Command Interface

This frontend is a React + TypeScript + Vite application for viewing and operating the realtime OSINT pipeline.

It provides:
- Command Center overview dashboard
- Explainable alerts interface
- Realtime pipeline visualization
- Audit logs view with CSV export
- Voice assistant dialog with Gemini Live websocket streaming (real-time mic/audio) + fallback behavior
- Firestore persistence for pipeline runs, alerts, dashboard snapshots, and voice transcripts

## Tech Stack

- React 19
- TypeScript
- Vite
- Zustand (state management)
- React Router
- Recharts (charts)
- date-fns (date formatting)

## Run Locally

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Default app URL:
- `http://127.0.0.1:5173`

## Environment

File:
- `.env`

Required variable:
- `VITE_BACKEND_URL=http://127.0.0.1:8000`

If backend runs on a different host/port, update this value.

## Available Scripts

- `npm run dev` - Start dev server
- `npm run build` - Type-check + production build
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Route Map

- `/login` - Simulated auth screen (demo flow)
- `/dashboard` - Command center overview
- `/alerts` - Explainable alert list and filters
- `/pipeline` - Stage-by-stage realtime pipeline view
- `/audit` - Audit logs and export

All routes except `/login` are protected by a simple in-memory auth guard.

## Frontend Data Flow

1. User enters topic via search or voice input.
2. Store action calls backend API:
- Sync mode: `runTopic()`
- Streaming mode: `streamTopic()`
3. Voice assistant calls backend voice endpoint `askVoiceAssistant()` with live dashboard context.
4. Response mapper converts backend payload to UI models.
5. Zustand store updates alerts, pipeline stages, stats, and report preview.
6. Runtime data is persisted to Firestore collections.

Main files:
- `src/store/useAppStore.ts` - global state and actions
- `src/services/realtimeApi.ts` - backend integration and payload mapping
- `src/pages/*` - route-level screens
- `src/components/*` - reusable UI elements

## Integration Notes

- Backend expects `topic` + `max_items` for topic runs.
- Stream endpoint sends SSE events: `stage`, `result`, and `error`.
- Voice endpoint: `POST /api/voice/assistant`.
- Live voice websocket: `WS /ws/voice/live`.
- Backend meta mode is surfaced in logs (`ollama`, `gemini`, `fallback`, `empty`).

## Current Behavior Notes

- Login is currently simulated (no production auth wired yet).
- If backend collection fails in some flows, store keeps UI responsive with mock fallback alerts.
- Voice assistant attempts backend intelligence first, then falls back to local canned responses.

## Related Documentation

- `../README.md`
- `../docs/PROJECT_DOCUMENTATION.md`
- `../docs/API_REFERENCE.md`
- `../docs/SETUP_AND_RUN.md`
- `../docs/GLOSSARY.md`
