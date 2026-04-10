import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { format } from 'date-fns';

const ACTION_COLORS: Record<string, string> = {
  ALERT_CREATED: 'var(--accent-blue)',
  STATUS_CHANGED: 'var(--risk-medium)',
  ALERT_REVIEWED: 'var(--accent-cyan)',
  ACTION_TAKEN: 'var(--risk-low)',
  ESCALATED: 'var(--risk-high)',
  RESOLVED: 'var(--risk-low)',
};

export default function AuditLogsPage() {
  const { auditLogs, alerts } = useAppStore();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const uniqueActions = ['ALL', ...Array.from(new Set(auditLogs.map(l => l.action)))];

  const filtered = auditLogs.filter(log => {
    const matchesSearch = !search ||
      log.alertId.toLowerCase().includes(search.toLowerCase()) ||
      log.performedBy.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase());
    const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const getAlertRisk = (alertId: string) => alerts.find(a => a.id === alertId)?.riskLevel;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Audit Logs</div>
        <div className="page-desc">Complete history and audit trail for compliance and transparency</div>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card blue">
          <div className="stat-label">Total Log Entries</div>
          <div className="stat-value blue">{auditLogs.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Showing</div>
          <div className="stat-value" style={{ color: 'var(--text-primary)' }}>{filtered.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unique Operators</div>
          <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>
            {new Set(auditLogs.map(l => l.performedBy)).size}
          </div>
        </div>
        <div className="stat-card high">
          <div className="stat-label">Escalations</div>
          <div className="stat-value high">
            {auditLogs.filter(l => l.action === 'ESCALATED').length}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-16 mb-16 wrap">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            id="audit-search"
            className="search-input"
            placeholder="Search by alert ID, operator, action..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {uniqueActions.map(action => (
            <button
              key={action}
              id={`audit-filter-${action.toLowerCase()}`}
              className={`btn btn-ghost btn-xs${actionFilter === action ? ' active' : ''}`}
              style={{ fontSize: 9, letterSpacing: '0.5px', borderColor: actionFilter === action ? ACTION_COLORS[action] || 'var(--accent-blue)' : undefined, color: actionFilter === action ? ACTION_COLORS[action] || 'var(--accent-blue)' : undefined }}
              onClick={() => setActionFilter(action)}
            >
              {action}
            </button>
          ))}
        </div>

        <button
          id="audit-export-btn"
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => {
            const csv = [
              ['Log ID', 'Alert ID', 'Action', 'Operator', 'Timestamp', 'Details'].join(','),
              ...filtered.map(l => [l.id, l.alertId, l.action, l.performedBy, format(l.timestamp, 'yyyy-MM-dd HH:mm'), l.details].join(','))
            ].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'Leis_audit.csv'; a.click();
          }}
        >
          📥 Export CSV
        </button>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Log ID</th>
                <th>Alert</th>
                <th>Risk</th>
                <th>Action</th>
                <th>Operator</th>
                <th>Timestamp</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    No audit logs match the current filters
                  </td>
                </tr>
              ) : (
                filtered.map(log => {
                  const risk = getAlertRisk(log.alertId);
                  return (
                    <tr key={log.id} id={`audit-row-${log.id}`}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{log.id}</td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-blue)' }}>
                          {log.alertId}
                        </span>
                      </td>
                      <td>
                        {risk && (
                          <span className={`risk-badge ${risk}`} style={{ fontSize: 9 }}>{risk}</span>
                        )}
                      </td>
                      <td>
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: ACTION_COLORS[log.action] || 'var(--text-secondary)',
                          background: `${ACTION_COLORS[log.action] || 'var(--text-muted)'}18`,
                          padding: '2px 8px', borderRadius: 4, letterSpacing: '0.5px',
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--accent-cyan)' }}>{log.performedBy}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, whiteSpace: 'nowrap' }}>
                        {format(log.timestamp, 'dd MMM · HH:mm')}
                      </td>
                      <td style={{ fontSize: 11, maxWidth: 240, color: 'var(--text-secondary)' }}>{log.details}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
