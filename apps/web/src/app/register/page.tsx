'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient, isAuthEnabled } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export default function RegisterPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
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

  const [mode, setMode] = useState<'paste' | 'url' | 'file'>('paste');
  const [spec, setSpec] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'url' && !url.trim()) return;
    if (mode !== 'url' && !spec.trim()) return;
    await doImport(mode === 'url' ? { url } : { spec });
  }

  async function doImport(body: { spec?: string; url?: string }) {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, is_public: isPublic }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to import');
        return;
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setSpec(content);
      setMode('paste');
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  if (authLoading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center text-[var(--text-muted)]">
        Loading...
      </div>
    );
  }

  // When auth is enabled, require login
  if (authEnabled && !user) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="text-3xl font-bold mb-4">Register Your API</h1>
        <p className="text-[var(--text-secondary)] mb-8">
          Log in to register and manage your APIs on AgentBridge.
        </p>
        <a
          href="/login"
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black font-semibold px-8 py-3 rounded-lg transition inline-block"
        >
          Log in to continue
        </a>
        <p className="text-[var(--text-muted)] text-sm mt-4">
          Browsing and chatting with APIs is free — no login needed.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">Register Your API</h1>
      <p className="text-[var(--text-secondary)] mb-8">
        Paste your OpenAPI/Swagger spec, enter a URL, or drag &amp; drop a file. We&apos;ll make it agent-ready in seconds.
      </p>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'paste' as const, label: 'Paste Spec' },
          { id: 'url' as const, label: 'From URL' },
          { id: 'file' as const, label: 'Upload File' },
        ].map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              mode === m.id ? 'bg-[var(--accent)] text-black font-medium' : 'bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {mode === 'paste' && (
          <div
            className={`relative ${dragActive ? 'ring-2 ring-[var(--accent)] rounded-xl' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <textarea
              value={spec}
              onChange={e => setSpec(e.target.value)}
              placeholder={`Paste your OpenAPI spec here (JSON or YAML)...\n\nOr drag & drop a file onto this area.\n\n{\n  "openapi": "3.0.0",\n  "info": { "title": "My API", ... },\n  "paths": { ... }\n}`}
              className="w-full h-80 bg-[var(--bg-input)] border border-[var(--border-hover)] rounded-xl p-4 font-mono text-sm text-[var(--text-secondary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none resize-y"
              required
            />
            {dragActive && (
              <div className="absolute inset-0 bg-[var(--accent-soft)] rounded-xl flex items-center justify-center pointer-events-none">
                <p className="text-[var(--accent)] font-medium text-lg">Drop your spec file here</p>
              </div>
            )}
          </div>
        )}

        {mode === 'url' && (
          <div>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://api.example.com/openapi.json"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-hover)] rounded-xl p-4 text-[var(--text-secondary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
              required
            />
            <p className="text-xs text-[var(--text-muted)] mt-2">
              We&apos;ll fetch the spec from this URL. Supports JSON and YAML.
            </p>
          </div>
        )}

        {mode === 'file' && (
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition ${
              dragActive ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border-hover)] hover:border-[var(--text-muted)]'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.yaml,.yml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <p className="text-[var(--text-secondary)] mb-2">Click to browse or drag &amp; drop</p>
            <p className="text-[var(--text-muted)] text-sm">Supports .json, .yaml, .yml files</p>
          </div>
        )}

        <label className="mt-4 flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={e => setIsPublic(e.target.checked)}
            className="w-4 h-4 rounded border-[var(--border-hover)] bg-[var(--bg-surface-hover)] text-[var(--accent)] focus:ring-[var(--accent)] focus:ring-offset-0"
          />
          <span className="text-sm text-[var(--text-secondary)]">List publicly on AgentBridge directory</span>
        </label>

        <button
          type="submit"
          disabled={loading || (mode === 'url' ? !url.trim() : !spec.trim())}
          className="mt-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold px-8 py-3 rounded-lg transition w-full"
        >
          {loading ? 'Importing...' : 'Register API'}
        </button>
      </form>

      {error && (
        <div className="mt-6 bg-[var(--error-bg)] border border-[var(--error-border)] rounded-xl p-4 text-[var(--error-text)]">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 bg-[var(--success-bg)] border border-[var(--success-border)] rounded-xl p-6">
          <h3 className="text-[var(--success-text)] font-semibold text-lg mb-2">
            Registered: {result.name}
          </h3>
          <p className="text-[var(--text-secondary)] mb-4">{result.description}</p>
          <p className="text-sm text-[var(--text-secondary)] mb-3">{result.action_count} actions detected:</p>
          <ul className="space-y-1 mb-6">
            {result.actions?.slice(0, 10).map((a: any) => (
              <li key={a.id} className="text-sm text-[var(--text-secondary)]">
                <span className="text-[var(--accent)] font-mono">{a.id}</span> &mdash; {a.description}
              </li>
            ))}
            {result.actions?.length > 10 && (
              <li className="text-sm text-[var(--text-muted)]">...and {result.actions.length - 10} more</li>
            )}
          </ul>

          {/* Next steps */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-4 mb-4">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-3">Use it now</p>
            <div className="space-y-2">
              <a href="/chat" className="flex items-center gap-2 text-[var(--accent)] hover:text-[var(--accent-hover)] text-sm">
                <span className="bg-[var(--accent-soft)] px-2 py-0.5 rounded text-xs">Web</span>
                Chat with it in the browser &rarr;
              </a>
              <div className="text-sm text-[var(--text-secondary)]">
                <span className="bg-[var(--bg-surface-hover)] px-2 py-0.5 rounded text-xs text-[var(--text-muted)]">CLI</span>
                <code className="ml-2 text-[var(--text-secondary)] text-xs">agentbridge add {typeof window !== 'undefined' ? window.location.origin : ''}/api/{result.name}/manifest</code>
              </div>
              <div className="text-sm text-[var(--text-secondary)]">
                <span className="bg-[var(--bg-surface-hover)] px-2 py-0.5 rounded text-xs text-[var(--text-muted)]">SDK</span>
                <code className="ml-2 text-[var(--text-secondary)] text-xs">fetch(&quot;{typeof window !== 'undefined' ? window.location.origin : ''}/api/{result.name}/manifest&quot;)</code>
              </div>
            </div>
          </div>

          {/* MCP instructions */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-4 mb-4">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-3">MCP (Claude Desktop / Cursor / Windsurf)</p>
            <pre className="bg-[var(--bg-inset)] border border-[var(--border)] rounded-lg p-3 text-xs text-[var(--text-secondary)] overflow-x-auto mb-2">{`{
  "mcpServers": {
    "${result.name}": {
      "command": "npx",
      "args": ["@agentbridgeai/mcp", "--api", "${result.name}"]
    }
  }
}`}</pre>
            <p className="text-xs text-[var(--text-muted)]">
              Add to <code className="text-[var(--text-secondary)]">~/.claude/claude_desktop_config.json</code> or Cursor/Windsurf MCP settings.
            </p>
          </div>

          <a href={`/api/${result.name}`} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm">
            View full API details &rarr;
          </a>
        </div>
      )}
    </div>
  );
}
