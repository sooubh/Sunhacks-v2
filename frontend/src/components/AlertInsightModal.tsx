import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import type { Alert } from '../types';
import { useAppStore } from '../store/useAppStore';

interface AlertInsightModalProps {
  alert: Alert | null;
  isOpen: boolean;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCount?: number;
}

function getCivilianImpact(alert: Alert): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (alert.impact) return alert.impact;
  if (alert.riskLevel === 'HIGH' && alert.escalationProbability >= 75) return 'CRITICAL';
  if (alert.riskLevel === 'HIGH' || alert.escalationProbability >= 60) return 'HIGH';
  if (alert.riskLevel === 'MEDIUM' || alert.escalationProbability >= 35) return 'MEDIUM';
  return 'LOW';
}

function buildSummaryPoints(summary: string): string[] {
  const points = summary
    .split('.')
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 5);

  return points.length > 0 ? points : [summary];
}

function buildDetailedNarrative(alert: Alert, role: string, impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): string[] {
  const citations = alert.evidence.length > 0
    ? `[C1-C${alert.evidence.length}]`
    : '[No external citation available]';

  const entityCount = alert.entities.length;
  const keywordCount = alert.keywords.length;

  return [
    `Incident context: ${alert.summary} The event is currently classified as ${alert.riskLevel} risk under the ${alert.category} category with ${alert.confidence}% analytical confidence and ${alert.escalationProbability}% escalation probability. Current sentiment posture is ${alert.sentiment}, and potential civilian impact is assessed as ${impact}. ${citations}`,
    `Evidence correlation: The system merged ${alert.rawCount} raw source items and extracted ${entityCount} key entities plus ${keywordCount} keywords, indicating multi-signal corroboration rather than single-source noise. This increases reliability for operational prioritization and supports continuous monitoring over the next update cycle. ${citations}`,
    `Operational implication for ${role}: Based on available data, immediate focus should be on area stabilization around ${alert.location}, reducing trigger amplification vectors, and maintaining cross-team visibility to prevent rapid incident spread into adjacent zones. ${citations}`,
  ];
}

