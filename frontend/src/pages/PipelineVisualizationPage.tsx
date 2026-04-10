import { useAppStore } from '../store/useAppStore';
import { format } from 'date-fns';

const STAGE_DETAILS: Record<string, { color: string; bg: string }> = {
  collector: { color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' },
  cleaner: { color: 'var(--accent-cyan)', bg: 'rgba(47,143,114,0.12)' },
  analyzer: { color: 'var(--accent-indigo)', bg: 'rgba(127,104,71,0.14)' },
  predictor: { color: 'var(--risk-medium)', bg: 'rgba(249,115,22,0.08)' },
  reporter: { color: 'var(--risk-low)', bg: 'rgba(34,197,94,0.08)' },
};

function stageResearchLabel(stageId: string, topic: string): string {
  const scopedTopic = topic.trim() || 'public safety signals';

  switch (stageId) {
    case 'collector':
      return `Collecting source documents and signals for "${scopedTopic}".`;
    case 'cleaner':
      return `Cleaning and deduplicating records linked to "${scopedTopic}".`;
    case 'analyzer':
      return `Analyzing entities, sentiment, and intent for "${scopedTopic}".`;
    case 'predictor':
      return `Scoring escalation probability and risk trajectory for "${scopedTopic}".`;
    case 'reporter':
      return `Drafting explainable briefing and actionables for "${scopedTopic}".`;
    default:
      return `Processing topic "${scopedTopic}".`;
  }
}

export default function PipelineVisualizationPage() {
  const {
    pipelineStages,
    isPipelineRunning,
    runPipeline,
    latestReport,
    lastTopic,
    pipelineModelMode,
    pipelineModelName,
    pipelineModelReason,
    pipelineActiveTopic,
    pipelineLiveNode,
    pipelineLiveInsight,
    pipelineActivityFeed,
    alerts,
    autoAgentReports,
    autoAgentLastRun,
    autoAgentIntervalMinutes,
    isAutoAgentRunning,
  } = useAppStore();

  const totalProcessed = pipelineStages.reduce((sum, s) => sum + s.itemsProcessed, 0);
  const totalTime = pipelineStages.reduce((sum, s) => sum + s.processingTime, 0);
  const activeStage = pipelineStages.findIndex(s => s.status === 'RUNNING');
  const activeTopic = isPipelineRunning ? (pipelineActiveTopic || lastTopic) : lastTopic;
  const modelConfigured = pipelineModelMode === 'gemini' || pipelineModelMode === 'ollama';

  const modelBadge = pipelineModelMode === 'unknown'
    ? 'CHECKING'
    : (modelConfigured ? 'CONFIGURED' : 'FALLBACK');

  const modelBadgeClass = pipelineModelMode === 'unknown'
    ? 'unknown'
    : (modelConfigured ? 'configured' : 'fallback');

  const sourceCards = (() => {
    const sourceMap = new Map<string, {
      name: string;
      type: string;
      icon: string;
      references: number;
      highRiskRefs: number;
      lastSeenAt: Date | null;
    }>();

    const typeLabel = (sourceType: string): string => {
      if (sourceType === 'NEWS_API') return 'News API';
      if (sourceType === 'WEB_SEARCH') return 'Web Search';
      return 'Source';
    };

    const typeIcon = (sourceType: string): string => {
      if (sourceType === 'NEWS_API') return '📰';
      if (sourceType === 'WEB_SEARCH') return '🔎';
      return '📡';
    };

    for (const alert of alerts) {
      for (const source of alert.sources) {
        const key = `${source.name}::${source.type}`;
        const existing = sourceMap.get(key);
        const nowSeen = source.fetchedAt;

        if (!existing) {
          sourceMap.set(key, {
            name: source.name,
            type: typeLabel(source.type),
            icon: typeIcon(source.type),
            references: 1,
            highRiskRefs: alert.riskLevel === 'HIGH' ? 1 : 0,
            lastSeenAt: nowSeen,
          });
          continue;
        }

        existing.references += 1;
        if (alert.riskLevel === 'HIGH') {
          existing.highRiskRefs += 1;
        }
        if (!existing.lastSeenAt || nowSeen > existing.lastSeenAt) {
          existing.lastSeenAt = nowSeen;
        }
      }
    }

    const collectorStage = pipelineStages.find(stage => stage.id === 'collector');
    const avgLatency = collectorStage && collectorStage.itemsProcessed > 0
      ? Math.max(8, Math.round(collectorStage.processingTime / collectorStage.itemsProcessed))
      : null;

    const cards = Array.from(sourceMap.values())
      .sort((a, b) => b.references - a.references)
      .slice(0, 8)
      .map((source) => ({
        name: source.name,
        type: source.type,
        icon: source.icon,
        status: source.references > 0 ? 'ACTIVE' : 'IDLE',
        latency: avgLatency ? `~${avgLatency}ms/item` : 'N/A',
        volume: `${source.references} refs`,
        highRiskRefs: source.highRiskRefs,
        lastSeen: source.lastSeenAt ? format(source.lastSeenAt, 'HH:mm:ss') : 'N/A',
      }));

    if (cards.length > 0) return cards;

    return [
      { name: 'Tavily', type: 'Web Search', icon: '🔎', status: 'STANDBY', latency: 'N/A', volume: '0 refs', highRiskRefs: 0, lastSeen: 'N/A' },
      { name: 'NewsAPI/NewsData/GNews', type: 'News API', icon: '📰', status: 'STANDBY', latency: 'N/A', volume: '0 refs', highRiskRefs: 0, lastSeen: 'N/A' },
    ];
  })();

  return (
    <div>
      <div className="flex items-center justify-between mb-16">
        <div className="page-header" style={{ margin: 0 }}>
          <div className="page-title">AI Pipeline</div>
          <div className="page-desc">End-to-end OSINT processing visualization with real-time status</div>
        </div>
        <button
          id="run-pipeline-btn"
          className="btn btn-primary"
          onClick={runPipeline}
          disabled={isPipelineRunning}
        >
          {isPipelineRunning ? <><span className="spinner" /> Running Pipeline...</> : '▶ Run Full Pipeline'}
        </button>
      </div>

      <div className="pipeline-readiness-panel">
        <div className="pipeline-readiness-item">
          <span className="pipeline-readiness-label">Model Status</span>
          <span className={`pipeline-model-chip ${modelBadgeClass}`}>{modelBadge}</span>
        </div>
        <div className="pipeline-readiness-item">
          <span className="pipeline-readiness-label">Model Name</span>
          <strong>{pipelineModelName}</strong>
        </div>
        <div className="pipeline-readiness-item">
          <span className="pipeline-readiness-label">Research Topic</span>
          <strong>{activeTopic || 'Not set'}</strong>
        </div>
      </div>

      <div className="pipeline-live-focus-card">
        <div className="pipeline-live-focus-head">Current Node Activity</div>
        <div className="pipeline-live-focus-title">
          {isPipelineRunning
            ? `Node: ${pipelineLiveNode || pipelineStages[activeStage]?.name || 'Initializing'}`
            : 'Pipeline idle'}
        </div>
        <div className="pipeline-live-focus-text">
          {pipelineLiveInsight || 'Run pipeline to inspect node-level research behavior.'}
        </div>
      </div>

      {/* Pipeline status banner */}
      <div style={{
        background: isPipelineRunning ? 'var(--accent-blue-dim)' : 'rgba(34,197,94,0.06)',
        border: `1px solid ${isPipelineRunning ? 'var(--accent-blue-glow)' : 'rgba(34,197,94,0.2)'}`,
        borderRadius: 10, padding: '12px 18px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div className={`live-dot${isPipelineRunning ? '' : ''}`}
          style={{ background: isPipelineRunning ? 'var(--accent-blue)' : 'var(--risk-low)', animation: isPipelineRunning ? 'livePulse 0.8s ease-in-out infinite' : 'none' }} />
        <div style={{ fontSize: 12, fontWeight: 600 }}>
          {isPipelineRunning
            ? `Pipeline RUNNING — Stage ${activeStage + 1} of ${pipelineStages.length}: ${pipelineStages[activeStage]?.name ?? ''}`
            : 'Pipeline IDLE — All stages completed successfully'}
        </div>
        <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
          {totalProcessed} items processed · {totalTime}ms total
        </div>
      </div>

      {/* Pipeline Stages */}
      <div className="pipeline-grid" id="pipeline-stages">
        {pipelineStages.map((stage, idx) => {
          const meta = STAGE_DETAILS[stage.id] || { color: 'var(--text-secondary)', bg: 'var(--bg-muted)' };
          const isActive = stage.status === 'RUNNING';
          const nodeText = stageResearchLabel(stage.id, activeTopic || 'public safety signals');

          return (
            <>
              <div
                key={stage.id}
                id={`pipeline-stage-${stage.id}`}
                className={`pipeline-stage ${stage.status}`}
                style={{ borderColor: stage.status === 'RUNNING' ? meta.color : undefined, background: stage.status === 'RUNNING' ? meta.bg : undefined }}
              >
                <div className={`pipeline-status-dot ${stage.status}`} />
                <div className="pipeline-icon">{stage.icon}</div>
                <div className="pipeline-name" style={{ color: meta.color }}>{stage.name}</div>
                <div className="pipeline-desc">{stage.description}</div>
                <div className={`pipeline-node-research${isActive ? ' active' : ''}`}>
                  {isActive ? `Researching now: ${nodeText}` : nodeText}
                </div>

                {stage.status !== 'IDLE' && (
                  <div className="pipeline-stats">
                    <div>Items: <span>{stage.itemsProcessed}</span></div>
                    <div>Time: <span>{stage.processingTime}ms</span></div>
                    {stage.lastRun && (
                      <div>Last: <span>{format(stage.lastRun, 'HH:mm:ss')}</span></div>
                    )}
                  </div>
                )}

                {stage.status === 'RUNNING' && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ background: 'var(--bg-muted)', height: 3, borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', background: meta.color, borderRadius: 99,
                        animation: 'progressBar 1.2s ease-in-out infinite',
                        width: '60%',
                      }} />
                    </div>
                  </div>
                )}

                {stage.status === 'DONE' && (
                  <div style={{ marginTop: 10, fontSize: 18 }}>✅</div>
                )}
              </div>

              {idx < pipelineStages.length - 1 && (
                <div key={`conn-${idx}`} className="pipeline-connector">
                  <span style={{ fontSize: 16, color: 'var(--border-emphasis)' }}>→</span>
                </div>
              )}
            </>
          );
        })}
      </div>

      <div className="card mt-20">
        <div className="chart-title" style={{ marginBottom: 12 }}>🧭 Live Pipeline Activity</div>
        <div className="pipeline-activity-feed">
          {pipelineActivityFeed.length > 0 ? (
            pipelineActivityFeed.map((item, index) => (
              <div key={`pipe-feed-${index}`} className="pipeline-activity-item">{item}</div>
            ))
          ) : (
            <div className="pipeline-activity-item">No activity yet. Run pipeline to see live node execution log.</div>
          )}
        </div>
      </div>

      {/* Stage detail cards */}
      <div className="grid-3 mt-20">
        {pipelineStages.map(stage => {
          const meta = STAGE_DETAILS[stage.id] || { color: 'var(--text-secondary)', bg: 'var(--bg-muted)' };
          return (
            <div key={stage.id} className="card" style={{ borderColor: stage.status === 'DONE' ? 'rgba(34,197,94,0.15)' : undefined }}>
              <div className="flex items-center gap-8 mb-14">
                <span style={{ fontSize: 18 }}>{stage.icon}</span>
                <div style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>{stage.name}</div>
                <span className={`pipeline-status-dot ${stage.status}`} style={{ marginLeft: 'auto', width: 8, height: 8, position: 'static' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>{stage.description}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: 'var(--bg-muted)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: meta.color }}>{stage.itemsProcessed}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Items</div>
                </div>
                <div style={{ background: 'var(--bg-muted)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{stage.processingTime}ms</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Time</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Data Sources */}
      <div className="mt-20">
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 14 }}>
          📡 OSINT Data Sources
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {sourceCards.map(src => (
            <div key={src.name} className="card" style={{ borderColor: 'rgba(34,197,94,0.1)' }}>
              <div className="flex items-center gap-8 mb-8">
                <span style={{ fontSize: 16 }}>{src.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{src.name}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{src.type}</div>
                </div>
                <div className="live-dot" style={{ flexShrink: 0, opacity: src.status === 'ACTIVE' ? 1 : 0.45 }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div>Latency: <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{src.latency}</span></div>
                <div>Volume: <span style={{ color: 'var(--text-secondary)' }}>{src.volume}</span></div>
                <div>High-risk refs: <span style={{ color: 'var(--risk-medium)', fontWeight: 700 }}>{src.highRiskRefs}</span></div>
                <div>Last seen: <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{src.lastSeen}</span></div>
                <div>Status: <span style={{ color: src.status === 'ACTIVE' ? 'var(--risk-low)' : 'var(--text-muted)', fontWeight: 700 }}>{src.status}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-20">
        <div className="chart-card">
          <div className="chart-title">🧠 AI Intelligence Briefing</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
            Topic: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{lastTopic}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
            Model: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{pipelineModelName}</span> · Status: <span style={{ color: modelConfigured ? 'var(--risk-low)' : 'var(--risk-medium)', fontWeight: 700 }}>{modelBadge}</span>
          </div>

          {modelConfigured ? (
            <pre
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                padding: '14px',
                maxHeight: 320,
                overflowY: 'auto',
              }}
            >
              {latestReport}
            </pre>
          ) : (
            <div className="pipeline-config-note">
              <strong>Model is not fully configured.</strong>
              <div style={{ marginTop: 6 }}>
                {pipelineModelReason || 'Configure backend model access, then rerun the pipeline to enable full AI briefing output.'}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-20">
        <div className="chart-card">
          <div className="chart-title">🤖 Auto Agent Reports (4-City Sweep)</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
            Runs every <strong>{autoAgentIntervalMinutes} minutes</strong>.
            {' '}
            {autoAgentLastRun
              ? `Last cycle: ${format(autoAgentLastRun, 'dd MMM · HH:mm:ss')}`
              : 'First cycle is in progress.'}
            {' '}
            {isAutoAgentRunning ? 'Status: running.' : 'Status: idle.'}
          </div>

          {autoAgentReports.length === 0 ? (
            <div className="pipeline-config-note">
              <strong>Auto agent reports are warming up.</strong>
              <div style={{ marginTop: 6 }}>
                The system will generate 4 real reports, one each for Mumbai, Delhi, Bangalore, and Hyderabad.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {autoAgentReports.map((entry) => {
                const chipBg = entry.mode === 'ollama' || entry.mode === 'gemini'
                  ? 'rgba(34,197,94,0.12)'
                  : 'rgba(249,115,22,0.12)';
                const chipColor = entry.mode === 'ollama' || entry.mode === 'gemini'
                  ? 'var(--risk-low)'
                  : 'var(--risk-medium)';

                return (
                  <div key={entry.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12, background: 'var(--bg-surface)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{entry.city}</div>
                      <span style={{ fontSize: 10, borderRadius: 999, padding: '3px 8px', background: chipBg, color: chipColor, fontWeight: 700, textTransform: 'uppercase' }}>
                        {entry.mode}
                      </span>
                    </div>

                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
                      Alerts found: <strong style={{ color: 'var(--text-primary)' }}>{entry.alertsFound}</strong> · Model: <strong style={{ color: 'var(--text-primary)' }}>{entry.modelName}</strong>
                    </div>

                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
                      Topic: <span style={{ color: 'var(--text-secondary)' }}>{entry.topic}</span>
                    </div>

                    <pre
                      style={{
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        lineHeight: 1.5,
                        color: 'var(--text-secondary)',
                        maxHeight: 180,
                        overflowY: 'auto',
                      }}
                    >
                      {entry.report}
                    </pre>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes progressBar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </div>
  );
}
