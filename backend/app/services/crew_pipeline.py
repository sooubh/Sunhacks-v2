from __future__ import annotations

import logging
import time
from typing import Iterable

from ..config import Settings
from ..models import AlertOut

try:
    from google import genai
except Exception:
    genai = None


logger = logging.getLogger(__name__)


class CrewReporter:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def generate_report(self, topic: str, alerts: list[AlertOut]) -> tuple[str, dict[str, str]]:
        if not alerts:
            return (
                "No actionable signals were collected for this topic in this run.",
                {"mode": "empty"},
            )

        if genai is None:
            logger.warning("Gemini SDK unavailable; using fallback report mode topic=%s", topic)
            return self._fallback_report(topic, alerts), {"mode": "fallback", "reason": "gemini_sdk_missing"}

        if not self.settings.gemini_api_key:
            logger.warning("Gemini key missing; using fallback report mode topic=%s", topic)
            return self._fallback_report(topic, alerts), {"mode": "fallback", "reason": "missing_gemini_key"}

        prompt = self._build_prompt(topic=topic, alerts=alerts)

        try:
            client = genai.Client(api_key=self.settings.gemini_api_key)
            model_errors: list[str] = []

            for model_name in self._candidate_models():
                max_attempts = 2
                for attempt in range(1, max_attempts + 1):
                    try:
                        logger.debug(
                            "Gemini model attempt topic=%s model=%s attempt=%d/%d alerts=%d",
                            topic,
                            model_name,
                            attempt,
                            max_attempts,
                            len(alerts),
                        )
                        response = client.models.generate_content(
                            model=model_name,
                            contents=prompt,
                        )
                        text = (getattr(response, "text", "") or "").strip()

                        if text:
                            logger.info("Gemini report generated topic=%s model=%s alerts=%d", topic, model_name, len(alerts))
                            return text, {"mode": "gemini", "model": model_name}

                        if attempt < max_attempts:
                            logger.warning(
                                "Gemini empty response; retrying topic=%s model=%s attempt=%d",
                                topic,
                                model_name,
                                attempt,
                            )
                            time.sleep(0.8 * attempt)
                            continue

                        model_errors.append(f"{model_name}: empty_response")
                        logger.warning("Gemini returned empty response topic=%s model=%s", topic, model_name)
                        break
                    except Exception as model_exc:
                        error_text = str(model_exc)
                        should_retry = self._is_transient_error(error_text) and attempt < max_attempts
                        logger.warning(
                            "Gemini model call failed topic=%s model=%s attempt=%d error=%s",
                            topic,
                            model_name,
                            attempt,
                            model_exc,
                        )

                        if should_retry:
                            time.sleep(0.8 * attempt)
                            continue

                        model_errors.append(f"{model_name}: {error_text}")
                        break

            reason = "gemini_empty_response" if model_errors and all("empty_response" in e for e in model_errors) else "gemini_runtime_error"
            logger.warning(
                "Gemini report fallback topic=%s reason=%s model_errors=%s",
                topic,
                reason,
                " | ".join(model_errors[:2]) if model_errors else "none",
            )

            return self._fallback_report(topic, alerts), {
                "mode": "fallback",
                "reason": reason,
                "model_errors": " | ".join(model_errors[:2]),
            }
        except Exception as exc:
            logger.exception("Gemini client/runtime failure topic=%s", topic)
            fallback = self._fallback_report(topic, alerts)
            return f"{fallback}\n\nGemini runtime warning: {exc}", {
                "mode": "fallback",
                "reason": "gemini_runtime_error",
            }

    @staticmethod
    def _is_transient_error(error_text: str) -> bool:
        text = error_text.upper()
        return "503" in text or "UNAVAILABLE" in text or "TIMEOUT" in text

    def _candidate_models(self) -> list[str]:
        configured = (self.settings.gemini_model or "").strip()
        candidates = [
            configured,
            "gemini-flash-latest",
            "gemini-2.5-flash",
            "gemini-2.0-flash",
        ]

        deduped: list[str] = []
        for name in candidates:
            if not name:
                continue
            if name not in deduped:
                deduped.append(name)
        return deduped

    def _build_prompt(self, topic: str, alerts: list[AlertOut]) -> str:
        serialized_alerts = self._serialize_alerts(alerts)
        return (
            "You are an OSINT command-center analyst. "
            "Create a detailed and operationally useful report for law-enforcement officers.\n\n"
            f"Topic: {topic}\n"
            "Use the following evidence list:\n"
            f"{serialized_alerts}\n\n"
            "Output format:\n"
            "1) Situation Summary\n"
            "2) Source Reliability and Fake-risk Notes\n"
            "3) Risk and Impact Forecast (next 6-24 hours)\n"
            "4) Recommended Actions (prioritized)\n"
            "5) Short executive briefing (5 bullet points)\n"
        )

    @staticmethod
    def _serialize_alerts(alerts: Iterable[AlertOut]) -> str:
        chunks: list[str] = []
        for alert in alerts:
            chunks.append(
                f"- {alert.title} | risk={alert.risk_level} | confidence={alert.confidence}% | "
                f"location={alert.location} | source_validity={alert.source_validity} | "
                f"impact={alert.impact} | actions={'; '.join(alert.recommended_actions[:2])}"
            )
        return "\n".join(chunks)

    @staticmethod
    def _fallback_report(topic: str, alerts: list[AlertOut]) -> str:
        high = [a for a in alerts if a.risk_level == "HIGH"]
        medium = [a for a in alerts if a.risk_level == "MEDIUM"]
        low = [a for a in alerts if a.risk_level == "LOW"]

        lines = [
            f"Topic: {topic}",
            f"Total signals processed: {len(alerts)}",
            f"Risk split: HIGH={len(high)}, MEDIUM={len(medium)}, LOW={len(low)}",
            "Top actionable alerts:",
        ]
        for alert in alerts[:5]:
            lines.append(
                f"- {alert.title} ({alert.location}) | risk={alert.risk_level}, confidence={alert.confidence}%, impact={alert.impact}"
            )

        lines.append("Priority actions:")
        action_pool: list[str] = []
        for alert in alerts[:3]:
            action_pool.extend(alert.recommended_actions[:2])
        for action in list(dict.fromkeys(action_pool))[:5]:
            lines.append(f"- {action}")

        return "\n".join(lines)
