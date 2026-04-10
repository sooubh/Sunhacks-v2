import type { Alert, AlertStatus, EventCategory, PipelineStage, RiskLevel, Sentiment } from '../types';

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

const STAGE_ICONS: Record<BackendStage['id'], string> = {
  collector: '📡',
  cleaner: '🧹',
  analyzer: '🔍',
  predictor: '⚠️',
  reporter: '📄',
};

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

export async function runTopic(topic: string, maxItems = 20): Promise<UIRunResult> {
  const response = await fetch(`${API_BASE}/api/realtime/topic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, max_items: maxItems }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Backend request failed: ${response.status} ${detail}`);
  }

  const json = (await response.json()) as BackendResult;
  return mapRunResult(json);
}

export type StreamHandlers = {
  onStage?: (stage: PipelineStage) => void;
  onResult?: (result: UIRunResult) => void;
  onError?: (error: string) => void;
};

export function streamTopic(topic: string, maxItems: number, handlers: StreamHandlers): () => void {
  const params = new URLSearchParams({ topic, max_items: String(maxItems) });
  const stream = new EventSource(`${API_BASE}/api/realtime/stream?${params.toString()}`);

  stream.addEventListener('stage', event => {
    try {
      const data = JSON.parse((event as MessageEvent).data) as BackendStage;
      handlers.onStage?.(mapStage(data));
    } catch (error) {
      handlers.onError?.(`Stage parse error: ${String(error)}`);
    }
  });

  stream.addEventListener('result', event => {
    try {
      const data = JSON.parse((event as MessageEvent).data) as BackendResult;
      handlers.onResult?.(mapRunResult(data));
    } catch (error) {
      handlers.onError?.(`Result parse error: ${String(error)}`);
    } finally {
      stream.close();
    }
  });

  stream.addEventListener('error', event => {
    try {
      const data = JSON.parse((event as MessageEvent).data || '{}') as { error?: string };
      handlers.onError?.(data.error || 'Realtime stream error');
    } catch {
      handlers.onError?.('Realtime stream error');
    } finally {
      stream.close();
    }
  });

  return () => stream.close();
}
