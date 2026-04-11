import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import type { User } from '../types';
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

const DEMO_ACCOUNTS = [
  { label: 'Analyst Account', email: 'analyst.sharma@gov.in', role: 'ANALYST' as const, icon: '👤' },
  { label: 'Commander Account', email: 'cmd.verma@gov.in', role: 'COMMANDER' as const, icon: '⭐' },
  { label: 'Admin Account', email: 'admin.singh@gov.in', role: 'ADMIN' as const, icon: '🛡' },
];

const DEMO_PASSWORD = 'demo1234';

function toDisplayName(email: string): string {
  return email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function inferRole(email: string): User['role'] {
  const normalized = email.toLowerCase();
  if (normalized.includes('admin')) return 'ADMIN';
  if (normalized.includes('cmd') || normalized.includes('commander')) return 'COMMANDER';
  return 'ANALYST';
}

export default function LoginPage() {
  const setUser = useAppStore(s => s.setUser);
  const navigate = useNavigate();
  const [email, setEmail] = useState('analyst.sharma@gov.in');
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loginWithUser = (user: User) => {
    setUser(user);
    navigate('/dashboard');
  };

  const tryDemoLogin = () => {
    const demo = DEMO_ACCOUNTS.find(acc => acc.email.toLowerCase() === email.trim().toLowerCase());
    if (!demo) return false;
    if (password !== DEMO_PASSWORD) return false;

    loginWithUser({
      uid: `demo-${demo.role.toLowerCase()}`,
      email: demo.email,
      displayName: toDisplayName(demo.email),
      role: demo.role,
      department: 'Intelligence Wing (Demo)',
      lastLogin: new Date(),
    });
    return true;
  };

  const applyDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Both fields are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      loginWithUser({
        uid: cred.user.uid,
        email: cred.user.email || email.trim(),
        displayName: cred.user.displayName || toDisplayName(cred.user.email || email.trim()),
        role: inferRole(cred.user.email || email.trim()),
        department: 'Intelligence Wing',
        lastLogin: new Date(),
      });
    } catch (firebaseError) {
      // Demo fallback keeps local development and hackathon demos functional.
      const demoLogged = tryDemoLogin();
      if (!demoLogged) {
        console.warn('[Login] Firebase sign-in failed', firebaseError);
        setError('Login failed. Use a valid official account or demo credentials (password: demo1234).');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-grid-pattern" />
      <div className="login-bg-orb login-bg-orb-a" />
      <div className="login-bg-orb login-bg-orb-b" />

      <section className="login-shell">
        <aside className="login-brand-panel">
          <div className="login-brand-chip">Secure Access</div>
          <h1 className="login-brand-title">LEIS Command Portal</h1>
          <p className="login-brand-copy">
            Intelligence operations dashboard for realtime monitoring, alert triage, and command visibility.
          </p>

          <div className="login-brand-metrics">
            <div className="login-metric-card">
              <span>Coverage</span>
              <strong>5 Cities</strong>
            </div>
            <div className="login-metric-card">
              <span>Pipeline</span>
              <strong>Realtime</strong>
            </div>
            <div className="login-metric-card">
              <span>Mode</span>
              <strong>Live Ops</strong>
            </div>
          </div>
        </aside>

        <div className="login-card">
          <div className="login-logo-wrap">
            <div className="login-title">Welcome Back</div>
            <div className="login-subtitle">Sign in to continue</div>
          </div>

          {error && (
            <div className="form-error">
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="email-input">Email Address</label>
              <input
                id="email-input"
                className="form-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="officer.name@gov.in"
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password-input">Password</label>
              <div className="login-password-wrap">
                <input
                  id="password-input"
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(prev => !prev)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              id="login-btn"
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={loading}
            >
              {loading ? <><span className="spinner" /> Signing in...</> : 'Sign In'}
            </button>
          </form>

          <div className="login-demo-row">
            {DEMO_ACCOUNTS.map(account => (
              <button
                key={account.email}
                type="button"
                className="login-demo-chip"
                onClick={() => applyDemoAccount(account.email)}
              >
                <span>{account.icon}</span>
                <span>{account.label}</span>
              </button>
            ))}
          </div>

          <div className="login-helper-text">Demo password: {DEMO_PASSWORD}</div>
        </div>
      </section>
    </div>
  );
}
