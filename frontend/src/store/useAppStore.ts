import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Alert, AlertStatus, DashboardStats, FilterType, PipelineStage, RiskLevel, AuditLog, User } from '../types';
import { generateMockAlerts, generateMockAuditLogs, generateMockPipelineStages } from '../services/mockData';
import { runTopic, streamTopic } from '../services/realtimeApi';

type PipelineModelMode = 'unknown' | 'gemini' | 'fallback';

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;

  // Alerts
  alerts: Alert[];
  activeFilter: FilterType;
  searchQuery: string;
  selectedCity: string;

  // Dashboard
  dashboardStats: DashboardStats;
  isCollecting: boolean;

  // Pipeline
  pipelineStages: PipelineStage[];
  isPipelineRunning: boolean;
  pipelineModelMode: PipelineModelMode;
  pipelineModelName: string;
  pipelineModelReason: string;
  pipelineActiveTopic: string;
  pipelineLiveNode: string;
  pipelineLiveInsight: string;
  pipelineActivityFeed: string[];

  // Audit Logs
  auditLogs: AuditLog[];

  // Voice Assistant
  isVoiceOpen: boolean;
  voiceQuery: string;

  // Latest backend output
  latestReport: string;
  lastTopic: string;

  // Actions
  setUser: (user: User | null) => void;
  setFilter: (filter: FilterType) => void;
  setSearchQuery: (q: string) => void;
  setSelectedCity: (city: string) => void;
  resolveAlert: (id: string) => void;
  addAlert: (alert: Alert) => void;
  setVoiceOpen: (open: boolean) => void;
  setVoiceQuery: (q: string) => void;
  triggerCollect: () => Promise<void>;
  runPipeline: () => Promise<void>;
  updateAlertStatus: (id: string, status: AlertStatus) => void;
}

const initialAlerts = generateMockAlerts(24);
const initialLogs = generateMockAuditLogs(initialAlerts);

function pickTopic(searchQuery: string, voiceQuery: string): string {
  const candidate = searchQuery.trim() || voiceQuery.trim();
  return candidate || 'india public safety protest unrest law and order';
}

