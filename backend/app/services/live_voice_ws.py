from __future__ import annotations

import asyncio
import base64
import json
import logging
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

from ..config import Settings

try:
    from google import genai
    from google.genai import types
except Exception:
    genai = None
    types = None


logger = logging.getLogger(__name__)


class LiveVoiceWebSocketGateway:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def handle(self, websocket: WebSocket) -> None:
        await websocket.accept()

        if genai is None or types is None:
            await self._send(websocket, {"type": "error", "message": "google-genai SDK is not available on backend."})
            await websocket.close(code=1011)
            return

        if not self.settings.gemini_api_key:
            await self._send(websocket, {"type": "error", "message": "GEMINI_API_KEY is not configured on backend."})
            await websocket.close(code=1011)
            return

        start_message = await self._read_start_message(websocket)
        if start_message is None:
            return

        requested_model = str(start_message.get("model") or "").strip()
        configured_model = str(self.settings.gemini_live_model or "").strip()
        voice_name = str(start_message.get("voice_name") or "Zephyr")
        dashboard_context = start_message.get("dashboard_context")
        if not isinstance(dashboard_context, dict):
            dashboard_context = {}

        live_config = self._build_live_config(voice_name=voice_name)
        client = genai.Client(
            http_options={"api_version": "v1beta"},
            api_key=self.settings.gemini_api_key,
        )

        model_errors: list[str] = []
        for model_name in self._candidate_models(requested_model=requested_model, configured_model=configured_model):
            try:
                async with client.aio.live.connect(model=model_name, config=live_config) as session:
                    await self._send(
                        websocket,
                        {
                            "type": "ready",
                            "provider": "gemini",
                            "mode": "gemini_live_voice",
                            "model": model_name,
                            "voice_name": voice_name,
                        },
                    )

                    context_prompt = self._context_prompt(dashboard_context)
                    if context_prompt:
                        await self._send_text_to_model(session=session, text=context_prompt, turn_complete=False)

                    await self._run_relay_session(websocket=websocket, session=session)
                    return
            except WebSocketDisconnect:
                logger.info("Live voice websocket disconnected by client")
                return
            except Exception as exc:
                model_errors.append(f"{model_name}: {exc}")
                logger.warning("Live voice model failed model=%s error=%s", model_name, exc)

        detail = " | ".join(model_errors[:2]) or "unknown_live_error"
        try:
            await self._send(websocket, {"type": "error", "message": f"Live voice session failed: {detail}"})
        except Exception:
            pass
        try:
            await websocket.close(code=1011)
        except Exception:
            pass

    async def _run_relay_session(self, websocket: WebSocket, session: Any) -> None:
        stop_event = asyncio.Event()

        inbound_task = asyncio.create_task(
            self._relay_client_to_model(websocket=websocket, session=session, stop_event=stop_event)
        )
        outbound_task = asyncio.create_task(
            self._relay_model_to_client(websocket=websocket, session=session, stop_event=stop_event)
        )

        done, pending = await asyncio.wait({inbound_task, outbound_task}, return_when=asyncio.FIRST_COMPLETED)

        stop_event.set()

        for task in pending:
            task.cancel()

        if pending:
            await asyncio.gather(*pending, return_exceptions=True)

        for task in done:
            if task.cancelled():
                continue
            exc = task.exception()
            if exc is None:
                continue
            if isinstance(exc, WebSocketDisconnect):
                continue
            if isinstance(exc, asyncio.CancelledError):
                continue
            raise exc

    async def _relay_client_to_model(self, websocket: WebSocket, session: Any, stop_event: asyncio.Event) -> None:
        while not stop_event.is_set():
            try:
                raw = await websocket.receive_text()
            except WebSocketDisconnect:
                stop_event.set()
                break

            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                await self._send(websocket, {"type": "error", "message": "Invalid JSON message."})
                continue

            msg_type = str(message.get("type", "")).lower()

            if msg_type == "audio":
                payload = str(message.get("data", ""))
                if not payload:
                    continue
                try:
                    audio_bytes = base64.b64decode(payload)
                except Exception:
                    await self._send(websocket, {"type": "error", "message": "Invalid base64 audio payload."})
                    continue

                await session.send_realtime_input(audio={"mime_type": "audio/pcm", "data": audio_bytes})
                continue

            if msg_type == "text":
                text = str(message.get("text", "")).strip()
                end_of_turn = bool(message.get("end_of_turn", True))
                await self._send_text_to_model(session=session, text=text or ".", turn_complete=end_of_turn)
                continue

            if msg_type == "context":
                context = message.get("dashboard_context")
                if not isinstance(context, dict):
                    context = {}
                prompt = self._context_prompt(context)
                if prompt:
                    await self._send_text_to_model(session=session, text=prompt, turn_complete=False)
                continue

            if msg_type == "end_turn":
                await self._send_text_to_model(session=session, text=".", turn_complete=True)
                continue

            if msg_type in {"stop", "close"}:
                stop_event.set()
                break

    async def _relay_model_to_client(self, websocket: WebSocket, session: Any, stop_event: asyncio.Event) -> None:
        while not stop_event.is_set():
            turn = session.receive()
            async for response in turn:
                if stop_event.is_set():
                    break

                if data := getattr(response, "data", None):
                    if isinstance(data, memoryview):
                        chunk = data.tobytes()
                    else:
                        chunk = bytes(data)

                    await self._send(
                        websocket,
                        {
                            "type": "audio",
                            "mime_type": "audio/pcm;rate=24000",
                            "data": base64.b64encode(chunk).decode("ascii"),
                        },
                    )

                if text := getattr(response, "text", None):
                    await self._send(websocket, {"type": "text", "text": str(text)})

            await self._send(websocket, {"type": "turn_complete"})

    async def _read_start_message(self, websocket: WebSocket) -> dict[str, Any] | None:
        try:
            raw = await websocket.receive_text()
        except WebSocketDisconnect:
            return None

        try:
            message = json.loads(raw)
        except json.JSONDecodeError:
            await self._send(websocket, {"type": "error", "message": "First websocket message must be valid JSON."})
            await websocket.close(code=1003)
            return None

        msg_type = str(message.get("type", "")).lower()
        if msg_type != "start":
            await self._send(websocket, {"type": "error", "message": "First websocket message must be type=start."})
            await websocket.close(code=1003)
            return None

        return message

    @staticmethod
    def _build_live_config(voice_name: str) -> Any:
        return types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_name)
                )
            ),
            context_window_compression=types.ContextWindowCompressionConfig(
                trigger_tokens=25600,
                sliding_window=types.SlidingWindow(target_tokens=12800),
            ),
        )

    @staticmethod
    async def _send_text_to_model(session: Any, text: str, turn_complete: bool) -> None:
        await session.send_client_content(
            turns=types.Content(parts=[types.Part(text=text)]),
            turn_complete=turn_complete,
        )

    @staticmethod
    def _candidate_models(requested_model: str, configured_model: str) -> list[str]:
        candidates = [
            (requested_model or "").strip(),
            "models/gemini-2.5-flash-native-audio-preview-12-2025",
            (configured_model or "").strip(),
            "models/gemini-2.0-flash-live-001",
        ]

        deduped: list[str] = []
        for model in candidates:
            if not model:
                continue
            if model not in deduped:
                deduped.append(model)
        return deduped

    @staticmethod
    def _context_prompt(dashboard_context: dict[str, Any]) -> str:
        if not dashboard_context:
            return ""

        try:
            context_text = json.dumps(dashboard_context, ensure_ascii=True, default=str)
        except Exception:
            context_text = "{}"

        if len(context_text) > 3800:
            context_text = f"{context_text[:3800]}..."

        return (
            "You are LEIS live voice command assistant. "
            "Use the dashboard context to provide tactical, concise, real-time guidance. "
            "Keep responses under 80 words when possible. "
            "Always include one concrete action recommendation.\n\n"
            f"Dashboard context JSON: {context_text}"
        )

    @staticmethod
    async def _send(websocket: WebSocket, payload: dict[str, Any]) -> None:
        await websocket.send_text(json.dumps(payload, ensure_ascii=True))
