const API_BASE = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim() || 'http://127.0.0.1:8000';

export interface LiveVoiceStartMessage {
  dashboard_context: unknown;
  voice_name?: string;
  model?: string;
}

export interface LiveVoiceHandlers {
  onReady?: (payload: { model: string; mode: string; voiceName: string }) => void;
  onText?: (text: string) => void;
  onAudio?: (base64Pcm: string) => void;
  onTurnComplete?: () => void;
  onError?: (message: string) => void;
  onClose?: (reason: string) => void;
}

function buildLiveVoiceWsUrl(apiBase: string): string {
  const normalized = apiBase.replace(/\/$/, '');
  if (normalized.startsWith('https://')) {
    return `${normalized.replace('https://', 'wss://')}/ws/voice/live`;
  }
  if (normalized.startsWith('http://')) {
    return `${normalized.replace('http://', 'ws://')}/ws/voice/live`;
  }
  return `ws://${normalized}/ws/voice/live`;
}

function isSocketOpen(socket: WebSocket | null): boolean {
  return !!socket && socket.readyState === WebSocket.OPEN;
}

export class LiveVoiceSessionClient {
  private socket: WebSocket | null = null;
  private readonly handlers: LiveVoiceHandlers;
  private readonly wsUrl: string;

  constructor(handlers: LiveVoiceHandlers, apiBase = API_BASE) {
    this.handlers = handlers;
    this.wsUrl = buildLiveVoiceWsUrl(apiBase);
  }

  connect(startMessage: LiveVoiceStartMessage): Promise<void> {
    this.close('reconnect');

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.wsUrl);
      this.socket = socket;
      let settled = false;

      const resolveOnce = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      const rejectOnce = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      socket.onopen = () => {
        this.sendRaw({
          type: 'start',
          dashboard_context: startMessage.dashboard_context,
          voice_name: startMessage.voice_name || 'Zephyr',
          model: startMessage.model,
        });
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as {
            type?: string;
            text?: string;
            data?: string;
            message?: string;
            model?: string;
            mode?: string;
            voice_name?: string;
          };

          const type = String(payload.type || '').toLowerCase();
          if (type === 'ready') {
            this.handlers.onReady?.({
              model: String(payload.model || 'unknown'),
              mode: String(payload.mode || 'gemini_live_voice'),
              voiceName: String(payload.voice_name || 'Zephyr'),
            });
            resolveOnce();
            return;
          }

          if (type === 'text') {
            this.handlers.onText?.(String(payload.text || ''));
            return;
          }

          if (type === 'audio') {
            const chunk = String(payload.data || '');
            if (chunk) this.handlers.onAudio?.(chunk);
            return;
          }

          if (type === 'turn_complete') {
            this.handlers.onTurnComplete?.();
            return;
          }

          if (type === 'error') {
            const message = String(payload.message || 'Live voice session error');
            this.handlers.onError?.(message);
            rejectOnce(new Error(message));
            return;
          }
        } catch (error) {
          this.handlers.onError?.(`Live voice parse error: ${String(error)}`);
          rejectOnce(new Error(String(error)));
        }
      };

      socket.onerror = () => {
        this.handlers.onError?.('Live voice websocket connection failed.');
        rejectOnce(new Error('Live websocket failed'));
      };

      socket.onclose = (event) => {
        rejectOnce(new Error(`Live websocket closed during handshake: code=${event.code}`));
        this.handlers.onClose?.(`code=${event.code} reason=${event.reason || 'closed'}`);
      };
    });
  }

  sendText(text: string, endOfTurn = true): void {
    this.sendRaw({ type: 'text', text, end_of_turn: endOfTurn });
  }

  sendAudioChunk(base64Pcm: string): void {
    this.sendRaw({ type: 'audio', data: base64Pcm, mime_type: 'audio/pcm' });
  }

  sendContext(dashboardContext: unknown): void {
    this.sendRaw({ type: 'context', dashboard_context: dashboardContext });
  }

  endTurn(): void {
    this.sendRaw({ type: 'end_turn' });
  }

  close(reason = 'client_close'): void {
    if (!this.socket) return;
    if (this.socket.readyState === WebSocket.OPEN) {
      this.sendRaw({ type: 'stop', reason });
    }
    this.socket.close();
    this.socket = null;
  }

  isConnected(): boolean {
    return isSocketOpen(this.socket);
  }

  private sendRaw(payload: Record<string, unknown>): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(payload));
  }
}

function downsampleBuffer(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (outputRate >= inputRate) return input;

  const ratio = inputRate / outputRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const result = new Float32Array(outputLength);

  let offsetResult = 0;
  let offsetInput = 0;
  while (offsetResult < outputLength) {
    const nextOffsetInput = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;

    for (let i = offsetInput; i < nextOffsetInput && i < input.length; i += 1) {
      accum += input[i];
      count += 1;
    }

    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult += 1;
    offsetInput = nextOffsetInput;
  }

  return result;
}

export function float32ToPcm16Base64(input: Float32Array, inputRate: number, outputRate = 16000): string {
  const samples = downsampleBuffer(input, inputRate, outputRate);
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export function pcm16Base64ToFloat32(base64Data: string): Float32Array {
  const binary = atob(base64Data);
  const byteLength = binary.length;
  const buffer = new ArrayBuffer(byteLength);
  const bytes = new Uint8Array(buffer);

  for (let i = 0; i < byteLength; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  const view = new DataView(buffer);
  const samples = new Float32Array(byteLength / 2);
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = view.getInt16(i * 2, true) / 0x8000;
  }

  return samples;
}
