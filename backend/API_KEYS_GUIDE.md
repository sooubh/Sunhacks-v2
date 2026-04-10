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

- Gemini LLM mode: set GEMINI_API_KEY
  - Used for voice assistant endpoint and as optional fallback for report generation.
  - Optional report fallback model override: GEMINI_MODEL (default is gemini-flash-latest).
  - Optional voice model override: GEMINI_LIVE_MODEL (default is models/gemini-3.1-flash-live-preview).

- Ollama LLM report mode (external/local API)
  - Default report reasoning provider order is Ollama first.
  - Optional provider order switch: AI_REASONING_PROVIDER_ORDER=ollama_first or gemini_first
  - Optional: OLLAMA_ENABLED=true
  - Optional: OLLAMA_BASE_URL=http://127.0.0.1:11434
  - Optional route: OLLAMA_ROUTE=fast or deep
  - OLLAMA_ROUTE behavior is fixed:
    - fast -> mistral.invoke(query)
    - otherwise -> llama.invoke(query)
  - Optional model override: OLLAMA_LLAMA_MODEL=llama3:8b
  - Optional model override: OLLAMA_MISTRAL_MODEL=mistral:7b
  - Optional timeout: OLLAMA_REQUEST_TIMEOUT_SECONDS=120
  - Optional backward-compatible alias: OLLAMA_MODEL (used when OLLAMA_LLAMA_MODEL is not set)
  - If Ollama and Gemini both fail, backend uses deterministic fallback summary mode.

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
