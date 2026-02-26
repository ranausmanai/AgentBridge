'use client';

import { useState, useEffect } from 'react';
import { createClient, isAuthEnabled } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();
  const next = typeof window !== 'undefined'
    ? (new URLSearchParams(window.location.search).get('next') || '/register')
    : '/register';

  useEffect(() => {
    if (!isAuthEnabled()) {
      router.replace('/');
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        router.replace(next);
      }
    });
  }, [router, next]);

  if (!isAuthEnabled()) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="text-3xl font-bold mb-4">Authentication Disabled</h1>
        <p className="text-[var(--text-secondary)] mb-8">
          This instance does not have authentication configured. All features are available without login.
        </p>
        <a
          href="/"
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black font-semibold px-8 py-3 rounded-lg transition inline-block"
        >
          Go to Home
        </a>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    const supabase = createClient()!;

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setError(error.message);
      } else {
        setMessage('Check your email for a confirmation link.');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        router.push(next);
        router.refresh();
      }
    }

    setLoading(false);
  }

  async function handleOAuth(provider: 'github' | 'google') {
    const supabase = createClient()!;
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-2">
        {mode === 'login' ? 'Log in' : 'Create account'}
      </h1>
      <p className="text-[var(--text-secondary)] mb-8">
        {mode === 'login'
          ? 'Log in to register and manage your APIs.'
          : 'Create an account to register your APIs on AgentBridge.'}
      </p>

      {/* OAuth buttons */}
      <div className="space-y-3 mb-6">
        <button
          onClick={() => handleOAuth('google')}
          className="w-full bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continue with Google
        </button>
        <button
          onClick={() => handleOAuth('github')}
          className="w-full bg-[var(--bg-surface-hover)] hover:bg-[var(--bg-surface)] border border-[var(--border-hover)] text-[var(--text-primary)] font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          Continue with GitHub
        </button>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-[var(--border)]" />
        <span className="text-[var(--text-muted)] text-xs">or use email</span>
        <div className="flex-1 h-px bg-[var(--border)]" />
      </div>

      {/* Email form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full bg-[var(--bg-input)] border border-[var(--border-hover)] rounded-lg p-3 text-[var(--text-secondary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            required
          />
        </div>
        <div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            minLength={6}
            className="w-full bg-[var(--bg-input)] border border-[var(--border-hover)] rounded-lg p-3 text-[var(--text-secondary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-black font-semibold py-3 rounded-lg transition"
        >
          {loading ? 'Loading...' : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
      </form>

      {error && (
        <div className="mt-4 bg-[var(--error-bg)] border border-[var(--error-border)] rounded-lg p-3 text-[var(--error-text)] text-sm">
          {error}
        </div>
      )}

      {message && (
        <div className="mt-4 bg-[var(--success-bg)] border border-[var(--success-border)] rounded-lg p-3 text-[var(--success-text)] text-sm">
          {message}
        </div>
      )}

      <p className="text-[var(--text-muted)] text-sm mt-6 text-center">
        {mode === 'login' ? (
          <>Don&apos;t have an account?{' '}
            <button onClick={() => setMode('signup')} className="text-[var(--accent)] hover:text-[var(--accent-hover)]">Sign up</button>
          </>
        ) : (
          <>Already have an account?{' '}
            <button onClick={() => setMode('login')} className="text-[var(--accent)] hover:text-[var(--accent-hover)]">Log in</button>
          </>
        )}
      </p>
    </div>
  );
}
