from __future__ import annotations

from typing import Iterable

from ..config import Settings
from ..models import AlertOut

try:
    from crewai import Agent, Crew, Process, Task, LLM
except Exception:
    Agent = Crew = Process = Task = LLM = None


class CrewReporter:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def generate_report(self, topic: str, alerts: list[AlertOut]) -> tuple[str, dict[str, str]]:
        if not alerts:
            return (
                "No actionable signals were collected for this topic in this run.",
                {"mode": "empty"},
            )

        if Agent is None or Crew is None or Task is None or Process is None:
            return self._fallback_report(topic, alerts), {"mode": "fallback", "reason": "crewai_not_installed"}

        llm = self._build_llm()
        if llm is None:
            return self._fallback_report(topic, alerts), {"mode": "fallback", "reason": "missing_openai_key"}

        serialized_alerts = self._serialize_alerts(alerts)

        collector_agent = Agent(
            role="OSINT Collector Agent",
            goal="Summarize the strongest facts from multi-source OSINT signals for the given topic.",
            backstory="You are an intelligence collector focused on factual extraction and source grounded evidence.",
            llm=llm,
            allow_delegation=False,
            verbose=False,
        )
        validator_agent = Agent(
            role="Source Validation Agent",
            goal="Highlight reliability, possible misinformation flags, and confidence consistency.",
            backstory="You validate source credibility and detect weak or conflicting evidence quickly.",
            llm=llm,
            allow_delegation=False,
            verbose=False,
        )
        analyst_agent = Agent(
            role="Risk Analysis Agent",
            goal="Infer likely impact and escalation outcomes using the current dataset.",
            backstory="You transform signal evidence into operationally useful risk intelligence.",
            llm=llm,
            allow_delegation=False,
            verbose=False,
        )
        reporter_agent = Agent(
            role="Operations Briefing Agent",
            goal="Produce a concise but detailed final briefing for command center operators.",
            backstory="You write executive summaries and recommend immediate actions.",
            llm=llm,
            allow_delegation=False,
            verbose=False,
        )

        collect_task = Task(
            description=(
                "Topic: {topic}. Use this dataset to list the most important confirmed facts and evidence:\n"
                "{dataset}\n"
                "Return a concise bullet summary with references to source names and risk level."
            ),
            expected_output="A compact evidence-first summary of key incidents.",
            agent=collector_agent,
        )
        validate_task = Task(
            description=(
                "Using the same dataset, identify misinformation risk indicators, source disagreements, and confidence caveats."
            ),
            expected_output="A reliability audit with clear caveats and trust signals.",
            agent=validator_agent,
        )
        analyze_task = Task(
            description=(
                "Infer top escalation scenarios and probable impact windows in the next 6-24 hours."
            ),
            expected_output="Risk projection with probability-weighted outcomes.",
            agent=analyst_agent,
        )
        report_task = Task(
            description=(
                "Create the final operational briefing with three sections: Situation, Validation, Recommended Actions."
            ),
            expected_output="A final structured briefing for field and command teams.",
            agent=reporter_agent,
        )

        try:
            crew = Crew(
                agents=[collector_agent, validator_agent, analyst_agent, reporter_agent],
                tasks=[collect_task, validate_task, analyze_task, report_task],
                process=Process.sequential,
                verbose=False,
            )
            result = crew.kickoff(inputs={"topic": topic, "dataset": serialized_alerts})
            text = str(result).strip() or self._fallback_report(topic, alerts)
            return text, {"mode": "crewai"}
        except Exception as exc:
            fallback = self._fallback_report(topic, alerts)
            return f"{fallback}\n\nCrewAI runtime warning: {exc}", {"mode": "fallback", "reason": "crewai_runtime_error"}

    def _build_llm(self):
        if not self.settings.openai_api_key or LLM is None:
            return None
        return LLM(model=self.settings.openai_model, api_key=self.settings.openai_api_key)

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
