import { useState } from 'react';
import type { Alert } from '../types';
import { format } from 'date-fns';
import { useAppStore } from '../store/useAppStore';

interface Props { alert: Alert; }

export default function ExplainableAlertCard({ alert }: Props) {
  const [open, setOpen] = useState(false);
  const { resolveAlert } = useAppStore();

  const riskColor = {
    HIGH:   'var(--risk-high)',
    MEDIUM: 'var(--risk-medium)',
    LOW:    'var(--risk-low)',
  }[alert.riskLevel];

  const riskIcon = alert.riskLevel === 'HIGH' ? '●' : alert.riskLevel === 'MEDIUM' ? '●' : '●';

  return (
    <div
      id={`alert-card-${alert.id}`}
      className={`alert-card ${alert.riskLevel}`}
    >
      {/* ── Header (always visible) ── */}
      <div className="alert-header" onClick={() => setOpen(!open)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badge row */}
          <div className="flex items-center gap-8" style={{ marginBottom: 7 }}>
            <span className={`risk-badge ${alert.riskLevel}`}>
              <span style={{ color: riskColor, fontSize: 8 }}>{riskIcon}</span>
              {alert.riskLevel}
            </span>

            <span className="flex items-center gap-8" style={{ gap: 5 }}>
              <span className={`status-dot ${alert.status}`} />
              <span className={`status-label ${alert.status}`}>{alert.status}</span>
            </span>

            <span className={`sentiment-tag ${alert.sentiment}`}>{alert.sentiment}</span>

            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--text-muted)',
                marginLeft: 'auto',
              }}
            >
              #{alert.id}
            </span>
          </div>

          {/* Title */}
          <div className="alert-title">{alert.title}</div>
        </div>

        {/* Expand chevron */}
        <div className="alert-chevron">
          <span style={{ fontSize: 8, color: 'inherit' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* ── Meta row ── */}
      <div className="alert-meta">
        <span className="alert-meta-item">
          <span className="alert-meta-icon">📍</span>
          {alert.location}
        </span>
        <span className="alert-meta-item">
          <span className="alert-meta-icon">🕒</span>
          {format(alert.createdAt, 'dd MMM yyyy · HH:mm')}
        </span>
        <span className="alert-meta-item">
          <span className="alert-meta-icon">📂</span>
          {alert.category}
        </span>
        <span className="alert-meta-item">
          <span className="alert-meta-icon">🔗</span>
          {alert.rawCount} sources
        </span>
      </div>

      {/* ── Confidence / Escalation bars ── */}
      <div className="alert-bars">
        <div>
          <div className="bar-label-row">
            <span className="bar-label">AI Confidence</span>
            <span className="bar-value" style={{ color: riskColor }}>{alert.confidence}%</span>
          </div>
          <div className="confidence-bar">
            <div
              className={`confidence-fill ${alert.riskLevel.toLowerCase()}`}
              style={{ width: `${alert.confidence}%` }}
            />
          </div>
        </div>

        <div>
          <div className="bar-label-row">
            <span className="bar-label">Escalation Probability</span>
            <span className="bar-value" style={{ color: alert.escalationProbability > 60 ? 'var(--risk-high)' : 'var(--risk-medium)' }}>
              {alert.escalationProbability}%
            </span>
          </div>
          <div className="confidence-bar">
            <div
              className="confidence-fill"
              style={{
                width: `${alert.escalationProbability}%`,
                background: alert.escalationProbability > 60
                  ? 'var(--risk-high)'
                  : 'var(--risk-medium)',
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Expanded body ── */}
      {open && (
        <div className="alert-body open">

          {/* Intelligence Summary */}
          <div className="alert-section">
            <div className="alert-section-header">
              <span className="alert-section-label">📋 Intelligence Summary</span>
              <span className="alert-section-line" />
            </div>
            <p className="alert-section-content">{alert.summary}</p>
          </div>

          {/* Why Triggered — Explainable AI */}
          <div className="alert-section">
            <div className="alert-section-header">
              <span className="alert-section-label" style={{ color: 'var(--accent-cyan)' }}>
                🧠 Why This Alert Was Triggered
              </span>
              <span className="alert-section-line" />
            </div>
            <div className="ai-reason-block">{alert.whyTriggered}</div>
          </div>

          {/* Named Entities */}
          <div className="alert-section">
            <div className="alert-section-header">
              <span className="alert-section-label">👥 Named Entities</span>
              <span className="alert-section-line" />
            </div>
            <div className="entity-row">
              {alert.entities.map((e, i) => (
                <div key={i} className="entity-chip">
                  <span className="entity-type">{e.type}</span>
                  <span className="entity-name">{e.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Keywords */}
          <div className="alert-section">
            <div className="alert-section-header">
              <span className="alert-section-label">🏷 Extracted Keywords (NER)</span>
              <span className="alert-section-line" />
            </div>
            <div className="keyword-chips">
              {alert.keywords.map(k => (
                <span key={k} className="keyword-chip">{k}</span>
              ))}
            </div>
          </div>

          {/* Evidence */}
          <div className="alert-section">
            <div className="alert-section-header">
              <span className="alert-section-label">
                🔍 Evidence Sources ({alert.evidence.length})
              </span>
              <span className="alert-section-line" />
            </div>
            {alert.evidence.map((ev, i) => (
              <div key={i} className="evidence-item">
                <div className="evidence-source">
                  <span>📰 {ev.source}</span>
                  <span className="evidence-timestamp">{ev.fetchedAt}</span>
                </div>
                <div className="evidence-excerpt">"{ev.excerpt}"</div>
                <a
                  href={ev.url}
                  target="_blank"
                  rel="noreferrer"
                  className="evidence-url"
                >
                  {ev.url}
                </a>
              </div>
            ))}
          </div>

          {/* Recommended Actions */}
          <div className="alert-section">
            <div className="alert-section-header">
              <span className="alert-section-label">⚡ Recommended Actions</span>
              <span className="alert-section-line" />
            </div>
            <div className="action-list">
              {alert.recommendedActions.map((action, i) => (
                <div key={i} className="action-item">
                  <span className="action-bullet">
                    <span className="action-bullet-icon">▶</span>
                  </span>
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer actions */}
          <div className="alert-footer">
            {alert.status !== 'RESOLVED' && (
              <button
                id={`resolve-${alert.id}`}
                className="btn btn-success btn-sm"
                onClick={e => { e.stopPropagation(); resolveAlert(alert.id); }}
              >
                ✓ Mark Resolved
              </button>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={e => e.stopPropagation()}
            >
              📤 Export Report
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={e => e.stopPropagation()}
            >
              🔗 Share Briefing
            </button>

            <div className="alert-footer-timestamp">
              <span>Updated</span>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                {format(alert.updatedAt, 'HH:mm:ss')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
