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
          <h1 className="text-3xl font-bold text-white mb-2">{api.name}</h1>
          <p className="text-gray-400">{api.description}</p>
          <div className="flex gap-4 mt-3 text-sm text-gray-500">
            <span>v{api.version}</span>
            <span>Base: {api.base_url}</span>
            <span>Auth: {api.auth_type}</span>
          </div>
        </div>
        <a
          href={`/chat`}
          className="bg-cyan-500 hover:bg-cyan-400 text-black font-medium px-5 py-2.5 rounded-lg transition shrink-0"
        >
          Chat with this API
        </a>
      </div>

      {/* Quick use */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Use this API</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-cyan-400 font-medium mb-1">Web</p>
            <a href="/chat" className="text-gray-400 hover:text-white text-xs">Chat in the browser &rarr;</a>
          </div>
          <div>
            <p className="text-cyan-400 font-medium mb-1">CLI (one command)</p>
            <code className="text-gray-400 text-xs">agentbridge chat {api.name}</code>
          </div>
          <div>
            <p className="text-cyan-400 font-medium mb-1">SDK / Agents</p>
            <code className="text-gray-400 text-xs break-all">fetch(&quot;/api/{api.name}/manifest&quot;)</code>
          </div>
        </div>
      </div>

      {/* Actions */}
      <h2 className="text-xl font-semibold mb-4">Actions ({actions.length})</h2>
      <div className="space-y-3">
        {manifest.actions.map((action: any) => (
          <div
            key={action.id}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${
                action.method === 'GET' ? 'bg-green-900/50 text-green-400' :
                action.method === 'POST' ? 'bg-blue-900/50 text-blue-400' :
                action.method === 'PUT' ? 'bg-yellow-900/50 text-yellow-400' :
                action.method === 'DELETE' ? 'bg-red-900/50 text-red-400' :
                'bg-gray-800 text-gray-400'
              }`}>
                {action.method}
              </span>
              <code className="text-sm text-gray-300">{action.path}</code>
            </div>
            <h3 className="font-medium text-white mb-1">{action.id}</h3>
            <p className="text-gray-400 text-sm mb-3">{action.description}</p>

            {action.parameters && action.parameters.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Parameters</p>
                <div className="space-y-1">
                  {action.parameters.map((param: any, idx: number) => (
                    <div key={`${param.name}-${param.in || idx}`} className="flex items-center gap-2 text-sm">
                      <code className="text-cyan-400">{param.name}</code>
                      <span className="text-gray-600">{param.type}</span>
                      {param.required && (
                        <span className="text-xs bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded">required</span>
                      )}
                      <span className="text-gray-500 text-xs">{param.description}</span>
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
          <pre className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto text-xs text-gray-400 max-h-96">
            {api.openapi_spec}
          </pre>
        </div>
      )}
    </div>
  );
}
