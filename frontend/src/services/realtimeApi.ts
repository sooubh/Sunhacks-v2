import type { Alert, AlertStatus, EventCategory, PipelineStage, RiskLevel, Sentiment } from '../types';
import type { CityScope } from '../config/cities';

const API_BASE = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim() || 'http://127.0.0.1:8000';

type StageStatus = 'IDLE' | 'RUNNING' | 'DONE' | 'ERROR';

type BackendStage = {
  id: 'collector' | 'cleaner' | 'analyzer' | 'predictor' | 'reporter';
  name: string;
  description: string;
  status: StageStatus;
  items_processed: number;
  processing_time: number;
  last_run: string | null;
};

type BackendEntity = {
  name: string;
  type: 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'EVENT';
};

type BackendSource = {
  id: string;
  name: string;
  type: 'NEWS_API' | 'RSS' | 'WEB_SEARCH';
  url: string;
  fetched_at: string;
};

type BackendEvidence = {
  source: string;
  url: string;
  excerpt: string;
  fetched_at: string;
};

type BackendAlert = {
  id: string;
  title: string;
  summary: string;
  location: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
  escalation_probability: number;
  sentiment: 'PANIC' | 'AGGRESSION' | 'NEUTRAL' | 'TENSE';
  category: 'PROTEST' | 'VIOLENCE' | 'UNREST' | 'ACCIDENT' | 'SURVEILLANCE' | 'UNKNOWN';
  status: 'ACTIVE' | 'RESOLVED' | 'MONITORING';
  entities: BackendEntity[];
  keywords: string[];
  evidence: BackendEvidence[];
  why_triggered: string;
  recommended_actions: string[];
  sources: BackendSource[];
  raw_count: number;
  source_validity: 'VERIFIED' | 'MIXED' | 'UNVERIFIED';
  impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  created_at: string;
  updated_at: string;
};

type BackendResult = {
  topic: string;
  generated_at: string;
  stages: BackendStage[];
  alerts: BackendAlert[];
  report: string;
  meta: Record<string, unknown>;
};

export interface UIRunResult {
  topic: string;
  generatedAt: Date;
  stages: PipelineStage[];
  alerts: Alert[];
  report: string;
  meta: Record<string, unknown>;
}

export interface VoiceAssistantResult {
  reply: string;
  provider: 'gemini' | 'fallback';
  model: string;
  mode: string;
  generatedAt: Date;
}

export type AssistantMode = 'chat' | 'voice';

export interface VoiceDashboardContext {
  topic: string;
  city: string;
  stats: {
    totalAlerts: number;
    activeAlerts: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
    avgConfidence: number;
    topLocation: string;
  };
  pipeline: {
    isRunning: boolean;
    activeNode: string;
    modelMode: string;
    modelName: string;
  };
  topAlerts: Array<{
    id: string;
    title: string;
    location: string;
    riskLevel: string;
    confidence: number;
    status: string;
  }>;
  recentAlerts?: Array<{
    id: string;
    title: string;
    summary: string;
    location: string;
    riskLevel: string;
    status: string;
    category: string;
    sentiment: string;
    confidence: number;
    escalationProbability: number;
    keywords: string[];
    createdAt: string;
  }>;
  categoryBreakdown?: Array<{
    category: string;
    total: number;
    active: number;
    highRisk: number;
  }>;
  locationBreakdown?: Array<{
    location: string;
    total: number;
    active: number;
    highRisk: number;
  }>;
  pipelineStages?: Array<{
    id: string;
    name: string;
    status: string;
    itemsProcessed: number;
    processingTime: number;
  }>;
  latestReportSnippet: string;
  conversation?: {
    recentUserQueries: string[];
    userTerms: string[];
    continuousMode: boolean;
  };
}

const STAGE_ICONS: Record<BackendStage['id'], string> = {
  collector: '📡',
  cleaner: '🧹',
  analyzer: '🔍',
  predictor: '⚠️',
  reporter: '📄',
};

