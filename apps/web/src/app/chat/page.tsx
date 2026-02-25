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
}

const LLM_PROVIDERS = [
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
  const [configured, setConfigured] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/apis').then(r => r.json()).then((data) => {
      setApis(data);
      // Auto-select all APIs if 3 or fewer
      if (data.length > 0 && data.length <= 3) {
        setSelectedApis(new Set(data.map((a: ApiInfo) => a.name)));
      }
    });
    const savedKey = localStorage.getItem('agentbridge_llm_key');
    const savedProvider = localStorage.getItem('agentbridge_llm_provider');
    if (savedKey) setApiKey(savedKey);
    if (savedProvider) setProvider(savedProvider);
    const savedCreds = localStorage.getItem('agentbridge_api_creds');
    if (savedCreds) try { setApiCredentials(JSON.parse(savedCreds)); } catch {}
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function toggleApi(name: string) {
    setSelectedApis(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function handleConfigure() {
    if (!apiKey.trim()) return;
    localStorage.setItem('agentbridge_llm_key', apiKey);
    localStorage.setItem('agentbridge_llm_provider', provider);
    if (Object.keys(apiCredentials).length > 0) {
      localStorage.setItem('agentbridge_api_creds', JSON.stringify(apiCredentials));
    }
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
          apiCredentials: Object.fromEntries(
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
        <p className="text-gray-400 mb-8">
          Talk to any registered API using natural language. Bring your own LLM key — we never store it.
        </p>

        {/* Step 1: LLM Provider + Key (combined) */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">
            <span className="bg-cyan-500/20 text-cyan-400 text-xs px-2 py-0.5 rounded mr-2">1</span>
            LLM Provider &amp; Key
          </label>
          <div className="flex gap-2 mb-3">
            {LLM_PROVIDERS.map(p => (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                className={`px-4 py-2 rounded-lg text-sm transition ${
                  provider === p.id ? 'bg-cyan-500 text-black font-medium' : 'bg-gray-800 text-gray-400 hover:text-white'
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
            className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-gray-300 placeholder-gray-600 focus:border-cyan-500 focus:outline-none"
          />
          <p className="text-xs text-gray-600 mt-1">
            {currentProvider?.hint} — stored in your browser only.
          </p>
        </div>

        {/* Step 2: Select APIs */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">
            <span className="bg-cyan-500/20 text-cyan-400 text-xs px-2 py-0.5 rounded mr-2">2</span>
            Select APIs to chat with
          </label>
          {apis.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
              <p className="text-gray-500 text-sm mb-2">No APIs registered yet.</p>
              <a href="/register" className="text-cyan-400 hover:text-cyan-300 text-sm">
                Register your first API &rarr;
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              {apis.map(api => (
                <label
                  key={api.name}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    selectedApis.has(api.name) ? 'border-cyan-500 bg-cyan-500/10' : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedApis.has(api.name)}
                    onChange={() => toggleApi(api.name)}
                    className="accent-cyan-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{api.name}</span>
                      <span className="text-gray-500 text-xs">{api.action_count} actions</span>
                      {api.auth_type && api.auth_type !== 'none' && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">{api.auth_type}</span>
                      )}
                    </div>
                    <p className="text-gray-400 text-xs mt-0.5">{api.description}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Step 3: API credentials (only if needed) */}
        {apisNeedingAuth.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">
              <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded mr-2">3</span>
              API Credentials
            </label>
            <p className="text-xs text-gray-500 mb-3">
              These APIs require authentication to make real calls.
            </p>
            <div className="space-y-3">
              {apisNeedingAuth.map(api => (
                <div key={api.name} className="bg-gray-900 border border-gray-700 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-white text-sm font-medium">{api.name}</span>
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                      {api.auth_type}
                    </span>
                  </div>
                  <input
                    type="password"
                    value={apiCredentials[api.name] || ''}
                    onChange={e => setApiCredentials(prev => ({ ...prev, [api.name]: e.target.value }))}
                    placeholder={api.auth_type === 'bearer' ? 'Bearer token...' : 'API key...'}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2 text-gray-300 text-sm placeholder-gray-600 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleConfigure}
          disabled={!apiKey.trim() || selectedApis.size === 0}
          className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-semibold px-8 py-3 rounded-lg transition w-full"
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
      <div className="border-b border-gray-800 px-6 py-3 flex items-center justify-between bg-gray-900/50">
        <div className="text-sm text-gray-400">
          Chatting with: {selectedApiNames.map(name => (
            <span key={name} className="inline-block bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded text-xs ml-1">
              {name}
            </span>
          ))}
        </div>
        <button
          onClick={() => { setConfigured(false); setMessages([]); setSessionId(undefined); }}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          Change settings
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-16">
            <p className="text-lg mb-4">What would you like to do?</p>
            <p className="text-sm mb-6 text-gray-600">
              You&apos;re connected to {selectedApiNames.join(', ')}. Try one of these:
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
              {selectedApiNames.map(name => {
                const suggestions = generateSuggestions(name);
                return suggestions.map((s, i) => (
                  <button
                    key={`${name}-${i}`}
                    onClick={() => sendMessage(s)}
                    className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-cyan-500/50 text-gray-300 text-sm px-4 py-2 rounded-lg transition"
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
                ? 'bg-cyan-500 text-black'
                : 'bg-gray-800 text-gray-200'
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-700/50">
                  {msg.toolCalls.map((tc, j) => (
                    <p key={j} className="text-xs text-gray-400 font-mono">
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
            <div className="bg-gray-800 rounded-2xl px-4 py-3 text-gray-400">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-gray-800 px-6 py-4 bg-gray-900/50">
        <div className="flex gap-3 max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-700 text-black font-medium px-6 py-3 rounded-xl transition"
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
  if (name.includes('extract') || name.includes('scrape')) {
    return ['Extract data from example.com', 'Scrape the pricing page'];
  }
  // Generic suggestions
  return [`What can ${apiName} do?`, `List all available actions`];
}
