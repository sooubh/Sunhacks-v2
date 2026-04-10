import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { runTopic, type UIRunResult } from '../services/realtimeApi';

interface Message { role: 'user' | 'ai'; text: string; time: string; }

const CANNED_RESPONSES: { pattern: RegExp; response: (store: ReturnType<typeof useAppStore.getState>) => string }[] = [
  {
    pattern: /high.?risk|critical|urgent/i,
    response: (s) => {
      const high = s.alerts.filter(a => a.riskLevel === 'HIGH' && a.status === 'ACTIVE');
      return `Found ${high.length} HIGH risk active alerts. Top incident: "${high[0]?.title ?? 'None'}" in ${high[0]?.location ?? '—'}. Confidence: ${high[0]?.confidence ?? '—'}%.`;
    },
  },
  {
    pattern: /pune|mumbai|delhi|bengaluru|hyderabad|kollkata|chennai/i,
    response: (s) => {
      const term = (s.voiceQuery || '').match(/pune|mumbai|delhi|bengaluru|hyderabad|kolkata|chennai/i)?.[0] ?? '';
      const found = s.alerts.filter(a => a.location.toLowerCase().includes(term.toLowerCase()));
      return found.length > 0
        ? `${found.length} incidents detected in ${term}. Most severe: "${found[0]?.title}" — Risk: ${found[0]?.riskLevel}.`
        : `No active incidents found for ${term}.`;
    },
  },
  {
    pattern: /summar|brief|overview|status/i,
    response: (s) => {
      const st = s.dashboardStats;
      return `Current Status: ${st.activeAlerts} active alerts, ${st.highRisk} HIGH risk, ${st.mediumRisk} MEDIUM, ${st.lowRisk} LOW. Avg confidence: ${st.avgConfidence}%. Most affected area: ${st.topLocation}.`;
    },
  },
  {
    pattern: /protest|violence|unrest|accident/i,
    response: (s) => {
      const cat = (s.voiceQuery || '').match(/protest|violence|unrest|accident/i)?.[0]?.toUpperCase() ?? '';
      const found = s.alerts.filter(a => a.category === cat);
      return `${found.length} ${cat} incidents found. ${found.filter(a => a.riskLevel === 'HIGH').length} are HIGH risk.`;
    },
  },
  {
    pattern: /resolve|close|done/i,
    response: () => 'To resolve an alert, open the Alerts System page and click "Resolve" on the relevant card.',
  },
  {
    pattern: /pipeline|processing|collector/i,
    response: (s) => {
      const stages = s.pipelineStages;
      const done = stages.filter(s => s.status === 'DONE').length;
      return `AI Pipeline status: ${done}/${stages.length} stages complete. Last processed: ${stages[stages.length - 1]?.itemsProcessed ?? 0} events.`;
    },
  },
];

function getAIResponse(query: string, state: ReturnType<typeof useAppStore.getState>): string {
  for (const r of CANNED_RESPONSES) {
    if (r.pattern.test(query)) return r.response(state);
  }
  return `Processing query: "${query}". Intelligence analysis underway. Try asking about high risk alerts, specific locations, or pipeline status.`;
}

function flattenText(value: string, maxLength = 500): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
}

function formatBackendReply(result: UIRunResult): string {
  const mode = String(result.meta?.mode ?? 'unknown');
  const reason = typeof result.meta?.reason === 'string' ? result.meta.reason : '';
  const intro = mode === 'gemini'
    ? `Gemini analysis complete for "${result.topic}".`
    : `AI fallback mode (${reason || mode}) for "${result.topic}".`;

  return `${intro} ${flattenText(result.report)}`;
}

export default function VoiceAssistantDialog() {
  const { setVoiceOpen, setVoiceQuery } = useAppStore();
  const storeState = useAppStore.getState;
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'Leis Voice AI ready. Ask me about active alerts, locations, or risk levels.', time: new Date().toLocaleTimeString() },
  ]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [respondingTopic, setRespondingTopic] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    const query = text.trim();
    if (!query || isAiResponding) return;

    const userMsg: Message = { role: 'user', text: query, time: new Date().toLocaleTimeString() };
    setVoiceQuery(query);
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsAiResponding(true);
    setRespondingTopic(query);

    try {
      console.info('[VoiceAI Debug] Gemini request started', { topic: query, maxItems: 15 });

      const timeoutMs = 20000;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Gemini response timeout after ${timeoutMs}ms`)), timeoutMs);
      });

      const result = await Promise.race([runTopic(query, 15), timeoutPromise]);

      console.info('[VoiceAI Debug] backend analysis success', {
        topic: query,
        mode: result.meta?.mode,
        reason: result.meta?.reason,
        model: result.meta?.model,
        alerts: result.alerts.length,
      });

      const aiMsg: Message = {
        role: 'ai',
        text: formatBackendReply(result),
        time: new Date().toLocaleTimeString(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error('[VoiceAI Debug] backend analysis failed; using local fallback', { topic: query, error });
      const state = storeState();
      const response = getAIResponse(query, { ...state, voiceQuery: query });
      const aiMsg: Message = {
        role: 'ai',
        text: `${response} Debug: backend AI request failed, local assistant fallback used.`,
        time: new Date().toLocaleTimeString(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } finally {
      setIsAiResponding(false);
      setRespondingTopic('');
      console.info('[VoiceAI Debug] Gemini request finished');
    }
  };

  const toggleListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      sendMessage('[Voice not supported — type your query above]');
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      sendMessage(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.start();
    setListening(true);
  };

  const quickCommands = ['Show high risk alerts', 'Status overview', 'Mumbai incidents', 'Pipeline status'];

  return (
    <div className="voice-panel">
      <div className="voice-panel-header">
        <div
          id="voice-mic-btn"
          className={`voice-mic${listening ? ' listening' : ''}`}
          onClick={toggleListening}
          style={{ cursor: 'pointer', userSelect: 'none' }}
          title={listening ? 'Stop listening' : 'Start voice input'}
        >
          🎙
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>Voice AI Assistant</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {listening
              ? 'Listening...'
              : isAiResponding
                ? `Gemini is typing... ${respondingTopic ? `(${respondingTopic})` : ''}`
                : 'Powered by Gemini'}
          </div>
        </div>
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
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3 }}>{msg.time}</div>
          </div>
        ))}

        {isAiResponding && (
          <div className="voice-msg ai voice-typing-row">
            <span className="typing-label">Gemini is typing</span>
            <span className="typing-dots" aria-hidden="true">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '6px 14px', display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--border-subtle)' }}>
        {quickCommands.map(cmd => (
          <button
            key={cmd}
            className="btn btn-ghost"
            style={{ padding: '3px 8px', fontSize: 9, letterSpacing: '0.3px' }}
            onClick={() => sendMessage(cmd)}
            disabled={isAiResponding}
          >
            {cmd}
          </button>
        ))}
      </div>

      <div className="voice-input-row">
        <input
          id="voice-text-input"
          className="voice-text-input"
          placeholder="Ask about alerts, locations, risk levels..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
          disabled={isAiResponding}
        />
        <button
          id="voice-send-btn"
          className="voice-send-btn"
          onClick={() => sendMessage(input)}
          title="Send"
          disabled={isAiResponding}
        >
          {isAiResponding ? '…' : '➤'}
        </button>
        <button
          id="voice-mic-input-btn"
          className="btn btn-ghost btn-xs"
          onClick={toggleListening}
          style={{ padding: '4px 8px', fontSize: 14, color: listening ? 'var(--risk-high)' : 'var(--text-muted)' }}
          title="Voice input"
        >
          🎙
        </button>
      </div>
    </div>
  );
}
