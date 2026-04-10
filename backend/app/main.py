from __future__ import annotations

import json
import logging

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
logger = logging.getLogger(__name__)

app = FastAPI(
    title="LEIS Realtime Agent API",
    version="0.1.0",
    description="Simple FastAPI backend with Gemini/Ollama-assisted agents for live OSINT topic analysis.",
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
        "gemini_enabled": bool(settings.gemini_api_key),
        "keys": {
            "tavily": bool(settings.tavily_api_key),
            "newsapi": bool(settings.newsapi_key),
            "newsdata": bool(settings.newsdata_api_key),
            "gnews": bool(settings.gnews_api_key),
            "gemini": bool(settings.gemini_api_key),
            "ollama_configured": bool(settings.ollama_enabled and settings.ollama_base_url),
        },
        "ai": {
            "gemini_enabled": bool(settings.gemini_api_key),
            "ollama_configured": bool(settings.ollama_enabled and settings.ollama_base_url),
            "ollama_model": settings.ollama_model,
        },
    }


@app.get("/api/realtime/sources")
def list_sources() -> dict:
    return {
        "rss_feeds": list(settings.rss_feeds),
        "web_scraper_urls": list(settings.web_scraper_urls),
        "tavily_recent_days": settings.tavily_recent_days,
        "integrations": {
            "tavily": bool(settings.tavily_api_key),
            "newsapi": bool(settings.newsapi_key),
            "newsdata": bool(settings.newsdata_api_key),
            "gnews": bool(settings.gnews_api_key),
            "web_scraper": True,
            "gemini_llm": bool(settings.gemini_api_key),
            "ollama_llm": bool(settings.ollama_enabled and settings.ollama_base_url),
        },
    }


@app.post("/api/realtime/topic", response_model=TopicResult)
def run_topic(payload: TopicRequest) -> TopicResult:
    try:
        result = orchestrator.run(topic=payload.topic, max_items=payload.max_items)
        meta = result.meta or {}
        mode = str(meta.get("mode", "unknown"))
        if mode in {"gemini", "ollama"}:
            logger.info(
                "topic analysis success topic=%s alerts=%d mode=%s model=%s",
                payload.topic,
                len(result.alerts),
                mode,
                meta.get("model", "n/a"),
            )
        else:
            logger.warning(
                "topic analysis fallback topic=%s alerts=%d mode=%s reason=%s",
                payload.topic,
                len(result.alerts),
                mode,
                meta.get("reason", "n/a"),
            )
        return result
    except Exception as exc:
        logger.exception("topic analysis failed topic=%s max_items=%s", payload.topic, payload.max_items)
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {exc}") from exc


@app.get("/api/realtime/stream")
def stream_topic(
    topic: str = Query(..., min_length=2, max_length=240),
    max_items: int = Query(20, ge=5, le=100),
):
    def event_stream():
        logger.info("stream started topic=%s max_items=%s", topic, max_items)
        try:
            for event_name, payload in orchestrator.stream(topic=topic, max_items=max_items):
                if event_name == "result":
                    meta = payload.get("meta", {}) if isinstance(payload, dict) else {}
                    mode = str(meta.get("mode", "unknown")) if isinstance(meta, dict) else "unknown"
                    if mode in {"gemini", "ollama"}:
                        logger.info(
                            "stream result success topic=%s mode=%s model=%s",
                            topic,
                            mode,
                            (meta.get("model", "n/a") if isinstance(meta, dict) else "n/a"),
                        )
                    else:
                        logger.warning(
                            "stream result fallback topic=%s mode=%s reason=%s",
                            topic,
                            mode,
                            (meta.get("reason", "n/a") if isinstance(meta, dict) else "n/a"),
                        )
                body = json.dumps(payload, ensure_ascii=True)
                yield f"event: {event_name}\n"
                yield f"data: {body}\n\n"
        except Exception as exc:
            logger.exception("stream failed topic=%s max_items=%s", topic, max_items)
            body = json.dumps({"error": str(exc)}, ensure_ascii=True)
            yield "event: error\n"
            yield f"data: {body}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
