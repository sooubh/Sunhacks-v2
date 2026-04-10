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
  const { user, setUser, isVoiceOpen, setVoiceOpen } = useAppStore();
  const navigate  = useNavigate();
  const location  = useLocation();

  const meta = PAGE_META[location.pathname] || { title: 'Leis', sub: '' };

  const handleLogout = () => {
    setUser(null);
    navigate('/login');
  };

  return (
    <div className="app-shell">

      {/* ── Main area ── */}
      <div className="main-area">

        {/* Topbar */}
        <header className="topbar">
          <div>
            <div className="topbar-title">{meta.title}</div>
            <div className="topbar-subtitle">{meta.sub}</div>
          </div>

          <nav className="topbar-route-nav" aria-label="Top navigation">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={`top-${item.to}`}
                to={item.to}
                className={({ isActive }) => `topbar-route-link${isActive ? ' active' : ''}`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

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

          <div className="topbar-user-chip">
            <span className="topbar-user-role">{user?.role ?? 'ANALYST'}</span>
            <span className="topbar-user-name">{user?.displayName ?? 'Analyst'}</span>
          </div>

          <button
            id="logout-btn"
            className="btn btn-ghost btn-sm"
            onClick={handleLogout}
            title="Logout"
          >
            Logout
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
