from __future__ import annotations

import logging
import time
from typing import Iterable

import requests

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

        prompt = self._build_prompt(topic=topic, alerts=alerts)

        gemini_reason = ""
        if genai is None:
            gemini_reason = "gemini_sdk_missing"
            logger.warning("Gemini SDK unavailable; skipping Gemini mode topic=%s", topic)
        elif not self.settings.gemini_api_key:
            gemini_reason = "missing_gemini_key"
            logger.info("Gemini key missing; skipping Gemini mode topic=%s", topic)
        else:
            gemini_text, gemini_meta = self._generate_with_gemini(topic=topic, alerts=alerts, prompt=prompt)
            if gemini_text:
                return gemini_text, gemini_meta
            gemini_reason = gemini_meta.get("reason", "gemini_runtime_error")

        ollama_prompt = self._build_ollama_prompt(topic=topic, alerts=alerts)
        ollama_text, ollama_meta = self._generate_with_ollama(topic=topic, alerts=alerts, prompt=ollama_prompt)
        if ollama_text:
            return ollama_text, ollama_meta

        logger.warning(
            "All AI providers failed topic=%s gemini_reason=%s ollama_reason=%s",
            topic,
            gemini_reason or "none",
            ollama_meta.get("reason", "none"),
        )

        fallback_meta = {
            "mode": "fallback",
            "reason": "all_ai_providers_failed",
            "gemini_reason": gemini_reason or "not_attempted",
            "ollama_reason": ollama_meta.get("reason", "unknown"),
        }
        if ollama_meta.get("model_errors"):
            fallback_meta["model_errors"] = ollama_meta["model_errors"]
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

    def _generate_with_ollama(self, topic: str, alerts: list[AlertOut], prompt: str) -> tuple[str | None, dict[str, str]]:
        if not self.settings.ollama_enabled:
            return None, {"reason": "ollama_disabled"}
        if not self.settings.ollama_base_url:
            return None, {"reason": "missing_ollama_base_url"}
        if LangChainOllama is None:
            logger.warning("LangChain Ollama client unavailable; skipping Ollama mode topic=%s", topic)
            return None, {"reason": "langchain_ollama_missing"}

        model_errors: list[str] = []
        available_models = self._available_ollama_models()

        # Requested Ollama model clients (external Ollama API via base_url).
        llama = LangChainOllama(
            model="llama3:8b",
            base_url=self.settings.ollama_base_url,
            temperature=0.2,
            num_predict=450,
        )
        mistral = LangChainOllama(
            model="mistral:7b",
            base_url=self.settings.ollama_base_url,
            temperature=0.2,
            num_predict=450,
        )
        predefined_clients = {
            "llama3:8b": llama,
            "mistral:7b": mistral,
        }

        for model_name in self._candidate_ollama_models(available_models=available_models):
            max_attempts = 1
            for attempt in range(1, max_attempts + 1):
                try:
                    logger.debug(
                        "Ollama model attempt topic=%s model=%s attempt=%d/%d alerts=%d",
                        topic,
                        model_name,
                        attempt,
                        max_attempts,
                        len(alerts),
                    )
                    client = predefined_clients.get(model_name)
                    if client is None:
                        client = LangChainOllama(
                            model=model_name,
                            base_url=self.settings.ollama_base_url,
                            temperature=0.2,
                            num_predict=450,
                        )

                    text = str(client.invoke(prompt)).strip()
                    if text:
                        logger.info("Ollama report generated topic=%s model=%s alerts=%d", topic, model_name, len(alerts))
                        return text, {"mode": "ollama", "model": model_name}

                    if attempt < max_attempts:
                        logger.warning(
                            "Ollama empty response; retrying topic=%s model=%s attempt=%d",
                            topic,
                            model_name,
                            attempt,
                        )
                        time.sleep(0.8 * attempt)
                        continue

                    model_errors.append(f"{model_name}: empty_response")
                    break
                except Exception as model_exc:
                    error_text = str(model_exc)
                    should_retry = self._is_transient_error(error_text) and attempt < max_attempts
                    logger.warning(
                        "Ollama model call failed topic=%s model=%s attempt=%d error=%s",
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

        reason = "ollama_empty_response" if model_errors and all("empty_response" in e for e in model_errors) else "ollama_runtime_error"
        return None, {
            "reason": reason,
            "model_errors": " | ".join(model_errors[:2]),
        }

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

    def _available_ollama_models(self) -> set[str]:
        if not self.settings.ollama_base_url:
            return set()

        try:
            response = requests.get(
                f"{self.settings.ollama_base_url}/api/tags",
                timeout=min(10, self.settings.ollama_request_timeout_seconds),
            )
            response.raise_for_status()
            payload = response.json()
            models = {
                (item.get("name") or "").strip()
                for item in payload.get("models", [])
                if isinstance(item, dict)
            }
            return {name for name in models if name}
        except Exception as exc:
            logger.warning("Ollama tags check failed base_url=%s error=%s", self.settings.ollama_base_url, exc)
            return set()

    def _candidate_ollama_models(self, available_models: set[str]) -> list[str]:
        configured = (self.settings.ollama_model or "").strip()
        preferred = [
            configured,
            "llama3:8b",
            "mistral:7b",
            "llama3.2:latest",
        ]

        deduped: list[str] = []
        for name in preferred:
            if not name:
                continue
            if available_models and name not in available_models:
                continue
            if name not in deduped:
                deduped.append(name)

        if deduped:
            return deduped

        if available_models:
            return sorted(available_models)

        return [configured] if configured else ["llama3:8b"]

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
