import { getApiByName, getApiActions } from '@/lib/db';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ApiDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const api = getApiByName(name);
  if (!api) notFound();

  const actions = getApiActions(api.id);
  const manifest = JSON.parse(api.manifest);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">{api.name}</h1>
          <p className="text-[var(--text-secondary)]">{api.description}</p>
          <div className="flex gap-4 mt-3 text-sm text-[var(--text-muted)]">
            <span>v{api.version}</span>
            <span>Base: {api.base_url}</span>
            <span>Auth: {api.auth_type}</span>
          </div>
        </div>
        <a
          href={`/chat`}
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black font-medium px-5 py-2.5 rounded-lg transition shrink-0"
        >
          Chat with this API
        </a>
      </div>

      {/* Quick use */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 mb-8">
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-3">Use this API</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-[var(--accent)] font-medium mb-1">Web</p>
            <a href="/chat" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs">Chat in the browser &rarr;</a>
          </div>
          <div>
            <p className="text-[var(--accent)] font-medium mb-1">CLI (one command)</p>
            <code className="text-[var(--text-secondary)] text-xs">agentbridge chat {api.name}</code>
          </div>
          <div>
            <p className="text-[var(--accent)] font-medium mb-1">SDK / Agents</p>
            <code className="text-[var(--text-secondary)] text-xs break-all">fetch(&quot;/api/{api.name}/manifest&quot;)</code>
          </div>
        </div>
      </div>

      {/* MCP instructions */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 mb-8">
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-3">MCP (Claude Desktop / Cursor / Windsurf)</p>
        <pre className="bg-[var(--bg-inset)] border border-[var(--border)] rounded-lg p-3 text-xs text-[var(--text-secondary)] overflow-x-auto mb-2">{`{
  "mcpServers": {
    "${api.name}": {
      "command": "npx",
      "args": ["@agentbridgeai/mcp", "--api", "${api.name}"]
    }
  }
}`}</pre>
        <p className="text-xs text-[var(--text-muted)]">
          Add to <code className="text-[var(--text-secondary)]">~/.claude/claude_desktop_config.json</code> or Cursor/Windsurf MCP settings.
        </p>
      </div>

      {/* Actions */}
      <h2 className="text-xl font-semibold mb-4">Actions ({actions.length})</h2>
      <div className="space-y-3">
        {manifest.actions.map((action: any) => (
          <div
            key={action.id}
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${
                action.method === 'GET' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                action.method === 'POST' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                action.method === 'PUT' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' :
                action.method === 'DELETE' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                'bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]'
              }`}>
                {action.method}
              </span>
              <code className="text-sm text-[var(--text-secondary)]">{action.path}</code>
            </div>
            <h3 className="font-medium text-[var(--text-primary)] mb-1">{action.id}</h3>
            <p className="text-[var(--text-secondary)] text-sm mb-3">{action.description}</p>

            {action.parameters && action.parameters.length > 0 && (
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-2 uppercase tracking-wide">Parameters</p>
                <div className="space-y-1">
                  {action.parameters.map((param: any, idx: number) => (
                    <div key={`${param.name}-${param.in || idx}`} className="flex items-center gap-2 text-sm">
                      <code className="text-[var(--accent)]">{param.name}</code>
                      <span className="text-[var(--text-muted)]">{param.type}</span>
                      {param.required && (
                        <span className="text-xs bg-[var(--error-bg)] text-[var(--error-text)] px-1.5 py-0.5 rounded">required</span>
                      )}
                      <span className="text-[var(--text-muted)] text-xs">{param.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Raw spec */}
      {api.openapi_spec && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold mb-4">Original OpenAPI Spec</h2>
          <pre className="bg-[var(--bg-inset)] border border-[var(--border)] rounded-xl p-4 overflow-x-auto text-xs text-[var(--text-secondary)] max-h-96">
            {api.openapi_spec}
          </pre>
        </div>
      )}
    </div>
  );
}
