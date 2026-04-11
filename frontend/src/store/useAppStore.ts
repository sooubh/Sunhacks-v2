import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Alert, AlertStatus, DashboardStats, FilterType, PipelineStage, RiskLevel, AuditLog, User } from '../types';
import { generateMockAlerts, generateMockAuditLogs, generateMockPipelineStages } from '../services/mockData';
import { runTopic, streamTopic, type UIRunResult } from '../services/realtimeApi';
import { persistAlertUpdates, persistDashboardSnapshot, persistPipelineRun } from '../services/firebaseDataService';
import { CITY_OPTIONS, OVERALL_CITY_OPTION, normalizeCityScope, isOverallCitySelection, type CityScope } from '../config/cities';

type PipelineModelMode = 'unknown' | 'ollama' | 'gemini' | 'fallback';

interface AutoAgentReport {
  id: string;
  city: CityScope;
  topic: string;
  report: string;
  mode: PipelineModelMode;
  modelName: string;
  alertsFound: number;
  generatedAt: Date;
}

const AUTO_AGENT_INTERVAL_MINUTES = 10;
const AUTO_AGENT_INTERVAL_MS = AUTO_AGENT_INTERVAL_MINUTES * 60 * 1000;
const AUTO_AGENT_CITIES: CityScope[] = [
  CITY_OPTIONS[0],
  CITY_OPTIONS[1],
  CITY_OPTIONS[2],
  CITY_OPTIONS[3],
];

let autoAgentIntervalId: number | null = null;

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
  autoAgentReports: AutoAgentReport[];
  autoAgentLastRun: Date | null;
  autoAgentIntervalMinutes: number;
  isAutoAgentRunning: boolean;

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
  runAutoAgentCycle: () => Promise<void>;
  startAutoAgentMonitoring: () => void;
  stopAutoAgentMonitoring: () => void;
  updateAlertStatus: (id: string, status: AlertStatus) => void;
}

const initialAlerts = generateMockAlerts(24);
const initialLogs = generateMockAuditLogs(initialAlerts);

function pickTopic(searchQuery: string, voiceQuery: string): string {
  const candidate = searchQuery.trim() || voiceQuery.trim();
  return candidate || 'public safety protest unrest law and order';
}

