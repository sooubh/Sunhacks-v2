import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import type { User } from '../types';
import { auth } from '../config/firebase';
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';

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

function buildUserFromEmail(email: string): User {
  return {
    uid: `uid-${email.toLowerCase()}`,
    email,
    displayName: toDisplayName(email),
    role: inferRole(email),
    department: 'Intelligence Wing',
    lastLogin: new Date(),
  };
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

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const authEmail = result.user.email || 'officer@gov.in';

      loginWithUser({
        uid: result.user.uid,
        email: authEmail,
        displayName: result.user.displayName || toDisplayName(authEmail),
        role: inferRole(authEmail),
        department: 'Intelligence Wing (OAuth)',
        lastLogin: new Date(),
      });
    } catch (oauthError) {
      console.warn('[Login] Google login failed, using offline demo fallback', oauthError);
      loginWithUser(buildUserFromEmail('officer.oauth@gov.in'));
    } finally {
      setLoading(false);
    }
  };

  const applyDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setError('');
  };

  return (
    <div className="login-page">
      <div className="login-bg-grid" />
      <div className="login-bg-vignette" />
      <div className="login-bg-center" />

      <div className="login-card">
        <div className="login-logo-wrap">
          <div className="login-shield">🛡️</div>
          <div className="login-title">Leis</div>
          <div className="login-subtitle">OSINT Intelligence Platform</div>
        </div>

        <div className="login-classify-banner">
          🔒 Classified — Authorized Personnel Only
        </div>

        {error && (
          <div className="form-error">
            <span>⚠</span> {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label" htmlFor="email-input">Official Email</label>
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
            <label className="form-label" htmlFor="password-input">Secure Passphrase</label>
            <div className="password-row">
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
                className="password-toggle-btn"
                onClick={() => setShowPassword(prev => !prev)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="login-helper-text">Demo password: {DEMO_PASSWORD}</div>
          </div>

          <button
            id="login-btn"
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? <><span className="spinner" /> Authenticating...</> : '🔐 Access Platform'}
          </button>
        </form>

        <div className="login-divider">Or continue with</div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="btn btn-ghost"
          style={{ width: '100%', marginBottom: 18 }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </button>

        <div className="demo-account-grid">
          {DEMO_ACCOUNTS.map(acc => (
            <button
              key={acc.label}
              id={`demo-${acc.label.toLowerCase().replace(/\s+/g, '-')}-btn`}
              type="button"
              className="demo-account-btn"
              onClick={() => applyDemoAccount(acc.email)}
            >
              <span className="demo-account-icon">{acc.icon}</span>
              <span>{acc.label}</span>
            </button>
          ))}
        </div>

        <div className="login-footer-note">
          Ministry of Home Affairs · Intelligence Wing<br />
          All actions are monitored, logged, and audited.
        </div>
      </div>
    </div>
  );
}
