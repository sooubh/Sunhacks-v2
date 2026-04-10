import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore, getFilteredAlerts } from '../store/useAppStore';
import type { FilterType } from '../types';
import ExplainableAlertCard from '../components/ExplainableAlertCard';
import { CITY_OPTIONS, getCityFromLocation, normalizeCityScope } from '../config/cities';

const FILTERS: { label: string; key: FilterType; cls: string }[] = [
  { label: 'All Alerts',   key: 'ALL',      cls: '' },
  { label: 'Active',       key: 'ACTIVE',   cls: '' },
  { label: '🔴 High Risk', key: 'HIGH',     cls: 'high' },
  { label: 'Resolved',     key: 'RESOLVED', cls: 'resolved' },
];

const RISK_FILTERS = [
  { key: 'ALL',    label: 'All',    color: 'var(--accent-blue)' },
  { key: 'HIGH',   label: 'HIGH',   color: 'var(--risk-high)' },
  { key: 'MEDIUM', label: 'MEDIUM', color: 'var(--risk-medium)' },
  { key: 'LOW',    label: 'LOW',    color: 'var(--risk-low)' },
];

function computeCityScopedStats(alerts: ReturnType<typeof getFilteredAlerts>) {
  const active = alerts.filter(a => a.status === 'ACTIVE');
  const high = alerts.filter(a => a.riskLevel === 'HIGH');
  const medium = alerts.filter(a => a.riskLevel === 'MEDIUM');
  const low = alerts.filter(a => a.riskLevel === 'LOW');
  const resolved = alerts.filter(a => a.status === 'RESOLVED');
  return {
    total: alerts.length,
    active: active.length,
    high: high.length,
    medium: medium.length,
    low: low.length,
    resolved: resolved.length,
  };
}

