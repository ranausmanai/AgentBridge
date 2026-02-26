'use client';

import { useEffect, useState } from 'react';
import { createClient, isAuthEnabled } from '@/lib/supabase/client';
import { useTheme } from '@/components/theme-provider';
import type { User } from '@supabase/supabase-js';

export default function Nav() {
  const [user, setUser] = useState<User | null>(null);
  const { theme, toggleTheme } = useTheme();
  const authEnabled = isAuthEnabled();

  useEffect(() => {
    if (!authEnabled) return;
    const supabase = createClient()!;
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [authEnabled]);

  async function handleLogout() {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = '/';
  }

  return (
    <nav className="border-b border-[var(--border)] bg-[var(--bg-surface)]/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="/" className="text-xl font-bold text-[var(--text-primary)]">
          <span className="text-[var(--accent)]">Agent</span>Bridge
        </a>
        <div className="flex items-center gap-6 text-sm">
          <a href="/" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">Browse APIs</a>
          <a href="/register" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">Register API</a>
          {(user || !authEnabled) && (
            <a href="/dashboard" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">Dashboard</a>
          )}
          <a href="/chat" className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black font-medium px-4 py-1.5 rounded-lg transition">
            Chat
          </a>
          <button
            onClick={toggleTheme}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)]"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          {authEnabled && (
            user ? (
              <div className="flex items-center gap-3">
                <span className="text-[var(--text-muted)] text-xs truncate max-w-[120px]">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs transition"
                >
                  Log out
                </button>
              </div>
            ) : (
              <a href="/login" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
                Log in
              </a>
            )
          )}
        </div>
      </div>
    </nav>
  );
}
