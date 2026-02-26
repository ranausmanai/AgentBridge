import { getAllPublicApis, getApiActions } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const apis = getAllPublicApis();
  const apisWithActions = apis.map(api => ({
    ...api,
    actions: getApiActions(api.id),
  }));

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Hero */}
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold mb-4">
          Make Any API <span className="text-[var(--accent)]">Agent-Ready</span>
        </h1>
        <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto mb-8">
          Register your API&apos;s OpenAPI spec, and any AI agent in the world can interact with it
          using natural language. Bring your own LLM key.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/register"
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black font-semibold px-6 py-3 rounded-lg transition"
          >
            Register Your API
          </a>
          <a
            href="/chat"
            className="border border-[var(--border-hover)] hover:border-[var(--text-muted)] text-[var(--text-primary)] px-6 py-3 rounded-lg transition"
          >
            Start Chatting
          </a>
        </div>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6">
          <div className="w-10 h-10 bg-[var(--accent-soft)] text-[var(--accent)] rounded-lg flex items-center justify-center font-bold text-lg mb-4">1</div>
          <h3 className="text-lg font-semibold mb-2">Paste your OpenAPI spec</h3>
          <p className="text-[var(--text-secondary)] text-sm">
            JSON, YAML, drag &amp; drop, or enter a URL. We parse everything automatically.
          </p>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6">
          <div className="w-10 h-10 bg-[var(--accent-soft)] text-[var(--accent)] rounded-lg flex items-center justify-center font-bold text-lg mb-4">2</div>
          <h3 className="text-lg font-semibold mb-2">API becomes agent-ready</h3>
          <p className="text-[var(--text-secondary)] text-sm">
            We convert your endpoints into tools any LLM can call — via web, CLI, or SDK.
          </p>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6">
          <div className="w-10 h-10 bg-[var(--accent-soft)] text-[var(--accent)] rounded-lg flex items-center justify-center font-bold text-lg mb-4">3</div>
          <h3 className="text-lg font-semibold mb-2">Anyone can chat with it</h3>
          <p className="text-[var(--text-secondary)] text-sm">
            Users bring their own LLM key and talk to your API naturally. No coding needed.
          </p>
        </div>
      </div>

      {/* Use it everywhere */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 mb-16">
        <h3 className="text-lg font-semibold mb-4">Use registered APIs everywhere</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-[var(--accent)] font-medium mb-1">Web</p>
            <p className="text-[var(--text-secondary)]">Chat in the browser at /chat — zero install.</p>
          </div>
          <div>
            <p className="text-[var(--accent)] font-medium mb-1">CLI</p>
            <code className="text-[var(--text-secondary)] text-xs">agentbridge search &lt;query&gt;</code>
          </div>
          <div>
            <p className="text-[var(--accent)] font-medium mb-1">SDK / Agents</p>
            <code className="text-[var(--text-secondary)] text-xs">fetch(&quot;/api/&lt;name&gt;/manifest&quot;)</code>
          </div>
        </div>
      </div>

      {/* API Grid */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-6">
          Registered APIs {apisWithActions.length > 0 && (
            <span className="text-[var(--text-muted)] text-lg font-normal">({apisWithActions.length})</span>
          )}
        </h2>

        {apisWithActions.length === 0 ? (
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-12 text-center">
            <p className="text-[var(--text-secondary)] mb-4">No APIs registered yet. Be the first!</p>
            <a href="/register" className="text-[var(--accent)] hover:text-[var(--accent-hover)]">
              Register an API &rarr;
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {apisWithActions.map(api => (
              <div
                key={api.id}
                className="bg-[var(--bg-surface)] border border-[var(--border)] hover:border-[var(--accent)]/50 rounded-xl p-6 transition group"
              >
                <a href={`/api/${api.name}`}>
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition">
                      {api.name}
                    </h3>
                    <span className="text-xs bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] px-2 py-1 rounded">
                      v{api.version}
                    </span>
                  </div>
                  <p className="text-[var(--text-secondary)] text-sm mb-3 line-clamp-2">
                    {api.description}
                  </p>
                </a>

                {/* Show first 3 actions */}
                <div className="mb-3 space-y-1">
                  {api.actions.slice(0, 3).map((action: any) => (
                    <p key={action.action_id} className="text-xs text-[var(--text-muted)] truncate">
                      <span className="text-[var(--text-muted)] font-mono">{action.method}</span> {action.action_id}
                    </p>
                  ))}
                  {api.actions.length > 3 && (
                    <p className="text-xs text-[var(--text-muted)]">+{api.actions.length - 3} more</p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                    <span>{api.actions.length} actions</span>
                    {api.auth_type && api.auth_type !== 'none' && (
                      <span className="bg-[var(--warning-bg)] text-[var(--warning-text)] px-1.5 py-0.5 rounded">{api.auth_type}</span>
                    )}
                  </div>
                  <a
                    href="/chat"
                    className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] opacity-0 group-hover:opacity-100 transition"
                  >
                    Chat &rarr;
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
