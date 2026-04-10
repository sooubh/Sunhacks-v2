# API Reference (Backend)

Base URL (local default):
- `http://127.0.0.1:8000`

OpenAPI docs (FastAPI generated):
- `http://127.0.0.1:8000/docs`

## Conventions

- Content type for JSON endpoints: `application/json`
- Time values: ISO 8601 strings
- Errors: HTTP status + JSON/string detail depending on context

## 1) Health Check

Endpoint:
- `GET /health`

Purpose:
- Quick backend liveness and integration readiness check.

Example response:

```json
{
  "ok": true,
  "service": "leis-realtime-agent-api",
  "gemini_enabled": true,
  "keys": {
    "tavily": true,
    "newsapi": false,
    "newsdata": true,
    "gnews": false,
    "gemini": true
  }
}
```

## 2) Source Configuration

Endpoint:
- `GET /api/realtime/sources`

Purpose:
- Returns active source lists and whether each integration is enabled by key presence.

Example response:

```json
{
  "rss_feeds": [
    "https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms"
  ],
  "web_scraper_urls": [
    "https://www.thehindu.com/news/national/"
  ],
  "tavily_recent_days": 3,
  "integrations": {
    "tavily": true,
    "newsapi": true,
    "newsdata": true,
    "gnews": true,
    "web_scraper": true,
    "gemini_llm": true
  }
}
```

## 3) Run Topic (Synchronous)

Endpoint:
- `POST /api/realtime/topic`

Request body:

```json
{
  "topic": "mumbai protest traffic unrest",
  "max_items": 20
}
```

Validation constraints:
- `topic`: min length 2, max length 240
- `max_items`: integer between 5 and 100

Response type:
- `TopicResult`

High-level response shape:

```json
{
  "topic": "mumbai protest traffic unrest",
  "generated_at": "2026-04-10T10:20:30.123Z",
  "stages": [
    {
      "id": "collector",
      "name": "OSINT Collector",
      "description": "Fetches from multiple sources",
      "status": "DONE",
      "items_processed": 20,
      "processing_time": 621,
      "last_run": "2026-04-10T10:20:29.111Z"
    }
  ],
  "alerts": [
    {
      "id": "ALT-20260410102030-001",
      "title": "Sample alert title",
      "summary": "Topic matched signal...",
      "location": "Mumbai",
      "risk_level": "HIGH",
      "confidence": 82,
      "escalation_probability": 90,
      "sentiment": "TENSE",
      "category": "PROTEST",
      "status": "ACTIVE",
      "entities": [
        { "name": "Mumbai", "type": "LOCATION" }
      ],
      "keywords": ["protest", "traffic"],
      "evidence": [
        {
          "source": "NewsAPI",
          "url": "https://example.com/news",
          "excerpt": "Sample excerpt",
          "fetched_at": "2026-04-10T10:20:28.000Z"
        }
      ],
      "why_triggered": "Signal scored HIGH risk...",
      "recommended_actions": [
        "Escalate to state-level command immediately."
      ],
      "sources": [
        {
          "id": "abc123",
          "name": "NewsAPI",
          "type": "NEWS_API",
          "url": "https://example.com/news",
          "fetched_at": "2026-04-10T10:20:28.000Z"
        }
      ],
      "raw_count": 1,
      "source_validity": "VERIFIED",
      "impact": "HIGH",
      "created_at": "2026-04-10T10:20:00.000Z",
      "updated_at": "2026-04-10T10:20:30.000Z"
    }
  ],
  "report": "Operational intelligence briefing text...",
  "meta": {
    "topic": "mumbai protest traffic unrest",
    "max_items": 20,
    "sources_collected": 25,
    "sources_after_cleaning": 20,
    "mode": "ollama",
    "model": "llama3:8b"
  }
}
```

Possible `meta.mode` values:
- `ollama`: Ollama-generated report success
- `gemini`: Gemini-generated report success (fallback provider)
- `fallback`: deterministic report due to key/sdk/runtime/model issue
- `empty`: no actionable alerts

## 4) Run Topic (Streaming SSE)

