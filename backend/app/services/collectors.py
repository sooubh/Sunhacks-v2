from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import logging
from urllib.parse import quote_plus, urlparse

import feedparser
import requests

from ..config import Settings
from ..models import SourceSignal

logger = logging.getLogger(__name__)


class OSINTCollector:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def collect(self, topic: str, max_items: int) -> list[SourceSignal]:
        per_source = max(3, max_items // 4)

        collected: list[SourceSignal] = []
        collected.extend(self._collect_newsapi(topic, per_source))
        collected.extend(self._collect_tavily(topic, per_source))
        collected.extend(self._collect_brave(topic, per_source))
        collected.extend(self._collect_rss(topic, per_source))
        collected.extend(self._collect_google_news_rss(topic, per_source))

        deduped: dict[str, SourceSignal] = {}
        for signal in collected:
            deduped.setdefault(signal.url, signal)

        return list(deduped.values())[:max_items]

    def _collect_newsapi(self, topic: str, limit: int) -> list[SourceSignal]:
        if not self.settings.newsapi_key:
            return []

        url = "https://newsapi.org/v2/everything"
        params = {
            "q": topic,
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": limit,
            "apiKey": self.settings.newsapi_key,
        }
        payload = self._safe_get_json(url, params=params)
        if not payload:
            return []

        out: list[SourceSignal] = []
        for item in payload.get("articles", []):
            title = (item.get("title") or "").strip()
            page_url = (item.get("url") or "").strip()
            if not title or not page_url:
                continue

            out.append(
                SourceSignal(
                    id=self._signal_id("newsapi", page_url),
                    source_name=(item.get("source") or {}).get("name") or "NewsAPI",
                    source_type="NEWS_API",
                    title=title,
                    url=page_url,
                    snippet=(item.get("description") or "").strip(),
                    published_at=self._parse_dt(item.get("publishedAt")),
                    domain=self._domain(page_url),
                )
            )

        return out

    def _collect_tavily(self, topic: str, limit: int) -> list[SourceSignal]:
        if not self.settings.tavily_api_key:
            return []

        url = "https://api.tavily.com/search"
        payload = {
            "api_key": self.settings.tavily_api_key,
            "query": topic,
            "search_depth": "advanced",
            "max_results": limit,
        }
        response = self._safe_post_json(url, payload=payload)
        if not response:
            return []

        out: list[SourceSignal] = []
        for item in response.get("results", []):
            title = (item.get("title") or "").strip()
            page_url = (item.get("url") or "").strip()
            if not title or not page_url:
                continue

            out.append(
                SourceSignal(
                    id=self._signal_id("tavily", page_url),
                    source_name="Tavily",
                    source_type="WEB_SEARCH",
                    title=title,
                    url=page_url,
                    snippet=(item.get("content") or "").strip(),
                    published_at=self._parse_dt(item.get("published_date")),
                    domain=self._domain(page_url),
                )
            )

        return out

    def _collect_brave(self, topic: str, limit: int) -> list[SourceSignal]:
        if not self.settings.brave_api_key:
            return []

        url = "https://api.search.brave.com/res/v1/web/search"
        headers = {
            "X-Subscription-Token": self.settings.brave_api_key,
            "Accept": "application/json",
        }
        params = {"q": topic, "count": limit}

        payload = self._safe_get_json(url, params=params, headers=headers)
        if not payload:
            return []

        out: list[SourceSignal] = []
        for item in ((payload.get("web") or {}).get("results") or []):
            title = (item.get("title") or "").strip()
            page_url = (item.get("url") or "").strip()
            if not title or not page_url:
                continue

            out.append(
                SourceSignal(
                    id=self._signal_id("brave", page_url),
                    source_name="Brave Search",
                    source_type="WEB_SEARCH",
                    title=title,
                    url=page_url,
                    snippet=(item.get("description") or "").strip(),
                    published_at=self._parse_dt(item.get("age")),
                    domain=self._domain(page_url),
                )
            )

        return out

    def _collect_rss(self, topic: str, limit: int) -> list[SourceSignal]:
        topic_words = [part for part in topic.lower().split() if part]
        per_feed = max(1, limit // max(1, len(self.settings.rss_feeds)))
        out: list[SourceSignal] = []

        for feed_url in self.settings.rss_feeds:
            try:
                parsed = feedparser.parse(feed_url)
            except Exception as exc:
                logger.warning("RSS parse failed for %s: %s", feed_url, exc)
                continue

            feed_name = (parsed.feed.get("title") or self._domain(feed_url) or "RSS Feed").strip()
            for entry in parsed.entries[: per_feed * 3]:
                title = (entry.get("title") or "").strip()
                page_url = (entry.get("link") or "").strip()
                summary = (entry.get("summary") or "").strip()
                if not title or not page_url:
                    continue

                haystack = f"{title} {summary}".lower()
                if topic_words and not any(word in haystack for word in topic_words):
                    continue

                out.append(
                    SourceSignal(
                        id=self._signal_id(feed_name, page_url),
                        source_name=feed_name,
                        source_type="RSS",
                        title=title,
                        url=page_url,
                        snippet=summary[:320],
                        published_at=self._parse_dt(entry.get("published")),
                        domain=self._domain(page_url),
                    )
                )
                if len(out) >= limit:
                    break

            if len(out) >= limit:
                break

        return out

    def _collect_google_news_rss(self, topic: str, limit: int) -> list[SourceSignal]:
        query = quote_plus(topic)
        url = f"https://news.google.com/rss/search?q={query}&hl=en-IN&gl=IN&ceid=IN:en"
        parsed = feedparser.parse(url)

        out: list[SourceSignal] = []
        for entry in parsed.entries[:limit]:
            title = (entry.get("title") or "").strip()
            page_url = (entry.get("link") or "").strip()
            if not title or not page_url:
                continue

            out.append(
                SourceSignal(
                    id=self._signal_id("google-news-rss", page_url),
                    source_name="Google News RSS",
                    source_type="RSS",
                    title=title,
                    url=page_url,
                    snippet=(entry.get("summary") or "").strip()[:320],
                    published_at=self._parse_dt(entry.get("published")),
                    domain=self._domain(page_url),
                )
            )

        return out

    def _safe_get_json(
        self,
        url: str,
        params: dict | None = None,
        headers: dict | None = None,
    ) -> dict | None:
        try:
            response = requests.get(
                url,
                params=params,
                headers=headers,
                timeout=self.settings.request_timeout_seconds,
            )
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            logger.warning("GET %s failed: %s", url, exc)
            return None

    def _safe_post_json(self, url: str, payload: dict) -> dict | None:
        try:
            response = requests.post(
                url,
                json=payload,
                timeout=self.settings.request_timeout_seconds,
            )
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            logger.warning("POST %s failed: %s", url, exc)
            return None

    @staticmethod
    def _signal_id(source: str, url: str) -> str:
        digest = hashlib.sha1(f"{source}:{url}".encode("utf-8")).hexdigest()
        return digest[:12]

    @staticmethod
    def _domain(url: str) -> str:
        return urlparse(url).netloc.lower().replace("www.", "")

    @staticmethod
    def _parse_dt(value: str | None) -> datetime | None:
        if not value:
            return None
        cleaned = value.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(cleaned)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            return None
