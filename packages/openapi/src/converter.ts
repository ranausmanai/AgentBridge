import { parse as parseYAML } from 'yaml';
import type {
  OpenAPISpec,
  AgentBridgeManifest,
  ManifestAction,
  ManifestParameter,
  ManifestAuth,
  Operation,
  ParameterObject,
} from './types.js';

export interface ConvertOptions {
  /** Only include operations with these tags */
  includeTags?: string[];
  /** Exclude operations with these tags */
  excludeTags?: string[];
  /** Only include specific operationIds */
  includeOperations?: string[];
  /** Max number of actions to include (LLMs have tool limits) */
  maxActions?: number;
  /** Override the base URL */
  baseUrl?: string;
}

/**
 * Convert an OpenAPI spec (JSON string, YAML string, or parsed object)
 * into an AgentBridge manifest.
 */
export function convertOpenAPIToManifest(
  input: string | OpenAPISpec,
  options: ConvertOptions = {},
): AgentBridgeManifest {
  const spec: OpenAPISpec = typeof input === 'string' ? parseSpec(input) : input;

  const baseUrl = options.baseUrl ?? extractBaseUrl(spec);
  const auth = extractAuth(spec);
  const actions = extractActions(spec, options);

  return {
    schema_version: '1.0',
    name: slugify(spec.info.title),
    description: spec.info.description ?? spec.info.title,
    version: spec.info.version,
    base_url: baseUrl,
    auth,
    actions,
  };
}

function parseSpec(input: string): OpenAPISpec {
  const trimmed = input.trim();
  // Try JSON first, then YAML
  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed);
  }
  return parseYAML(trimmed) as OpenAPISpec;
}

function extractBaseUrl(spec: OpenAPISpec): string {
  // OpenAPI 3.x
  if (spec.servers && spec.servers.length > 0) {
    return spec.servers[0].url.replace(/\/$/, '');
  }
  // Swagger 2.0
  if (spec.host) {
    const scheme = spec.schemes?.[0] ?? 'https';
    const basePath = spec.basePath ?? '';
    return `${scheme}://${spec.host}${basePath}`.replace(/\/$/, '');
  }
  return '';
}

function extractAuth(spec: OpenAPISpec): ManifestAuth | undefined {
  const schemes = spec.components?.securitySchemes ?? spec.securityDefinitions;
  if (!schemes) return undefined;

  for (const [, scheme] of Object.entries(schemes) as [string, any][]) {
    if (scheme.type === 'http' && scheme.scheme === 'bearer') {
      return { type: 'bearer' };
    }
    if (scheme.type === 'apiKey') {
      return {
        type: 'api_key',
        api_key_header: scheme.name,
      };
    }
    if (scheme.type === 'oauth2') {
      const flows = scheme.flows;
      const flow = flows?.authorizationCode ?? flows?.implicit ?? flows?.clientCredentials;
      if (flow) {
        return {
          type: 'oauth2',
          oauth2: {
            authorization_url: flow.authorizationUrl ?? '',
            token_url: flow.tokenUrl ?? '',
            scopes: flow.scopes ?? {},
          },
        };
      }
    }
  }

  return undefined;
}

function extractActions(spec: OpenAPISpec, options: ConvertOptions): ManifestAction[] {
  const actions: ManifestAction[] = [];

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;

    for (const method of methods) {
      const operation = pathItem[method] as Operation | undefined;
      if (!operation) continue;

      // Filter by tags
      if (options.includeTags && operation.tags) {
        if (!operation.tags.some(t => options.includeTags!.includes(t))) continue;
      }
      if (options.excludeTags && operation.tags) {
        if (operation.tags.some(t => options.excludeTags!.includes(t))) continue;
      }

      // Filter by operationId
      if (options.includeOperations) {
        if (!operation.operationId || !options.includeOperations.includes(operation.operationId)) continue;
      }

      const actionId = operation.operationId ?? `${method}_${slugify(path)}`;
      const description = operation.summary ?? operation.description ?? `${method.toUpperCase()} ${path}`;

      // Collect parameters
      const parameters: ManifestParameter[] = [];

      // Path-level parameters
      if (pathItem.parameters) {
        for (const param of pathItem.parameters) {
          parameters.push(convertParameter(param));
        }
      }

      // Operation-level parameters
      if (operation.parameters) {
        for (const param of operation.parameters) {
          // Operation params override path-level params with same name
          const existing = parameters.findIndex(p => p.name === param.name && p.in === param.in);
          const converted = convertParameter(param);
          if (existing >= 0) {
            parameters[existing] = converted;
          } else {
            parameters.push(converted);
          }
        }
      }

      // Request body (OpenAPI 3.x)
      if (operation.requestBody) {
        const content = operation.requestBody.content;
        const jsonSchema = content?.['application/json']?.schema;
        if (jsonSchema) {
          const bodyParams = flattenBodySchema(jsonSchema, spec);
          parameters.push(...bodyParams);
        }
      }

      const isMutating = method !== 'get';

      actions.push({
        id: actionId,
        description,
        method: method.toUpperCase() as ManifestAction['method'],
        path,
        parameters,
        confirm: isMutating ? true : undefined,
      });
    }
  }

  // Respect maxActions limit
  if (options.maxActions && actions.length > options.maxActions) {
    return actions.slice(0, options.maxActions);
  }

  return actions;
}

function convertParameter(param: ParameterObject): ManifestParameter {
  return {
    name: param.name,
    description: param.description ?? param.name,
    in: param.in as ManifestParameter['in'],
    required: param.required ?? false,
    type: (param.schema?.type ?? param.type ?? 'string') as ManifestParameter['type'],
    default: param.schema?.default,
    enum: param.schema?.enum,
  };
}

/**
 * Flatten a JSON Schema body into individual parameters.
 * Only goes one level deep for simplicity.
 */
function flattenBodySchema(
  schema: any,
  spec: OpenAPISpec,
): ManifestParameter[] {
  // Resolve $ref
  if (schema.$ref) {
    const refPath = schema.$ref.replace('#/components/schemas/', '').replace('#/definitions/', '');
    schema = spec.components?.schemas?.[refPath] ?? schema;
  }

  if (schema.type !== 'object' || !schema.properties) {
    // If it's not an object, treat entire body as a single param
    return [{
      name: 'body',
      description: schema.description ?? 'Request body',
      in: 'body',
      required: true,
      type: (schema.type ?? 'object') as ManifestParameter['type'],
    }];
  }

  const params: ManifestParameter[] = [];
  const required = new Set(schema.required ?? []);

  for (const [name, prop] of Object.entries(schema.properties) as [string, any][]) {
    params.push({
      name,
      description: prop.description ?? name,
      in: 'body',
      required: required.has(name),
      type: (prop.type ?? 'string') as ManifestParameter['type'],
      default: prop.default,
      enum: prop.enum,
    });
  }

  return params;
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