Endpoint:
- `GET /api/realtime/stream?topic=<topic>&max_items=<n>`

Query params:
- `topic` (required): 2..240 chars
- `max_items` (optional): default 20, allowed 5..100

Response media type:
- `text/event-stream`

Event types emitted:
- `stage`: sent repeatedly as each stage updates
- `result`: sent once with final `TopicResult`
- `error`: sent on stream failure

Example raw SSE stream:

```text
event: stage
data: {"id":"collector","status":"RUNNING",...}

event: stage
data: {"id":"collector","status":"DONE",...}

event: stage
data: {"id":"cleaner","status":"RUNNING",...}

event: result
data: {"topic":"...","alerts":[...],"report":"...","meta":{...}}
```

## 5) Voice Assistant (Dashboard-Aware)

Endpoint:
- `POST /api/voice/assistant`

Request body:

```json
{
  "query": "Give me Mumbai risk overview",
  "dashboard_context": {
    "topic": "mumbai protest traffic",
    "city": "Mumbai",
    "stats": {
      "activeAlerts": 8,
      "highRisk": 3,
      "mediumRisk": 3,
      "lowRisk": 2
    }
  }
}
```

Response shape:

```json
{
  "reply": "Current Mumbai posture is elevated...",
  "provider": "gemini",
  "model": "models/gemini-3.1-flash-live-preview",
  "mode": "gemini_live_voice",
  "generated_at": "2026-04-11T10:20:30.123Z"
}
```

## 6) Live Voice WebSocket

Endpoint:
- `WS /ws/voice/live`

Purpose:
- Real-time Gemini Live voice session with bidirectional streaming audio.

Client first message (required):

```json
{
  "type": "start",
  "voice_name": "Zephyr",
  "dashboard_context": {
    "topic": "mumbai traffic unrest",
    "city": "Mumbai"
  }
}
```

Client message types:
- `audio`: `{ "type": "audio", "data": "<base64 pcm16 mono 16k>" }`
- `text`: `{ "type": "text", "text": "status update", "end_of_turn": true }`
- `context`: `{ "type": "context", "dashboard_context": {...} }`
- `end_turn`: `{ "type": "end_turn" }`
- `stop`: `{ "type": "stop" }`

Server event types:
- `ready`: session established with model metadata
- `audio`: streamed PCM16 chunks (base64)
- `text`: streamed text chunks
- `turn_complete`: turn has ended
- `error`: session/runtime error message

## 7) Error Behavior

Synchronous endpoint (`POST /api/realtime/topic`):
- On unhandled pipeline error, returns HTTP 500 with detail string:
- `{"detail": "Pipeline failed: ..."}`

Streaming endpoint (`GET /api/realtime/stream`):
- Emits `error` event with JSON payload:
- `{"error": "..."}`

Voice endpoint (`POST /api/voice/assistant`):
- On unhandled runtime error, returns HTTP 500 with detail string:
- `{"detail": "Voice assistant failed: ..."}`

WebSocket endpoint (`WS /ws/voice/live`):
- Sends `error` event on runtime/config failures, then closes socket.

## 8) Minimal Test Commands

Health:

```powershell
curl http://127.0.0.1:8000/health
```

Sync run:

```powershell
curl -X POST http://127.0.0.1:8000/api/realtime/topic -H "Content-Type: application/json" -d "{\"topic\":\"delhi protest\",\"max_items\":20}"
```

Stream run:

```powershell
curl "http://127.0.0.1:8000/api/realtime/stream?topic=delhi+protest&max_items=20"
```

Voice run:

```powershell
curl -X POST http://127.0.0.1:8000/api/voice/assistant -H "Content-Type: application/json" -d "{\"query\":\"Give me Mumbai risk summary\",\"dashboard_context\":{\"topic\":\"mumbai law and order\",\"city\":\"Mumbai\"}}"
```

## 9) Frontend Integration Notes

Frontend API client:
- `frontend/src/services/realtimeApi.ts`

Expected env var:
- `VITE_BACKEND_URL` (default in project env is `http://127.0.0.1:8000`)

Client mapping layer converts backend snake_case fields to frontend camelCase models before rendering.
