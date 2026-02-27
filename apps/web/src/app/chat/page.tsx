'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: { action: string; params: any }[];
}

interface ApiInfo {
  name: string;
  description: string;
  action_count: number;
  auth_type: string;
  is_builtin?: boolean;
  builtin_oauth_ready?: boolean;
}

interface CredentialStatus {
  configured: boolean;
  oauthConnected: boolean;
  hasClientConfig: boolean;
  updatedAt?: string;
}

const LLM_PROVIDERS = [
  { id: 'gemini', label: 'Gemini (free)', placeholder: 'AIzaSy...', hint: 'Free at aistudio.google.com' },
  { id: 'groq', label: 'Groq (free)', placeholder: 'gsk_...', hint: 'Free at console.groq.com' },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-...', hint: 'platform.openai.com' },
  { id: 'claude', label: 'Claude', placeholder: 'sk-ant-...', hint: 'console.anthropic.com' },
];

export default function ChatPage() {
  const [apis, setApis] = useState<ApiInfo[]>([]);
  const [selectedApis, setSelectedApis] = useState<Set<string>>(new Set());
  const [provider, setProvider] = useState('groq');
  const [apiKey, setApiKey] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [apiCredentials, setApiCredentials] = useState<Record<string, string>>({});
  const [oauthClientIds, setOauthClientIds] = useState<Record<string, string>>({});
  const [oauthClientSecrets, setOauthClientSecrets] = useState<Record<string, string>>({});
  const [credentialStatus, setCredentialStatus] = useState<Record<string, CredentialStatus>>({});
  const [vaultEnabled, setVaultEnabled] = useState(true);
  const [oauthNotice, setOauthNotice] = useState('');
  const [oauthError, setOauthError] = useState('');
  const [oauthConnectingApi, setOauthConnectingApi] = useState('');
  const [configured, setConfigured] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/apis').then(r => r.json()).then((data) => {
      setApis(data);
      // Auto-select all APIs if 3 or fewer
      if (data.length > 0 && data.length <= 3) {
        setSelectedApis(new Set(data.map((a: ApiInfo) => a.name)));
      }
      refreshCredentialStatus(data.map((a: ApiInfo) => a.name));
    });
    const savedKey = localStorage.getItem('agentbridge_llm_key');
    const savedProvider = localStorage.getItem('agentbridge_llm_provider');
    if (savedKey) setApiKey(savedKey);
    if (savedProvider) setProvider(savedProvider);

    const params = new URLSearchParams(window.location.search);
    const oauth = params.get('oauth');
    const api = params.get('api');
    const reason = params.get('reason');
    if (oauth === 'connected' && api) {
      setOauthNotice(`OAuth connected for ${api}.`);
      params.delete('oauth');
      params.delete('api');
      params.delete('reason');
      window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`);
    } else if (oauth === 'error') {
      setOauthError(`OAuth failed${reason ? `: ${reason}` : ''}`);
      params.delete('oauth');
      params.delete('api');
      params.delete('reason');
      window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function refreshCredentialStatus(apiNames?: string[]) {
    const names = apiNames ?? apis.map(a => a.name);
    if (names.length === 0) return;
    const res = await fetch(`/api/credentials?apis=${encodeURIComponent(names.join(','))}`);
    const data = await res.json();
    if (!res.ok || data.configured === false) {
      setVaultEnabled(false);
      setCredentialStatus({});
      return;
    }
    setVaultEnabled(true);
    setCredentialStatus(data.statuses || {});
  }

  function toggleApi(name: string) {
    setSelectedApis(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function persistSecureCredentials() {
    if (!vaultEnabled) return;

    const selected = apis.filter(api => selectedApis.has(api.name));
    for (const api of selected) {
      if (api.auth_type === 'oauth2') {
        const clientId = oauthClientIds[api.name]?.trim();
        const clientSecret = oauthClientSecrets[api.name]?.trim();
        if (!clientId) continue;
        await fetch('/api/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiName: api.name,
            credentials: {
              oauth_client_id: clientId,
              ...(clientSecret ? { oauth_client_secret: clientSecret } : {}),
            },
          }),
        });
      } else {
        const token = apiCredentials[api.name]?.trim();
        if (!token) continue;
        await fetch('/api/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiName: api.name,
            credentials: {
              token,
              api_key: token,
            },
          }),
        });
      }
    }
    await refreshCredentialStatus(selected.map(a => a.name));
  }

  async function connectOAuth(apiName: string, useBuiltinDefaults?: boolean) {
    const clientId = oauthClientIds[apiName]?.trim();
    if (!useBuiltinDefaults && !clientId) {
      setOauthError(`Enter client ID for ${apiName} first.`);
      return;
    }
    setOauthError('');
    setOauthNotice('');
    setOauthConnectingApi(apiName);
    try {
      if (!useBuiltinDefaults) {
        const secret = oauthClientSecrets[apiName]?.trim();
        await fetch('/api/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiName,
            credentials: {
              oauth_client_id: clientId,
              ...(secret ? { oauth_client_secret: secret } : {}),
            },
          }),
        });
      }
      const oauthUrl = `/api/oauth/start?api=${encodeURIComponent(apiName)}`;
      const popup = window.open(oauthUrl, '_blank', 'noopener');
      if (!popup) {
        window.location.href = oauthUrl;
        return;
      }
      const poll = setInterval(async () => {
        const res = await fetch(`/api/credentials?apis=${encodeURIComponent(apiName)}`);
        const data = await res.json();
        if (data.statuses?.[apiName]?.oauthConnected) {
          clearInterval(poll);
          setOauthConnectingApi('');
          setOauthNotice(`OAuth connected for ${apiName}.`);
          setCredentialStatus(prev => ({ ...prev, [apiName]: data.statuses[apiName] }));
        }
      }, 2000);
      setTimeout(() => clearInterval(poll), 300000);
    } catch {
      setOauthConnectingApi('');
    }
  }

  async function handleConfigure() {
    if (!apiKey.trim()) return;
    localStorage.setItem('agentbridge_llm_key', apiKey);
    localStorage.setItem('agentbridge_llm_provider', provider);
    await persistSecureCredentials();
    localStorage.removeItem('agentbridge_api_creds');
    setConfigured(true);
  }

  async function sendMessage(msg: string) {
    if (!msg.trim() || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          apis: Array.from(selectedApis),
          llmProvider: provider,
          llmKey: apiKey,
          sessionId,
          apiCredentials: vaultEnabled ? {} : Object.fromEntries(
            Object.entries(apiCredentials)
              .filter(([, v]) => v)
              .map(([name, token]) => [name, { token, api_key: token }])
          ),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Error: ${data.error}`,
        }]);
        return;
      }

      if (data.sessionId) setSessionId(data.sessionId);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        toolCalls: data.toolCalls,
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err.message}`,
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    await sendMessage(input.trim());
  }

  const currentProvider = LLM_PROVIDERS.find(p => p.id === provider);

  // Setup screen
  if (!configured) {
    const apisNeedingAuth = apis.filter(
      api => selectedApis.has(api.name) && api.auth_type && api.auth_type !== 'none'
    );

    return (
      <div className="max-w-xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Chat with APIs</h1>
        <p className="text-[var(--text-secondary)] mb-8">
          Talk to any registered API using natural language. Bring your own LLM key — we never store it.
        </p>

        {/* Step 1: LLM Provider + Key (combined) */}
        <div className="mb-6">
          <label className="block text-sm text-[var(--text-secondary)] mb-2">
            <span className="bg-[var(--accent-soft)] text-[var(--accent)] text-xs px-2 py-0.5 rounded mr-2">1</span>
            LLM Provider &amp; Key
          </label>
          <div className="flex gap-2 mb-3">
            {LLM_PROVIDERS.map(p => (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                className={`px-4 py-2 rounded-lg text-sm transition ${
                  provider === p.id ? 'bg-[var(--accent)] text-black font-medium' : 'bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={currentProvider?.placeholder}
            className="w-full bg-[var(--bg-input)] border border-[var(--border-hover)] rounded-xl p-3 text-[var(--text-secondary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {currentProvider?.hint} — stored in your browser only.
          </p>
        </div>

        {/* Step 2: Select APIs */}
        <div className="mb-6">
          <label className="block text-sm text-[var(--text-secondary)] mb-2">
            <span className="bg-[var(--accent-soft)] text-[var(--accent)] text-xs px-2 py-0.5 rounded mr-2">2</span>
            Select APIs to chat with
          </label>
          {apis.length === 0 ? (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 text-center">
              <p className="text-[var(--text-muted)] text-sm mb-2">No APIs registered yet.</p>
              <a href="/register" className="text-[var(--accent)] hover:text-[var(--accent-hover)] text-sm">
                Register your first API &rarr;
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              {apis.map(api => (
                <label
                  key={api.name}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    selectedApis.has(api.name) ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border-hover)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedApis.has(api.name)}
                    onChange={() => toggleApi(api.name)}
                    className="accent-[var(--accent)]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--text-primary)] font-medium">{api.name}</span>
                      <span className="text-[var(--text-muted)] text-xs">{api.action_count} actions</span>
                      {api.auth_type && api.auth_type !== 'none' && (
                        <span className="text-xs bg-[var(--warning-bg)] text-[var(--warning-text)] px-1.5 py-0.5 rounded">{api.auth_type}</span>
                      )}
                    </div>
                    <p className="text-[var(--text-secondary)] text-xs mt-0.5">{api.description}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Step 3: API credentials (only if needed) */}
        {apisNeedingAuth.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              <span className="bg-[var(--warning-bg)] text-[var(--warning-text)] text-xs px-2 py-0.5 rounded mr-2">3</span>
              API Credentials
            </label>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              {vaultEnabled
                ? 'Credentials are encrypted and stored on the server for hosted secure calling.'
                : 'Server vault is not configured. Credentials will be sent per request only.'}
            </p>
            {oauthNotice && (
              <p className="text-xs text-green-600 dark:text-green-400 mb-2">{oauthNotice}</p>
            )}
            {oauthError && (
              <p className="text-xs text-red-600 dark:text-red-400 mb-2">{oauthError}</p>
            )}
            <div className="space-y-3">
              {apisNeedingAuth.map(api => {
                const status = credentialStatus[api.name];
                return (
                  <div key={api.name} className="bg-[var(--bg-surface)] border border-[var(--border-hover)] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[var(--text-primary)] text-sm font-medium">{api.name}</span>
                      <span className="text-xs bg-[var(--warning-bg)] text-[var(--warning-text)] px-2 py-0.5 rounded">
                        {api.auth_type}
                      </span>
                      {status?.configured && (
                        <span className="text-xs bg-green-500/10 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                          saved
                        </span>
                      )}
                      {status?.oauthConnected && (
                        <span className="text-xs bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                          connected
                        </span>
                      )}
                    </div>

                    {api.auth_type === 'oauth2' ? (
                      (api.is_builtin && api.builtin_oauth_ready) ? (
                        <div>
                          <button
                            onClick={() => connectOAuth(api.name, true)}
                            disabled={oauthConnectingApi === api.name}
                            className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-black font-medium px-3 py-1.5 rounded-lg transition"
                          >
                            {oauthConnectingApi === api.name ? 'Opening OAuth...' : `Connect ${api.name}`}
                          </button>
                          <p className="text-xs text-[var(--text-muted)] mt-1">No setup needed — click to authorize with your {api.name} account.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {api.is_builtin && (
                            <p className="text-xs text-[var(--text-muted)]">
                              This prebuilt needs your OAuth app credentials (Client ID and optional Client Secret).
                            </p>
                          )}
                          <input
                            type="text"
                            value={oauthClientIds[api.name] || ''}
                            onChange={e => setOauthClientIds(prev => ({ ...prev, [api.name]: e.target.value }))}
                            placeholder="OAuth client ID"
                            className="w-full bg-[var(--bg-surface-hover)] border border-[var(--border)] rounded-lg p-2 text-[var(--text-secondary)] text-sm placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                          />
                          <input
                            type="password"
                            value={oauthClientSecrets[api.name] || ''}
                            onChange={e => setOauthClientSecrets(prev => ({ ...prev, [api.name]: e.target.value }))}
                            placeholder="OAuth client secret (optional)"
                            className="w-full bg-[var(--bg-surface-hover)] border border-[var(--border)] rounded-lg p-2 text-[var(--text-secondary)] text-sm placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                          />
                          <button
                            onClick={() => connectOAuth(api.name)}
                            disabled={oauthConnectingApi === api.name}
                            className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-black font-medium px-3 py-1.5 rounded-lg transition"
                          >
                            {oauthConnectingApi === api.name ? 'Opening OAuth...' : `Connect ${api.name}`}
                          </button>
                        </div>
                      )
                    ) : (
                      <input
                        type="password"
                        value={apiCredentials[api.name] || ''}
                        onChange={e => setApiCredentials(prev => ({ ...prev, [api.name]: e.target.value }))}
                        placeholder={api.auth_type === 'bearer' ? 'Bearer token...' : 'API key...'}
                        className="w-full bg-[var(--bg-surface-hover)] border border-[var(--border)] rounded-lg p-2 text-[var(--text-secondary)] text-sm placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={handleConfigure}
          disabled={!apiKey.trim() || selectedApis.size === 0}
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold px-8 py-3 rounded-lg transition w-full"
        >
          Start Chatting
        </button>
      </div>
    );
  }

  // Chat screen
  const selectedApiNames = Array.from(selectedApis);

  return (
    <div className="flex flex-col h-[calc(100vh-65px)]">
      {/* Header */}
      <div className="border-b border-[var(--border)] px-6 py-3 flex items-center justify-between bg-[var(--bg-surface)]/80 backdrop-blur-sm">
        <div className="text-sm text-[var(--text-secondary)]">
          Chatting with: {selectedApiNames.map(name => (
            <span key={name} className="inline-block bg-[var(--accent-soft)] text-[var(--accent)] px-2 py-0.5 rounded text-xs ml-1">
              {name}
            </span>
          ))}
        </div>
        <button
          onClick={() => { setConfigured(false); setMessages([]); setSessionId(undefined); }}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        >
          Change settings
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-[var(--text-muted)] mt-16">
            <p className="text-lg mb-4">What would you like to do?</p>
            <p className="text-sm mb-6 text-[var(--text-muted)]">
              You&apos;re connected to {selectedApiNames.join(', ')}. Try one of these:
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
              {selectedApiNames.map(name => {
                const suggestions = generateSuggestions(name);
                return suggestions.map((s, i) => (
                  <button
                    key={`${name}-${i}`}
                    onClick={() => sendMessage(s)}
                    className="bg-[var(--bg-surface-hover)] hover:bg-[var(--bg-surface)] border border-[var(--border-hover)] hover:border-[var(--accent)]/50 text-[var(--text-secondary)] text-sm px-4 py-2 rounded-lg transition"
                  >
                    {s}
                  </button>
                ));
              })}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-2xl rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-[var(--accent)] text-black'
                : 'bg-[var(--bg-surface-hover)] text-[var(--text-primary)]'
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[var(--border)]">
                  {msg.toolCalls.map((tc, j) => (
                    <p key={j} className="text-xs text-[var(--text-secondary)] font-mono">
                      Called: {tc.action}({JSON.stringify(tc.params).slice(0, 60)})
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[var(--bg-surface-hover)] rounded-2xl px-4 py-3 text-[var(--text-secondary)]">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-[var(--border)] px-6 py-4 bg-[var(--bg-surface)]/80 backdrop-blur-sm">
        <div className="flex gap-3 max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-[var(--bg-surface-hover)] border border-[var(--border-hover)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-black font-medium px-6 py-3 rounded-xl transition"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

/** Generate contextual example prompts based on API name */
function generateSuggestions(apiName: string): string[] {
  const name = apiName.toLowerCase();
  if (name.includes('pet') || name.includes('store')) {
    return ['Find available pets', 'Add a new pet named Buddy'];
  }
  if (name.includes('weather')) {
    return ["What's the weather in Tokyo?", 'Get forecast for New York'];
  }
  if (name.includes('spotify') || name.includes('music')) {
    return ['Search for jazz tracks', 'Find albums by Miles Davis'];
  }
  if (name.includes('gmail') || name.includes('mail')) {
    return ['Show unread emails from this week', 'Draft a follow-up email to the last sender'];
  }
  if (name.includes('calendar')) {
    return ['What meetings do I have tomorrow?', 'Create a 30-minute focus block at 4 PM'];
  }
  if (name.includes('extract') || name.includes('scrape')) {
    return ['Extract data from example.com', 'Scrape the pricing page'];
  }
  // Generic suggestions
  return [`What can ${apiName} do?`, `List all available actions`];
}
