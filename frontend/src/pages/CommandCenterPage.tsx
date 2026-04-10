import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getCategoryDistribution } from '../services/mockData';
import { format } from 'date-fns';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Link } from 'react-router-dom';
import AlertInsightModal from '../components/AlertInsightModal.tsx';
import CityHeatmapMap from '../components/CityHeatmapMap';
import type { Alert } from '../types';

const COLORS = {
  HIGH: '#ef4444',
  MEDIUM: '#f97316',
  LOW: '#22c55e',
};

const PIE_COLORS = ['#ef4444', '#f97316', '#22c55e', '#c9a227', '#7f6847', '#2f8f72'];

const HOME_SECTIONS = ['Overview', 'Reports', 'Analytics'] as const;
type HomeSection = (typeof HOME_SECTIONS)[number];

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Mumbai: { lat: 19.076, lng: 72.8777 },
  'New Delhi': { lat: 28.6139, lng: 77.209 },
  Pune: { lat: 18.5204, lng: 73.8567 },
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  Hyderabad: { lat: 17.385, lng: 78.4867 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
  Kolkata: { lat: 22.5726, lng: 88.3639 },
  Lucknow: { lat: 26.8467, lng: 80.9462 },
  Jaipur: { lat: 26.9124, lng: 75.7873 },
  Bhopal: { lat: 23.2599, lng: 77.4126 },
  Patna: { lat: 25.5941, lng: 85.1376 },
};

interface RiskTrendRow {
  time: string;
  HIGH: number;
  MEDIUM: number;
  LOW: number;
}

interface CityHeatStat {
  city: string;
  lat: number;
  lng: number;
  total: number;
  high: number;
  medium: number;
  low: number;
}

interface ProactiveInsight {
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  reason: string;
  action: string;
  metric: string;
}

function getCityName(location: string): string {
  return location.split(',')[0]?.trim() || location.trim();
}

function hashCode(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getPointJitter(seed: string): { lat: number; lng: number } {
  const h1 = hashCode(seed);
  const h2 = hashCode(`${seed}-alt`);
  return {
    lat: (((h1 % 1000) / 1000) - 0.5) * 0.28,
    lng: (((h2 % 1000) / 1000) - 0.5) * 0.28,
  };
}

function computeScopedStats(scopedAlerts: Alert[]) {
  const active = scopedAlerts.filter(a => a.status === 'ACTIVE');
  const high = active.filter(a => a.riskLevel === 'HIGH');
  const medium = active.filter(a => a.riskLevel === 'MEDIUM');
  const low = active.filter(a => a.riskLevel === 'LOW');
  const resolved = scopedAlerts.filter(a => a.status === 'RESOLVED');

  const avgConf = scopedAlerts.length > 0
    ? Math.round(scopedAlerts.reduce((sum, alert) => sum + alert.confidence, 0) / scopedAlerts.length)
    : 0;

  const locationCount: Record<string, number> = {};
  scopedAlerts.forEach((alert) => {
    locationCount[alert.location] = (locationCount[alert.location] || 0) + 1;
  });
  const topLocation = Object.entries(locationCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  return {
    totalAlerts: scopedAlerts.length,
    activeAlerts: active.length,
    highRisk: high.length,
    mediumRisk: medium.length,
    lowRisk: low.length,
    resolvedToday: resolved.length,
    avgConfidence: avgConf,
    topLocation,
  };
}

function buildRiskTrendsFromAlerts(scopedAlerts: Alert[]): RiskTrendRow[] {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;

  return Array.from({ length: 24 }, (_, index) => {
    const start = new Date(now - ((23 - index) * hourMs));
    const end = new Date(start.getTime() + hourMs);

    const bucketAlerts = scopedAlerts.filter(
      (alert) => alert.createdAt >= start && alert.createdAt < end,
    );

    return {
      time: format(start, 'HH:mm'),
      HIGH: bucketAlerts.filter(alert => alert.riskLevel === 'HIGH').length,
      MEDIUM: bucketAlerts.filter(alert => alert.riskLevel === 'MEDIUM').length,
      LOW: bucketAlerts.filter(alert => alert.riskLevel === 'LOW').length,
    };
  });
}

const CustomTooltipTheme = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '10px 14px', fontSize: 11 }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: COLORS[p.dataKey as keyof typeof COLORS] || p.color, marginBottom: 2 }}>
          {p.dataKey}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

