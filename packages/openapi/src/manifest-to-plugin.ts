import { z } from 'zod';
import type { Plugin, Action, ActionResult } from '@agentbridgeai/core';
import type { AgentBridgeManifest, ManifestAction, ManifestParameter } from './types.js';

export interface PluginFromManifestOptions {
  /** Auth credentials to inject into requests */
  credentials?: Record<string, any>;
  /** Custom fetch function (for testing or proxying) */
  fetchFn?: typeof fetch;
}

/**
 * Convert an AgentBridge manifest into a live, callable Plugin.
 * This is the magic — any manifest becomes an agent-usable plugin at runtime.
 */
export function manifestToPlugin(
  manifest: AgentBridgeManifest,
  options: PluginFromManifestOptions = {},
): Plugin {
  const fetchFn = options.fetchFn ?? globalThis.fetch;

  const actions: Action[] = manifest.actions.map(action =>
    createAction(action, manifest, fetchFn, options.credentials),
  );

  return {
    name: manifest.name,
    description: manifest.description,
    version: manifest.version,
    actions,
  };
}

function createAction(
  action: ManifestAction,
  manifest: AgentBridgeManifest,
  fetchFn: typeof fetch,
  credentials?: Record<string, any>,
): Action {
  const parametersSchema = buildZodSchema(action.parameters);

  return {
    name: action.id,
    description: action.description,
    parameters: parametersSchema,
    confirm: action.confirm,
    execute: async (params): Promise<ActionResult> => {
      try {
        // Build the URL
        let url = `${manifest.base_url}${action.path}`;
        const queryParams: Record<string, string> = {};
        const bodyParams: Record<string, any> = {};
        const resolvedParams: Record<string, any> = { ...(params ?? {}) };
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        };

        // Inject auth
        if (credentials) {
          if (manifest.auth?.type === 'bearer' && credentials.token) {
            headers['Authorization'] = `Bearer ${credentials.token}`;
          } else if (manifest.auth?.type === 'api_key' && manifest.auth.api_key_header) {
            const key = credentials.api_key ?? credentials.token ?? '';
            headers[manifest.auth.api_key_header] = key;
          } else if (manifest.auth?.type === 'oauth2') {
            const oauth = (credentials.oauth && typeof credentials.oauth === 'object')
              ? credentials.oauth as Record<string, string>
              : {};
            const accessToken = credentials.access_token ?? oauth.access_token ?? credentials.token;
            if (accessToken) {
              headers['Authorization'] = `Bearer ${accessToken}`;
            }
          }
        }

        // Spotify convenience: if user_id path param is missing/placeholder for create playlist,
        // resolve current user id via /me so the model does not need to guess it.
        if (
          manifest.name === 'spotify' &&
          action.id === 'create_playlist' &&
          action.path.includes('{user_id}')
        ) {
          const rawUserId = String(resolvedParams.user_id ?? '').trim();
          const placeholderLike = !rawUserId
            || rawUserId === 'user_id'
            || rawUserId === 'current_user'
            || rawUserId.startsWith('<');
          if (placeholderLike) {
            const meRes = await fetchFn(`${manifest.base_url}/me`, {
              method: 'GET',
              headers: {
                Accept: 'application/json',
                ...(headers['Authorization'] ? { Authorization: headers['Authorization'] } : {}),
              },
            });
            const meText = await meRes.text();
            let meJson: any = null;
            try {
              meJson = meText ? JSON.parse(meText) : null;
            } catch {
              meJson = null;
            }
            if (!meRes.ok || !meJson?.id) {
              return {
                success: false,
                message: `Unable to resolve Spotify user_id automatically: ${typeof meJson === 'string' ? meJson : JSON.stringify(meJson ?? { status: meRes.status }).slice(0, 200)}`,
                data: meJson ?? meText,
              };
            }
            resolvedParams.user_id = meJson.id;
          }
        }

        // Distribute params to path, query, header, body
        for (const paramDef of action.parameters) {
          const value = resolvedParams[paramDef.name];
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

        // Append query string
        const qs = new URLSearchParams(queryParams).toString();
        if (qs) url += `?${qs}`;

        // Make the request
        const fetchOptions: RequestInit = {
          method: action.method,
          headers,
        };

        if (['POST', 'PUT', 'PATCH'].includes(action.method) && Object.keys(bodyParams).length > 0) {
          fetchOptions.body = JSON.stringify(bodyParams);
        }

        const response = await fetchFn(url, fetchOptions);
        const responseText = await response.text();

        let data: any;
        try {
          data = JSON.parse(responseText);
        } catch {
          data = responseText;
        }

        if (!response.ok) {
          return {
            success: false,
            message: `API returned ${response.status}: ${typeof data === 'string' ? data : JSON.stringify(data).slice(0, 200)}`,
            data,
          };
        }

        // Summarize the response for the LLM
        const summary = summarizeResponse(data, action.id);

        return {
          success: true,
          message: summary,
          data,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Request failed: ${error.message}`,
        };
      }
    },
  };
}

function buildZodSchema(parameters: ManifestParameter[]): z.ZodType<any> {
  if (parameters.length === 0) {
    return z.object({});
  }

  const shape: Record<string, z.ZodTypeAny> = {};

  for (const param of parameters) {
    let field: z.ZodTypeAny;

    switch (param.type) {
      case 'number':
      case 'integer':
        field = z.number();
        break;
      case 'boolean':
        field = z.boolean();
        break;
      case 'array':
        field = z.array(z.any());
        break;
      case 'object':
        field = z.record(z.any());
        break;
      default:
        if (param.enum) {
          field = z.enum(param.enum as [string, ...string[]]);
        } else {
          field = z.string();
        }
    }

    field = field.describe(param.description);

    if (param.default !== undefined) {
      field = field.default(param.default);
    }

    if (!param.required) {
      field = field.optional();
    }

    shape[param.name] = field;
  }

  return z.object(shape);
}

/**
 * Create a human-readable summary of an API response.
 * Keeps it concise so LLMs can process it efficiently.
 */
function summarizeResponse(data: any, actionId: string): string {
  if (typeof data === 'string') return data.slice(0, 500);

  // If it's an array, summarize count + first few items
  if (Array.isArray(data)) {
    const preview = data.slice(0, 3).map(item =>
      typeof item === 'object' ? JSON.stringify(item).slice(0, 100) : String(item)
    ).join(', ');
    return `${actionId} returned ${data.length} results: ${preview}${data.length > 3 ? '...' : ''}`;
  }

  // If it has common result patterns, extract them
  if (data.items && Array.isArray(data.items)) {
    const count = data.total ?? data.items.length;
    const preview = data.items.slice(0, 3).map((item: any) =>
      item.name ?? item.title ?? JSON.stringify(item).slice(0, 80)
    ).join(', ');
    return `Found ${count} results: ${preview}${data.items.length > 3 ? '...' : ''}`;
  }

  // Generic: stringify with truncation
  const json = JSON.stringify(data);
  if (json.length > 500) {
    return json.slice(0, 500) + '... (truncated)';
  }
  return json;
}
