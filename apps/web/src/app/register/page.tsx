'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export default function RegisterPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
    });
  }, []);
  const [mode, setMode] = useState<'paste' | 'url' | 'file'>('paste');
  const [spec, setSpec] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
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
        body: JSON.stringify(body),
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
      <div className="max-w-3xl mx-auto px-6 py-20 text-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="text-3xl font-bold mb-4">Register Your API</h1>
        <p className="text-gray-400 mb-8">
          Log in to register and manage your APIs on AgentBridge.
        </p>
        <a
          href="/login"
          className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-8 py-3 rounded-lg transition inline-block"
        >
          Log in to continue
        </a>
        <p className="text-gray-600 text-sm mt-4">
          Browsing and chatting with APIs is free — no login needed.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">Register Your API</h1>
      <p className="text-gray-400 mb-8">
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
              mode === m.id ? 'bg-cyan-500 text-black font-medium' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {mode === 'paste' && (
          <div
            className={`relative ${dragActive ? 'ring-2 ring-cyan-500 rounded-xl' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <textarea
              value={spec}
              onChange={e => setSpec(e.target.value)}
              placeholder={`Paste your OpenAPI spec here (JSON or YAML)...\n\nOr drag & drop a file onto this area.\n\n{\n  "openapi": "3.0.0",\n  "info": { "title": "My API", ... },\n  "paths": { ... }\n}`}
              className="w-full h-80 bg-gray-900 border border-gray-700 rounded-xl p-4 font-mono text-sm text-gray-300 placeholder-gray-600 focus:border-cyan-500 focus:outline-none resize-y"
              required
            />
            {dragActive && (
              <div className="absolute inset-0 bg-cyan-500/10 rounded-xl flex items-center justify-center pointer-events-none">
                <p className="text-cyan-400 font-medium text-lg">Drop your spec file here</p>
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
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-gray-300 placeholder-gray-600 focus:border-cyan-500 focus:outline-none"
              required
            />
            <p className="text-xs text-gray-600 mt-2">
              We&apos;ll fetch the spec from this URL. Supports JSON and YAML.
            </p>
          </div>
        )}

        {mode === 'file' && (
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition ${
              dragActive ? 'border-cyan-500 bg-cyan-500/10' : 'border-gray-700 hover:border-gray-500'
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
            <p className="text-gray-400 mb-2">Click to browse or drag &amp; drop</p>
            <p className="text-gray-600 text-sm">Supports .json, .yaml, .yml files</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || (mode === 'url' ? !url.trim() : !spec.trim())}
          className="mt-4 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-semibold px-8 py-3 rounded-lg transition w-full"
        >
          {loading ? 'Importing...' : 'Register API'}
        </button>
      </form>

      {error && (
        <div className="mt-6 bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 bg-green-900/20 border border-green-700 rounded-xl p-6">
          <h3 className="text-green-400 font-semibold text-lg mb-2">
            Registered: {result.name}
          </h3>
          <p className="text-gray-300 mb-4">{result.description}</p>
          <p className="text-sm text-gray-400 mb-3">{result.action_count} actions detected:</p>
          <ul className="space-y-1 mb-6">
            {result.actions?.slice(0, 10).map((a: any) => (
              <li key={a.id} className="text-sm text-gray-300">
                <span className="text-cyan-400 font-mono">{a.id}</span> &mdash; {a.description}
              </li>
            ))}
            {result.actions?.length > 10 && (
              <li className="text-sm text-gray-500">...and {result.actions.length - 10} more</li>
            )}
          </ul>

          {/* Next steps */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Use it now</p>
            <div className="space-y-2">
              <a href="/chat" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm">
                <span className="bg-cyan-500/20 px-2 py-0.5 rounded text-xs">Web</span>
                Chat with it in the browser &rarr;
              </a>
              <div className="text-sm text-gray-400">
                <span className="bg-gray-800 px-2 py-0.5 rounded text-xs text-gray-500">CLI</span>
                <code className="ml-2 text-gray-300 text-xs">agentbridge add {typeof window !== 'undefined' ? window.location.origin : ''}/api/{result.name}/manifest</code>
              </div>
              <div className="text-sm text-gray-400">
                <span className="bg-gray-800 px-2 py-0.5 rounded text-xs text-gray-500">SDK</span>
                <code className="ml-2 text-gray-300 text-xs">fetch(&quot;{typeof window !== 'undefined' ? window.location.origin : ''}/api/{result.name}/manifest&quot;)</code>
              </div>
            </div>
          </div>

          <a href={`/api/${result.name}`} className="text-gray-400 hover:text-gray-300 text-sm">
            View full API details &rarr;
          </a>
        </div>
      )}
    </div>
  );
}