function mergeAlerts(current: Alert[], incoming: Alert[]): Alert[] {
  const merged = new Map<string, Alert>();

  for (const alert of [...incoming, ...current]) {
    const key = `${alert.title.toLowerCase()}|${alert.location.toLowerCase()}|${alert.category}`;
    if (!merged.has(key)) {
      merged.set(key, alert);
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 120);
}

function upsertStage(existing: PipelineStage[], next: PipelineStage): PipelineStage[] {
  const order = ['collector', 'cleaner', 'analyzer', 'predictor', 'reporter'];
  const found = existing.some(stage => stage.id === next.id);
  const updated = found
    ? existing.map(stage => (stage.id === next.id ? next : stage))
    : [...existing, next];

  return updated.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

function computeStats(alerts: Alert[]): DashboardStats {
  const active = alerts.filter(a => a.status === 'ACTIVE');
  const high = alerts.filter(a => a.riskLevel === 'HIGH');
  const medium = alerts.filter(a => a.riskLevel === 'MEDIUM');
  const low = alerts.filter(a => a.riskLevel === 'LOW');
  const resolved = alerts.filter(a => a.status === 'RESOLVED');
  const avgConf = alerts.length > 0
    ? Math.round(alerts.reduce((s, a) => s + a.confidence, 0) / alerts.length)
    : 0;
  const locCount: Record<string, number> = {};
  alerts.forEach(a => { locCount[a.location] = (locCount[a.location] || 0) + 1; });
  const topLocation = Object.entries(locCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  return {
    totalAlerts: alerts.length,
    activeAlerts: active.length,
    highRisk: high.length,
    mediumRisk: medium.length,
    lowRisk: low.length,
    resolvedToday: resolved.length,
    avgConfidence: avgConf,
    topLocation,
    lastUpdated: new Date(),
  };
}

function buildStageInsight(stageId: string, topic: string, itemsProcessed: number): string {
  const shortTopic = topic.trim() || 'public safety signals';

  switch (stageId) {
    case 'collector':
      return `Gathering source documents for "${shortTopic}" from APIs, RSS, and web search (${itemsProcessed} items).`;
    case 'cleaner':
      return `Deduplicating and normalizing collected records for "${shortTopic}" to improve signal quality.`;
    case 'analyzer':
      return `Extracting entities, sentiment, and event intent from "${shortTopic}" evidence clusters.`;
    case 'predictor':
      return `Calculating risk and escalation patterns for "${shortTopic}" using current evidence trends.`;
    case 'reporter':
      return `Generating explainable report narrative and action recommendations for "${shortTopic}".`;
    default:
      return `Processing topic "${shortTopic}".`;
  }
}

function pushActivity(feed: string[], message: string): string[] {
  return [message, ...feed].slice(0, 14);
}

export const useAppStore = create<AppState>()(persist((set, get) => ({
  user: null,
  isAuthenticated: false,
  alerts: initialAlerts,
  activeFilter: 'ALL',
  searchQuery: '',
  selectedCity: '',
  dashboardStats: computeStats(initialAlerts),
  isCollecting: false,
  pipelineStages: generateMockPipelineStages(),
  isPipelineRunning: false,
  pipelineModelMode: 'unknown',
  pipelineModelName: 'Not detected',
  pipelineModelReason: 'Run the pipeline to verify model configuration.',
  pipelineActiveTopic: '',
  pipelineLiveNode: '',
  pipelineLiveInsight: 'Pipeline is idle.',
  pipelineActivityFeed: [],
  auditLogs: initialLogs,
  isVoiceOpen: false,
  voiceQuery: '',
  latestReport: 'Run the pipeline to generate a Gemini intelligence briefing.',
  lastTopic: 'Not set',

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setFilter: (filter) => set({ activeFilter: filter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedCity: (selectedCity) => set({ selectedCity }),

  resolveAlert: (id) => {
    set(state => {
      const alerts = state.alerts.map(a =>
        a.id === id ? { ...a, status: 'RESOLVED' as AlertStatus, updatedAt: new Date() } : a
      );
      return { alerts, dashboardStats: computeStats(alerts) };
    });
  },

  updateAlertStatus: (id, status) => {
    set(state => {
      const alerts = state.alerts.map(a =>
        a.id === id ? { ...a, status, updatedAt: new Date() } : a
      );
      return { alerts, dashboardStats: computeStats(alerts) };
    });
  },

  addAlert: (alert) => {
    set(state => {
      const alerts = [alert, ...state.alerts];
      return { alerts, dashboardStats: computeStats(alerts) };
    });
  },

  setVoiceOpen: (isVoiceOpen) => set({ isVoiceOpen }),
  setVoiceQuery: (voiceQuery) => set({ voiceQuery }),

  triggerCollect: async () => {
    set({ isCollecting: true });
    const topic = pickTopic(get().searchQuery, get().voiceQuery);

    try {
      const result = await runTopic(topic, 20);
      const mode = String(result.meta?.mode ?? 'unknown');
      if (mode === 'gemini') {
        console.info('[AI Debug] triggerCollect succeeded with Gemini mode', {
          topic,
          model: result.meta?.model,
          alerts: result.alerts.length,
        });
      } else {
        console.warn('[AI Debug] triggerCollect returned fallback mode', {
          topic,
          mode,
          reason: result.meta?.reason,
          modelErrors: result.meta?.model_errors,
        });
      }

      set(state => {
        const alerts = mergeAlerts(state.alerts, result.alerts);
        const mode = String(result.meta?.mode ?? 'unknown');
        const model = String(result.meta?.model ?? 'Not detected');
        const reason = String(result.meta?.reason ?? '');
        return {
          isCollecting: false,
          alerts,
          dashboardStats: computeStats(alerts),
          pipelineStages: result.stages,
          pipelineModelMode: mode === 'gemini' ? 'gemini' : 'fallback',
          pipelineModelName: model,
          pipelineModelReason: mode === 'gemini'
            ? `Model configured successfully (${model}).`
            : (reason || 'Backend returned fallback mode. Verify API keys and model access.'),
          auditLogs: generateMockAuditLogs(alerts).slice(0, 120),
          latestReport: result.report,
          lastTopic: result.topic,
        };
      });
    } catch (error) {
      console.error('[AI Debug] triggerCollect backend failed, falling back to mock alerts', {
        topic,
        error,
      });

      // Keep UI usable if backend is down or keys are missing.
      await new Promise(r => setTimeout(r, 1000));
      const newAlerts = generateMockAlerts(3);
      set(state => {
        const alerts = mergeAlerts(state.alerts, newAlerts);
        return {
          isCollecting: false,
          alerts,
          dashboardStats: computeStats(alerts),
        };
      });
    }
  },

  runPipeline: async () => {
    const topic = pickTopic(get().searchQuery, get().voiceQuery);
    set({
      isPipelineRunning: true,
      lastTopic: topic,
      pipelineActiveTopic: topic,
      pipelineLiveNode: 'collector',
      pipelineLiveInsight: buildStageInsight('collector', topic, 0),
      pipelineModelMode: 'unknown',
      pipelineModelReason: 'Validating model configuration and preparing execution.',
      pipelineActivityFeed: [`Queued pipeline run for topic "${topic}".`],
      pipelineStages: get().pipelineStages.map(stage => ({
        ...stage,
        status: 'IDLE',
        itemsProcessed: 0,
        processingTime: 0,
      })),
    });

    await new Promise<void>((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve();
      };

      const close = streamTopic(topic, 25, {
        onStage: (stage) => {
          console.info('[AI Debug] pipeline stage update', {
            topic,
            stage: stage.id,
            status: stage.status,
            itemsProcessed: stage.itemsProcessed,
            processingMs: stage.processingTime,
          });

          set(state => ({
            pipelineStages: upsertStage(state.pipelineStages, stage),
            pipelineLiveNode: stage.id,
            pipelineLiveInsight: buildStageInsight(stage.id, topic, stage.itemsProcessed),
            pipelineActivityFeed: pushActivity(
              state.pipelineActivityFeed,
              `${stage.name}: ${stage.status} (${stage.itemsProcessed} items, ${stage.processingTime}ms)`
            ),
          }));
        },
        onResult: (result) => {
          const mode = String(result.meta?.mode ?? 'unknown');
          const model = String(result.meta?.model ?? 'Not detected');
          const reason = String(result.meta?.reason ?? '');
          if (mode === 'gemini') {
            console.info('[AI Debug] runPipeline completed with Gemini mode', {
              topic,
              model: result.meta?.model,
              alerts: result.alerts.length,
            });
          } else {
            console.warn('[AI Debug] runPipeline completed in fallback mode', {
              topic,
              mode,
              reason: result.meta?.reason,
              modelErrors: result.meta?.model_errors,
            });
          }

          set(state => {
            const alerts = mergeAlerts(state.alerts, result.alerts);
            return {
              isPipelineRunning: false,
              alerts,
              dashboardStats: computeStats(alerts),
              pipelineStages: result.stages,
              pipelineModelMode: mode === 'gemini' ? 'gemini' : 'fallback',
              pipelineModelName: model,
              pipelineModelReason: mode === 'gemini'
                ? `Model configured successfully (${model}).`
                : (reason || 'Backend returned fallback mode. Verify API keys and model access.'),
              pipelineActiveTopic: '',
              pipelineLiveNode: '',
              pipelineLiveInsight: mode === 'gemini'
                ? `Pipeline completed for "${result.topic}" with configured model.`
                : `Pipeline completed in fallback mode for "${result.topic}".`,
              pipelineActivityFeed: pushActivity(
                state.pipelineActivityFeed,
                mode === 'gemini'
                  ? `Completed with model ${model}.`
                  : `Completed in fallback mode${reason ? `: ${reason}` : '.'}`,
              ),
              auditLogs: generateMockAuditLogs(alerts).slice(0, 120),
              latestReport: result.report,
              lastTopic: result.topic,
            };
          });
          close();
          finish();
        },
        onError: (error) => {
          console.error('[AI Debug] runPipeline stream failed', { topic, error });
          set(state => ({
            isPipelineRunning: false,
            pipelineActiveTopic: '',
            pipelineLiveNode: '',
            pipelineLiveInsight: `Pipeline failed: ${error}`,
            pipelineModelMode: 'fallback',
            pipelineModelReason: `Pipeline stream error: ${error}`,
            pipelineActivityFeed: pushActivity(state.pipelineActivityFeed, `Error: ${error}`),
          }));
          close();
          finish();
        },
      });
    });
  },
}), {
  name: 'leis-app-store',
  partialize: (state) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    selectedCity: state.selectedCity,
  }),
}));

export function getFilteredAlerts(alerts: Alert[], filter: FilterType, query: string): Alert[] {
  let filtered = [...alerts];

  switch (filter) {
    case 'ACTIVE':
      filtered = filtered.filter(a => a.status === 'ACTIVE');
      break;
    case 'HIGH':
      filtered = filtered.filter(a => a.riskLevel === 'HIGH');
      break;
    case 'RESOLVED':
      filtered = filtered.filter(a => a.status === 'RESOLVED');
      break;
  }

  if (query.trim()) {
    const q = query.toLowerCase();
    filtered = filtered.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.location.toLowerCase().includes(q) ||
      a.summary.toLowerCase().includes(q) ||
      a.keywords.some(k => k.toLowerCase().includes(q))
    );
  }

  return filtered.sort((a, b) => {
    const riskOrder: Record<RiskLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return riskOrder[a.riskLevel] - riskOrder[b.riskLevel] || b.createdAt.getTime() - a.createdAt.getTime();
  });
}
