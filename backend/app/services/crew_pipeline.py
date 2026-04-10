from __future__ import annotations

import logging
import time
from typing import Iterable

try:
    from langchain_ollama import OllamaLLM as LangChainOllama
except Exception:
    try:
        from langchain_community.llms import Ollama as LangChainOllama
    except Exception:
        LangChainOllama = None

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

        gemini_prompt = self._build_prompt(topic=topic, alerts=alerts)
        ollama_prompt = self._build_ollama_prompt(topic=topic, alerts=alerts)

        provider_order = self.settings.reasoning_provider_order()
        gemini_reason = "not_attempted"
        ollama_reason = "not_attempted"
        gemini_model_errors = ""
        ollama_model_errors = ""

        for provider in provider_order:
            if provider == "ollama":
                ollama_text, ollama_meta = self._generate_with_ollama(topic=topic, alerts=alerts, query=ollama_prompt)
                if ollama_text:
                    return ollama_text, ollama_meta

                ollama_reason = ollama_meta.get("reason", "ollama_runtime_error")
                ollama_model_errors = ollama_meta.get("model_errors", "")
                continue

            if genai is None:
                gemini_reason = "gemini_sdk_missing"
                logger.warning("Gemini SDK unavailable; skipping Gemini mode topic=%s", topic)
                continue

            if not self.settings.gemini_api_key:
                gemini_reason = "missing_gemini_key"
                logger.info("Gemini key missing; skipping Gemini mode topic=%s", topic)
                continue

            gemini_text, gemini_meta = self._generate_with_gemini(topic=topic, alerts=alerts, prompt=gemini_prompt)
            if gemini_text:
                return gemini_text, gemini_meta

            gemini_reason = gemini_meta.get("reason", "gemini_runtime_error")
            gemini_model_errors = gemini_meta.get("model_errors", "")

        logger.warning(
            "All AI providers failed topic=%s provider_order=%s gemini_reason=%s ollama_reason=%s",
            topic,
            "->".join(provider_order),
            gemini_reason,
            ollama_reason,
        )

        fallback_meta = {
            "mode": "fallback",
            "reason": "all_ai_providers_failed",
            "provider_order": "->".join(provider_order),
            "gemini_reason": gemini_reason,
            "ollama_reason": ollama_reason,
        }
        if gemini_model_errors:
            fallback_meta["gemini_model_errors"] = gemini_model_errors
        if ollama_model_errors:
            fallback_meta["ollama_model_errors"] = ollama_model_errors
        return self._fallback_report(topic, alerts), fallback_meta

    def _generate_with_gemini(self, topic: str, alerts: list[AlertOut], prompt: str) -> tuple[str | None, dict[str, str]]:
        try:
            client = genai.Client(api_key=self.settings.gemini_api_key)
        except Exception as exc:
            logger.warning("Gemini client init failed topic=%s error=%s", topic, exc)
            return None, {"reason": "gemini_runtime_error"}

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
        return None, {
            "reason": reason,
            "model_errors": " | ".join(model_errors[:2]),
        }

    def _generate_with_ollama(self, topic: str, alerts: list[AlertOut], query: str) -> tuple[str | None, dict[str, str]]:
        if not self.settings.ollama_enabled:
            return None, {"reason": "ollama_disabled"}
        if not self.settings.ollama_base_url:
            return None, {"reason": "missing_ollama_base_url"}
        if LangChainOllama is None:
            logger.warning("LangChain Ollama client unavailable; skipping Ollama mode topic=%s", topic)
            return None, {"reason": "langchain_ollama_missing"}

        route = self._select_ollama_route()
        try:
            text, model_name = self._invoke_ollama_router(route=route, query=query)
            if text:
                logger.info("Ollama report generated topic=%s route=%s model=%s alerts=%d", topic, route, model_name, len(alerts))
                return text, {"mode": "ollama", "model": model_name, "route": route}
            return None, {"reason": "ollama_empty_response", "route": route}
        except Exception as exc:
            logger.warning("Ollama runtime failed topic=%s route=%s error=%s", topic, route, exc)
            return None, {
                "reason": "ollama_runtime_error",
                "route": route,
                "model_errors": str(exc)[:240],
            }

    def _invoke_ollama_router(self, route: str, query: str) -> tuple[str, str]:
        def _build_client(model_name: str, num_predict: int):
            try:
                return LangChainOllama(
                    model=model_name,
                    base_url=self.settings.ollama_base_url,
                    temperature=0.2,
                    num_predict=num_predict,
                    timeout=self.settings.ollama_request_timeout_seconds,
                )
            except TypeError:
                # Some Ollama client variants do not accept timeout.
                return LangChainOllama(
                    model=model_name,
                    base_url=self.settings.ollama_base_url,
                    temperature=0.2,
                    num_predict=num_predict,
                )

        llama = _build_client(self.settings.ollama_llama_model, 450)
        mistral = _build_client(self.settings.ollama_mistral_model, 300)

        # Keep router behavior exactly as requested: fast -> mistral, else -> llama.
        if route == "fast":
            return str(mistral.invoke(query)).strip(), self.settings.ollama_mistral_model
        return str(llama.invoke(query)).strip(), self.settings.ollama_llama_model

    def _select_ollama_route(self) -> str:
        route = (self.settings.ollama_route or "").strip().lower()
        if route == "fast":
            return "fast"
        return "deep"

    @staticmethod
    def _is_transient_error(error_text: str) -> bool:
        text = error_text.upper()
        return "429" in text or "503" in text or "UNAVAILABLE" in text or "TIMEOUT" in text

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

    def _build_ollama_prompt(self, topic: str, alerts: list[AlertOut]) -> str:
        serialized_alerts = self._serialize_alerts_compact(alerts)
        return (
            "You are an OSINT command-center analyst. "
            "Write a concise operations report using only the given evidence.\n\n"
            f"Topic: {topic}\n"
            "Evidence list:\n"
            f"{serialized_alerts}\n\n"
            "Output rules:\n"
            "- Keep total output under 240 words.\n"
            "- Use plain text with these headings: Situation Summary, Reliability Notes, Risk Forecast (6-24h), Priority Actions.\n"
            "- In Priority Actions, provide exactly 3 bullet points.\n"
            "- Do not invent facts beyond the evidence list.\n"
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
    def _serialize_alerts_compact(alerts: Iterable[AlertOut]) -> str:
        chunks: list[str] = []
        for alert in list(alerts)[:6]:
            chunks.append(
                f"- {alert.title[:110]} | risk={alert.risk_level} | conf={alert.confidence}% | "
                f"location={alert.location} | validity={alert.source_validity} | impact={alert.impact}"
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
