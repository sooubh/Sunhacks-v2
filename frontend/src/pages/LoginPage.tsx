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

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    // Simulate Google OAuth
    await new Promise(r => setTimeout(r, 1200));
    const mockGoogleUser: User = {
      uid: 'uid-google-001',
      email: 'officer@gmail.com',
      displayName: 'Authorized Officer',
      role: 'ANALYST',
      department: 'Intelligence Wing (OAuth)',
      lastLogin: new Date(),
    };
    setUser(mockGoogleUser);
    setLoading(false);
    navigate('/dashboard');
  };

  const demoAccounts = [
    { label: 'Analyst Account', email: 'analyst.sharma@gov.in', icon: '👤' },
    { label: 'Commander Account', email: 'cmd.verma@gov.in', icon: '⭐' },
  ];

  return (
    <div className="login-page flex items-center justify-center min-h-screen relative overflow-hidden bg-slate-50">
      <div className="login-bg-grid" />
      <div className="login-bg-vignette" />
      
      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-slate-200">
        
        {/* Logo / Branding */}
        <div className="flex flex-col items-center mb-6">
          <div className="text-4xl mb-2">🛡️</div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Leis</h1>
          <p className="text-sm text-slate-500 font-medium">OSINT Intelligence Platform</p>
        </div>

        {/* Classification banner */}
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-4 py-2 rounded-lg text-center mb-6">
          🔒 Classified — Authorized Personnel Only
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4 flex items-center gap-2">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="email-input">
              Official Email
            </label>
            <input
              id="email-input"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="officer.name@gov.in"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="password-input">
              Secure Passphrase
            </label>
            <input
              id="password-input"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
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
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors flex justify-center items-center text-sm shadow-sm"
            disabled={loading}
          >
            {loading ? 'Authenticating...' : '🔐 Access Platform'}
          </button>
        </form>

        <div className="flex items-center my-6">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-medium uppercase tracking-wider">Or continue with</span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        {/* Google Login Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg transition-colors flex justify-center items-center text-sm shadow-sm gap-2 mb-6"
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

        {/* Demo access */}
        <div className="flex gap-2">
          {demoAccounts.map(acc => (
            <button
              key={acc.label}
              id={`demo-${acc.label.toLowerCase().replace(/\s+/g, '-')}-btn`}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-3 rounded-md text-xs font-medium flex flex-col items-center gap-1 transition-colors"
              onClick={() => { setEmail(acc.email); setPassword('demo1234'); }}
            >
              <span className="text-base">{acc.icon}</span>
              <span>{acc.label}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-slate-400 font-medium">
          Ministry of Home Affairs · Intelligence Wing<br />
          All actions are monitored, logged, and audited.
        </div>
      </div>
    </div>
  );
}