export default function CommandCenterPage() {
  const { alerts, dashboardStats, isCollecting, triggerCollect, selectedCity, setSelectedCity } = useAppStore();
  const [activeSection, setActiveSection] = useState<HomeSection>('Overview');
  const [selectedReportIndex, setSelectedReportIndex] = useState<number | null>(null);

  const cityFrequency = useMemo(() => {
    const map: Record<string, number> = {};
    alerts.forEach((alert) => {
      const city = getCityName(alert.location);
      map[city] = (map[city] || 0) + 1;
    });

    return Object.entries(map)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count);
  }, [alerts]);

  const topCityOptions = useMemo(
    () => cityFrequency.slice(0, 5).map((entry) => entry.city),
    [cityFrequency],
  );

  useEffect(() => {
    if (!topCityOptions.length) {
      setSelectedCity('');
      return;
    }

    if (!selectedCity || !topCityOptions.includes(selectedCity)) {
      setSelectedCity(topCityOptions[0]);
    }
  }, [topCityOptions, selectedCity]);

  const cityAlerts = useMemo(
    () => alerts.filter((alert) => getCityName(alert.location) === selectedCity),
    [alerts, selectedCity],
  );

  const scopedStats = useMemo(() => computeScopedStats(cityAlerts), [cityAlerts]);
  const riskTrends = useMemo(() => buildRiskTrendsFromAlerts(cityAlerts), [cityAlerts]);
  const categoryDist = useMemo(() => getCategoryDistribution(cityAlerts), [cityAlerts]);

  const activeAlerts = useMemo(
    () => cityAlerts
      .filter(a => a.status === 'ACTIVE')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    [cityAlerts],
  );

  const reportAlerts = useMemo(() => {
    const critical = activeAlerts.filter(a => a.riskLevel === 'HIGH').slice(0, 8);
    return critical.length > 0 ? critical : activeAlerts.slice(0, 8);
  }, [activeAlerts]);

  const selectedReport = selectedReportIndex === null ? null : reportAlerts[selectedReportIndex] ?? null;

  const highRiskAlerts = activeAlerts.filter(a => a.riskLevel === 'HIGH');
  const mediumRiskAlerts = activeAlerts.filter(a => a.riskLevel === 'MEDIUM');
  const lowRiskAlerts = activeAlerts.filter(a => a.riskLevel === 'LOW');

  const cityHeatStats = useMemo<CityHeatStat[]>(() => {
    const rows: CityHeatStat[] = [];

    topCityOptions.forEach((city) => {
      const coord = CITY_COORDS[city];
      if (!coord) return;

      const cityActive = alerts.filter(
        (alert) => getCityName(alert.location) === city && alert.status === 'ACTIVE',
      );

      rows.push({
        city,
        lat: coord.lat,
        lng: coord.lng,
        total: cityActive.length,
        high: cityActive.filter(a => a.riskLevel === 'HIGH').length,
        medium: cityActive.filter(a => a.riskLevel === 'MEDIUM').length,
        low: cityActive.filter(a => a.riskLevel === 'LOW').length,
      });
    });

    return rows;
  }, [alerts, topCityOptions]);

  const heatPoints = useMemo<Array<[number, number, number]>>(() => {
    const points: Array<[number, number, number]> = [];

    cityHeatStats.forEach((stat) => {
      const baseWeight = Math.min(1, Math.max(0.14, stat.total / 10));
      points.push([stat.lat, stat.lng, baseWeight]);
    });

    cityAlerts.forEach((alert) => {
      const city = getCityName(alert.location);
      const base = CITY_COORDS[city] || CITY_COORDS[selectedCity];
      if (!base) return;

      const jitter = getPointJitter(alert.id);
      const riskWeight = alert.riskLevel === 'HIGH' ? 1 : alert.riskLevel === 'MEDIUM' ? 0.68 : 0.4;
      const confidenceFactor = alert.confidence / 220;
      points.push([
        base.lat + jitter.lat,
        base.lng + jitter.lng,
        Math.min(1, riskWeight + confidenceFactor),
      ]);
    });

    return points;
  }, [cityHeatStats, cityAlerts, selectedCity]);

  useEffect(() => {
    if (reportAlerts.length === 0) {
      setSelectedReportIndex(null);
      return;
    }

    if (selectedReportIndex !== null && selectedReportIndex >= reportAlerts.length) {
      setSelectedReportIndex(0);
    }
  }, [reportAlerts, selectedReportIndex]);

  const openReportByIndex = (index: number) => {
    setSelectedReportIndex(index);
  };

  const openReportByRisk = (risk: 'HIGH' | 'MEDIUM' | 'LOW') => {
    const nextIndex = reportAlerts.findIndex(a => a.riskLevel === risk);
    if (nextIndex >= 0) {
      openReportByIndex(nextIndex);
    }
  };

  const closeReportPanels = () => {
    setSelectedReportIndex(null);
  };

  const shiftReport = (delta: number) => {
    if (!reportAlerts.length) return;
    const current = selectedReportIndex ?? 0;
    const next = (current + delta + reportAlerts.length) % reportAlerts.length;
    setSelectedReportIndex(next);
  };

  const firstHighRiskIndex = reportAlerts.findIndex((alert) => alert.riskLevel === 'HIGH');

  const proactiveInsights = useMemo<ProactiveInsight[]>(() => {
    const next: ProactiveInsight[] = [];

    const latestWindow = riskTrends.slice(-6);
    const previousWindow = riskTrends.slice(-12, -6);

    const sumHighLatest = latestWindow.reduce((sum, row) => sum + row.HIGH, 0);
    const sumHighPrevious = previousWindow.reduce((sum, row) => sum + row.HIGH, 0);

    const sumTotalLatest = latestWindow.reduce((sum, row) => sum + row.HIGH + row.MEDIUM + row.LOW, 0);
    const sumTotalPrevious = previousWindow.reduce((sum, row) => sum + row.HIGH + row.MEDIUM + row.LOW, 0);

    const highTrendDelta = sumHighLatest - sumHighPrevious;
    const totalTrendDelta = sumTotalLatest - sumTotalPrevious;

    if (highRiskAlerts.length >= 3) {
      next.push({
        priority: 'CRITICAL',
        title: `Escalation pressure is high in ${selectedCity || 'selected city'}`,
        reason: `${highRiskAlerts.length} high-risk active alerts are currently open, increasing short-term disruption probability.`,
        action: 'Open highest-priority report, assign rapid response owner, and initiate 2-hour review cycle.',
        metric: `${highRiskAlerts.length} high-risk alerts`,
      });
    } else if (highRiskAlerts.length > 0) {
      next.push({
        priority: 'HIGH',
        title: `High-risk incidents require focused watch`,
        reason: `${highRiskAlerts.length} high-risk alert${highRiskAlerts.length > 1 ? 's are' : ' is'} active and can escalate if response visibility drops.`,
        action: 'Prioritize field updates and publish verified status bulletin in the next monitoring cycle.',
        metric: `${highRiskAlerts.length} high-risk alerts`,
      });
    }

    if (highTrendDelta > 1 || totalTrendDelta > 3) {
      next.push({
        priority: highTrendDelta > 2 ? 'HIGH' : 'MEDIUM',
        title: 'Incident trend is rising in the last 6 hours',
        reason: `High-risk trend delta: ${highTrendDelta >= 0 ? '+' : ''}${highTrendDelta}, total event delta: ${totalTrendDelta >= 0 ? '+' : ''}${totalTrendDelta} versus previous window.`,
        action: 'Increase collection frequency and watch adjacent zones for spillover signals.',
        metric: `Delta ${totalTrendDelta >= 0 ? '+' : ''}${totalTrendDelta} events`,
      });
    }

    if (activeAlerts.length > 0 && scopedStats.avgConfidence < 65) {
      next.push({
        priority: 'MEDIUM',
        title: 'Evidence confidence is below operational comfort',
        reason: `Average confidence is ${scopedStats.avgConfidence}% which may increase false-priority decisions.`,
        action: 'Run one fresh intelligence collection and validate top entities before escalation calls.',
        metric: `${scopedStats.avgConfidence}% avg confidence`,
      });
    }

    if (scopedStats.activeAlerts > 0 && scopedStats.resolvedToday === 0) {
      next.push({
        priority: 'MEDIUM',
        title: 'Resolution throughput is currently zero',
        reason: `${scopedStats.activeAlerts} active incident${scopedStats.activeAlerts > 1 ? 's remain' : ' remains'} unresolved today.`,
        action: 'Assign closure owners for top 2 incidents and track resolution ETA on the next shift handoff.',
        metric: `${scopedStats.resolvedToday} resolved today`,
      });
    }

    if (next.length === 0) {
      next.push({
        priority: 'LOW',
        title: 'Situation is stable with controlled risk posture',
        reason: 'No high-risk pressure or adverse trend spike detected in the latest monitoring windows.',
        action: `Maintain routine watch on ${scopedStats.topLocation} and continue periodic verification checks.`,
        metric: `${scopedStats.activeAlerts} active alerts`,
      });
    }

    if (next.length < 3) {
      next.push({
        priority: 'LOW',
        title: 'Regional monitoring recommendation',
        reason: `${scopedStats.topLocation} remains the most active location in city scope and can influence nearby zones.`,
        action: 'Keep district communication synced and pre-position contingency resources near high-flow corridors.',
        metric: `Top location: ${scopedStats.topLocation}`,
      });
    }

    return next.slice(0, 3);
  }, [
    activeAlerts.length,
    highRiskAlerts.length,
    riskTrends,
    scopedStats.activeAlerts,
    scopedStats.avgConfidence,
    scopedStats.resolvedToday,
    scopedStats.topLocation,
    selectedCity,
  ]);

  const sectionDescription: Record<HomeSection, string> = {
    Overview: 'Unified command snapshot with alerts, map, and risk posture.',
    Reports: 'Incident-first workflow focused on reports and response readiness.',
    Analytics: 'Trend analytics and heat signals for proactive forecasting.',
  };

  return (
    <div className="home-command-shell">
      <div className="flex items-center justify-between mb-16">
        <div className="page-header" style={{ margin: 0 }}>
          <div className="page-title">Command Center</div>
          <div className="page-desc">
            {selectedCity || 'City'} intelligence overview · Top 5 city scope · Updated {format(dashboardStats.lastUpdated, 'HH:mm:ss')}
          </div>
        </div>
        <div className="home-toolbar-row">
          <div className="city-filter-wrap">
            <label className="city-filter-label" htmlFor="city-filter">City Scope</label>
            <select
              id="city-filter"
              className="city-filter-select"
              value={selectedCity}
              onChange={(event) => setSelectedCity(event.target.value)}
            >
              {topCityOptions.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          <button
            id="collect-btn"
            className="btn btn-primary"
            onClick={triggerCollect}
            disabled={isCollecting}
          >
            {isCollecting ? <><span className="spinner" /> Collecting...</> : '📡 Collect Intelligence'}
          </button>
        </div>
      </div>

      <div className="home-inline-nav">
        {HOME_SECTIONS.map((section) => (
          <button
            key={section}
            className={`home-inline-nav-btn${activeSection === section ? ' active' : ''}`}
            onClick={() => setActiveSection(section as HomeSection)}
          >
            {section}
          </button>
        ))}
      </div>

      <div className="home-section-caption">{sectionDescription[activeSection]}</div>

      <div className={`home-main-grid${activeSection !== 'Overview' ? ' single-pane' : ''}`}>
        {activeSection !== 'Analytics' && (
        <section className="home-left-column">
          <div className="curved-report-box" id="home-critical-reports">
            <div className="flex items-center justify-between mb-16">
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>
                🔴 Top Critical Alerts · {selectedCity || 'City'}
              </div>
              <Link to="/alerts" style={{ fontSize: 11, color: 'var(--text-accent)', textDecoration: 'none' }}>View all →</Link>
            </div>

            {reportAlerts.length === 0 ? (
              <div className="empty-state" style={{ padding: '34px 20px' }}>
                <div className="empty-state-icon">✅</div>
                <div className="empty-state-text">No active alerts available for {selectedCity}</div>
              </div>
            ) : (
              <div className="report-list">
                {reportAlerts.map((alert, index) => (
                  <button
                    key={alert.id}
                    className={`report-tile ${alert.riskLevel}${selectedReport?.id === alert.id ? ' active' : ''}`}
                    onClick={() => openReportByIndex(index)}
                  >
                    <div className="report-tile-header">
                      <span className={`risk-badge ${alert.riskLevel}`}>{alert.riskLevel}</span>
                      <span className="report-tile-id">#{alert.id}</span>
                    </div>
                    <div className="report-tile-title">{alert.title}</div>
                    <div className="report-tile-meta">
                      <span>📍 {alert.location}</span>
                      <span>🕒 {format(alert.createdAt, 'dd MMM · HH:mm')}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="curved-side-box mt-20">
            <div className="chart-title" style={{ marginBottom: 14 }}>📄 Latest Reports Feed</div>
            <div className="latest-report-list">
              {activeAlerts.slice(0, 6).map((alert) => (
                <div key={alert.id} className="latest-report-item">
                  <div className="latest-report-title">{alert.title}</div>
                  <div className="latest-report-sub">{alert.category} · {alert.location}</div>
                </div>
              ))}

              {activeAlerts.length === 0 && (
                <div className="latest-report-item">
                  <div className="latest-report-title">No active report feed for {selectedCity}</div>
                  <div className="latest-report-sub">Try collecting intelligence or select another city</div>
                </div>
              )}
            </div>
          </div>

          <div className="home-proactive-strip home-proactive-in-column">
            <div className="home-proactive-head">
              Proactive Guidance
              <span className="home-proactive-subhead">Updated {format(dashboardStats.lastUpdated, 'HH:mm:ss')}</span>
            </div>
            <div className="home-proactive-list">
              {proactiveInsights.map((item, index) => (
                <div key={`${activeSection}-guide-${index}`} className="home-proactive-item">
                  <div className="home-proactive-item-top">
                    <span className={`home-proactive-priority ${item.priority.toLowerCase()}`}>{item.priority}</span>
                    <span className="home-proactive-metric">{item.metric}</span>
                  </div>
                  <div className="home-proactive-title">{item.title}</div>
                  <div className="home-proactive-reason">Why: {item.reason}</div>
                  <div className="home-proactive-action">Next action: {item.action}</div>
                </div>
              ))}
            </div>
            <div className="home-proactive-actions">
              <button className="btn btn-ghost btn-sm" onClick={triggerCollect} disabled={isCollecting}>
                Refresh Signals
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  if (firstHighRiskIndex >= 0) {
                    openReportByIndex(firstHighRiskIndex);
                  } else if (reportAlerts.length > 0) {
                    openReportByIndex(0);
                  }
                }}
                disabled={reportAlerts.length === 0}
              >
                Open Highest Priority Report
              </button>
            </div>
          </div>
        </section>
        )}

        {activeSection !== 'Reports' && (
        <section className="home-right-column">
          <div className="curved-side-box">
            <div className="chart-title" style={{ marginBottom: 12 }}>⚠ Risk Matrix</div>
            <div className="home-risk-grid">
              <button className="home-risk-card high" onClick={() => openReportByRisk('HIGH')}>
                <span className="home-risk-label">High Risk</span>
                <strong>{highRiskAlerts.length}</strong>
              </button>
              <button className="home-risk-card medium" onClick={() => openReportByRisk('MEDIUM')}>
                <span className="home-risk-label">Medium Risk</span>
                <strong>{mediumRiskAlerts.length}</strong>
              </button>
              <button className="home-risk-card low" onClick={() => openReportByRisk('LOW')}>
                <span className="home-risk-label">Low Risk</span>
                <strong>{lowRiskAlerts.length}</strong>
              </button>
              <div className="home-risk-card neutral">
                <span className="home-risk-label">Avg. Confidence</span>
                <strong>{scopedStats.avgConfidence}%</strong>
              </div>
            </div>
          </div>

          <div className="mt-20">
            <CityHeatmapMap
              selectedCity={selectedCity}
              updatedAt={dashboardStats.lastUpdated}
              cityStats={cityHeatStats}
              heatPoints={heatPoints}
              onCitySelect={setSelectedCity}
            />
          </div>

          <div className="chart-card mt-20">
            <div className="chart-title">⚡ Risk Level Trends — {selectedCity || 'Selected City'} (Last 24 Hours)</div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={riskTrends} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                <defs>
                  <linearGradient id="gHigh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gMedium" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gLow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#8b8478' }} interval={3} />
                <YAxis tick={{ fontSize: 9, fill: '#8b8478' }} />
                <Tooltip content={<CustomTooltipTheme />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="HIGH" stroke="#ef4444" strokeWidth={2} fill="url(#gHigh)" />
                <Area type="monotone" dataKey="MEDIUM" stroke="#f97316" strokeWidth={2} fill="url(#gMedium)" />
                <Area type="monotone" dataKey="LOW" stroke="#22c55e" strokeWidth={1.5} fill="url(#gLow)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid-2 mt-20">
            <div className="chart-card">
              <div className="chart-title">📂 Event Distribution — {selectedCity || 'City'}</div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={categoryDist}
                    cx="50%" cy="50%"
                    innerRadius={40} outerRadius={72}
                    dataKey="value"
                    paddingAngle={3}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {categoryDist.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <div className="chart-title">📊 Hourly Incident Volume — {selectedCity || 'City'}</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={riskTrends.slice(-12)} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#8b8478' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#8b8478' }} />
                  <Tooltip content={<CustomTooltipTheme />} />
                  <Bar dataKey="HIGH" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="MEDIUM" stackId="a" fill="#f97316" />
                  <Bar dataKey="LOW" stackId="a" fill="#22c55e" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
        )}
      </div>

      <AlertInsightModal
        alert={selectedReport}
        isOpen={!!selectedReport}
        onClose={closeReportPanels}
        onPrevious={reportAlerts.length > 1 ? () => shiftReport(-1) : undefined}
        onNext={reportAlerts.length > 1 ? () => shiftReport(1) : undefined}
        currentIndex={selectedReportIndex === null ? undefined : selectedReportIndex + 1}
        totalCount={reportAlerts.length}
      />

      <div className="stat-grid mt-20">
        <div className="stat-card high">
          <div className="stat-label">High Risk Alerts</div>
          <div className="stat-value high">{scopedStats.highRisk}</div>
          <div className="stat-sub">Requires immediate action</div>
        </div>
        <div className="stat-card medium">
          <div className="stat-label">Medium Risk</div>
          <div className="stat-value medium">{scopedStats.mediumRisk}</div>
          <div className="stat-sub">Needs monitoring</div>
        </div>
        <div className="stat-card low">
          <div className="stat-label">Low Risk</div>
          <div className="stat-value low">{scopedStats.lowRisk}</div>
          <div className="stat-sub">Routine surveillance</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Active Alerts</div>
          <div className="stat-value blue">{scopedStats.activeAlerts}</div>
          <div className="stat-sub">of {scopedStats.totalAlerts} total</div>
        </div>
        <div className="stat-card cyan">
          <div className="stat-label">Avg. Confidence</div>
          <div className="stat-value cyan">{scopedStats.avgConfidence}%</div>
          <div className="stat-sub">AI model certainty</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Resolved Today</div>
          <div className="stat-value" style={{ color: 'var(--text-primary)' }}>{scopedStats.resolvedToday}</div>
          <div className="stat-sub">Closed incidents</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Top Location</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6, color: 'var(--text-primary)', lineHeight: 1.3 }}>{scopedStats.topLocation}</div>
          <div className="stat-sub">Most active area</div>
        </div>
      </div>
    </div>
  );
}
