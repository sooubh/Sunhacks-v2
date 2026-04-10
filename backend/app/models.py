from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field

from .cities import CityName


class TopicRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=240)
    max_items: int = Field(default=20, ge=5, le=100)
    city: CityName | None = None


class VoiceAssistantRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=360)
    dashboard_context: dict[str, Any] = Field(default_factory=dict)
    mode: Literal["chat", "voice"] = "voice"


class VoiceAssistantResponse(BaseModel):
    reply: str
    provider: Literal["gemini", "ollama", "fallback"]
    model: str
    mode: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SourceSignal(BaseModel):
    id: str
    source_name: str
    source_type: Literal["NEWS_API", "RSS", "WEB_SEARCH"]
    title: str
    url: str
    snippet: str = ""
    published_at: datetime | None = None
    fetched_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    domain: str


class PipelineStage(BaseModel):
    id: Literal["collector", "cleaner", "analyzer", "predictor", "reporter"]
    name: str
    description: str
    status: Literal["IDLE", "RUNNING", "DONE", "ERROR"] = "IDLE"
    items_processed: int = 0
    processing_time: int = 0
    last_run: datetime | None = None


class SourceRef(BaseModel):
    id: str
    name: str
    type: Literal["NEWS_API", "RSS", "WEB_SEARCH"]
    url: str
    fetched_at: datetime


class Entity(BaseModel):
    name: str
    type: Literal["PERSON", "ORGANIZATION", "LOCATION", "EVENT"]


class EvidenceItem(BaseModel):
    source: str
    url: str
    excerpt: str
    fetched_at: datetime


class AlertOut(BaseModel):
    id: str
    title: str
    summary: str
    location: str
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    confidence: int = Field(..., ge=0, le=100)
    escalation_probability: int = Field(..., ge=0, le=100)
    sentiment: Literal["PANIC", "AGGRESSION", "NEUTRAL", "TENSE"]
    category: Literal["PROTEST", "VIOLENCE", "UNREST", "ACCIDENT", "SURVEILLANCE", "UNKNOWN"]
    status: Literal["ACTIVE", "RESOLVED", "MONITORING"] = "ACTIVE"
    entities: list[Entity] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    evidence: list[EvidenceItem] = Field(default_factory=list)
    why_triggered: str
    recommended_actions: list[str] = Field(default_factory=list)
    sources: list[SourceRef] = Field(default_factory=list)
    raw_count: int
    source_validity: Literal["VERIFIED", "MIXED", "UNVERIFIED"]
    impact: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    created_at: datetime
    updated_at: datetime


class TopicResult(BaseModel):
    topic: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    stages: list[PipelineStage]
    alerts: list[AlertOut]
    report: str
    meta: dict[str, Any] = Field(default_factory=dict)
