from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=BACKEND_ENV_PATH)

DEFAULT_RSS_FEEDS = (
    "https://news.google.com/rss/search?q=india+law+and+order&hl=en-IN&gl=IN&ceid=IN:en",
    "https://feeds.bbci.co.uk/news/world/asia/india/rss.xml",
    "https://www.thehindu.com/news/national/feeder/default.rss",
    "https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms",
    "https://feeds.feedburner.com/ndtvnews-top-stories",
    "https://indianexpress.com/section/india/feed/",
    "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml",
)

DEFAULT_WEB_SCRAPER_URLS = (
    "https://www.thehindu.com/news/national/",
    "https://timesofindia.indiatimes.com/india",
    "https://indianexpress.com/section/india/",
    "https://www.bbc.com/news/world/asia/india",
)


@dataclass(frozen=True)
class Settings:
    tavily_api_key: str
    newsapi_key: str
    newsdata_api_key: str
    gnews_api_key: str
    tavily_recent_days: int
    gemini_api_key: str
    gemini_model: str
    cors_allow_origins: str
    request_timeout_seconds: int
    rss_feeds: tuple[str, ...]
    web_scraper_urls: tuple[str, ...]

    @classmethod
    def from_env(cls) -> "Settings":
        feeds_from_env = os.getenv("RSS_FEEDS", "")
        rss_feeds = tuple(
            feed.strip() for feed in feeds_from_env.split(",") if feed.strip()
        ) or DEFAULT_RSS_FEEDS

        scrape_urls_from_env = os.getenv("WEB_SCRAPER_URLS", "")
        web_scraper_urls = tuple(
            url.strip() for url in scrape_urls_from_env.split(",") if url.strip()
        ) or DEFAULT_WEB_SCRAPER_URLS

        return cls(
            tavily_api_key=os.getenv("TAVILY_API_KEY", "").strip(),
            newsapi_key=os.getenv("NEWSAPI_KEY", "").strip(),
            newsdata_api_key=os.getenv("NEWSDATA_API_KEY", "").strip(),
            gnews_api_key=os.getenv("GNEWS_API_KEY", "").strip(),
            tavily_recent_days=int(os.getenv("TAVILY_RECENT_DAYS", "3")),
            gemini_api_key=os.getenv("GEMINI_API_KEY", "").strip(),
            gemini_model=os.getenv("GEMINI_MODEL", "gemini-flash-latest").strip(),
            cors_allow_origins=os.getenv("CORS_ALLOW_ORIGINS", "*").strip(),
            request_timeout_seconds=int(os.getenv("REQUEST_TIMEOUT_SECONDS", "15")),
            rss_feeds=rss_feeds,
            web_scraper_urls=web_scraper_urls,
        )

    def cors_origins(self) -> list[str]:
        if self.cors_allow_origins == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_allow_origins.split(",") if origin.strip()]
