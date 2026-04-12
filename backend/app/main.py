from __future__ import annotations

import json
import logging

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .config import Settings
from .models import TopicRequest, TopicResult, VoiceAssistantRequest, VoiceAssistantResponse
from .services.collectors import OSINTCollector
from .services import crew_pipeline
from .services.crew_pipeline import CrewReporter
from .services.live_voice_ws import LiveVoiceWebSocketGateway
from .services.orchestrator import PipelineOrchestrator
from .services.voice_assistant import VoiceAssistantService

load_dotenv()
settings = Settings.from_env()
logger = logging.getLogger(__name__)

app = FastAPI(
    title="LEIS Realtime Agent API",
    version="0.1.0",
    description="FastAPI backend for realtime OSINT analysis with Ollama-first report reasoning and Gemini live voice assistant.",
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
voice_assistant = VoiceAssistantService(settings=settings)
live_voice_gateway = LiveVoiceWebSocketGateway(settings=settings)


@app.get("/health")
def health() -> dict:
    provider_order = settings.reasoning_provider_order()
    local_only = provider_order == ("ollama",)

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
            "ollama": bool(settings.ollama_enabled and settings.ollama_base_url),
        },
        "ai": {
            "gemini_enabled": bool(settings.gemini_api_key),
            "local_only": local_only,
            "crewai_available": crew_pipeline.Agent is not None,
            "active_reasoning_providers": list(provider_order),
            "gemini_live_model": settings.gemini_live_model,
            "gemini_live_ws_enabled": bool(settings.gemini_api_key),
            "ollama_enabled": bool(settings.ollama_enabled and settings.ollama_base_url),
            "reasoning_provider_order": "->".join(provider_order),
            "ollama_route": settings.ollama_route,
            "ollama_llama_model": settings.ollama_llama_model,
            "ollama_mistral_model": settings.ollama_mistral_model,
            "ollama_base_url": settings.ollama_base_url,
        },
    }


@app.websocket("/ws/voice/live")
async def voice_live_socket(websocket: WebSocket):
    await live_voice_gateway.handle(websocket)


@app.get("/api/realtime/sources")
def list_sources() -> dict:
    provider_order = settings.reasoning_provider_order()
    local_only = provider_order == ("ollama",)

    return {
        "rss_feeds": [],
        "web_scraper_urls": [],
        "tavily_recent_days": settings.tavily_recent_days,
        "integrations": {
            "tavily": bool(settings.tavily_api_key),
            "newsapi": bool(settings.newsapi_key),
            "newsdata": bool(settings.newsdata_api_key),
            "gnews": bool(settings.gnews_api_key),
            "rss": False,
            "web_scraper": False,
            "gemini_llm": bool(settings.gemini_api_key) and not local_only,
            "ollama_llm": bool(settings.ollama_enabled and settings.ollama_base_url),
            "crewai": crew_pipeline.Agent is not None,
            "local_only": local_only,
            "active_reasoning_providers": list(provider_order),
        },
    }


@app.post("/api/realtime/topic", response_model=TopicResult)
def run_topic(payload: TopicRequest) -> TopicResult:
    try:
        result = orchestrator.run(topic=payload.topic, max_items=payload.max_items, city=payload.city)
        meta = result.meta or {}
        mode = str(meta.get("mode", "unknown"))
        if mode in {"gemini", "ollama", "crewai"}:
            logger.info(
                "topic analysis success topic=%s city=%s alerts=%d mode=%s model=%s",
                payload.topic,
                payload.city,
                len(result.alerts),
                mode,
                meta.get("model", "n/a"),
            )
        else:
            logger.warning(
                "topic analysis fallback topic=%s city=%s alerts=%d mode=%s reason=%s",
                payload.topic,
                payload.city,
                len(result.alerts),
                mode,
                meta.get("reason", "n/a"),
            )
        return result
    except Exception as exc:
        logger.exception("topic analysis failed topic=%s max_items=%s", payload.topic, payload.max_items)
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {exc}") from exc


@app.post("/api/voice/assistant", response_model=VoiceAssistantResponse)
def voice_chat(payload: VoiceAssistantRequest) -> VoiceAssistantResponse:
    try:
        reply, meta = voice_assistant.ask(
            query=payload.query,
            dashboard_context=payload.dashboard_context,
            assistant_mode=payload.mode,
        )
        provider_raw = str(meta.get("provider", "fallback")).lower()
        provider = provider_raw if provider_raw in {"gemini", "ollama", "crewai", "fallback"} else "fallback"
        model = str(meta.get("model", "unknown"))
        mode = str(meta.get("mode", "voice_assistant"))

        logger.info(
            "voice assistant response provider=%s model=%s mode=%s query_len=%d",
            provider,
            model,
            mode,
            len(payload.query),
        )
        return VoiceAssistantResponse(
            reply=reply,
            provider=provider,
            model=model,
            mode=mode,
        )
    except Exception as exc:
        logger.exception("voice assistant failed query=%s", payload.query)
        raise HTTPException(status_code=500, detail=f"Voice assistant failed: {exc}") from exc


@app.get("/api/realtime/stream")
def stream_topic(
    topic: str = Query(..., min_length=2, max_length=240),
    max_items: int = Query(20, ge=5, le=100),
    city: str | None = Query(None, min_length=3, max_length=32),
):
    def event_stream():
        logger.info("stream started topic=%s city=%s max_items=%s", topic, city, max_items)
        try:
            for event_name, payload in orchestrator.stream(topic=topic, max_items=max_items, city=city):
                if event_name == "result":
                    meta = payload.get("meta", {}) if isinstance(payload, dict) else {}
                    mode = str(meta.get("mode", "unknown")) if isinstance(meta, dict) else "unknown"
                    if mode in {"gemini", "ollama", "crewai"}:
                        logger.info(
                            "stream result success topic=%s city=%s mode=%s model=%s",
                            topic,
                            city,
                            mode,
                            (meta.get("model", "n/a") if isinstance(meta, dict) else "n/a"),
                        )
                    else:
                        logger.warning(
                            "stream result fallback topic=%s city=%s mode=%s reason=%s",
                            topic,
                            city,
                            mode,
                            (meta.get("reason", "n/a") if isinstance(meta, dict) else "n/a"),
                        )
                body = json.dumps(payload, ensure_ascii=True)
                yield f"event: {event_name}\n"
                yield f"data: {body}\n\n"
        except Exception as exc:
            logger.exception("stream failed topic=%s city=%s max_items=%s", topic, city, max_items)
            body = json.dumps({"error": str(exc)}, ensure_ascii=True)
            yield "event: error\n"
            yield f"data: {body}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