function logDebugReport(label: string, details: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  console.groupCollapsed(`[RealtimeDebug] ${label} @ ${timestamp}`);
  for (const [key, value] of Object.entries(details)) {
    console.log(`${key}:`, value);
  }
  console.groupEnd();
}

function toDate(value: string | null | undefined): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toRisk(value: string): RiskLevel {
  if (value === 'HIGH' || value === 'MEDIUM' || value === 'LOW') return value;
  return 'LOW';
}

function toSentiment(value: string): Sentiment {
  if (value === 'PANIC' || value === 'AGGRESSION' || value === 'NEUTRAL' || value === 'TENSE') return value;
  return 'NEUTRAL';
}

function toCategory(value: string): EventCategory {
  if (value === 'PROTEST' || value === 'VIOLENCE' || value === 'UNREST' || value === 'ACCIDENT' || value === 'SURVEILLANCE' || value === 'UNKNOWN') {
    return value;
  }
  return 'UNKNOWN';
}

function toStatus(value: string): AlertStatus {
  if (value === 'ACTIVE' || value === 'RESOLVED' || value === 'MONITORING') return value;
  return 'ACTIVE';
}

export function mapStage(stage: BackendStage): PipelineStage {
  return {
    id: stage.id,
    name: stage.name,
    icon: STAGE_ICONS[stage.id],
    description: stage.description,
    status: stage.status,
    itemsProcessed: stage.items_processed,
    processingTime: stage.processing_time,
    lastRun: stage.last_run ? toDate(stage.last_run) : null,
  };
}

export function mapAlert(alert: BackendAlert): Alert {
  return {
    id: alert.id,
    title: alert.title,
    summary: alert.summary,
    location: alert.location,
    timestamp: toDate(alert.created_at),
    riskLevel: toRisk(alert.risk_level),
    confidence: alert.confidence,
    escalationProbability: alert.escalation_probability,
    sentiment: toSentiment(alert.sentiment),
    category: toCategory(alert.category),
    status: toStatus(alert.status),
    entities: alert.entities,
    keywords: alert.keywords,
    evidence: alert.evidence.map(item => ({
      source: item.source,
      url: item.url,
      excerpt: item.excerpt,
      fetchedAt: item.fetched_at,
    })),
    whyTriggered: alert.why_triggered,
    recommendedActions: alert.recommended_actions,
    sources: alert.sources.map(source => ({
      id: source.id,
      name: source.name,
      type: source.type,
      url: source.url,
      fetchedAt: toDate(source.fetched_at),
    })),
    rawCount: alert.raw_count,
    sourceValidity: alert.source_validity,
    impact: alert.impact,
    createdAt: toDate(alert.created_at),
    updatedAt: toDate(alert.updated_at),
  };
}

export function mapRunResult(payload: BackendResult): UIRunResult {
  return {
    topic: payload.topic,
    generatedAt: toDate(payload.generated_at),
    stages: payload.stages.map(mapStage),
    alerts: payload.alerts.map(mapAlert),
    report: payload.report,
    meta: payload.meta,
  };
}

