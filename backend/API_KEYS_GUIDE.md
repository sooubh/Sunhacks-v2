# API Keys Guide

This project supports partial keys. You can start with just one source and add more.

## Required for each integration

- Tavily Search: set TAVILY_API_KEY
  - Console: https://app.tavily.com
  - Recent-only mode is enabled using `topic=news` and `TAVILY_RECENT_DAYS` (default: 3).

- NewsAPI: set NEWSAPI_KEY
  - Console: https://newsapi.org

- NewsData.io: set NEWSDATA_API_KEY
  - Console: https://newsdata.io

- GNews API: set GNEWS_API_KEY
  - Console: https://gnews.io

- Gemini LLM report mode: set GEMINI_API_KEY
  - Without this key, AI report falls back to deterministic summary mode.
  - Optional model override: GEMINI_MODEL (default is gemini-flash-latest).

- Web scraper source
  - No key required.
  - Optional target websites: WEB_SCRAPER_URLS (comma-separated URLs).

- RSS source pack (enabled by default)
  - Includes Google News RSS, Times of India RSS, NDTV RSS, Indian Express RSS, The Hindu RSS, BBC India RSS.
  - Override with `RSS_FEEDS` (comma-separated feed URLs).

## Quick validation

1. Start backend: uvicorn app.main:app --reload --port 8000
2. Open: http://127.0.0.1:8000/health
3. Confirm key flags under keys.

## Realtime endpoint test

Use browser or curl:

curl "http://127.0.0.1:8000/api/realtime/stream?topic=delhi+protest&max_items=20"

You should receive stage events and one final result event.
