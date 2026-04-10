import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Alert, DashboardStats, PipelineStage } from '../types';

type RunTrigger = 'collect' | 'pipeline' | 'auto-monitor';

interface PersistRunInput {
  userId?: string;
  topic: string;
  report: string;
  trigger: RunTrigger;
  modelMode: string;
  modelName: string;
  modelReason?: string;
  meta: Record<string, unknown>;
  stages: PipelineStage[];
  alerts: Alert[];
}

interface DashboardSnapshotInput {
  userId?: string;
  city: string;
  topic: string;
  modelMode: string;
  modelName: string;
  stats: DashboardStats;
}

interface VoiceTranscriptInput {
  userId?: string;
  topic: string;
  query: string;
  reply: string;
  provider: string;
  model: string;
  mode: string;
}

function normalizeUserId(userId?: string): string {
  return userId && userId.trim() ? userId.trim() : 'anonymous';
}

function toSerializable(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value, (_key, item) => {
      if (item instanceof Date) return item.toISOString();
      return item;
    }));
  } catch {
    return {};
  }
}

function mapStage(stage: PipelineStage): Record<string, unknown> {
  return {
    id: stage.id,
    name: stage.name,
    status: stage.status,
    description: stage.description,
    itemsProcessed: stage.itemsProcessed,
    processingTime: stage.processingTime,
    lastRun: stage.lastRun ? stage.lastRun.toISOString() : null,
  };
}

function mapAlert(alert: Alert): Record<string, unknown> {
  return {
    id: alert.id,
    title: alert.title,
    summary: alert.summary,
    location: alert.location,
    riskLevel: alert.riskLevel,
    confidence: alert.confidence,
    escalationProbability: alert.escalationProbability,
    sentiment: alert.sentiment,
    category: alert.category,
    status: alert.status,
    keywords: [...alert.keywords],
    entities: toSerializable(alert.entities),
    evidence: toSerializable(alert.evidence),
    whyTriggered: alert.whyTriggered,
    recommendedActions: [...alert.recommendedActions],
    sources: alert.sources.map(source => ({
      id: source.id,
      name: source.name,
      type: source.type,
      url: source.url,
      fetchedAt: source.fetchedAt.toISOString(),
    })),
    rawCount: alert.rawCount,
    sourceValidity: alert.sourceValidity ?? null,
    impact: alert.impact ?? null,
    createdAt: alert.createdAt.toISOString(),
    updatedAt: alert.updatedAt.toISOString(),
  };
}

export async function persistPipelineRun(input: PersistRunInput): Promise<void> {
  const userId = normalizeUserId(input.userId);

  await addDoc(collection(db, 'pipeline_runs'), {
    userId,
    topic: input.topic,
    report: input.report,
    trigger: input.trigger,
    modelMode: input.modelMode,
    modelName: input.modelName,
    modelReason: input.modelReason || '',
    meta: toSerializable(input.meta),
    stageCount: input.stages.length,
    alertCount: input.alerts.length,
    stages: input.stages.map(mapStage),
    alerts: input.alerts.map(mapAlert),
    createdAt: serverTimestamp(),
  });

  const batch = writeBatch(db);
  for (const alert of input.alerts) {
    const ref = doc(db, 'alerts', alert.id);
    batch.set(ref, {
      userId,
      topic: input.topic,
      modelMode: input.modelMode,
      modelName: input.modelName,
      ...mapAlert(alert),
      updatedAtServer: serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
}

export async function persistAlertUpdates(userId: string | undefined, topic: string, alerts: Alert[]): Promise<void> {
  if (!alerts.length) return;

  const normalizedUserId = normalizeUserId(userId);
  const batch = writeBatch(db);
  for (const alert of alerts) {
    const ref = doc(db, 'alerts', alert.id);
    batch.set(ref, {
      userId: normalizedUserId,
      topic,
      ...mapAlert(alert),
      updatedAtServer: serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
}

export async function persistDashboardSnapshot(input: DashboardSnapshotInput): Promise<void> {
  const userId = normalizeUserId(input.userId);

  await addDoc(collection(db, 'dashboard_snapshots'), {
    userId,
    city: input.city,
    topic: input.topic,
    modelMode: input.modelMode,
    modelName: input.modelName,
    stats: {
      totalAlerts: input.stats.totalAlerts,
      activeAlerts: input.stats.activeAlerts,
      highRisk: input.stats.highRisk,
      mediumRisk: input.stats.mediumRisk,
      lowRisk: input.stats.lowRisk,
      resolvedToday: input.stats.resolvedToday,
      avgConfidence: input.stats.avgConfidence,
      topLocation: input.stats.topLocation,
      lastUpdated: input.stats.lastUpdated.toISOString(),
    },
    createdAt: serverTimestamp(),
  });
}

export async function persistVoiceTranscript(input: VoiceTranscriptInput): Promise<void> {
  const userId = normalizeUserId(input.userId);
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await setDoc(doc(db, 'voice_transcripts', key), {
    userId,
    topic: input.topic,
    query: input.query,
    reply: input.reply,
    provider: input.provider,
    model: input.model,
    mode: input.mode,
    createdAt: serverTimestamp(),
  });
}
