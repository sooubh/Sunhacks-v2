import { useAppStore } from '../store/useAppStore';
import { format } from 'date-fns';

const STAGE_DETAILS: Record<string, { color: string; bg: string }> = {
  collector: { color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' },
  cleaner: { color: 'var(--accent-cyan)', bg: 'rgba(47,143,114,0.12)' },
  analyzer: { color: 'var(--accent-indigo)', bg: 'rgba(127,104,71,0.14)' },
  predictor: { color: 'var(--risk-medium)', bg: 'rgba(249,115,22,0.08)' },
  reporter: { color: 'var(--risk-low)', bg: 'rgba(34,197,94,0.08)' },
};

const SOURCE_CARDS = [
  { name: 'NewsData.io', type: 'News API', icon: '📰', status: 'CONNECTED', latency: '~120ms', volume: '45 articles/run' },
  { name: 'GNews API', type: 'News API', icon: '🗞', status: 'CONNECTED', latency: '~95ms', volume: '38 articles/run' },
  { name: 'Times of India RSS', type: 'RSS Feed', icon: '📡', status: 'CONNECTED', latency: '~60ms', volume: '22 articles/run' },
  { name: 'Tavily Web Search', type: 'Web Search', icon: '🔎', status: 'CONNECTED', latency: '~310ms', volume: '18 results/run' },
  { name: 'NDTV RSS', type: 'RSS Feed', icon: '📡', status: 'CONNECTED', latency: '~55ms', volume: '25 articles/run' },
];

export default function PipelineVisualizationPage() {
  const { pipelineStages, isPipelineRunning, runPipeline, latestReport, lastTopic } = useAppStore();

  const totalProcessed = pipelineStages.reduce((sum, s) => sum + s.itemsProcessed, 0);
  const totalTime = pipelineStages.reduce((sum, s) => sum + s.processingTime, 0);
  const activeStage = pipelineStages.findIndex(s => s.status === 'RUNNING');

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
          {SOURCE_CARDS.map(src => (
            <div key={src.name} className="card" style={{ borderColor: 'rgba(34,197,94,0.1)' }}>
              <div className="flex items-center gap-8 mb-8">
                <span style={{ fontSize: 16 }}>{src.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{src.name}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{src.type}</div>
                </div>
                <div className="live-dot" style={{ flexShrink: 0 }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div>Latency: <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{src.latency}</span></div>
                <div>Volume: <span style={{ color: 'var(--text-secondary)' }}>{src.volume}</span></div>
                <div>Status: <span style={{ color: 'var(--risk-low)', fontWeight: 700 }}>{src.status}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-20">
        <div className="chart-card">
          <div className="chart-title">🧠 Gemini Intelligence Briefing</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
            Topic: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{lastTopic}</span>
          </div>
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
