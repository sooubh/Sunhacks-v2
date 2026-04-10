from __future__ import annotations

from dataclasses import dataclass
import os

DEFAULT_RSS_FEEDS = (
    "https://news.google.com/rss/search?q=india+law+and+order&hl=en-IN&gl=IN&ceid=IN:en",
    "https://feeds.bbci.co.uk/news/world/asia/india/rss.xml",
    "https://www.thehindu.com/news/national/feeder/default.rss",
    "https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms",
)


@dataclass(frozen=True)
class Settings:
    tavily_api_key: str
    brave_api_key: str
    newsapi_key: str
    openai_api_key: str
    openai_model: str
    cors_allow_origins: str
    request_timeout_seconds: int
    rss_feeds: tuple[str, ...]

    @classmethod
    def from_env(cls) -> "Settings":
        feeds_from_env = os.getenv("RSS_FEEDS", "")
        rss_feeds = tuple(
            feed.strip() for feed in feeds_from_env.split(",") if feed.strip()
        ) or DEFAULT_RSS_FEEDS

        return cls(
            tavily_api_key=os.getenv("TAVILY_API_KEY", "").strip(),
            brave_api_key=os.getenv("BRAVE_API_KEY", "").strip(),
            newsapi_key=os.getenv("NEWSAPI_KEY", "").strip(),
            openai_api_key=os.getenv("OPENAI_API_KEY", "").strip(),
            openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip(),
            cors_allow_origins=os.getenv("CORS_ALLOW_ORIGINS", "*").strip(),
            request_timeout_seconds=int(os.getenv("REQUEST_TIMEOUT_SECONDS", "15")),
            rss_feeds=rss_feeds,
        )

    def cors_origins(self) -> list[str]:
        if self.cors_allow_origins == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_allow_origins.split(",") if origin.strip()]