function buildCityTopic(baseTopic: string, city: CityScope): string {
  const topic = baseTopic.trim();
  if (!topic) return `${city} public safety law and order`;
  if (topic.toLowerCase().includes(city.toLowerCase())) return topic;
  return `${city} ${topic}`;
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

function normalizePipelineMode(value: unknown): PipelineModelMode {
  const mode = String(value ?? 'unknown');
  if (mode === 'ollama' || mode === 'gemini' || mode === 'fallback') return mode;
  return 'unknown';
}

function modelConfigured(mode: PipelineModelMode): boolean {
  return mode === 'ollama' || mode === 'gemini';
}

function alertFingerprint(alert: Alert): string {
  return `${alert.title.toLowerCase()}|${alert.location.toLowerCase()}|${alert.category}`;
}

function buildAutoAgentReport(city: CityScope, result: UIRunResult): AutoAgentReport {
  const mode = normalizePipelineMode(result.meta?.mode);
  const modelName = String(result.meta?.model ?? 'Not detected');

  return {
    id: `${city.toLowerCase()}-${result.generatedAt.getTime()}`,
    city,
    topic: result.topic,
    report: result.report,
    mode,
    modelName,
    alertsFound: result.alerts.length,
    generatedAt: result.generatedAt,
  };
}

export const useAppStore = create<AppState>()(persist((set, get) => ({
  user: null,
  isAuthenticated: false,
  alerts: initialAlerts,
  activeFilter: 'ALL',
  searchQuery: '',
  selectedCity: CITY_OPTIONS[0],
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
  latestReport: 'Run the pipeline to generate an AI intelligence briefing.',
  lastTopic: 'Not set',
  autoAgentReports: [],
  autoAgentLastRun: null,
  autoAgentIntervalMinutes: AUTO_AGENT_INTERVAL_MINUTES,
  isAutoAgentRunning: false,

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

    const stateAfter = get();
    const changed = stateAfter.alerts.find(alert => alert.id === id);
    if (changed) {
      void persistAlertUpdates(stateAfter.user?.uid, stateAfter.lastTopic || 'manual_alert_update', [changed]).catch((persistError) => {
        console.warn('[Firebase] Failed to persist resolved alert', { id, persistError });
      });
    }
  },

  updateAlertStatus: (id, status) => {
    set(state => {
      const alerts = state.alerts.map(a =>
        a.id === id ? { ...a, status, updatedAt: new Date() } : a
      );
      return { alerts, dashboardStats: computeStats(alerts) };
    });

    const stateAfter = get();
    const changed = stateAfter.alerts.find(alert => alert.id === id);
    if (changed) {
      void persistAlertUpdates(stateAfter.user?.uid, stateAfter.lastTopic || 'manual_alert_update', [changed]).catch((persistError) => {
        console.warn('[Firebase] Failed to persist alert status update', { id, status, persistError });
      });
    }
  },

  addAlert: (alert) => {
    set(state => {
      const alerts = [alert, ...state.alerts];
      return { alerts, dashboardStats: computeStats(alerts) };
    });

    const stateAfter = get();
    void persistAlertUpdates(stateAfter.user?.uid, stateAfter.lastTopic || 'manual_alert_add', [alert]).catch((persistError) => {
      console.warn('[Firebase] Failed to persist added alert', { id: alert.id, persistError });
    });
  },

  setVoiceOpen: (isVoiceOpen) => set({ isVoiceOpen }),
  setVoiceQuery: (voiceQuery) => set({ voiceQuery }),

  triggerCollect: async () => {
    set({ isCollecting: true });
    const selectedCity = get().selectedCity;
    const city = normalizeCityScope(selectedCity);
    const topic = city
      ? buildCityTopic(pickTopic(get().searchQuery, get().voiceQuery), city)
      : pickTopic(get().searchQuery, get().voiceQuery);

    try {
      const result = await runTopic(topic, 20, city ?? undefined);
      const mode = normalizePipelineMode(result.meta?.mode);
      if (modelConfigured(mode)) {
        console.info('[AI Debug] triggerCollect succeeded with AI mode', {
          topic,
          mode,
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
        const mode = normalizePipelineMode(result.meta?.mode);
        const model = String(result.meta?.model ?? 'Not detected');
        const reason = String(result.meta?.reason ?? '');
        return {
          isCollecting: false,
          alerts,
          dashboardStats: computeStats(alerts),
          pipelineStages: result.stages,
          pipelineModelMode: mode,
          pipelineModelName: model,
          pipelineModelReason: modelConfigured(mode)
            ? `Model configured successfully (${model}).`
            : (reason || 'Backend returned fallback mode. Verify API keys and model access.'),
          auditLogs: generateMockAuditLogs(alerts).slice(0, 120),
          latestReport: result.report,
          lastTopic: result.topic,
        };
      });

      const stateAfter = get();
      const modelName = String(result.meta?.model ?? 'Not detected');
      const modelReason = String(result.meta?.reason ?? '');
      void Promise.all([
        persistPipelineRun({
          userId: stateAfter.user?.uid,
          topic: result.topic,
          report: result.report,
          trigger: 'collect',
          modelMode: mode,
          modelName,
          modelReason,
          meta: result.meta,
          stages: result.stages,
          alerts: result.alerts,
        }),
        persistDashboardSnapshot({
          userId: stateAfter.user?.uid,
          city: city ?? (isOverallCitySelection(selectedCity) ? OVERALL_CITY_OPTION : selectedCity),
          topic: result.topic,
          modelMode: mode,
          modelName,
          stats: stateAfter.dashboardStats,
        }),
      ]).catch((persistError) => {
        console.warn('[Firebase] Failed to persist collect artifacts', { topic, persistError });
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

  runAutoAgentCycle: async () => {
    if (get().isAutoAgentRunning) {
      return;
    }

    const stateBeforeRun = get();
    const baseTopic = pickTopic(stateBeforeRun.searchQuery, stateBeforeRun.voiceQuery);
    const knownAlertKeys = new Set(stateBeforeRun.alerts.map(alertFingerprint));
    const reports: AutoAgentReport[] = [];
    const collectedAlerts: Alert[] = [];
    const persistenceJobs: Promise<void>[] = [];

    set(state => ({
      isAutoAgentRunning: true,
      pipelineActivityFeed: pushActivity(
        state.pipelineActivityFeed,
        `Auto-monitor cycle started for ${AUTO_AGENT_CITIES.join(', ')}.`
      ),
    }));

    try {
      for (const city of AUTO_AGENT_CITIES) {
        const topic = buildCityTopic(baseTopic, city);

        try {
          const result = await runTopic(topic, 20, city);
          const mode = normalizePipelineMode(result.meta?.mode);
          const modelName = String(result.meta?.model ?? 'Not detected');
          const modelReason = String(result.meta?.reason ?? '');

          if (modelConfigured(mode)) {
            console.info('[AI Debug] auto monitor city cycle completed', {
              city,
              topic: result.topic,
              mode,
              modelName,
              alerts: result.alerts.length,
            });
          } else {
            console.warn('[AI Debug] auto monitor city cycle fallback', {
              city,
              topic: result.topic,
              mode,
              modelReason,
              modelErrors: result.meta?.model_errors,
            });
          }

          reports.push(buildAutoAgentReport(city, result));
          collectedAlerts.push(...result.alerts);

          persistenceJobs.push(
            persistPipelineRun({
              userId: stateBeforeRun.user?.uid,
              topic: result.topic,
              report: result.report,
              trigger: 'auto-monitor',
              modelMode: mode,
              modelName,
              modelReason,
              meta: result.meta,
              stages: result.stages,
              alerts: result.alerts,
            }),
            persistDashboardSnapshot({
              userId: stateBeforeRun.user?.uid,
              city,
              topic: result.topic,
              modelMode: mode,
              modelName,
              stats: computeStats(result.alerts),
            }),
          );
        } catch (error) {
          console.error('[AI Debug] auto monitor city cycle failed', { city, topic, error });
          reports.push({
            id: `${city.toLowerCase()}-${Date.now()}-error`,
            city,
            topic,
            report: `Auto monitor run failed for ${city}. ${String(error)}`,
            mode: 'fallback',
            modelName: 'Run failed',
            alertsFound: 0,
            generatedAt: new Date(),
          });
        }
      }

      if (persistenceJobs.length > 0) {
        const persisted = await Promise.allSettled(persistenceJobs);
        const failed = persisted.filter((entry) => entry.status === 'rejected').length;
        if (failed > 0) {
          console.warn('[Firebase] Auto monitor persistence had failures', { failed });
        }
      }

      const freshAlerts = collectedAlerts.filter(alert => !knownAlertKeys.has(alertFingerprint(alert)));
      const sortedReports = reports
        .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())
        .slice(0, AUTO_AGENT_CITIES.length);
      const featuredReport = sortedReports.find(report => report.alertsFound > 0) ?? sortedReports[0] ?? null;

      set(state => {
        const alerts = collectedAlerts.length > 0 ? mergeAlerts(state.alerts, collectedAlerts) : state.alerts;
        return {
          isAutoAgentRunning: false,
          alerts,
          dashboardStats: collectedAlerts.length > 0 ? computeStats(alerts) : state.dashboardStats,
          autoAgentReports: sortedReports,
          autoAgentLastRun: new Date(),
          latestReport: featuredReport ? featuredReport.report : state.latestReport,
          lastTopic: featuredReport ? featuredReport.topic : state.lastTopic,
          pipelineActivityFeed: pushActivity(
            state.pipelineActivityFeed,
            freshAlerts.length > 0
              ? `Auto-monitor found ${freshAlerts.length} new alerts across ${AUTO_AGENT_CITIES.length} city agents.`
              : 'Auto-monitor completed with no new actionable alerts.'
          ),
        };
      });
    } catch (error) {
      console.error('[AI Debug] auto monitor cycle failed', { error });
      set(state => ({
        isAutoAgentRunning: false,
        pipelineActivityFeed: pushActivity(
          state.pipelineActivityFeed,
          `Auto-monitor failed: ${String(error)}`
        ),
      }));
    }
  },

  startAutoAgentMonitoring: () => {
    if (autoAgentIntervalId !== null) {
      return;
    }

    autoAgentIntervalId = window.setInterval(() => {
      void get().runAutoAgentCycle();
    }, AUTO_AGENT_INTERVAL_MS);

    void get().runAutoAgentCycle();
  },

  stopAutoAgentMonitoring: () => {
    if (autoAgentIntervalId !== null) {
      window.clearInterval(autoAgentIntervalId);
      autoAgentIntervalId = null;
    }
  },

  runPipeline: async () => {
    const selectedCity = get().selectedCity;
    const city = normalizeCityScope(selectedCity);
    const topic = city
      ? buildCityTopic(pickTopic(get().searchQuery, get().voiceQuery), city)
      : pickTopic(get().searchQuery, get().voiceQuery);
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
          const mode = normalizePipelineMode(result.meta?.mode);
          const model = String(result.meta?.model ?? 'Not detected');
          const reason = String(result.meta?.reason ?? '');
          if (modelConfigured(mode)) {
            console.info('[AI Debug] runPipeline completed with AI mode', {
              topic,
              mode,
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
              pipelineModelMode: mode,
              pipelineModelName: model,
              pipelineModelReason: modelConfigured(mode)
                ? `Model configured successfully (${model}).`
                : (reason || 'Backend returned fallback mode. Verify API keys and model access.'),
              pipelineActiveTopic: '',
              pipelineLiveNode: '',
              pipelineLiveInsight: modelConfigured(mode)
                ? `Pipeline completed for "${result.topic}" with configured model.`
                : `Pipeline completed in fallback mode for "${result.topic}".`,
              pipelineActivityFeed: pushActivity(
                state.pipelineActivityFeed,
                modelConfigured(mode)
                  ? `Completed with model ${model}.`
                  : `Completed in fallback mode${reason ? `: ${reason}` : '.'}`,
              ),
              auditLogs: generateMockAuditLogs(alerts).slice(0, 120),
              latestReport: result.report,
              lastTopic: result.topic,
            };
          });

          const stateAfter = get();
          void Promise.all([
            persistPipelineRun({
              userId: stateAfter.user?.uid,
              topic: result.topic,
              report: result.report,
              trigger: 'pipeline',
              modelMode: mode,
              modelName: model,
              modelReason: reason,
              meta: result.meta,
              stages: result.stages,
              alerts: result.alerts,
            }),
            persistDashboardSnapshot({
              userId: stateAfter.user?.uid,
              city: city ?? (isOverallCitySelection(selectedCity) ? OVERALL_CITY_OPTION : selectedCity),
              topic: result.topic,
              modelMode: mode,
              modelName: model,
              stats: stateAfter.dashboardStats,
            }),
          ]).catch((persistError) => {
            console.warn('[Firebase] Failed to persist pipeline artifacts', { topic, persistError });
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
      }, city ?? undefined);
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
