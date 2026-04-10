import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { format } from 'date-fns';
import VoiceAssistantDialog from './VoiceAssistantDialog';
import type { Alert } from '../types';

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

interface AlertNotification {
  id: string;
  alert: Alert;
  createdAtMs: number;
}

const NOTIFICATION_AUTO_DISMISS_MS = 15000;
const MAX_NOTIFICATIONS = 6;

function alertFingerprint(alert: Alert): string {
  return `${alert.title.toLowerCase()}|${alert.location.toLowerCase()}|${alert.category}`;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const {
    user,
    setUser,
    isVoiceOpen,
    setVoiceOpen,
    alerts,
    isAutoAgentRunning,
    autoAgentIntervalMinutes,
    autoAgentLastRun,
    startAutoAgentMonitoring,
    stopAutoAgentMonitoring,
  } = useAppStore();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const knownAlertFingerprintsRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<Map<string, number>>(new Map());
  const bootstrappedRef = useRef(false);

  const meta = PAGE_META[location.pathname] || { title: 'Leis', sub: '' };

  const handleLogout = () => {
    setUser(null);
    navigate('/login');
  };

  const dismissNotification = (notificationId: string) => {
    const timer = timersRef.current.get(notificationId);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(notificationId);
    }

    setNotifications(prev => prev.filter(item => item.id !== notificationId));
  };

  const openNotificationAlert = (notification: AlertNotification) => {
    navigate('/alerts', {
      state: {
        openAlertId: notification.alert.id,
        source: 'notification',
      },
    });
    dismissNotification(notification.id);
  };

  useEffect(() => {
    startAutoAgentMonitoring();

    return () => {
      stopAutoAgentMonitoring();
    };
  }, [startAutoAgentMonitoring, stopAutoAgentMonitoring]);

  useEffect(() => {
    const currentFingerprints = alerts.map(alertFingerprint);

    if (!bootstrappedRef.current) {
      knownAlertFingerprintsRef.current = new Set(currentFingerprints);
      bootstrappedRef.current = true;
      return;
    }

    const known = knownAlertFingerprintsRef.current;
    const freshAlerts = alerts.filter(alert => !known.has(alertFingerprint(alert)));

    if (freshAlerts.length > 0) {
      const now = Date.now();
      const nextNotifications: AlertNotification[] = freshAlerts.map((alert, index) => ({
        id: `${alert.id}-${now}-${index}`,
        alert,
        createdAtMs: now + index,
      }));

      nextNotifications.forEach((notification) => {
        const timer = window.setTimeout(() => {
          setNotifications(prev => prev.filter(item => item.id !== notification.id));
          timersRef.current.delete(notification.id);
        }, NOTIFICATION_AUTO_DISMISS_MS);

        timersRef.current.set(notification.id, timer);
      });

      setNotifications(prev => [...nextNotifications, ...prev].slice(0, MAX_NOTIFICATIONS));
    }

    knownAlertFingerprintsRef.current = new Set(currentFingerprints);
  }, [alerts]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

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

          <div
            style={{
              border: '1px solid var(--border-default)',
              borderRadius: 999,
              padding: '4px 10px',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: isAutoAgentRunning ? 'var(--risk-low)' : 'var(--text-muted)',
              whiteSpace: 'nowrap',
            }}
            title={autoAgentLastRun ? `Last auto run: ${format(autoAgentLastRun, 'dd MMM HH:mm:ss')}` : 'Auto monitor not run yet'}
          >
            {isAutoAgentRunning ? 'Auto agents running' : `Auto agents every ${autoAgentIntervalMinutes}m`}
          </div>

          <button
            id="voice-toggle-btn"
            className="btn btn-ghost btn-sm"
            onClick={() => setVoiceOpen(!isVoiceOpen)}
            title="Cyna Assistant"
          >
            🎙 Cyna
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
          title="Open Cyna"
        >
          🎙
        </button>
      )}

      {isVoiceOpen && <VoiceAssistantDialog />}

      {notifications.length > 0 && (
        <div className="alert-notification-stack" aria-live="polite" aria-label="New alert notifications">
          {notifications.map((notification) => {
            const { alert } = notification;
            return (
              <div
                key={notification.id}
                className={`alert-notification-item ${alert.riskLevel.toLowerCase()}`}
                onClick={() => openNotificationAlert(notification)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openNotificationAlert(notification);
                  }
                }}
              >
                <div className="alert-notification-head">
                  <span className={`alert-notification-risk ${alert.riskLevel.toLowerCase()}`}>{alert.riskLevel}</span>
                  <span className="alert-notification-time">{format(new Date(notification.createdAtMs), 'HH:mm:ss')}</span>
                  <button
                    className="alert-notification-close"
                    onClick={(event) => {
                      event.stopPropagation();
                      dismissNotification(notification.id);
                    }}
                    aria-label="Dismiss alert notification"
                  >
                    ×
                  </button>
                </div>
                <div className="alert-notification-title">{alert.title}</div>
                <div className="alert-notification-subline">{alert.location} · {alert.category} · confidence {alert.confidence}%</div>
                <div className="alert-notification-cta">Click to open detailed report</div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
