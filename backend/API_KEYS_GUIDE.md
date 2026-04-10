# API Keys Guide

This project supports partial keys. You can start with just one source and add more.

## Required for each integration

- Tavily Search: set TAVILY_API_KEY
  - Console: https://app.tavily.com

- Brave Search API: set BRAVE_API_KEY
  - Console: https://api.search.brave.com

- NewsAPI: set NEWSAPI_KEY
  - Console: https://newsapi.org

- CrewAI LLM report mode: set OPENAI_API_KEY
  - Without this key, CrewAI report falls back to deterministic summary mode.

## Quick validation

1. Start backend: uvicorn app.main:app --reload --port 8000
2. Open: http://127.0.0.1:8000/health
3. Confirm key flags under keys.

## Realtime endpoint test

Use browser or curl:

curl "http://127.0.0.1:8000/api/realtime/stream?topic=delhi+protest&max_items=20"

You should receive stage events and one final result event.
