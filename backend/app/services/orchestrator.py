from __future__ import annotations

from datetime import datetime, timezone
import re
from time import perf_counter
from typing import Generator

from ..models import (
    AlertOut,
    Entity,
    EvidenceItem,
    PipelineStage,
    SourceRef,
    SourceSignal,
    TopicResult,
)
from .collectors import OSINTCollector
from .crew_pipeline import CrewReporter
from .scoring import (
    confidence_score,
    escalation_probability,
    extract_keywords,
    infer_category,
    infer_impact,
    infer_location,
    infer_risk,
    infer_sentiment,
    recommended_actions,
    validity_label,
)


class PipelineOrchestrator:
    def __init__(self, collector: OSINTCollector, reporter: CrewReporter) -> None:
        self.collector = collector
        self.reporter = reporter

    def run(self, topic: str, max_items: int) -> TopicResult:
        result_payload: dict | None = None
        for event_name, payload in self.stream(topic=topic, max_items=max_items):
            if event_name == "result":
                result_payload = payload

        if result_payload is None:
            raise RuntimeError("Pipeline finished without producing a result payload")

        return TopicResult.model_validate(result_payload)

    def stream(self, topic: str, max_items: int) -> Generator[tuple[str, dict], None, None]:
        stages = self._initial_stages()
        stage_map = {stage.id: stage for stage in stages}

        def emit_stage(stage_id: str, *, status: str, items: int = 0, duration_ms: int = 0) -> dict:
            stage = stage_map[stage_id]
            stage.status = status  # type: ignore[assignment]
            stage.items_processed = items
            stage.processing_time = duration_ms
            stage.last_run = datetime.now(timezone.utc)
            return stage.model_dump(mode="json")

        collector_start = perf_counter()
        yield "stage", emit_stage("collector", status="RUNNING")
        raw_signals = self.collector.collect(topic=topic, max_items=max_items)
        collector_ms = int((perf_counter() - collector_start) * 1000)
        yield "stage", emit_stage(
            "collector",
            status="DONE",
            items=len(raw_signals),
            duration_ms=collector_ms,
        )

        cleaner_start = perf_counter()
        yield "stage", emit_stage("cleaner", status="RUNNING")
        cleaned_signals = self._dedupe_signals(raw_signals)
        cleaner_ms = int((perf_counter() - cleaner_start) * 1000)
        yield "stage", emit_stage(
            "cleaner",
            status="DONE",
            items=len(cleaned_signals),
            duration_ms=cleaner_ms,
        )

        analyzer_start = perf_counter()
        yield "stage", emit_stage("analyzer", status="RUNNING")
        analyzed_items = [self._analyze_signal(signal) for signal in cleaned_signals]
        analyzer_ms = int((perf_counter() - analyzer_start) * 1000)
        yield "stage", emit_stage(
            "analyzer",
            status="DONE",
            items=len(analyzed_items),
            duration_ms=analyzer_ms,
        )

        predictor_start = perf_counter()
        yield "stage", emit_stage("predictor", status="RUNNING")
        alerts = self._build_alerts(topic=topic, analyzed_items=analyzed_items)
        predictor_ms = int((perf_counter() - predictor_start) * 1000)
        yield "stage", emit_stage(
            "predictor",
            status="DONE",
            items=len(alerts),
            duration_ms=predictor_ms,
        )

        reporter_start = perf_counter()
        yield "stage", emit_stage("reporter", status="RUNNING")
        report_text, report_meta = self.reporter.generate_report(topic=topic, alerts=alerts)
        reporter_ms = int((perf_counter() - reporter_start) * 1000)
        yield "stage", emit_stage(
            "reporter",
            status="DONE",
            items=len(alerts),
            duration_ms=reporter_ms,
        )

        result = TopicResult(
            topic=topic,
            generated_at=datetime.now(timezone.utc),
            stages=list(stage_map.values()),
            alerts=alerts,
            report=report_text,
            meta={
                "topic": topic,
                "max_items": max_items,
                "sources_collected": len(raw_signals),
                "sources_after_cleaning": len(cleaned_signals),
                **report_meta,
            },
        )
        yield "result", result.model_dump(mode="json")

    @staticmethod
    def _initial_stages() -> list[PipelineStage]:
        return [
            PipelineStage(
                id="collector",
                name="OSINT Collector",
                description="Fetches from NewsAPI, NewsData, GNews, Tavily (recent news), RSS, Google News, and website scraping",
            ),
            PipelineStage(
                id="cleaner",
                name="Data Cleaner",
                description="Removes duplicates and weak noisy items",
            ),
            PipelineStage(
                id="analyzer",
                name="AI Analyzer",
                description="Classifies category, sentiment, keywords, and location",
            ),
            PipelineStage(
                id="predictor",
                name="Risk Predictor",
                description="Assigns confidence, risk, impact, and action recommendations",
            ),
            PipelineStage(
                id="reporter",
                name="Gemini Reporter",
                description="Generates final operational briefing with Gemini",
            ),
        ]

    @staticmethod
    def _dedupe_signals(signals: list[SourceSignal]) -> list[SourceSignal]:
        deduped: dict[str, SourceSignal] = {}
        for signal in signals:
            title_key = re.sub(r"[^a-z0-9]+", "", signal.title.lower())[:80]
            key = f"{signal.domain}:{title_key}"
            deduped.setdefault(key, signal)

        return list(deduped.values())

    @staticmethod
    def _analyze_signal(signal: SourceSignal) -> dict:
        text = f"{signal.title}. {signal.snippet}".strip()
        category = infer_category(text)
        risk = infer_risk(text)
        sentiment = infer_sentiment(text)
        location = infer_location(text)
        keywords = extract_keywords(text)
        confidence = confidence_score(
            text=text,
            domain=signal.domain,
            has_published_at=signal.published_at is not None,
        )
        validity = validity_label(confidence)
        impact = infer_impact(risk=risk, confidence=confidence)
        escalation = escalation_probability(risk=risk, confidence=confidence)
        actions = recommended_actions(category=category, risk=risk)

        return {
            "signal": signal,
            "category": category,
            "risk": risk,
            "sentiment": sentiment,
            "location": location,
            "keywords": keywords,
            "confidence": confidence,
            "validity": validity,
            "impact": impact,
            "escalation": escalation,
            "actions": actions,
        }

    @staticmethod
    def _build_alerts(topic: str, analyzed_items: list[dict]) -> list[AlertOut]:
        def rank(item: dict) -> tuple[int, int]:
            risk_order = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}
            return risk_order[item["risk"]], item["confidence"]

        sorted_items = sorted(analyzed_items, key=rank, reverse=True)
        now = datetime.now(timezone.utc)

        alerts: list[AlertOut] = []
        for idx, item in enumerate(sorted_items[:30], start=1):
            signal: SourceSignal = item["signal"]
            alert_id = f"ALT-{now.strftime('%Y%m%d%H%M%S')}-{idx:03d}"

            summary = (
                f"Topic '{topic}' matched signal from {signal.source_name}. "
                f"Detected category={item['category']} with {item['risk']} risk and {item['confidence']}% confidence."
            )
            why_triggered = (
                f"Signal scored {item['risk']} risk due to detected keywords {item['keywords'][:4]} and "
                f"source validity {item['validity']}. Sentiment={item['sentiment']}, impact={item['impact']}."
            )

            alerts.append(
                AlertOut(
                    id=alert_id,
                    title=signal.title,
                    summary=summary,
                    location=item["location"],
                    risk_level=item["risk"],
                    confidence=item["confidence"],
                    escalation_probability=item["escalation"],
                    sentiment=item["sentiment"],
                    category=item["category"],
                    status="ACTIVE",
                    entities=[
                        Entity(name=item["location"], type="LOCATION"),
                        Entity(name=signal.source_name, type="ORGANIZATION"),
                    ],
                    keywords=item["keywords"],
                    evidence=[
                        EvidenceItem(
                            source=signal.source_name,
                            url=signal.url,
                            excerpt=signal.snippet or signal.title,
                            fetched_at=signal.fetched_at,
                        )
                    ],
                    why_triggered=why_triggered,
                    recommended_actions=item["actions"],
                    sources=[
                        SourceRef(
                            id=signal.id,
                            name=signal.source_name,
                            type=signal.source_type,
                            url=signal.url,
                            fetched_at=signal.fetched_at,
                        )
                    ],
                    raw_count=1,
                    source_validity=item["validity"],
                    impact=item["impact"],
                    created_at=signal.published_at or now,
                    updated_at=now,
                )
            )

        return alerts
