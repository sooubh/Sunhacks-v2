import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import type { Alert } from '../types';
import { useAppStore } from '../store/useAppStore';
import { CITY_COORDS, getCityFromLocation } from '../config/cities';

interface AlertInsightModalProps {
  alert: Alert | null;
  isOpen: boolean;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCount?: number;
}

interface ScenarioMessage {
  role: 'user' | 'assistant';
  text: string;
  time: string;
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

function buildMapEmbedUrl(lat: number, lng: number): string {
  const delta = 0.2;
  const left = lng - delta;
  const right = lng + delta;
  const top = lat + delta;
  const bottom = lat - delta;

  const params = new URLSearchParams({
    bbox: `${left},${bottom},${right},${top}`,
    layer: 'mapnik',
    marker: `${lat},${lng}`,
  });

  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
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
  const [scenarioMessages, setScenarioMessages] = useState<ScenarioMessage[]>([
    {
      role: 'assistant',
      text: 'Ask a what-if question and I will simulate escalation and likely outcomes for this alert.',
      time: format(new Date(), 'HH:mm:ss'),
    },
  ]);

  useEffect(() => {
    if (!isOpen || !alert) return;
    setActionMessage('');
    setScenarioPrompt('');
    setScenarioResult('');
    setScenarioMessages([
      {
        role: 'assistant',
        text: 'Ask a what-if question and I will simulate escalation and likely outcomes for this alert.',
        time: format(new Date(), 'HH:mm:ss'),
      },
    ]);
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

  const scopedCity = getCityFromLocation(alert.location);
  const fallbackCoords = scopedCity ? CITY_COORDS[scopedCity] : { lat: 20.5937, lng: 78.9629 };
  const mapCenter = alert.coordinates ?? fallbackCoords;
  const mapEmbedUrl = buildMapEmbedUrl(mapCenter.lat, mapCenter.lng);

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
      const margin = 36;
      const footerReserved = 24;
      const contentWidth = pageWidth - (margin * 2);
      const pageBottom = pageHeight - margin - footerReserved;
      const generatedAt = format(new Date(), 'dd MMM yyyy · HH:mm:ss');

      const palette = {
        ink: [17, 24, 39] as const,
        muted: [71, 85, 105] as const,
        border: [203, 213, 225] as const,
        panelFill: [248, 250, 252] as const,
        panelHeaderFill: [239, 246, 255] as const,
        panelHeaderText: [30, 64, 175] as const,
        accent: [37, 99, 235] as const,
      };

      const riskColors: Record<Alert['riskLevel'], { bg: [number, number, number]; text: [number, number, number] }> = {
        HIGH: { bg: [254, 226, 226], text: [153, 27, 27] },
        MEDIUM: { bg: [255, 237, 213], text: [154, 52, 18] },
        LOW: { bg: [220, 252, 231], text: [22, 101, 52] },
      };

      const impactColors: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', [number, number, number]> = {
        LOW: [34, 197, 94],
        MEDIUM: [249, 115, 22],
        HIGH: [239, 68, 68],
        CRITICAL: [185, 28, 28],
      };

      let y = margin;

      const applyTextColor = (rgb: readonly [number, number, number]) => {
        doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      };

      const ensureSpace = (requiredHeight = 18) => {
        if (y + requiredHeight > pageBottom) {
          doc.addPage();
          y = margin;
        }
      };

      const splitLines = (text: string, width: number, size = 10, style: 'normal' | 'bold' = 'normal'): string[] => {
        doc.setFont('helvetica', style);
        doc.setFontSize(size);
        return doc.splitTextToSize(text, width) as string[];
      };

      const addHeaderBanner = () => {
        const headerHeight = 104;
        ensureSpace(headerHeight + 12);

        doc.setFillColor(palette.ink[0], palette.ink[1], palette.ink[2]);
        doc.roundedRect(margin, y, contentWidth, headerHeight, 12, 12, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(255, 255, 255);
        const titleLines = splitLines(alert.title, contentWidth - 168, 18, 'bold').slice(0, 2);
        doc.text(titleLines, margin + 14, y + 28);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(226, 232, 240);
        doc.text(`Alert ID: ${alert.id}`, margin + 14, y + 60);
        doc.text(`Location: ${alert.location}`, margin + 14, y + 76);
        doc.text(`Generated: ${generatedAt}`, margin + 14, y + 92);

        const riskTone = riskColors[alert.riskLevel];
        const badgeX = margin + contentWidth - 110;
        const badgeY = y + 14;
        doc.setFillColor(riskTone.bg[0], riskTone.bg[1], riskTone.bg[2]);
        doc.roundedRect(badgeX, badgeY, 92, 24, 8, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(riskTone.text[0], riskTone.text[1], riskTone.text[2]);
        doc.text(alert.riskLevel, badgeX + 46, badgeY + 16, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text(`${alert.category} · ${alert.sentiment}`, badgeX + 46, badgeY + 44, { align: 'center' });
        y += headerHeight + 12;
      };

      const addMetricCards = () => {
        const cardGap = 8;
        const cardCount = 4;
        const cardWidth = (contentWidth - (cardGap * (cardCount - 1))) / cardCount;
        const cardHeight = 60;
        ensureSpace(cardHeight + 12);

        const cards = [
          { label: 'Confidence', value: `${alert.confidence}%`, tone: [37, 99, 235] as const },
          { label: 'Escalation', value: `${alert.escalationProbability}%`, tone: [234, 88, 12] as const },
          { label: 'Impact', value: civilianImpact, tone: impactColors[civilianImpact] },
          { label: 'Status', value: alert.status, tone: [22, 101, 52] as const },
        ];

        cards.forEach((card, index) => {
          const x = margin + (index * (cardWidth + cardGap));
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(x, y, cardWidth, cardHeight, 10, 10, 'FD');

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text(card.label, x + 10, y + 18);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(14);
          doc.setTextColor(card.tone[0], card.tone[1], card.tone[2]);
          doc.text(card.value, x + 10, y + 40);
        });

        y += cardHeight + 12;
      };

      const addPanel = (title: string, lines: string[]) => {
        const bodyWidth = contentWidth - 24;
        const wrapped: string[] = [];

        lines.forEach((line) => {
          const safeLine = line.trim();
          if (!safeLine) {
            wrapped.push('');
            return;
          }
          const split = splitLines(safeLine, bodyWidth, 10, 'normal');
          wrapped.push(...split);
        });

        const lineHeight = 13;
        const panelHeaderHeight = 24;
        const panelBodyHeight = Math.max(24, wrapped.length * lineHeight + 10);
        const panelHeight = panelHeaderHeight + panelBodyHeight;
        ensureSpace(panelHeight + 10);

        doc.setFillColor(palette.panelFill[0], palette.panelFill[1], palette.panelFill[2]);
        doc.setDrawColor(palette.border[0], palette.border[1], palette.border[2]);
        doc.roundedRect(margin, y, contentWidth, panelHeight, 10, 10, 'FD');

        doc.setFillColor(palette.panelHeaderFill[0], palette.panelHeaderFill[1], palette.panelHeaderFill[2]);
        doc.roundedRect(margin, y, contentWidth, panelHeaderHeight, 10, 10, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        applyTextColor(palette.panelHeaderText);
        doc.text(title, margin + 12, y + 16);

        let textY = y + panelHeaderHeight + 14;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        applyTextColor(palette.muted);
        wrapped.forEach((line) => {
          if (!line) {
            textY += lineHeight;
            return;
          }
          doc.text(line, margin + 12, textY);
          textY += lineHeight;
        });

        y += panelHeight + 10;
      };

      const summaryLines = summaryPoints.map((point, index) => `${index + 1}. ${point}`);
      const narrativeLines = detailedNarrative.map((paragraph, index) => `${index + 1}. ${paragraph}`);
      const snapshotLines = dataSnapshot.map((item) => `${item.label}: ${item.value}`);
      const entityLines = alert.entities.length > 0
        ? alert.entities.map((entity) => `- ${entity.type}: ${entity.name}`)
        : ['- No entities detected'];
      const keywordLines = alert.keywords.length > 0
        ? [alert.keywords.join(', ')]
        : ['No keywords detected'];
      const evidenceLines = alert.evidence.length > 0
        ? alert.evidence.flatMap((item, index) => [
          `[C${index + 1}] ${item.source} · Fetched ${item.fetchedAt}`,
          `Excerpt: ${item.excerpt}`,
          `Link: ${item.url}`,
          '',
        ])
        : ['No citation evidence available'];

      const forecastLines = [
        `Outlook: ${prediction.heading}`,
        `Next 6 hours: ${prediction.next6h}`,
        `Next 24 hours: ${prediction.next24h}`,
        `Next 48 hours: ${prediction.next48h}`,
      ];

      const triggerLines = prediction.likelyTriggers.map((item, index) => `${index + 1}. ${item}`);
      const signalLines = prediction.mitigationSignals.map((item, index) => `${index + 1}. ${item}`);
      const actionLines = alert.recommendedActions.length > 0
        ? alert.recommendedActions.map((item, index) => `${index + 1}. ${item}`)
        : ['No recommended actions'];
      const assessedAreaLines = assessedAreas.length > 0
        ? assessedAreas.map((area, index) => `${index + 1}. ${area}`)
        : ['No assessed areas'];
      const sourceLines = alert.sources.length > 0
        ? alert.sources.map((source, index) => {
          const fetched = format(source.fetchedAt, 'dd MMM yyyy · HH:mm:ss');
          return `${index + 1}. ${source.name} (${source.type}) · ${fetched} · ${source.url}`;
        })
        : ['No source registry entries'];

      const scenarioLines = [
        `Prompt: ${scenarioPrompt.trim() || 'Not provided in this session.'}`,
        `Output: ${scenarioResult || 'No scenario generated in this session.'}`,
      ];

      addHeaderBanner();
      addMetricCards();

      addPanel('Situation Summary', summaryLines);
      addPanel('Detailed Intelligence Narrative', narrativeLines);
      addPanel('Data Snapshot', snapshotLines);
      addPanel('Entities', entityLines);
      addPanel('Keywords', keywordLines);
      addPanel('Why Triggered', [alert.whyTriggered]);
      addPanel('Evidence and Citations', evidenceLines);
      addPanel('Future Forecast', forecastLines);
      addPanel('Likely Triggers', triggerLines);
      addPanel('Stabilization Signals', signalLines);
      addPanel('Recommended Actions', actionLines);
      addPanel('Assessed Areas', assessedAreaLines);
      addPanel('Source Registry', sourceLines);
      addPanel('Scenario Predictor (Latest Session)', scenarioLines);

      const pageCount = doc.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setDrawColor(palette.border[0], palette.border[1], palette.border[2]);
        doc.line(margin, pageHeight - 22, pageWidth - margin, pageHeight - 22);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        applyTextColor(palette.muted);
        doc.text(`${alert.id} · ${alert.location} · ${generatedAt}`, margin, pageHeight - 10);
        doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
      }

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

    const forecast = buildWhatIfResponse(alert, prompt);
    setScenarioResult(forecast);
    setScenarioMessages(prev => [
      ...prev,
      {
        role: 'user',
        text: prompt,
        time: format(new Date(), 'HH:mm:ss'),
      },
      {
        role: 'assistant',
        text: forecast,
        time: format(new Date(), 'HH:mm:ss'),
      },
    ]);
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
              <div className="alert-section-label">Live Alert Map</div>
              <div className="alert-map-frame-wrap mt-8">
                <iframe
                  className="alert-map-frame"
                  src={mapEmbedUrl}
                  title={`Map for ${alert.location}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <div className="alert-map-meta-row">
                <span>Location: <strong>{alert.location}</strong></span>
                <span>Coordinates: <strong>{mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)}</strong></span>
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
              <div className="scenario-chat-log">
                {scenarioMessages.map((message, index) => (
                  <div key={`${alert.id}-scenario-msg-${index}`} className={`scenario-chat-msg ${message.role}`}>
                    <div>{message.text}</div>
                    <div className="scenario-chat-time">{message.time}</div>
                  </div>
                ))}
              </div>

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
                    setScenarioMessages([
                      {
                        role: 'assistant',
                        text: 'Ask a what-if question and I will simulate escalation and likely outcomes for this alert.',
                        time: format(new Date(), 'HH:mm:ss'),
                      },
                    ]);
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
