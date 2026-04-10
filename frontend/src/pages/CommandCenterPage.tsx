import { useAppStore } from '../store/useAppStore';
import { getRiskTrends, getCategoryDistribution } from '../services/mockData';
import { format } from 'date-fns';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import ExplainableAlertCard from '../components/ExplainableAlertCard';

const COLORS = {
  HIGH: '#ef4444',
  MEDIUM: '#f97316',
  LOW: '#22c55e',
};

const PIE_COLORS = ['#ef4444', '#f97316', '#22c55e', '#3b82f6', '#6366f1', '#06b6d4'];

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
  const { alerts, dashboardStats, isCollecting, triggerCollect } = useAppStore();
  const riskTrends = getRiskTrends();
  const categoryDist = getCategoryDistribution(alerts);
  const topAlerts = alerts.filter(a => a.riskLevel === 'HIGH' && a.status === 'ACTIVE').slice(0, 5);

  return (
    <div>
      <div className="flex items-center justify-between mb-16">
        <div className="page-header" style={{ margin: 0 }}>
          <div className="page-title">Command Center</div>
          <div className="page-desc">Real-time OSINT intelligence overview · Updated {format(dashboardStats.lastUpdated, 'HH:mm:ss')}</div>
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

      {/* Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card high">
          <div className="stat-label">High Risk Alerts</div>
          <div className="stat-value high">{dashboardStats.highRisk}</div>
          <div className="stat-sub">Requires immediate action</div>
        </div>
        <div className="stat-card medium">
          <div className="stat-label">Medium Risk</div>
          <div className="stat-value medium">{dashboardStats.mediumRisk}</div>
          <div className="stat-sub">Needs monitoring</div>
        </div>
        <div className="stat-card low">
          <div className="stat-label">Low Risk</div>
          <div className="stat-value low">{dashboardStats.lowRisk}</div>
          <div className="stat-sub">Routine surveillance</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Active Alerts</div>
          <div className="stat-value blue">{dashboardStats.activeAlerts}</div>
          <div className="stat-sub">of {dashboardStats.totalAlerts} total</div>
        </div>
        <div className="stat-card cyan">
          <div className="stat-label">Avg. Confidence</div>
          <div className="stat-value cyan">{dashboardStats.avgConfidence}%</div>
          <div className="stat-sub">AI model certainty</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Resolved Today</div>
          <div className="stat-value" style={{ color: 'var(--text-primary)' }}>{dashboardStats.resolvedToday}</div>
          <div className="stat-sub">Closed incidents</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Top Location</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6, color: 'var(--text-primary)', lineHeight: 1.3 }}>{dashboardStats.topLocation}</div>
          <div className="stat-sub">Most active area</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid-21 mt-20">
        {/* Risk Trend Area Chart */}
        <div className="chart-card">
          <div className="chart-title">⚡ Risk Level Trends — Last 24 Hours</div>
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
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b' }} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltipTheme />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="HIGH" stroke="#ef4444" strokeWidth={2} fill="url(#gHigh)" />
              <Area type="monotone" dataKey="MEDIUM" stroke="#f97316" strokeWidth={2} fill="url(#gMedium)" />
              <Area type="monotone" dataKey="LOW" stroke="#22c55e" strokeWidth={1.5} fill="url(#gLow)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category Pie */}
        <div className="chart-card">
          <div className="chart-title">📂 Event Distribution</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={categoryDist}
                cx="50%" cy="50%"
                innerRadius={55} outerRadius={85}
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
      </div>

      {/* Risk Distribution Bar */}
      <div className="chart-card mt-20">
        <div className="chart-title">📊 Hourly Incident Volume (Last 12 Hours)</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={riskTrends.slice(-12)} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
            <Tooltip content={<CustomTooltipTheme />} />
            <Bar dataKey="HIGH" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
            <Bar dataKey="MEDIUM" stackId="a" fill="#f97316" />
            <Bar dataKey="LOW" stackId="a" fill="#22c55e" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Critical Alerts */}
      <div className="mt-20">
        <div className="flex items-center justify-between mb-16">
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>
            🔴 Top Critical Alerts
          </div>
          <a href="/alerts" style={{ fontSize: 11, color: 'var(--accent-blue)', textDecoration: 'none' }}>View all →</a>
        </div>
        {topAlerts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-text">No active HIGH risk alerts</div>
          </div>
        ) : (
          topAlerts.map(alert => <ExplainableAlertCard key={alert.id} alert={alert} />)
        )}
      </div>
    </div>
  );
}