export async function runTopic(topic: string, maxItems = 20, city?: CityScope): Promise<UIRunResult> {
  const requestUrl = `${API_BASE}/api/realtime/topic`;
  logDebugReport('runTopic.request', { topic, maxItems, city, requestUrl });

  const response = await fetch(`${API_BASE}/api/realtime/topic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, max_items: maxItems, city }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('[RealtimeDebug] runTopic.failed', {
      topic,
      maxItems,
      status: response.status,
      detail,
      requestUrl,
    });
    throw new Error(`Backend request failed: ${response.status} ${detail}`);
  }

  const json = (await response.json()) as BackendResult;
  const mapped = mapRunResult(json);
  const mode = String(json.meta?.mode ?? 'unknown');

  logDebugReport('runTopic.result', {
    topic: mapped.topic,
    alerts: mapped.alerts.length,
    stageCount: mapped.stages.length,
    mode,
    reason: json.meta?.reason,
    model: json.meta?.model,
  });

  if (mode === 'fallback') {
    console.warn('[RealtimeDebug] backend returned fallback mode', {
      topic: mapped.topic,
      mode,
      reason: json.meta?.reason,
      modelErrors: json.meta?.model_errors ?? json.meta?.ollama_model_errors ?? json.meta?.gemini_model_errors,
    });
  }

  return mapped;
}

export type StreamHandlers = {
  onStage?: (stage: PipelineStage) => void;
  onResult?: (result: UIRunResult) => void;
  onError?: (error: string) => void;
};

export function streamTopic(topic: string, maxItems: number, handlers: StreamHandlers, city?: CityScope): () => void {
  const params = new URLSearchParams({ topic, max_items: String(maxItems) });
  if (city) params.set('city', city);
  const stream = new EventSource(`${API_BASE}/api/realtime/stream?${params.toString()}`);
  logDebugReport('streamTopic.open', {
    topic,
    maxItems,
    city,
    streamUrl: `${API_BASE}/api/realtime/stream?${params.toString()}`,
  });

  stream.addEventListener('stage', event => {
    try {
      const data = JSON.parse((event as MessageEvent).data) as BackendStage;
      console.info('[RealtimeDebug] stream stage', {
        topic,
        stage: data.id,
        status: data.status,
        itemsProcessed: data.items_processed,
        processingMs: data.processing_time,
      });
      handlers.onStage?.(mapStage(data));
    } catch (error) {
      console.error('[RealtimeDebug] stream stage parse error', { topic, error });
      handlers.onError?.(`Stage parse error: ${String(error)}`);
    }
  });

  stream.addEventListener('result', event => {
    try {
      const data = JSON.parse((event as MessageEvent).data) as BackendResult;
      const mode = String(data.meta?.mode ?? 'unknown');
      logDebugReport('streamTopic.result', {
        topic,
        alerts: data.alerts.length,
        mode,
        reason: data.meta?.reason,
        model: data.meta?.model,
      });

      if (mode === 'fallback') {
        console.warn('[RealtimeDebug] stream result fallback mode', {
          topic,
          mode,
          reason: data.meta?.reason,
          modelErrors: data.meta?.model_errors ?? data.meta?.ollama_model_errors ?? data.meta?.gemini_model_errors,
        });
      }

      handlers.onResult?.(mapRunResult(data));
    } catch (error) {
      console.error('[RealtimeDebug] stream result parse error', { topic, error });
      handlers.onError?.(`Result parse error: ${String(error)}`);
    } finally {
      stream.close();
    }
  });

  stream.addEventListener('error', event => {
    const rawData = String((event as MessageEvent).data || '');
    try {
      const data = JSON.parse(rawData || '{}') as { error?: string };
      const errorMessage = data.error || 'Realtime stream error';
      console.error('[RealtimeDebug] stream error event', {
        topic,
        maxItems,
        readyState: stream.readyState,
        rawData,
        errorMessage,
      });
      handlers.onError?.(errorMessage);
    } catch (error) {
      console.error('[RealtimeDebug] stream error parse failure', {
        topic,
        maxItems,
        readyState: stream.readyState,
        rawData,
        error,
      });
      handlers.onError?.('Realtime stream error');
    } finally {
      stream.close();
    }
  });

  return () => stream.close();
}

export async function askVoiceAssistant(
  query: string,
  dashboardContext: VoiceDashboardContext,
  assistantMode: AssistantMode = 'voice',
): Promise<VoiceAssistantResult> {
  const requestUrl = `${API_BASE}/api/voice/assistant`;
  logDebugReport('voiceAssistant.request', {
    query,
    requestUrl,
    city: dashboardContext.city,
    topic: dashboardContext.topic,
    assistantMode,
  });

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      dashboard_context: dashboardContext,
      mode: assistantMode,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Voice assistant failed: ${response.status} ${detail}`);
  }

  const json = (await response.json()) as {
    reply: string;
    provider: 'gemini' | 'fallback';
    model: string;
    mode: string;
    generated_at: string;
  };

  return {
    reply: json.reply,
    provider: json.provider,
    model: json.model,
    mode: json.mode,
    generatedAt: toDate(json.generated_at),
  };
}
