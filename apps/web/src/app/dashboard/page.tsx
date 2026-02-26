'use client';

import { useState, useEffect } from 'react';
import { createClient, isAuthEnabled } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

interface ApiStats {
  name: string;
  description: string;
  manifest_fetches: number;
  chat_uses: number;
  action_calls: number;
  discover_hits: number;
  top_actions: { action_id: string; count: number }[];
  timeseries: { date: string; manifest_fetch: number; chat_use: number; action_call: number; discover_hit: number }[];
}

interface DashboardData {
  apis: ApiStats[];
  totals: {
    manifest_fetches: number;
    chat_uses: number;
    action_calls: number;
    discover_hits: number;
  };
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const authEnabled = isAuthEnabled();

  useEffect(() => {
    if (!authEnabled) {
      setAuthLoading(false);
      return;
    }
    const supabase = createClient()!;
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
    });
  }, [authEnabled]);

  useEffect(() => {
    if (authEnabled && !user) return;
    setLoading(true);
    fetch(`/api/dashboard?days=${days}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user, days, authEnabled]);

  if (authLoading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-20 text-center text-[var(--text-muted)]">
        Loading...
      </div>
    );
  }

  if (authEnabled && !user) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
        <p className="text-[var(--text-secondary)] mb-8">
          Log in to view analytics for your registered APIs.
        </p>
        <a
          href="/login"
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black font-semibold px-8 py-3 rounded-lg transition inline-block"
        >
          Log in to continue
        </a>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-20 text-center text-[var(--text-muted)]">
        <span className="animate-pulse">Loading dashboard...</span>
      </div>
    );
  }

  if (data.apis.length === 0) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
        <p className="text-[var(--text-secondary)] mb-8">
          You haven&apos;t registered any APIs yet. Register one to start seeing usage analytics.
        </p>
        <a
          href="/register"
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black font-semibold px-8 py-3 rounded-lg transition inline-block"
        >
          Register Your First API
        </a>
      </div>
    );
  }

  const { totals } = data;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-[var(--text-secondary)] mt-1">Usage analytics for {authEnabled ? 'your' : 'all'} APIs</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${
                days === d
                  ? 'bg-[var(--accent)] text-black font-medium'
                  : 'bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="Manifest Fetches" value={totals.manifest_fetches} />
        <StatCard label="Chat Sessions" value={totals.chat_uses} />
        <StatCard label="Action Calls" value={totals.action_calls} />
        <StatCard label="Discovery Hits" value={totals.discover_hits} />
      </div>

      {/* Per-API sections */}
      <div className="space-y-6">
        {data.apis.map(api => (
          <ApiCard key={api.name} api={api} days={days} />
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5">
      <p className="text-[var(--text-muted)] text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}

function ApiCard({ api, days }: { api: ApiStats; days: number }) {
  const total = api.manifest_fetches + api.chat_uses + api.action_calls + api.discover_hits;
  const maxDaily = Math.max(
    1,
    ...api.timeseries.map(t => t.manifest_fetch + t.chat_use + t.action_call + t.discover_hit),
  );

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <a href={`/api/${api.name}`} className="text-lg font-semibold hover:text-[var(--accent)] transition">
            {api.name}
          </a>
          <p className="text-[var(--text-secondary)] text-sm mt-0.5">{api.description}</p>
        </div>
        <span className="text-[var(--text-muted)] text-sm">{total.toLocaleString()} total events</span>
      </div>

      {/* Stat chips */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Chip label="Fetches" value={api.manifest_fetches} color="var(--accent)" />
        <Chip label="Chats" value={api.chat_uses} color="#8b5cf6" />
        <Chip label="Actions" value={api.action_calls} color="#10b981" />
        <Chip label="Discovery" value={api.discover_hits} color="#f59e0b" />
      </div>

      {/* Timeseries bar chart */}
      {api.timeseries.length > 0 && (
        <div className="mb-5">
          <p className="text-xs text-[var(--text-muted)] mb-2">Activity (last {days} days)</p>
          <div className="flex items-end gap-px h-20">
            {api.timeseries.map(t => {
              const total = t.manifest_fetch + t.chat_use + t.action_call + t.discover_hit;
              const height = Math.max(2, (total / maxDaily) * 100);
              return (
                <div
                  key={t.date}
                  className="flex-1 rounded-t transition-all hover:opacity-80"
                  style={{
                    height: `${height}%`,
                    background: 'var(--accent)',
                    opacity: 0.7,
                    minWidth: '2px',
                  }}
                  title={`${t.date}: ${total} events`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Top actions */}
      {api.top_actions.length > 0 && (
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-2">Top actions</p>
          <div className="space-y-1.5">
            {api.top_actions.map(a => {
              const maxCount = api.top_actions[0]?.count || 1;
              const width = Math.max(5, (a.count / maxCount) * 100);
              return (
                <div key={a.action_id} className="flex items-center gap-3">
                  <code className="text-xs text-[var(--accent)] w-40 truncate shrink-0">{a.action_id}</code>
                  <div className="flex-1 h-5 bg-[var(--bg-surface-hover)] rounded overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{ width: `${width}%`, background: 'var(--accent)', opacity: 0.5 }}
                    />
                  </div>
                  <span className="text-xs text-[var(--text-muted)] w-10 text-right shrink-0">{a.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span
      className="text-xs px-2.5 py-1 rounded-lg font-medium"
      style={{ background: `${color}15`, color }}
    >
      {value.toLocaleString()} {label}
    </span>
  );
}
