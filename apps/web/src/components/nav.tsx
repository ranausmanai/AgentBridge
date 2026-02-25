'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export default function Nav() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = '/';
  }

  return (
    <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="/" className="text-xl font-bold text-white">
          <span className="text-cyan-400">Agent</span>Bridge
        </a>
        <div className="flex items-center gap-6 text-sm">
          <a href="/" className="text-gray-400 hover:text-white transition">Browse APIs</a>
          <a href="/register" className="text-gray-400 hover:text-white transition">Register API</a>
          <a href="/chat" className="bg-cyan-500 hover:bg-cyan-400 text-black font-medium px-4 py-1.5 rounded-lg transition">
            Chat
          </a>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-gray-500 text-xs truncate max-w-[120px]">{user.email}</span>
              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-white text-xs transition"
              >
                Log out
              </button>
            </div>
          ) : (
            <a href="/login" className="text-gray-400 hover:text-white transition">
              Log in
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
