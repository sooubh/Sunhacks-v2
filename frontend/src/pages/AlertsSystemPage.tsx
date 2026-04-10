import { useState } from 'react';
import { useAppStore, getFilteredAlerts } from '../store/useAppStore';
import type { FilterType } from '../types';
import ExplainableAlertCard from '../components/ExplainableAlertCard';

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

export default function AlertsSystemPage() {
  const { alerts, activeFilter, searchQuery, setFilter, setSearchQuery, dashboardStats } = useAppStore();
  const [riskOnly, setRiskOnly] = useState<string>('ALL');

  const filtered = getFilteredAlerts(alerts, activeFilter, searchQuery);
  const display  = riskOnly === 'ALL' ? filtered : filtered.filter(a => a.riskLevel === riskOnly);

  const summaryStats = [
    { label: 'Total',    count: dashboardStats.totalAlerts,    color: 'var(--text-primary)' },
    { label: 'Active',   count: dashboardStats.activeAlerts,   color: 'var(--accent-blue)' },
    { label: 'High',     count: dashboardStats.highRisk,       color: 'var(--risk-high)' },
    { label: 'Medium',   count: dashboardStats.mediumRisk,     color: 'var(--risk-medium)' },
    { label: 'Low',      count: dashboardStats.lowRisk,        color: 'var(--risk-low)' },
    { label: 'Resolved', count: dashboardStats.resolvedToday,  color: 'var(--text-muted)' },
  ];

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div className="page-title">Alerts System</div>
        <div className="page-desc">AI-powered explainable intelligence reports with evidence tracing</div>
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
        <strong style={{ color: 'var(--text-secondary)' }}>{alerts.length}</strong> intelligence alerts
        {searchQuery && (
          <> · Filtered by "<strong style={{ color: 'var(--text-primary)' }}>{searchQuery}</strong>"</>
        )}
      </div>

      {/* Alert cards */}
      {display.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-text">No alerts match the current filters</div>
        </div>
      ) : (
        display.map(alert => <ExplainableAlertCard key={alert.id} alert={alert} />)
      )}
    </div>
  );
}
