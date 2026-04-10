from __future__ import annotations

import json

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .config import Settings
from .models import TopicRequest, TopicResult
from .services.collectors import OSINTCollector
from .services.crew_pipeline import CrewReporter
from .services.orchestrator import PipelineOrchestrator

load_dotenv()
settings = Settings.from_env()

app = FastAPI(
    title="LEIS Realtime Agent API",
    version="0.1.0",
    description="Simple FastAPI backend with CrewAI agents for live OSINT topic analysis.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

orchestrator = PipelineOrchestrator(
    collector=OSINTCollector(settings=settings),
    reporter=CrewReporter(settings=settings),
)


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "service": "leis-realtime-agent-api",
        "crewai_enabled": bool(settings.openai_api_key),
        "keys": {
            "tavily": bool(settings.tavily_api_key),
            "brave": bool(settings.brave_api_key),
            "newsapi": bool(settings.newsapi_key),
            "openai": bool(settings.openai_api_key),
        },
    }


@app.get("/api/realtime/sources")
def list_sources() -> dict:
    return {
        "rss_feeds": list(settings.rss_feeds),
        "integrations": {
            "tavily": bool(settings.tavily_api_key),
            "brave_search": bool(settings.brave_api_key),
            "newsapi": bool(settings.newsapi_key),
            "crewai_llm": bool(settings.openai_api_key),
        },
    }


@app.post("/api/realtime/topic", response_model=TopicResult)
def run_topic(payload: TopicRequest) -> TopicResult:
    try:
        return orchestrator.run(topic=payload.topic, max_items=payload.max_items)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {exc}") from exc


@app.get("/api/realtime/stream")
def stream_topic(
    topic: str = Query(..., min_length=2, max_length=240),
    max_items: int = Query(20, ge=5, le=100),
):
    def event_stream():
        try:
            for event_name, payload in orchestrator.stream(topic=topic, max_items=max_items):
                body = json.dumps(payload, ensure_ascii=True)
                yield f"event: {event_name}\n"
                yield f"data: {body}\n\n"
        except Exception as exc:
            body = json.dumps({"error": str(exc)}, ensure_ascii=True)
            yield "event: error\n"
            yield f"data: {body}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
