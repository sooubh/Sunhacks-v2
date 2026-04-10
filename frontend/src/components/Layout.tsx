import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { format } from 'date-fns';
import VoiceAssistantDialog from './VoiceAssistantDialog';

const NAV_ITEMS = [
  { to: '/dashboard', icon: '⚡', label: 'Command Center',    badgeKey: 'active', badgeClass: '' },
  { to: '/alerts',    icon: '🚨', label: 'Alerts System',      badgeKey: 'high',   badgeClass: '' },
  { to: '/pipeline',  icon: '⚙️', label: 'AI Pipeline',        badgeKey: null,     badgeClass: '' },
  { to: '/audit',     icon: '📜', label: 'Audit Logs',         badgeKey: null,     badgeClass: 'blue' },
];

const PAGE_META: Record<string, { title: string; sub: string }> = {
  '/dashboard': { title: 'Command Center',  sub: 'Real-time OSINT Intelligence Overview' },
  '/alerts':    { title: 'Alerts System',   sub: 'AI-Powered Explainable Intelligence Reports' },
  '/pipeline':  { title: 'AI Pipeline',     sub: 'Processing Visualization & System Status' },
  '/audit':     { title: 'Audit Logs',      sub: 'Activity History & Compliance Trail' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, dashboardStats, setUser, isVoiceOpen, setVoiceOpen } = useAppStore();
  const navigate  = useNavigate();
  const location  = useLocation();

  const badgeMap: Record<string, number> = {
    active: dashboardStats.activeAlerts,
    high:   dashboardStats.highRisk,
  };

  const meta = PAGE_META[location.pathname] || { title: 'Leis', sub: '' };

  const handleLogout = () => {
    setUser(null);
    navigate('/login');
  };

  return (
    <div className="app-shell">

      {/* ── Sidebar ── */}
      <aside className="sidebar">

        {/* Brand */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🛡️</div>
          <div>
            <div className="sidebar-logo-text">Leis</div>
            <div className="sidebar-logo-sub">OSINT Platform</div>
          </div>
        </div>

        {/* Nav */}
        <div className="sidebar-section-label">Navigation</div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badgeKey && badgeMap[item.badgeKey] > 0 && (
                <span className={`nav-badge ${item.badgeClass}`}>
                  {badgeMap[item.badgeKey]}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer / User */}
        <div className="sidebar-footer">
          <div className="avatar">{user?.displayName?.[0] ?? 'A'}</div>
          <div className="avatar-info">
            <div className="avatar-name">{user?.displayName ?? 'Analyst'}</div>
            <div className="avatar-role">{user?.role ?? 'ANALYST'}</div>
          </div>
          <button
            id="logout-btn"
            className="btn btn-ghost btn-xs"
            onClick={handleLogout}
            title="Logout"
            style={{ padding: '4px 8px', fontSize: 12, flexShrink: 0 }}
          >
            ⎋
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="main-area">

        {/* Topbar */}
        <header className="topbar">
          <div>
            <div className="topbar-title">{meta.title}</div>
            <div className="topbar-subtitle">{meta.sub}</div>
          </div>
          <div className="topbar-spacer" />

          <div className="live-badge">
            <div className="live-dot" />
            LIVE
          </div>

          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-muted)',
              letterSpacing: '0.3px',
            }}
          >
            {format(new Date(), 'dd MMM yyyy · HH:mm:ss')}
          </div>

          <button
            id="voice-toggle-btn"
            className="btn btn-ghost btn-sm"
            onClick={() => setVoiceOpen(!isVoiceOpen)}
            title="Voice AI Assistant"
          >
            🎙 Voice AI
          </button>
        </header>

        {/* Page */}
        <main className="page-content">
          {children}
        </main>
      </div>

      {/* Voice FAB */}
      {!isVoiceOpen && (
        <button
          id="voice-fab"
          className="voice-fab"
          onClick={() => setVoiceOpen(true)}
          title="Open Voice Assistant"
        >
          🎙
        </button>
      )}

      {isVoiceOpen && <VoiceAssistantDialog />}
    </div>
  );
}
