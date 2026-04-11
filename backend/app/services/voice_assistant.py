from __future__ import annotations

import json
import logging
from typing import Any

from ..config import Settings

try:
    from google import genai
except Exception:
    genai = None


logger = logging.getLogger(__name__)


class VoiceAssistantService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def ask(
        self,
        query: str,
        dashboard_context: dict[str, Any],
        assistant_mode: str = "voice",
    ) -> tuple[str, dict[str, str]]:
        mode = "chat" if assistant_mode == "chat" else "voice"
        prompt = self._build_prompt(query=query, dashboard_context=dashboard_context, assistant_mode=mode)

        gemini_text, gemini_meta = self._ask_with_gemini(query=query, prompt=prompt, assistant_mode=mode)
        if gemini_text:
            return gemini_text, gemini_meta

        fallback = self._fallback_reply(query=query, dashboard_context=dashboard_context, assistant_mode=mode)
        return fallback, {
            "provider": "fallback",
            "mode": "chat_fallback" if mode == "chat" else "voice_fallback",
            "model": "deterministic",
            "reason": f"gemini={gemini_meta.get('reason', 'unknown')};gemini_only_voice_chat=true",
        }

    def _ask_with_gemini(self, query: str, prompt: str, assistant_mode: str) -> tuple[str | None, dict[str, str]]:
        if genai is None:
            return None, {"reason": "gemini_sdk_missing"}
        if not self.settings.gemini_api_key:
            return None, {"reason": "missing_gemini_key"}

        try:
            client = genai.Client(api_key=self.settings.gemini_api_key)
        except Exception as exc:
            logger.warning("Gemini voice client init failed query=%s error=%s", query, exc)
            return None, {"reason": "gemini_runtime_error"}

        model_errors: list[str] = []
        for model_name in self._gemini_candidates():
            try:
                response = client.models.generate_content(model=model_name, contents=prompt)
                text = (getattr(response, "text", "") or "").strip()
                if text:
                    mode_name = "gemini_smart_chat" if assistant_mode == "chat" else "gemini_live_voice"
                    return text, {
                        "provider": "gemini",
                        "mode": mode_name,
                        "model": model_name,
                    }
                model_errors.append(f"{model_name}:empty_response")
            except Exception as exc:
                model_errors.append(f"{model_name}:{str(exc)[:100]}")

        return None, {
            "reason": "gemini_voice_error",
            "model_errors": " | ".join(model_errors[:2]),
        }

    def _gemini_candidates(self) -> list[str]:
        configured = (self.settings.gemini_live_model or "").strip()
        candidates = [
            configured,
            "gemini-2.5-flash-preview-native-audio-dialog",
            "gemini-2.5-flash",
            "gemini-flash-latest",
        ]

        out: list[str] = []
        for name in candidates:
            if name and name not in out:
                out.append(name)
        return out

    def _build_prompt(self, query: str, dashboard_context: dict[str, Any], assistant_mode: str) -> str:
        context_json = self._compact_context_json(dashboard_context)
        if assistant_mode == "chat":
            return (
                "You are Cyna Smart Chat Analyst for a public safety command dashboard. "
                "Understand the user question deeply and answer with structured, tactical intelligence. "
                "Use only the provided dashboard context and user query.\n\n"
                f"User query: {query}\n"
                f"Dashboard context JSON: {context_json}\n\n"
                "Response format (plain text):\n"
                "1) Situation: one concise paragraph.\n"
                "2) Risk Snapshot: high/medium/low counts and top pressure location if present.\n"
                "3) Signal Flow Diagram: one ASCII flow line using arrows (for example A -> B -> C).\n"
                "4) Recommended Actions: exactly 3 numbered actions.\n"
                "Grounding rules:\n"
                "- Base your answer on stats, topAlerts, recentAlerts, categoryBreakdown, locationBreakdown, pipelineStages, and latestReportSnippet when available.\n"
                "- If recentAlerts exist, mention at least one specific alert id/title/location in the Situation section.\n"
                "- If user asks for patterns, compare categoryBreakdown and locationBreakdown explicitly.\n"
                "- If requested data is missing in context, clearly state what is missing instead of inventing facts.\n"
                "Keep total response under 230 words and avoid markdown tables."
            )

        return (
            "You are LEIS Voice Copilot for a real-time command dashboard. "
            "Answer like a direct live operations assistant for spoken conversation. "
            "Use only the provided dashboard context and the user query. "
            "If context is missing, say what is missing briefly.\n\n"
            f"User query: {query}\n"
            f"Dashboard context JSON: {context_json}\n\n"
            "Response rules:\n"
            "- Keep under 90 words.\n"
            "- Use short, easy-to-speak sentences.\n"
            "- Mention high/medium/low risk counts when available.\n"
            "- End with one direct action recommendation.\n"
            "- Plain text only.\n"
        )

    @staticmethod
    def _compact_context_json(dashboard_context: dict[str, Any]) -> str:
        try:
            text = json.dumps(dashboard_context, ensure_ascii=True, default=str)
        except Exception:
            return "{}"

        max_chars = 3600
        if len(text) <= max_chars:
            return text
        return f"{text[:max_chars]}..."

    @staticmethod
    def _fallback_reply(query: str, dashboard_context: dict[str, Any], assistant_mode: str) -> str:
        stats = dashboard_context.get("stats", {}) if isinstance(dashboard_context, dict) else {}
        active = stats.get("activeAlerts", "unknown")
        high = stats.get("highRisk", "unknown")
        medium = stats.get("mediumRisk", "unknown")
        low = stats.get("lowRisk", "unknown")
        top_location = stats.get("topLocation", "unknown location")

        if assistant_mode == "chat":
            return (
                "Situation: Live AI models are temporarily unavailable, so this is a deterministic smart summary. "
                f"You asked: '{query}'.\n"
                f"Risk Snapshot: active={active}, high={high}, medium={medium}, low={low}; top pressure={top_location}.\n"
                "Signal Flow Diagram: incoming query -> dashboard context scan -> risk snapshot -> action priority.\n"
                "Recommended Actions:\n"
                "1. Trigger one fresh pipeline run for updated evidence.\n"
                "2. Prioritize response teams in the top pressure location.\n"
                "3. Re-check high risk alerts for escalation signs in 10 minutes."
            )

        return (
            f"Live voice model is temporarily unavailable. For your query '{query}', "
            f"current dashboard shows active={active}, high={high}, medium={medium}, low={low}, "
            f"with top pressure at {top_location}. Recommend running a fresh pipeline cycle before escalation."
        )
