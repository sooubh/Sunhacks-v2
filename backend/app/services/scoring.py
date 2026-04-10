from __future__ import annotations

import re
from typing import Literal

RISK_KEYWORDS = {
    "HIGH": {
        "riot",
        "explosion",
        "shooting",
        "bomb",
        "terror",
        "violent",
        "lynching",
        "curfew",
        "clash",
        "stampede",
        "hostage",
    },
    "MEDIUM": {
        "protest",
        "strike",
        "blockade",
        "march",
        "injured",
        "accident",
        "arson",
        "vandalism",
        "unrest",
        "panic",
    },
    "LOW": {
        "advisory",
        "monitor",
        "warning",
        "awareness",
        "crowd",
        "traffic",
        "investigation",
    },
}

CATEGORY_RULES = {
    "PROTEST": {"protest", "march", "demonstration", "rally", "strike", "sit-in"},
    "VIOLENCE": {"riot", "clash", "violent", "attack", "arson", "shooting", "bomb"},
    "UNREST": {"tension", "unrest", "panic", "disturbance", "blockade", "agitation"},
    "ACCIDENT": {"accident", "collision", "crash", "fire", "flood", "stampede"},
    "SURVEILLANCE": {"monitor", "watchlist", "tracking", "intel", "investigation"},
}

SENTIMENT_RULES = {
    "PANIC": {"panic", "chaos", "fear", "evacuate", "stampede"},
    "AGGRESSION": {"violent", "attack", "arson", "clash", "riot", "stone pelting"},
    "TENSE": {"tense", "protest", "agitation", "blockade", "mobilization"},
}

SUSPICIOUS_MARKERS = {
    "rumor",
    "unverified",
    "forwarded",
    "whatsapp",
    "unknown source",
    "allegedly",
}

TRUSTED_NEWS_DOMAINS = {
    "reuters.com",
    "apnews.com",
    "bbc.com",
    "thehindu.com",
    "timesofindia.indiatimes.com",
    "indianexpress.com",
    "ndtv.com",
    "news18.com",
}

CITY_ALIASES = {
    "mumbai": "Mumbai",
    "bombay": "Mumbai",
    "delhi": "Delhi",
    "new delhi": "Delhi",
    "ncr": "Delhi",
    "bangalore": "Bangalore",
    "bengaluru": "Bangalore",
    "bengalore": "Bangalore",
    "hyderabad": "Hyderabad",
    "chennai": "Chennai",
    "madras": "Chennai",
}

STOP_WORDS = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "have",
    "has",
    "were",
    "into",
    "about",
    "after",
    "before",
    "where",
    "while",
    "their",
    "will",
    "today",
    "latest",
    "india",
}


def infer_risk(text: str) -> Literal["LOW", "MEDIUM", "HIGH"]:
    haystack = text.lower()
    scores = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for risk, words in RISK_KEYWORDS.items():
        for word in words:
            if word in haystack:
                scores[risk] += 1

    if scores["HIGH"] > 0:
        return "HIGH"
    if scores["MEDIUM"] > 0:
        return "MEDIUM"
    return "LOW"


def infer_category(
    text: str,
) -> Literal["PROTEST", "VIOLENCE", "UNREST", "ACCIDENT", "SURVEILLANCE", "UNKNOWN"]:
    haystack = text.lower()
    best = "UNKNOWN"
    best_score = 0

    for category, words in CATEGORY_RULES.items():
        score = sum(1 for word in words if word in haystack)
        if score > best_score:
            best = category
            best_score = score

    return best  # type: ignore[return-value]


def infer_sentiment(text: str) -> Literal["PANIC", "AGGRESSION", "NEUTRAL", "TENSE"]:
    haystack = text.lower()
    for sentiment, words in SENTIMENT_RULES.items():
        if any(word in haystack for word in words):
            return sentiment  # type: ignore[return-value]
    return "NEUTRAL"


def infer_location(text: str, fallback_city: str | None = None) -> str:
    haystack = text.lower()

    for alias in sorted(CITY_ALIASES.keys(), key=len, reverse=True):
        if alias in haystack:
            return CITY_ALIASES[alias]

    if fallback_city:
        clean_fallback = CITY_ALIASES.get(fallback_city.strip().lower())
        if clean_fallback:
            return clean_fallback

    return "Unknown"


def extract_keywords(text: str, limit: int = 8) -> list[str]:
    words = re.findall(r"[a-zA-Z][a-zA-Z\-]{3,}", text.lower())
    ranked: list[str] = []
    for word in words:
        if word in STOP_WORDS:
            continue
        if word not in ranked:
            ranked.append(word)
        if len(ranked) >= limit:
            break
    return ranked


def confidence_score(text: str, domain: str, has_published_at: bool) -> int:
    score = 45
    if domain in TRUSTED_NEWS_DOMAINS:
        score += 20
    if has_published_at:
        score += 10
    if len(text) >= 120:
        score += 8
    if any(marker in text.lower() for marker in SUSPICIOUS_MARKERS):
        score -= 25

    return max(10, min(95, score))


def validity_label(confidence: int) -> Literal["VERIFIED", "MIXED", "UNVERIFIED"]:
    if confidence >= 75:
        return "VERIFIED"
    if confidence >= 50:
        return "MIXED"
    return "UNVERIFIED"


def infer_impact(risk: Literal["LOW", "MEDIUM", "HIGH"], confidence: int) -> Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
    if risk == "HIGH" and confidence >= 80:
        return "CRITICAL"
    if risk == "HIGH":
        return "HIGH"
    if risk == "MEDIUM" and confidence >= 70:
        return "HIGH"
    if risk == "MEDIUM":
        return "MEDIUM"
    return "LOW"


def escalation_probability(risk: Literal["LOW", "MEDIUM", "HIGH"], confidence: int) -> int:
    base = {"LOW": 20, "MEDIUM": 50, "HIGH": 75}[risk]
    return max(5, min(99, base + (confidence - 50) // 2))


def recommended_actions(
    category: Literal["PROTEST", "VIOLENCE", "UNREST", "ACCIDENT", "SURVEILLANCE", "UNKNOWN"],
    risk: Literal["LOW", "MEDIUM", "HIGH"],
) -> list[str]:
    common = [
        "Keep district command informed every 30 minutes.",
        "Cross-check at least two independent sources before escalation.",
    ]

    category_actions = {
        "PROTEST": [
            "Deploy traffic management and crowd control teams.",
            "Coordinate with local administration for safe protest routes.",
        ],
        "VIOLENCE": [
            "Dispatch rapid response teams and secure critical junctions.",
            "Issue priority alert to nearby hospitals and emergency units.",
        ],
        "UNREST": [
            "Increase patrolling in vulnerable zones.",
            "Monitor social channels for escalation signals.",
        ],
        "ACCIDENT": [
            "Coordinate emergency medical and rescue support.",
            "Broadcast route diversion advisories to reduce congestion.",
        ],
        "SURVEILLANCE": [
            "Maintain watchlist monitoring for linked entities.",
            "Share intelligence brief with regional analysts.",
        ],
        "UNKNOWN": [
            "Mark event for manual analyst review.",
            "Collect more evidence before assigning final severity.",
        ],
    }

    risk_action = {
        "HIGH": "Escalate to state-level command immediately.",
        "MEDIUM": "Keep quick reaction unit on standby.",
        "LOW": "Track the signal in routine watch mode.",
    }[risk]

    return [risk_action, *category_actions[category], *common][:5]
