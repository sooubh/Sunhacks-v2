import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { askVoiceAssistant, type AssistantMode, type VoiceAssistantResult, type VoiceDashboardContext } from '../services/realtimeApi';
import { persistVoiceTranscript } from '../services/firebaseDataService';
import type { Alert } from '../types';
import {
  LiveVoiceSessionClient,
  float32ToPcm16Base64,
  pcm16Base64ToFloat32,
} from '../services/liveVoiceSession';

interface Message {
  role: 'user' | 'ai';
  text: string;
  time: string;
}

type LiveStatus = 'CONNECTING' | 'LIVE' | 'OFFLINE';

const SPEECH_RMS_THRESHOLD = 0.01;
const END_TURN_SILENCE_MS = 900;
const LIVE_RECONNECT_BASE_MS = 1800;
const LIVE_RECONNECT_MAX_MS = 12000;
const LIVE_RECONNECT_MAX_ATTEMPTS = 8;

function flattenText(value: string, maxLength = 500): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
}

const TERM_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'will', 'into',
  'what', 'when', 'where', 'about', 'please', 'show', 'open', 'alert', 'city',
  'risk', 'status', 'update', 'tell', 'give', 'need', 'want', 'could', 'would',
]);

function extractUserTerms(text: string): string[] {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ');
  const tokens = normalized
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length >= 3 && !TERM_STOP_WORDS.has(token));

  return Array.from(new Set(tokens)).slice(0, 8);
}