export default function AlertsSystemPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    alerts,
    activeFilter,
    searchQuery,
    selectedCity,
    setFilter,
    setSearchQuery,
    setSelectedCity,
    dashboardStats,
  } = useAppStore();
  const [riskOnly, setRiskOnly] = useState<string>('ALL');
  const [autoOpenAlertId, setAutoOpenAlertId] = useState<string | null>(null);

  const effectiveCity = normalizeCityScope(selectedCity) ?? CITY_OPTIONS[0];

  useEffect(() => {
    if (!normalizeCityScope(selectedCity)) {
      setSelectedCity(CITY_OPTIONS[0]);
    }
  }, [selectedCity, setSelectedCity]);

  useEffect(() => {
    const state = (location.state as { openAlertId?: string } | null) ?? null;
    const requestedId = state?.openAlertId;
    if (!requestedId) return;

    const requested = alerts.find(alert => alert.id.toLowerCase() === requestedId.toLowerCase());
    if (requested) {
      setFilter('ALL');
      setSearchQuery('');
      setRiskOnly('ALL');

      const city = getCityFromLocation(requested.location);
      if (city) {
        setSelectedCity(city);
      }

      setAutoOpenAlertId(requested.id);
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [alerts, location.pathname, location.state, navigate, setFilter, setSearchQuery, setSelectedCity]);

  const cityScopedAllAlerts = useMemo(
    () => alerts.filter(a => getCityFromLocation(a.location) === effectiveCity),
    [alerts, effectiveCity],
  );

  const filtered = getFilteredAlerts(alerts, activeFilter, searchQuery);
  const cityScopedFiltered = filtered.filter(a => getCityFromLocation(a.location) === effectiveCity);
  const display = riskOnly === 'ALL' ? cityScopedFiltered : cityScopedFiltered.filter(a => a.riskLevel === riskOnly);

  const cityStats = computeCityScopedStats(cityScopedAllAlerts);

  const liveUpdates = useMemo(
    () => [...cityScopedFiltered]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 6),
    [cityScopedFiltered],
  );

  const highestConfidence = cityScopedAllAlerts.length > 0
    ? Math.max(...cityScopedAllAlerts.map((alert) => alert.confidence))
    : 0;

  const summaryStats = [
    { label: 'Total',    count: cityStats.total,    color: 'var(--text-primary)' },
    { label: 'Active',   count: cityStats.active,   color: 'var(--accent-blue)' },
    { label: 'High',     count: cityStats.high,     color: 'var(--risk-high)' },
    { label: 'Medium',   count: cityStats.medium,   color: 'var(--risk-medium)' },
    { label: 'Low',      count: cityStats.low,      color: 'var(--risk-low)' },
    { label: 'Resolved', count: cityStats.resolved, color: 'var(--text-muted)' },
  ];

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div className="page-title">Alerts System</div>
        <div className="page-desc">
          AI-powered explainable intelligence reports with evidence tracing · City Scope: {effectiveCity || dashboardStats.topLocation}
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {summaryStats.map(item => (
          <div
            key={item.label}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 20, fontWeight: 800, color: item.color, lineHeight: 1 }}>
              {item.count}
            </span>
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '1.2px',
            }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-16 mb-16 wrap" style={{ gap: 10 }}>
        {/* Status filter tabs */}
        <div className="filter-tabs" id="alert-filter-tabs">
          {FILTERS.map(f => (
            <button
              key={f.key}
              id={`filter-${f.key.toLowerCase()}`}
              className={`filter-tab ${activeFilter === f.key ? 'active ' + f.cls : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Risk level filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {RISK_FILTERS.map(r => (
            <button
              key={r.key}
              id={`risk-filter-${r.key.toLowerCase()}`}
              className="btn btn-ghost btn-xs"
              style={{
                fontSize: 10,
                letterSpacing: '0.5px',
                borderColor: riskOnly === r.key ? r.color : undefined,
                color:       riskOnly === r.key ? r.color : undefined,
                background:  riskOnly === r.key ? `${r.color}1a` : undefined,
                fontWeight:  riskOnly === r.key ? 700 : 500,
              }}
              onClick={() => setRiskOnly(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="city-filter-wrap" style={{ minWidth: 185 }}>
          <label className="city-filter-label" htmlFor="alerts-city-filter">City Scope</label>
          <select
            id="alerts-city-filter"
            className="city-filter-select"
            value={effectiveCity}
            onChange={e => setSelectedCity(e.target.value)}
          >
            {CITY_OPTIONS.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="search-wrap" style={{ marginLeft: 'auto' }}>
          <span className="search-icon">🔍</span>
          <input
            id="alerts-search"
            className="search-input"
            placeholder="Search alerts, locations, keywords..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Results count */}
      <div
        style={{
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          marginBottom: 14,
          letterSpacing: '0.3px',
        }}
      >
        Showing <strong style={{ color: 'var(--text-secondary)' }}>{display.length}</strong> of{' '}
        <strong style={{ color: 'var(--text-secondary)' }}>{cityScopedAllAlerts.length}</strong> intelligence alerts
        {searchQuery && (
          <> · Filtered by "<strong style={{ color: 'var(--text-primary)' }}>{searchQuery}</strong>"</>
        )}
      </div>

      {/* Alert cards + right side information */}
      <div className="alerts-split-layout">
        <section className="alerts-main-pane">
          <div className="alerts-rectangle-box">
            <div className="chart-title" style={{ marginBottom: 12 }}>🚨 City-Wise Alerts · {effectiveCity}</div>
            {display.length === 0 ? (
              <div className="empty-state" style={{ minHeight: 200 }}>
                <div className="empty-state-icon">🔍</div>
                <div className="empty-state-text">No alerts match current filters for {effectiveCity || 'selected city'}</div>
              </div>
            ) : (
              <div className="alerts-rectangle-list">
                {display.map(alert => (
                  <ExplainableAlertCard
                    key={alert.id}
                    alert={alert}
                    autoOpen={autoOpenAlertId === alert.id}
                    onAutoOpenHandled={() => setAutoOpenAlertId(null)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="alerts-side-pane">
          <div className="alerts-side-block">
            <div className="chart-title" style={{ marginBottom: 10 }}>Live Updates</div>
            <div className="alerts-live-list">
              {liveUpdates.map((alert) => (
                <div key={`live-${alert.id}`} className="alerts-live-item">
                  <div className="alerts-live-title">{alert.title}</div>
                  <div className="alerts-live-meta">
                    <span>{alert.riskLevel}</span>
                    <span>{format(alert.updatedAt, 'HH:mm:ss')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="alerts-side-block">
            <div className="chart-title" style={{ marginBottom: 10 }}>Other Information</div>
            <div className="alerts-info-grid">
              <div className="alerts-info-item">
                <span>Active in City</span>
                <strong>{cityStats.active}</strong>
              </div>
              <div className="alerts-info-item">
                <span>High Priority</span>
                <strong>{cityStats.high}</strong>
              </div>
              <div className="alerts-info-item">
                <span>Avg Confidence</span>
                <strong>{cityScopedAllAlerts.length ? Math.round(cityScopedAllAlerts.reduce((sum, alert) => sum + alert.confidence, 0) / cityScopedAllAlerts.length) : 0}%</strong>
              </div>
              <div className="alerts-info-item">
                <span>Top Confidence</span>
                <strong>{highestConfidence}%</strong>
              </div>
            </div>
            <div className="alerts-side-note">
              Live monitoring scope is synced with dashboard city selection.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
