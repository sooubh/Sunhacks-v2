from __future__ import annotations

from typing import Literal

CityName = Literal["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai"]

MAJOR_CITIES: tuple[CityName, ...] = (
    "Mumbai",
    "Delhi",
    "Bangalore",
    "Hyderabad",
    "Chennai",
)

_CITY_ALIASES: dict[str, CityName] = {
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


def normalize_city(value: str | None) -> CityName | None:
    if not value:
        return None
    normalized = _CITY_ALIASES.get(value.strip().lower())
    return normalized


def detect_city(text: str) -> CityName | None:
    haystack = text.lower()
    for alias in sorted(_CITY_ALIASES.keys(), key=len, reverse=True):
        if alias in haystack:
            return _CITY_ALIASES[alias]
    return None


def scoped_topic(topic: str, city: CityName | None) -> str:
    clean_topic = topic.strip()
    if not city:
        return clean_topic

    if detect_city(clean_topic) == city:
        return clean_topic

    if clean_topic:
        return f"{city} {clean_topic}"
    return f"{city} public safety law and order"


def city_location(city: CityName) -> str:
    return f"{city}, India"