function buildFuturePrediction(alert: Alert): {
  heading: string;
  next6h: string;
  next24h: string;
  next48h: string;
  likelyTriggers: string[];
  mitigationSignals: string[];
} {
  const severityScore = (alert.escalationProbability * 0.6) + (alert.confidence * 0.4);

  if (severityScore >= 75) {
    return {
      heading: 'High likelihood of tactical escalation if unmanaged',
      next6h: 'Localized intensification is possible with crowd density increase, message amplification, or copycat coordination in nearby pockets.',
      next24h: 'If intervention is delayed, spillover to secondary locations can occur with higher volatility and resource strain on response units.',
      next48h: 'Sustained narrative momentum can convert this into a broader regional disruption pattern requiring multi-agency coordination.',
      likelyTriggers: [
        'Rapid social amplification around the event keywords',
        'Counter-group mobilization in adjacent areas',
        'Delayed response visibility or misinformation bursts',
      ],
      mitigationSignals: [
        'Verified local updates with reduced rumor velocity',
        'Stable sentiment trend over consecutive monitoring windows',
        'Decline in high-risk source mentions and entity conflict markers',
      ],
    };
  }

  if (severityScore >= 55) {
    return {
      heading: 'Moderate escalation potential with manageable risk window',
      next6h: 'Situation may remain contained but is sensitive to local triggers, especially around movement points and communication channels.',
      next24h: 'Risk can either stabilize or step up depending on crowd behavior and response speed from field teams.',
      next48h: 'Likely to transition into low-intensity monitoring if preventive actions are visible and coordinated early.',
      likelyTriggers: [
        'Localized confrontation or traffic chokepoints',
        'Unverified viral media related to the incident',
        'Compounding events in the same district',
      ],
      mitigationSignals: [
        'Continuous neutral sentiment progression',
        'Declining incident mention frequency from primary feeds',
        'On-ground coordination updates with no secondary flare-ups',
      ],
    };
  }

  return {
    heading: 'Low immediate escalation probability under active watch',
    next6h: 'Short-term disruption is expected to remain limited with no strong indicators of rapid spread.',
    next24h: 'Most outcomes point toward controlled stabilization if monitoring continues at current intensity.',
    next48h: 'Scenario likely shifts into routine surveillance unless new catalysts emerge.',
    likelyTriggers: [
      'Unexpected mobilization in nearby nodes',
      'False alarm content causing local panic',
      'Critical infrastructure interruption around the area',
    ],
    mitigationSignals: [
      'Consistent drop in risk-tagged mentions',
      'No new high-risk entities extracted in updates',
      'Higher ratio of verified-to-unverified evidence updates',
    ],
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildWhatIfResponse(alert: Alert, query: string): string {
  const normalized = query.toLowerCase();
  let delta = 0;

  if (/spread|adjacent|district|city|region/.test(normalized)) delta += 12;
  if (/social|viral|rumou?r|misinformation|propaganda/.test(normalized)) delta += 15;
  if (/weapon|violent|clash|riot|mob/.test(normalized)) delta += 18;
  if (/police|curfew|deployment|checkpoint|contain/.test(normalized)) delta -= 8;
  if (/rain|weather|night|festival|event/.test(normalized)) delta += 5;

  const projectedEscalation = clamp(alert.escalationProbability + delta, 5, 98);
  const projectedRisk = projectedEscalation >= 75 ? 'HIGH' : projectedEscalation >= 45 ? 'MEDIUM' : 'LOW';

  return [
    `Scenario query: ${query}`,
    `Projected escalation probability: ${projectedEscalation}% (${projectedRisk} risk outlook).`,
    `Likely impact window: 6-24 hours if early indicators continue in ${alert.location}.`,
    'Recommended response: increase monitoring frequency, verify high-velocity narratives, and pre-position local response units.',
  ].join(' ');
}

export default function AlertInsightModal({
  alert,
  isOpen,
  onClose,
  onPrevious,
  onNext,
  currentIndex,
  totalCount,
}: AlertInsightModalProps) {
  const { user, resolveAlert, updateAlertStatus } = useAppStore();
  const [actionMessage, setActionMessage] = useState('');
  const [scenarioPrompt, setScenarioPrompt] = useState('');
  const [scenarioResult, setScenarioResult] = useState('');

  useEffect(() => {
    if (!isOpen || !alert) return;
    setActionMessage('');
    setScenarioPrompt('');
    setScenarioResult('');
  }, [isOpen, alert?.id]);

  if (!isOpen || !alert) return null;

  const summaryPoints = buildSummaryPoints(alert.summary);
  const role = user?.role ?? 'ANALYST';
  const civilianImpact = getCivilianImpact(alert);
  const detailedNarrative = buildDetailedNarrative(alert, role, civilianImpact);
  const prediction = buildFuturePrediction(alert);

  const assessedAreas = Array.from(
    new Set([
      alert.location,
      ...alert.entities.filter(entity => entity.type === 'LOCATION').map(entity => entity.name),
    ]),
  );

  const dataSnapshot: Array<{ label: string; value: string }> = [
    { label: 'Alert ID', value: alert.id },
    { label: 'Status', value: alert.status },
    { label: 'Risk Level', value: alert.riskLevel },
    { label: 'Category', value: alert.category },
    { label: 'Sentiment', value: alert.sentiment },
    { label: 'Confidence', value: `${alert.confidence}%` },
    { label: 'Escalation', value: `${alert.escalationProbability}%` },
    { label: 'Raw Source Count', value: String(alert.rawCount) },
    { label: 'Area', value: alert.location },
    { label: 'Created', value: format(alert.createdAt, 'dd MMM yyyy · HH:mm:ss') },
    { label: 'Updated', value: format(alert.updatedAt, 'dd MMM yyyy · HH:mm:ss') },
    { label: 'Assigned Role', value: role },
  ];

  const exportReport = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 42;
      const maxTextWidth = pageWidth - (margin * 2);
      let y = margin;

      const ensureSpace = (requiredHeight = 16) => {
        if (y + requiredHeight > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
      };

      const addHeading = (text: string, level: 1 | 2 | 3 = 2) => {
        const size = level === 1 ? 18 : level === 2 ? 14 : 12;
        const spacing = level === 1 ? 24 : 19;
        ensureSpace(spacing + 6);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(size);
        doc.setTextColor(15, 23, 42);
        doc.text(text, margin, y);
        y += spacing;
      };

      const addText = (
        text: string,
        options?: {
          bold?: boolean;
          size?: number;
          spacing?: number;
          indent?: number;
        },
      ) => {
        const bold = options?.bold ?? false;
        const size = options?.size ?? 11;
        const spacing = options?.spacing ?? 15;
        const indent = options?.indent ?? 0;

        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(size);
        doc.setTextColor(31, 41, 55);

        const lines = doc.splitTextToSize(text, maxTextWidth - indent);
        lines.forEach((line: string) => {
          ensureSpace(spacing);
          doc.text(line, margin + indent, y);
          y += spacing;
        });
      };

      const addList = (items: string[]) => {
        if (!items.length) {
          addText('- N/A');
          return;
        }

        items.forEach((item, index) => {
          addText(`${index + 1}. ${item}`);
        });
      };

      addHeading('Alert Intelligence Report', 1);
      addText(`Generated At: ${format(new Date(), 'dd MMM yyyy · HH:mm:ss')}`);
      addText('Report Type: Full Intelligence Export');
      y += 4;

      addHeading('Executive Overview', 2);
      addList([
        `Alert ID: ${alert.id}`,
        `Title: ${alert.title}`,
        `Location: ${alert.location}`,
        `Category: ${alert.category}`,
        `Status: ${alert.status}`,
        `Risk Level: ${alert.riskLevel}`,
        `Sentiment: ${alert.sentiment}`,
        `Confidence: ${alert.confidence}%`,
        `Escalation Probability: ${alert.escalationProbability}%`,
        `Civilian Impact: ${civilianImpact}`,
        `Assigned Role: ${role}`,
        `Created: ${format(alert.createdAt, 'dd MMM yyyy · HH:mm:ss')}`,
        `Updated: ${format(alert.updatedAt, 'dd MMM yyyy · HH:mm:ss')}`,
      ]);

      y += 6;
      addHeading('Summary Report (Point-wise)', 2);
      addList(summaryPoints);

      y += 6;
      addHeading('Detailed Intelligence Narrative', 2);
      addList(detailedNarrative);

      y += 6;
      addHeading('All Data Snapshot', 2);
      addList(dataSnapshot.map((item) => `${item.label}: ${item.value}`));

      y += 6;
      addHeading('Entities', 2);
      addList(alert.entities.map((entity) => `[${entity.type}] ${entity.name}`));

      y += 6;
      addHeading('Keywords', 2);
      addList(alert.keywords);

      y += 6;
      addHeading('Why Triggered', 2);
      addText(alert.whyTriggered);

      y += 6;
      addHeading('Link Citations and Evidence Details', 2);
      if (alert.evidence.length > 0) {
        alert.evidence.forEach((item, index) => {
          addText(`[C${index + 1}] ${item.source} | Fetched: ${item.fetchedAt}`, { bold: true });
          addText(`Excerpt: ${item.excerpt}`, { indent: 10 });
          addText(`URL: ${item.url}`, { indent: 10, size: 10 });
          y += 3;
        });
      } else {
        addText('- No citation evidence available');
      }

      y += 6;
      addHeading('Future Prediction (Informative)', 2);
      addList([
        `Outlook: ${prediction.heading}`,
        `Next 6 Hours: ${prediction.next6h}`,
        `Next 24 Hours: ${prediction.next24h}`,
        `Next 48 Hours: ${prediction.next48h}`,
      ]);

      y += 4;
      addHeading('Likely Triggers', 3);
      addList(prediction.likelyTriggers);

      y += 4;
      addHeading('Stabilization Signals to Watch', 3);
      addList(prediction.mitigationSignals);

      y += 6;
      addHeading('Recommended Actions', 2);
      addList(alert.recommendedActions);

      y += 6;
      addHeading('Metrics Panel', 2);
      addList([
        `Confidence Score: ${alert.confidence}%`,
        `Escalation: ${alert.escalationProbability}%`,
        `Civilian Impact: ${civilianImpact}`,
        `User Role: ${role}`,
      ]);

      y += 6;
      addHeading('Assessed Areas', 2);
      addList(assessedAreas);

      y += 6;
      addHeading('Source Registry', 2);
      if (alert.sources.length > 0) {
        addList(
          alert.sources.map(
            (source) =>
              `${source.name} (${source.type}) | Fetched: ${format(source.fetchedAt, 'dd MMM yyyy · HH:mm:ss')} | URL: ${source.url}`,
          ),
        );
      } else {
        addText('- No source registry entries available');
      }

      y += 6;
      addHeading('Scenario Predictor (Latest Session)', 2);
      addList([
        `Prompt: ${scenarioPrompt.trim() || 'Not provided'}`,
        `Output: ${scenarioResult || 'No scenario generated in this session.'}`,
      ]);

      y += 6;
      addHeading('Footer', 2);
      addList([
        typeof currentIndex === 'number' && typeof totalCount === 'number'
          ? `Alert Position: ${currentIndex} of ${totalCount}`
          : 'Alert Position: N/A',
        `Last Updated: ${format(alert.updatedAt, 'dd MMM yyyy · HH:mm:ss')}`,
      ]);

      doc.save(`${alert.id}-full-intelligence-report.pdf`);
      setActionMessage('Full PDF report exported successfully.');
    } catch (error) {
      console.error('PDF export failed', error);
      setActionMessage('PDF export failed. Please try again.');
    }
  };

  const markForReview = () => {
    updateAlertStatus(alert.id, 'MONITORING');
    setActionMessage('Alert marked for review (Monitoring).');
  };

  const reopenAlert = () => {
    updateAlertStatus(alert.id, 'ACTIVE');
    setActionMessage('Alert reopened and moved to Active.');
  };

  const runScenarioPredictor = () => {
    const prompt = scenarioPrompt.trim();
    if (!prompt) {
      setScenarioResult('Enter a what-if question to generate a scenario prediction.');
      return;
    }
    setScenarioResult(buildWhatIfResponse(alert, prompt));
  };

  const modalContent = (
    <div className="alert-modal-overlay" onClick={onClose}>
      <section className="alert-modal-card" onClick={(e) => e.stopPropagation()}>
        <header className="alert-modal-header">
          <div style={{ minWidth: 0 }}>
            <div className="chart-title" style={{ marginBottom: 7 }}>Alert Intelligence Report</div>
            <h2 className="alert-modal-title">{alert.title}</h2>
            <div className="alert-modal-meta-row">
              <span className={`risk-badge ${alert.riskLevel}`}>{alert.riskLevel}</span>
              <span>#{alert.id}</span>
              <span>{alert.category}</span>
              <span>{format(alert.createdAt, 'dd MMM yyyy · HH:mm')}</span>
            </div>
          </div>

          <div className="alert-modal-header-actions">
            {onPrevious && <button className="btn btn-ghost btn-sm" onClick={onPrevious}>← Prev</button>}
            {onNext && <button className="btn btn-ghost btn-sm" onClick={onNext}>Next →</button>}
            <button className="btn btn-primary btn-sm" onClick={onClose}>Close</button>
          </div>
        </header>

        <div className="alert-modal-body">
          <div className="alert-modal-main-col">
            <div className="alert-modal-block">
              <div className="summary-title-chip">Summary Name: {alert.category} Situation Brief - {alert.location}</div>
              <div className="alert-section-label">Summary Report (Point-wise)</div>
              <ol className="alert-point-list">
                {summaryPoints.map((point, index) => (
                  <li key={`${alert.id}-point-${index}`}>{point}</li>
                ))}
              </ol>
            </div>

            <div className="alert-modal-block">
              <div className="alert-section-label">Detailed Intelligence Narrative</div>
              <div className="detailed-narrative-list">
                {detailedNarrative.map((paragraph, index) => (
                  <p key={`${alert.id}-narrative-${index}`} className="detailed-paragraph">{paragraph}</p>
                ))}
              </div>
            </div>

            <div className="alert-modal-block">
              <div className="alert-section-label">All Data Snapshot</div>
              <div className="alert-data-grid">
                {dataSnapshot.map((item) => (
                  <div key={`${alert.id}-${item.label}`} className="alert-data-item">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>

              <div className="alert-section-label mt-14">Entities and Keywords</div>
              <div className="entity-row mt-8">
                {alert.entities.map((entity, index) => (
                  <div key={`${alert.id}-entity-${index}`} className="entity-chip">
                    <span className="entity-type">{entity.type}</span>
                    <span className="entity-name">{entity.name}</span>
                  </div>
                ))}
              </div>
              <div className="keyword-chips mt-8">
                {alert.keywords.map((keyword) => (
                  <span key={`${alert.id}-${keyword}`} className="keyword-chip">{keyword}</span>
                ))}
              </div>
            </div>

            <div className="alert-modal-block">
              <div className="alert-section-label">Why Triggered</div>
              <div className="ai-reason-block">{alert.whyTriggered}</div>
            </div>

            <div className="alert-modal-block">
              <div className="alert-section-label">Link Citations and Evidence Details</div>
              <div className="citation-list">
                {alert.evidence.map((item, index) => (
                  <a key={`${alert.id}-citation-${index}`} className="citation-link" href={item.url} target="_blank" rel="noreferrer">
                    [C{index + 1}] {item.source} - {item.excerpt} - {item.url}
                  </a>
                ))}
              </div>
            </div>

            <div className="alert-modal-block">
              <div className="alert-section-label">Future Prediction (Informative)</div>
              <div className="prediction-card">
                <div className="prediction-heading">{prediction.heading}</div>
                <div className="prediction-line"><strong>Next 6 Hours:</strong> {prediction.next6h}</div>
                <div className="prediction-line"><strong>Next 24 Hours:</strong> {prediction.next24h}</div>
                <div className="prediction-line"><strong>Next 48 Hours:</strong> {prediction.next48h}</div>

                <div className="prediction-subtitle">Likely Triggers</div>
                <ul className="alert-point-list" style={{ marginTop: 8 }}>
                  {prediction.likelyTriggers.map((item, index) => (
                    <li key={`${alert.id}-trigger-${index}`}>{item}</li>
                  ))}
                </ul>

                <div className="prediction-subtitle">Stabilization Signals to Watch</div>
                <ul className="alert-point-list" style={{ marginTop: 8 }}>
                  {prediction.mitigationSignals.map((item, index) => (
                    <li key={`${alert.id}-signal-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="alert-modal-block">
              <div className="alert-section-label">Recommended Actions</div>
              <div className="action-list mt-8">
                {alert.recommendedActions.map((action, index) => (
                  <div key={`${alert.id}-action-${index}`} className="action-item">
                    <span className="action-bullet"><span className="action-bullet-icon">▶</span></span>
                    <span>{action}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="alert-modal-side-col">
            <div className="alert-modal-metrics-grid">
              <div className="alert-mini-metric">
                <span>Confidence Score</span>
                <strong>{alert.confidence}%</strong>
              </div>
              <div className="alert-mini-metric">
                <span>Escalation</span>
                <strong>{alert.escalationProbability}%</strong>
              </div>
              <div className="alert-mini-metric">
                <span>Civilian Impact</span>
                <strong>{civilianImpact}</strong>
              </div>
              <div className="alert-mini-metric">
                <span>User Role</span>
                <strong>{role}</strong>
              </div>
            </div>

            <div className="alert-modal-block">
              <div className="alert-section-label">Assessed Areas</div>
              <div className="entity-row mt-8">
                {assessedAreas.map((area) => (
                  <div key={`${alert.id}-${area}`} className="entity-chip">
                    <span className="entity-type">AREA</span>
                    <span className="entity-name">{area}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="alert-modal-block">
              <div className="alert-section-label">Source Registry</div>
              <div className="citation-list mt-8">
                {alert.sources.map((source, index) => (
                  <a
                    key={`${alert.id}-source-${index}`}
                    className="citation-link"
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    [S{index + 1}] {source.name} ({source.type}) - {source.url}
                  </a>
                ))}
              </div>
            </div>

            <div className="alert-modal-footer-actions">
              {alert.status !== 'RESOLVED' && (
                <button className="btn btn-success" onClick={() => resolveAlert(alert.id)}>Mark Resolved</button>
              )}
              {alert.status !== 'MONITORING' && (
                <button className="btn btn-ghost" onClick={markForReview}>Mark for Review</button>
              )}
              {alert.status !== 'ACTIVE' && (
                <button className="btn btn-ghost" onClick={reopenAlert}>Re-open Alert</button>
              )}
              <button className="btn btn-ghost" onClick={exportReport}>Export Report</button>
            </div>

            {actionMessage && (
              <div className="action-message-note">{actionMessage}</div>
            )}

            <div className="alert-modal-block">
              <div className="alert-section-label">Scenario Predictor · What-if Chatbot</div>
              <div className="scenario-quick-row">
                <button className="scenario-chip" onClick={() => setScenarioPrompt('What if this incident spreads to nearby districts in next 12 hours?')}>Spread Scenario</button>
                <button className="scenario-chip" onClick={() => setScenarioPrompt('What if misinformation around this event goes viral tonight?')}>Misinformation Scenario</button>
              </div>

              <textarea
                className="scenario-textarea"
                value={scenarioPrompt}
                onChange={(event) => setScenarioPrompt(event.target.value)}
                placeholder="Ask: What if protests escalate after 8 PM near transport hubs?"
              />

              <div className="scenario-actions-row">
                <button className="btn btn-primary btn-sm" onClick={runScenarioPredictor}>Run Scenario</button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setScenarioPrompt('');
                    setScenarioResult('');
                  }}
                >
                  Clear
                </button>
              </div>

              {scenarioResult && <div className="scenario-result-box">{scenarioResult}</div>}
            </div>
          </aside>
        </div>

        <footer className="alert-modal-footer-note">
          {typeof currentIndex === 'number' && typeof totalCount === 'number' && (
            <span>Alert {currentIndex} of {totalCount}</span>
          )}
          <span>Last Updated {format(alert.updatedAt, 'dd MMM yyyy · HH:mm:ss')}</span>
        </footer>
      </section>
    </div>
  );

  if (typeof document === 'undefined') {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
}
