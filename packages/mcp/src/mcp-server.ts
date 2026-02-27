import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { AgentBridgeManifest, ManifestAction } from '@agentbridgeai/openapi';
import { manifestToMCPTools } from './manifest-to-mcp.js';

export interface MCPServerOptions {
  manifests: AgentBridgeManifest[];
  credentials?: Record<string, Record<string, any>>;
}

/**
 * Create an MCP server from AgentBridge manifests.
 * Any AI agent that supports MCP (Claude, Cursor, Windsurf, etc.)
 * can instantly use all registered APIs.
 */
export function createMCPServer(options: MCPServerOptions) {
  const { manifests, credentials = {} } = options;

  const server = new McpServer({
    name: 'agentbridge',
    version: '0.1.4',
  });

  // Register all manifest actions as MCP tools
  for (const manifest of manifests) {
    for (const action of manifest.actions) {
      const toolName = `${manifest.name}__${action.id}`;

      // Build parameter shape for the tool
      const paramShape: Record<string, any> = {};
      for (const param of action.parameters) {
        const schemaType = param.type === 'integer' ? 'number' : param.type;
        const schema: Record<string, any> = {
          type: schemaType === 'object' ? 'object' : schemaType === 'array' ? 'array' : schemaType === 'boolean' ? 'boolean' : schemaType === 'number' ? 'number' : 'string',
          description: param.description,
        };
        if (schema.type === 'array') {
          schema.items = { type: 'string' };
        }
        if (schema.type === 'object') {
          schema.additionalProperties = true;
        }
        paramShape[param.name] = {
          ...schema,
        };
      }

      server.tool(
        toolName,
        `[${manifest.name}] ${action.description}`,
        paramShape,
        async (params: Record<string, any>) => {
          const result = await executeAction(manifest, action, params, credentials[manifest.name]);
          return {
            content: [{ type: 'text' as const, text: result }],
          };
        },
      );
    }
  }

  // Register manifests as resources so agents can read API docs
  for (const manifest of manifests) {
    server.resource(
      `api-${manifest.name}`,
      `agentbridge://apis/${manifest.name}`,
      async (uri) => ({
        contents: [{
          uri: uri.href,
          text: JSON.stringify(manifest, null, 2),
          mimeType: 'application/json',
        }],
      }),
    );
  }

  return server;
}

/**
 * Execute an API action by making the actual HTTP request.
 */
async function executeAction(
  manifest: AgentBridgeManifest,
  action: ManifestAction,
  params: Record<string, any>,
  creds?: Record<string, any>,
): Promise<string> {
  try {
    let url = `${manifest.base_url}${action.path}`;
    const queryParams: Record<string, string> = {};
    const bodyParams: Record<string, any> = {};
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Inject auth
    if (creds) {
      if (manifest.auth?.type === 'bearer' && creds.token) {
        headers['Authorization'] = `Bearer ${creds.token}`;
      } else if (manifest.auth?.type === 'api_key' && manifest.auth.api_key_header) {
        headers[manifest.auth.api_key_header] = creds.api_key ?? creds.token ?? '';
      } else if (manifest.auth?.type === 'oauth2') {
        const oauth = (creds.oauth && typeof creds.oauth === 'object')
          ? creds.oauth as Record<string, string>
          : {};
        const accessToken = creds.access_token ?? oauth.access_token ?? creds.token;
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }
      }
    }

    // Distribute params
    for (const paramDef of action.parameters) {
      const value = params[paramDef.name];
      if (value === undefined) continue;

      switch (paramDef.in) {
        case 'path':
          url = url.replace(`{${paramDef.name}}`, encodeURIComponent(String(value)));
          break;
        case 'query':
          queryParams[paramDef.name] = String(value);
          break;
        case 'header':
          headers[paramDef.name] = String(value);
          break;
        case 'body':
          bodyParams[paramDef.name] = value;
          break;
      }
    }

    const qs = new URLSearchParams(queryParams).toString();
    if (qs) url += `?${qs}`;

    const fetchOptions: RequestInit = { method: action.method, headers };
    if (['POST', 'PUT', 'PATCH'].includes(action.method) && Object.keys(bodyParams).length > 0) {
      fetchOptions.body = JSON.stringify(bodyParams);
    }

    const response = await fetch(url, fetchOptions);
    const text = await response.text();

    if (!response.ok) {
      return `API error ${response.status}: ${text.slice(0, 500)}`;
    }

    // Try to parse and summarize
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data)) {
        return `Returned ${data.length} results: ${JSON.stringify(data.slice(0, 3)).slice(0, 500)}`;
      }
      if (data.items && Array.isArray(data.items)) {
        return `Found ${data.total ?? data.items.length} results: ${JSON.stringify(data.items.slice(0, 3)).slice(0, 500)}`;
      }
      return JSON.stringify(data).slice(0, 1000);
    } catch {
      return text.slice(0, 1000);
    }
  } catch (error: any) {
    return `Request failed: ${error.message}`;
  }
}
