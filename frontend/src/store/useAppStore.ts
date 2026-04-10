import { create } from 'zustand';
import type { Alert, AlertStatus, DashboardStats, FilterType, PipelineStage, RiskLevel, AuditLog, User } from '../types';
import { generateMockAlerts, generateMockAuditLogs, generateMockPipelineStages } from '../services/mockData';
import { runTopic, streamTopic } from '../services/realtimeApi';

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;

  // Alerts
  alerts: Alert[];
  activeFilter: FilterType;
  searchQuery: string;

  // Dashboard
  dashboardStats: DashboardStats;
  isCollecting: boolean;

  // Pipeline
  pipelineStages: PipelineStage[];
  isPipelineRunning: boolean;

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

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  alerts: initialAlerts,
  activeFilter: 'ALL',
  searchQuery: '',
  dashboardStats: computeStats(initialAlerts),
  isCollecting: false,
  pipelineStages: generateMockPipelineStages(),
  isPipelineRunning: false,
  auditLogs: initialLogs,
  isVoiceOpen: false,
  voiceQuery: '',
  latestReport: 'Run the pipeline to generate a CrewAI intelligence briefing.',
  lastTopic: 'Not set',

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setFilter: (filter) => set({ activeFilter: filter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

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
      set(state => {
        const alerts = mergeAlerts(state.alerts, result.alerts);
        return {
          isCollecting: false,
          alerts,
          dashboardStats: computeStats(alerts),
          pipelineStages: result.stages,
          auditLogs: generateMockAuditLogs(alerts).slice(0, 120),
          latestReport: result.report,
          lastTopic: result.topic,
        };
      });
    } catch {
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
          set(state => ({
            pipelineStages: upsertStage(state.pipelineStages, stage),
          }));
        },
        onResult: (result) => {
          set(state => {
            const alerts = mergeAlerts(state.alerts, result.alerts);
            return {
              isPipelineRunning: false,
              alerts,
              dashboardStats: computeStats(alerts),
              pipelineStages: result.stages,
              auditLogs: generateMockAuditLogs(alerts).slice(0, 120),
              latestReport: result.report,
              lastTopic: result.topic,
            };
          });
          close();
          finish();
        },
        onError: () => {
          set({ isPipelineRunning: false });
          close();
          finish();
        },
      });
    });
  },
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