function findRequestedAlert(query: string, alerts: Alert[]): Alert | null {
  const exactMatch = query.match(/(?:open|show|view|inspect|go\s+to)\s+alert\s*#?\s*([a-z0-9-]+)/i);
  if (exactMatch?.[1]) {
    const id = exactMatch[1].toLowerCase();
    return alerts.find(alert => alert.id.toLowerCase() === id) ?? null;
  }

  if (/(open|show|view).*(latest|new|recent).*(alert)/i.test(query)) {
    const sorted = [...alerts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return sorted[0] ?? null;
  }

  if (/(open|show|view).*(high).*(alert)/i.test(query)) {
    const highest = [...alerts]
      .filter(alert => alert.status === 'ACTIVE')
      .sort((a, b) => {
        const rank: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return rank[b.riskLevel] - rank[a.riskLevel] || b.confidence - a.confidence;
      });
    return highest[0] ?? null;
  }

  return null;
}

function speakText(text: string): void {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(flattenText(text, 280));
  utterance.lang = 'en-IN';
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function buildDashboardContext(
  state: ReturnType<typeof useAppStore.getState>,
  conversation?: { recentUserQueries: string[]; userTerms: string[]; continuousMode: boolean },
): VoiceDashboardContext {
  const topic = state.pipelineActiveTopic || state.lastTopic || state.voiceQuery || 'public safety signals';
  const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  const alertsByPriority = [...state.alerts]
    .sort((a, b) => rank[b.riskLevel] - rank[a.riskLevel] || b.confidence - a.confidence);

  const topAlerts = alertsByPriority
    .filter(alert => alert.status === 'ACTIVE')
    .slice(0, 6)
    .map(alert => ({
      id: alert.id,
      title: alert.title,
      location: alert.location,
      riskLevel: alert.riskLevel,
      confidence: alert.confidence,
      status: alert.status,
    }));

  const recentAlerts = [...state.alerts]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10)
    .map(alert => ({
      id: alert.id,
      title: alert.title,
      summary: flattenText(alert.summary || '', 220),
      location: alert.location,
      riskLevel: alert.riskLevel,
      status: alert.status,
      category: alert.category,
      sentiment: alert.sentiment,
      confidence: alert.confidence,
      escalationProbability: alert.escalationProbability,
      keywords: (alert.keywords || []).slice(0, 6),
      createdAt: alert.createdAt.toISOString(),
    }));

  const categoryAgg: Record<string, { total: number; active: number; highRisk: number }> = {};
  const locationAgg: Record<string, { total: number; active: number; highRisk: number }> = {};

  for (const alert of state.alerts) {
    if (!categoryAgg[alert.category]) {
      categoryAgg[alert.category] = { total: 0, active: 0, highRisk: 0 };
    }
    if (!locationAgg[alert.location]) {
      locationAgg[alert.location] = { total: 0, active: 0, highRisk: 0 };
    }

    categoryAgg[alert.category].total += 1;
    locationAgg[alert.location].total += 1;
    if (alert.status === 'ACTIVE') {
      categoryAgg[alert.category].active += 1;
      locationAgg[alert.location].active += 1;
    }
    if (alert.riskLevel === 'HIGH') {
      categoryAgg[alert.category].highRisk += 1;
      locationAgg[alert.location].highRisk += 1;
    }
  }

  const categoryBreakdown = Object.entries(categoryAgg)
    .map(([category, counts]) => ({ category, ...counts }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  const locationBreakdown = Object.entries(locationAgg)
    .map(([location, counts]) => ({ location, ...counts }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  return {
    topic,
    city: state.selectedCity,
    stats: {
      totalAlerts: state.dashboardStats.totalAlerts,
      activeAlerts: state.dashboardStats.activeAlerts,
      highRisk: state.dashboardStats.highRisk,
      mediumRisk: state.dashboardStats.mediumRisk,
      lowRisk: state.dashboardStats.lowRisk,
      avgConfidence: state.dashboardStats.avgConfidence,
      topLocation: state.dashboardStats.topLocation,
    },
    topAlerts,
    recentAlerts,
    categoryBreakdown,
    locationBreakdown,
    latestReportSnippet: flattenText(state.latestReport, 800),
    conversation,
  };
}

export default function VoiceAssistantDialog() {
  const { setVoiceOpen, setVoiceQuery } = useAppStore();
  const storeState = useAppStore.getState;
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      text: 'Cyna is ready. Use Smart Chat for structured analysis, or switch to Direct Voice for mic-only commands.',
      time: new Date().toLocaleTimeString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [respondingTopic, setRespondingTopic] = useState('');
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('CONNECTING');
  const [continuousMode, setContinuousMode] = useState(true);
  const [assistantMode, setAssistantMode] = useState<AssistantMode>('chat');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const liveClientRef = useRef<LiveVoiceSessionClient | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const assistantModeRef = useRef<AssistantMode>('chat');
  const isMountedRef = useRef(true);
  const liveSessionIdRef = useRef(0);

  const currentTurnUserQueryRef = useRef('');
  const assistantDraftIndexRef = useRef<number | null>(null);
  const assistantDraftTextRef = useRef('');
  const assistantTurnHadAudioRef = useRef(false);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const micContextRef = useRef<AudioContext | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const micMuteGainRef = useRef<GainNode | null>(null);

  const playbackContextRef = useRef<AudioContext | null>(null);
  const playbackCursorRef = useRef(0);

  const listeningRef = useRef(false);
  const continuousModeRef = useRef(true);
  const continuousSessionActiveRef = useRef(false);
  const awaitingTurnCompletionRef = useRef(false);
  const speechDetectedRef = useRef(false);
  const lastSpeechAtRef = useRef(0);
  const recentUserQueriesRef = useRef<string[]>([]);
  const recentUserTermsRef = useRef<string[]>([]);

  useEffect(() => {
    listeningRef.current = listening;
  }, [listening]);

  useEffect(() => {
    continuousModeRef.current = continuousMode;
    if (!continuousMode) {
      continuousSessionActiveRef.current = false;
    }
  }, [continuousMode]);

  useEffect(() => {
    assistantModeRef.current = assistantMode;
  }, [assistantMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const conversationContext = () => ({
    recentUserQueries: recentUserQueriesRef.current,
    userTerms: recentUserTermsRef.current,
    continuousMode: continuousModeRef.current,
  });

  const rememberUserInput = (query: string) => {
    if (!query.trim()) return;

    recentUserQueriesRef.current = [query.trim(), ...recentUserQueriesRef.current].slice(0, 8);
    const mergedTerms = [...extractUserTerms(query), ...recentUserTermsRef.current];
    recentUserTermsRef.current = Array.from(new Set(mergedTerms)).slice(0, 14);
  };

  const appendAssistantChunk = (chunk: string) => {
    const cleanChunk = chunk || '';
    if (!cleanChunk) return;

    setMessages(prev => {
      if (assistantDraftIndexRef.current === null) {
        const next = [
          ...prev,
          {
            role: 'ai' as const,
            text: cleanChunk,
            time: new Date().toLocaleTimeString(),
          },
        ];
        assistantDraftIndexRef.current = next.length - 1;
        assistantDraftTextRef.current = cleanChunk;
        return next;
      }

      const index = assistantDraftIndexRef.current;
      if (index < 0 || index >= prev.length) return prev;

      const next = [...prev];
      const previousText = next[index].text;
      const merged = `${previousText}${cleanChunk}`;
      next[index] = { ...next[index], text: merged };
      assistantDraftTextRef.current = merged;
      return next;
    });
  };

  const queuePcmAudio = async (base64Pcm: string) => {
    assistantTurnHadAudioRef.current = true;

    if (!playbackContextRef.current) {
      playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
      playbackCursorRef.current = 0;
    }

    const context = playbackContextRef.current;
    if (context.state === 'suspended') {
      await context.resume();
    }

    const samples = pcm16Base64ToFloat32(base64Pcm);
    if (samples.length === 0) return;

    const buffer = context.createBuffer(1, samples.length, 24000);
    buffer.getChannelData(0).set(samples);

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);

    const now = context.currentTime;
    const startAt = Math.max(now, playbackCursorRef.current || now);
    source.start(startAt);
    playbackCursorRef.current = startAt + buffer.duration;
  };

  const stopMicCapture = (sendEndTurn: boolean) => {
    const hadActiveCapture = Boolean(mediaStreamRef.current || micProcessorRef.current || micContextRef.current);

    if (micProcessorRef.current) {
      micProcessorRef.current.disconnect();
      micProcessorRef.current.onaudioprocess = null;
      micProcessorRef.current = null;
    }
    if (micSourceRef.current) {
      micSourceRef.current.disconnect();
      micSourceRef.current = null;
    }
    if (micMuteGainRef.current) {
      micMuteGainRef.current.disconnect();
      micMuteGainRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (micContextRef.current) {
      void micContextRef.current.close();
      micContextRef.current = null;
    }

    if (hadActiveCapture || listening) {
      setListening(false);
      speechDetectedRef.current = false;
      lastSpeechAtRef.current = 0;
      if (sendEndTurn && liveClientRef.current?.isConnected()) {
        setIsAiResponding(true);
        awaitingTurnCompletionRef.current = true;
        liveClientRef.current.endTurn();
      }
    }
  };

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const scheduleLiveReconnect = (reason: string) => {
    if (!isMountedRef.current) return;
    if (assistantModeRef.current !== 'voice') return;
    if (liveClientRef.current?.isConnected()) {
      reconnectAttemptRef.current = 0;
      clearReconnectTimer();
      return;
    }
    if (reconnectTimerRef.current !== null) return;

    if (reconnectAttemptRef.current >= LIVE_RECONNECT_MAX_ATTEMPTS) {
      setLiveStatus('OFFLINE');
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          text: 'Voice channel is still offline after multiple retries. Switch to Smart Chat and try voice again in a moment.',
          time: new Date().toLocaleTimeString(),
        },
      ]);
      return;
    }

    const attempt = reconnectAttemptRef.current + 1;
    const delay = Math.min(LIVE_RECONNECT_MAX_MS, LIVE_RECONNECT_BASE_MS * (2 ** reconnectAttemptRef.current));
    reconnectAttemptRef.current = attempt;
    setLiveStatus('CONNECTING');

    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      void connectLiveSession(false, `retry_${reason}_${attempt}`);
    }, delay);
  };

  const connectLiveSession = async (announce = false, reason = 'manual'): Promise<boolean> => {
    const dashboardContext = buildDashboardContext(storeState(), conversationContext());

    clearReconnectTimer();
    if (liveClientRef.current) {
      liveClientRef.current.close('replace_session');
      liveClientRef.current = null;
    }

    const sessionId = liveSessionIdRef.current + 1;
    liveSessionIdRef.current = sessionId;
    setLiveStatus('CONNECTING');
    const liveClient = new LiveVoiceSessionClient({
      onReady: () => {
        if (!isMountedRef.current || sessionId !== liveSessionIdRef.current) return;
        reconnectAttemptRef.current = 0;
        clearReconnectTimer();
        setLiveStatus('LIVE');
        if (announce) {
          setMessages(prev => [
            ...prev,
            {
              role: 'ai',
              text: 'Voice channel connected. Cyna is online.',
              time: new Date().toLocaleTimeString(),
            },
          ]);
        }
      },
      onText: (text) => {
        appendAssistantChunk(text);
      },
      onAudio: (base64Pcm) => {
        void queuePcmAudio(base64Pcm);
      },
      onTurnComplete: () => {
        setIsAiResponding(false);
        setRespondingTopic('');
        awaitingTurnCompletionRef.current = false;

        let finalReply = assistantDraftTextRef.current.trim();
        if (!finalReply && assistantTurnHadAudioRef.current) {
          finalReply = 'Live audio response delivered.';
          setMessages(prev => [
            ...prev,
            {
              role: 'ai',
              text: finalReply,
              time: new Date().toLocaleTimeString(),
            },
          ]);
        }

        if (finalReply) {
          const topic = buildDashboardContext(storeState()).topic;
          void persistVoiceTranscript({
            userId: storeState().user?.uid,
            topic,
            query: currentTurnUserQueryRef.current || 'live microphone query',
            reply: finalReply,
            provider: 'ai',
            model: 'runtime',
            mode: 'live_voice_ws',
          }).catch((persistError) => {
            console.warn('[Firebase] Failed to persist live voice transcript', { persistError });
          });

          if (!assistantTurnHadAudioRef.current) {
            speakText(finalReply);
          }
        }

        assistantDraftIndexRef.current = null;
        assistantDraftTextRef.current = '';
        assistantTurnHadAudioRef.current = false;
        currentTurnUserQueryRef.current = '';

        if (continuousModeRef.current && continuousSessionActiveRef.current && !listeningRef.current) {
          window.setTimeout(() => {
            if (continuousModeRef.current && continuousSessionActiveRef.current && !listeningRef.current) {
              void startMicCapture();
            }
          }, 280);
        }
      },
      onError: (message) => {
        if (!isMountedRef.current || sessionId !== liveSessionIdRef.current) return;
        stopMicCapture(false);
        continuousSessionActiveRef.current = false;
        awaitingTurnCompletionRef.current = false;
        setLiveStatus('OFFLINE');
        setIsAiResponding(false);
        setRespondingTopic('');
        setMessages(prev => [
          ...prev,
          {
            role: 'ai',
            text: `Live session error: ${message}`,
            time: new Date().toLocaleTimeString(),
          },
        ]);
        scheduleLiveReconnect('socket_error');
      },
      onClose: () => {
        if (!isMountedRef.current || sessionId !== liveSessionIdRef.current) return;
        stopMicCapture(false);
        continuousSessionActiveRef.current = false;
        awaitingTurnCompletionRef.current = false;
        setLiveStatus('OFFLINE');
        scheduleLiveReconnect('socket_close');
      },
    });

    liveClientRef.current = liveClient;
    try {
      await liveClient.connect({
        dashboard_context: dashboardContext,
        voice_name: 'Zephyr',
      });
      return true;
    } catch (error) {
      setLiveStatus('OFFLINE');
      console.warn('[VoiceAI Debug] Live websocket connect failed', { error, reason });
      scheduleLiveReconnect('connect_failed');
      return false;
    }
  };

  const ensureLiveSession = async (): Promise<boolean> => {
    if (liveClientRef.current?.isConnected()) return true;
    return connectLiveSession(true);
  };

  const startMicCapture = async () => {
    setAssistantMode('voice');

    const connected = await ensureLiveSession();
    if (!connected) {
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          text: 'Cannot start live mic because the realtime voice channel is offline. Switch to Smart Chat (Gemini text) and retry voice in a few seconds.',
          time: new Date().toLocaleTimeString(),
        },
      ]);
      return;
    }

    const latestContext = buildDashboardContext(storeState(), conversationContext());
    liveClientRef.current?.sendContext(latestContext);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(4096, 1, 1);
    const muteGain = context.createGain();
    muteGain.gain.value = 0;

    source.connect(processor);
    processor.connect(muteGain);
    muteGain.connect(context.destination);

    mediaStreamRef.current = stream;
    micContextRef.current = context;
    micSourceRef.current = source;
    micProcessorRef.current = processor;
    micMuteGainRef.current = muteGain;

    speechDetectedRef.current = false;
    lastSpeechAtRef.current = Date.now();
    awaitingTurnCompletionRef.current = false;

    processor.onaudioprocess = (event) => {
      if (!liveClientRef.current?.isConnected() || awaitingTurnCompletionRef.current) return;
      const inputData = event.inputBuffer.getChannelData(0);

      let sumSquares = 0;
      for (let i = 0; i < inputData.length; i += 1) {
        sumSquares += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sumSquares / Math.max(inputData.length, 1));
      const now = Date.now();

      if (rms > SPEECH_RMS_THRESHOLD) {
        speechDetectedRef.current = true;
        lastSpeechAtRef.current = now;
      }

      const base64Pcm = float32ToPcm16Base64(inputData, context.sampleRate, 16000);
      liveClientRef.current.sendAudioChunk(base64Pcm);

      const silenceMs = now - lastSpeechAtRef.current;
      if (
        speechDetectedRef.current
        && silenceMs > END_TURN_SILENCE_MS
      ) {
        stopMicCapture(true);
      }
    };

    currentTurnUserQueryRef.current = 'live microphone query';
    assistantDraftIndexRef.current = null;
    assistantDraftTextRef.current = '';
    assistantTurnHadAudioRef.current = false;

    setMessages(prev => [
      ...prev,
      {
        role: 'user',
        text: '[Microphone stream started] Speak now. Cyna will reply automatically when you pause.',
        time: new Date().toLocaleTimeString(),
      },
    ]);

    setListening(true);
    setVoiceQuery('live microphone query');
    setIsAiResponding(false);
  };

  useEffect(() => {
    isMountedRef.current = true;
    void connectLiveSession(false, 'initial_mount');

    return () => {
      isMountedRef.current = false;
      clearReconnectTimer();
      liveSessionIdRef.current += 1;
      continuousSessionActiveRef.current = false;
      awaitingTurnCompletionRef.current = false;
      stopMicCapture(false);
      liveClientRef.current?.close('component_unmount');
      liveClientRef.current = null;
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (playbackContextRef.current) {
        void playbackContextRef.current.close();
        playbackContextRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (assistantMode !== 'voice') return;
    if (liveClientRef.current?.isConnected()) return;
    void connectLiveSession(true, 'mode_switch');
  }, [assistantMode]);

  const sendMessage = async (text: string) => {
    const query = text.trim();
    if (!query || isAiResponding) return;

    if (assistantMode !== 'chat') {
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          text: 'Direct Voice mode is mic-only. Switch to Smart Chat to send typed queries.',
          time: new Date().toLocaleTimeString(),
        },
      ]);
      return;
    }

    const stateSnapshot = storeState();
    const requestedAlert = findRequestedAlert(query, stateSnapshot.alerts);
    if (requestedAlert) {
      setMessages(prev => [
        ...prev,
        {
          role: 'user',
          text: query,
          time: new Date().toLocaleTimeString(),
        },
        {
          role: 'ai',
          text: `Opening alert ${requestedAlert.id} in Alerts System now.`,
          time: new Date().toLocaleTimeString(),
        },
      ]);
      navigate('/alerts', { state: { openAlertId: requestedAlert.id, source: 'cyna' } });
      setVoiceOpen(false);
      setInput('');
      return;
    }

    rememberUserInput(query);

    setVoiceQuery(query);
    setMessages(prev => [
      ...prev,
      {
        role: 'user',
        text: query,
        time: new Date().toLocaleTimeString(),
      },
    ]);
    setInput('');
    setRespondingTopic(query);

    const dashboardContext = buildDashboardContext(storeState(), conversationContext());

    setIsAiResponding(true);
    try {
      let result: VoiceAssistantResult;
      try {
        result = await askVoiceAssistant(query, dashboardContext, 'chat');
      } catch (firstError) {
        console.warn('[VoiceAI Debug] Smart chat primary attempt failed, retrying once', firstError);
        result = await askVoiceAssistant(query, dashboardContext, 'chat');
      }

      const outputText = (result.reply || '').trim();
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          text: outputText,
          time: new Date().toLocaleTimeString(),
        },
      ]);

      void persistVoiceTranscript({
        userId: storeState().user?.uid,
        topic: dashboardContext.topic,
        query,
        reply: result.reply,
        provider: result.provider,
        model: result.model,
        mode: result.mode,
      }).catch((persistError) => {
        console.warn('[Firebase] Failed to persist smart chat transcript', { persistError });
      });
    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          text: 'Gemini Smart Chat is temporarily unavailable. Please retry in a few seconds while pipeline data continues syncing.',
          time: new Date().toLocaleTimeString(),
        },
      ]);
      console.warn('[VoiceAI Debug] Smart chat request failed after retry', error);
    } finally {
      setIsAiResponding(false);
      setRespondingTopic('');
    }
  };

  const toggleListening = async () => {
    if (listening) {
      continuousSessionActiveRef.current = false;
      stopMicCapture(true);
      return;
    }

    try {
      continuousSessionActiveRef.current = continuousModeRef.current;
      await startMicCapture();
    } catch (error) {
      continuousSessionActiveRef.current = false;
      setListening(false);
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          text: `Could not access microphone for live session: ${String(error)}`,
          time: new Date().toLocaleTimeString(),
        },
      ]);
    }
  };

  const quickCommands = [
    'Explain current high risk pattern',
    'Create a short risk diagram for Mumbai',
    'What will happen in next 2 hours?',
    'Open latest alert',
  ];
  const isChatMode = assistantMode === 'chat';
  const assistantStatus = listening
    ? 'Listening and streaming microphone audio...'
    : isAiResponding
      ? `${isChatMode ? 'Smart Chat is analyzing' : 'Cyna is responding'}${respondingTopic ? ` (${respondingTopic})` : ''}`
      : isChatMode
        ? 'Smart Chat mode: structured and diagram-style tactical responses.'
        : liveStatus === 'LIVE'
          ? (continuousMode ? 'Realtime voice connected. Continuous flow active.' : 'Realtime voice channel connected.')
          : liveStatus === 'CONNECTING'
            ? 'Connecting voice channel...'
            : 'Voice channel offline. Direct voice will be unavailable.';

  return (
    <div className="voice-panel">
      <div className="voice-panel-header">
        <div
          id="voice-mic-btn"
          className={`voice-mic${listening ? ' listening' : ''}`}
          onClick={() => void toggleListening()}
          style={{ cursor: 'pointer', userSelect: 'none' }}
          title={listening ? 'Stop live microphone stream' : 'Start live microphone stream'}
        >
          🎙
        </div>
        <div className="voice-header-copy">
          <div className="voice-header-title">Cyna {isChatMode ? 'Smart Chat' : 'Direct Voice'}</div>
          <div className="voice-header-status">{assistantStatus}</div>
        </div>
        <div className="voice-mode-switch" role="tablist" aria-label="Assistant mode">
          <button
            className={`voice-mode-btn${isChatMode ? ' active' : ''}`}
            onClick={() => setAssistantMode('chat')}
            disabled={listening || isAiResponding}
            title="Smart chat mode"
          >
            Smart Chat
          </button>
          <button
            className={`voice-mode-btn${!isChatMode ? ' active' : ''}`}
            onClick={() => setAssistantMode('voice')}
            disabled={isAiResponding}
            title="Direct voice mode"
          >
            Direct Voice
          </button>
        </div>
        {!isChatMode && (
          <button
            id="voice-continuous-btn"
            className={`btn btn-ghost btn-xs voice-continuous-btn${continuousMode ? ' active' : ''}`}
            onClick={() => {
              const next = !continuousMode;
              setContinuousMode(next);
              if (!next) {
                continuousSessionActiveRef.current = false;
              }
            }}
            title={continuousMode ? 'Continuous flow enabled' : 'Continuous flow disabled'}
          >
            {continuousMode ? 'Continuous On' : 'Continuous Off'}
          </button>
        )}
        <button
          id="voice-close-btn"
          className="btn btn-ghost btn-xs"
          onClick={() => setVoiceOpen(false)}
          style={{ padding: '4px 7px', fontSize: 13 }}
        >
          ✕
        </button>
      </div>

      <div className="voice-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`voice-msg ${msg.role}`}>
            {msg.text}
            <div className="voice-msg-time">{msg.time}</div>
          </div>
        ))}

        {isAiResponding && (
          <div className="voice-msg ai voice-typing-row">
            <span className="typing-label">{isChatMode ? 'Smart Chat is responding' : 'Live AI responding'}</span>
            <span className="typing-dots" aria-hidden="true">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {isChatMode && (
        <div className="voice-quick-actions">
          {quickCommands.map(cmd => (
            <button
              key={cmd}
              className="btn btn-ghost voice-quick-btn"
              onClick={() => void sendMessage(cmd)}
              disabled={isAiResponding || listening}
            >
              {cmd}
            </button>
          ))}
        </div>
      )}

      <div className="voice-input-row">
        <input
          id="voice-text-input"
          className="voice-text-input"
          placeholder={isChatMode ? 'Ask Cyna for smart analysis and diagram-style insights...' : 'Direct Voice mode is mic-only'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void sendMessage(input)}
          disabled={isAiResponding || listening || !isChatMode}
        />
        <button
          id="voice-send-btn"
          className="voice-send-btn"
          onClick={() => void sendMessage(input)}
          title="Send"
          disabled={isAiResponding || listening || !isChatMode}
        >
          {isAiResponding ? '…' : '➤'}
        </button>
        <button
          id="voice-mic-input-btn"
          className="btn btn-ghost btn-xs"
          onClick={() => void toggleListening()}
          style={{ padding: '4px 8px', fontSize: 14, color: listening ? 'var(--risk-high)' : 'var(--text-muted)' }}
          title={listening ? 'Stop live microphone stream' : 'Start live microphone stream'}
        >
          🎙
        </button>
      </div>
    </div>
  );
}
