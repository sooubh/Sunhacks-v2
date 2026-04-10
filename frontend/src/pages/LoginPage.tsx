import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import type { User } from '../types';

export default function LoginPage() {
  const setUser = useAppStore(s => s.setUser);
  const navigate = useNavigate();
  const [email, setEmail] = useState('analyst.sharma@gov.in');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Both fields are required.'); return; }
    setLoading(true);
    setError('');
    // Simulate auth — replace with Firebase signInWithEmailAndPassword
    await new Promise(r => setTimeout(r, 1200));
    const mockUser: User = {
      uid: 'uid-001',
      email,
      displayName: email.split('@')[0].replace('.', ' ').replace(/\b\w/g, c => c.toUpperCase()),
      role: 'ANALYST',
      department: 'Intelligence Wing',
      lastLogin: new Date(),
    };
    setUser(mockUser);
    setLoading(false);
    navigate('/dashboard');
  };

  const demoAccounts = [
    { label: 'Analyst Account', email: 'analyst.sharma@gov.in', icon: '👤' },
    { label: 'Commander Account', email: 'cmd.verma@gov.in', icon: '⭐' },
  ];

  return (
    <div className="login-page">
      <div className="login-bg-grid" />
      <div className="login-bg-vignette" />
      <div className="login-bg-center" />

      <div className="login-card">

        {/* Logo / Branding */}
        <div className="login-logo-wrap">
          <div className="login-shield">🛡️</div>
          <div className="login-title">ConflictSense</div>
          <div className="login-subtitle">OSINT Intelligence Platform</div>
        </div>

        {/* Classification banner */}
        <div className="login-classify-banner">
          🔒 Classified — Authorized Personnel Only
        </div>

        {/* Error */}
        {error && (
          <div className="form-error">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label" htmlFor="email-input">
              Official Government Email
            </label>
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
            <label className="form-label" htmlFor="password-input">
              Secure Passphrase
            </label>
            <input
              id="password-input"
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            id="login-btn"
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: 13, marginTop: 4 }}
            disabled={loading}
          >
            {loading
              ? <><span className="spinner" /> Authenticating...</>
              : '🔐  Access Platform'
            }
          </button>
        </form>

        {/* Demo access */}
        <div className="login-divider">Quick Demo Access</div>

        <div style={{ display: 'flex', gap: 8 }}>
          {demoAccounts.map(acc => (
            <button
              key={acc.label}
              id={`demo-${acc.label.toLowerCase().replace(/\s+/g, '-')}-btn`}
              className="btn btn-ghost"
              style={{ flex: 1, padding: '8px 10px', fontSize: 11, flexDirection: 'column', gap: 3, height: 'auto' }}
              onClick={() => { setEmail(acc.email); setPassword('demo1234'); }}
            >
              <span style={{ fontSize: 15 }}>{acc.icon}</span>
              <span>{acc.label}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="login-footer-note">
          Ministry of Home Affairs · Intelligence Wing<br />
          All actions are monitored, logged, and audited.<br />
          Unauthorized access is a punishable offence.
        </div>
      </div>
    </div>
  );
}
