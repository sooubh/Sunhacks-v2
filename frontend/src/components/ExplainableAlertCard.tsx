import { useEffect, useState } from 'react';
import type { Alert } from '../types';
import { format } from 'date-fns';
import AlertInsightModal from './AlertInsightModal.tsx';

interface Props {
  alert: Alert;
  autoOpen?: boolean;
  onAutoOpenHandled?: () => void;
}

function previewSummary(text: string, maxLen = 148): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trimEnd()}...`;
}

export default function ExplainableAlertCard({ alert, autoOpen = false, onAutoOpenHandled }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!autoOpen) return;

    setIsModalOpen(true);
    const element = document.getElementById(`alert-card-${alert.id}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    onAutoOpenHandled?.();
  }, [alert.id, autoOpen, onAutoOpenHandled]);

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
      onClick={() => setIsModalOpen(true)}
    >
      {/* ── Header (always visible) ── */}
      <div className="alert-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="alert-top-row">
            <div className="alert-badge-cluster">
              <span className={`risk-badge ${alert.riskLevel}`}>
                <span style={{ color: riskColor, fontSize: 8 }}>{riskIcon}</span>
                {alert.riskLevel}
              </span>

              <span className="flex items-center gap-8" style={{ gap: 5 }}>
                <span className={`status-dot ${alert.status}`} />
                <span className={`status-label ${alert.status}`}>{alert.status}</span>
              </span>

              <span className={`sentiment-tag ${alert.sentiment}`}>{alert.sentiment}</span>
            </div>

            <span className="alert-id-badge">#{alert.id}</span>
          </div>

          <div className="alert-title">{alert.title}</div>
          <div className="alert-summary-preview">{previewSummary(alert.summary)}</div>
        </div>

        <div className="alert-chevron">
          <span style={{ fontSize: 8, color: 'inherit' }}>↗</span>
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

      <div className="alert-context-row">
        <span className="alert-context-chip">Entities: {alert.entities.length}</span>
        <span className="alert-context-chip">Keywords: {alert.keywords.length}</span>
        <span className="alert-context-chip">Updated: {format(alert.updatedAt, 'HH:mm:ss')}</span>
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

      <div className="alert-footer alert-footer-card">
        <button
          className="btn btn-ghost btn-sm alert-open-btn"
          onClick={(event) => {
            event.stopPropagation();
            setIsModalOpen(true);
          }}
        >
          Open Full Report
        </button>
        <div className="alert-footer-timestamp">
          <span>Updated</span>
          <span className="alert-footer-timevalue">
            {format(alert.updatedAt, 'HH:mm:ss')}
          </span>
        </div>
      </div>

      <AlertInsightModal
        alert={alert}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
