/**
 * AgentBridge Manifest — the standard format for making an API agent-ready.
 * API owners host this as .agentbridge.json at their domain root,
 * or publish it to the AgentBridge registry.
 */
export interface AgentBridgeManifest {
  /** Schema version */
  schema_version: '1.0';

  /** API identity */
  name: string;
  description: string;
  version: string;
  logo_url?: string;
  contact_url?: string;

  /** Where to find the OpenAPI spec */
  openapi_url?: string;

  /** Auth configuration */
  auth?: ManifestAuth;

  /** Base URL for all API calls */
  base_url: string;

  /** Actions the agent can perform */
  actions: ManifestAction[];
}

export interface ManifestAuth {
  type: 'bearer' | 'api_key' | 'oauth2' | 'none';
  /** For api_key: where to put it */
  api_key_header?: string;
  /** For oauth2 */
  oauth2?: {
    authorization_url: string;
    token_url: string;
    scopes: Record<string, string>;
  };
  /** Human-readable instructions for getting credentials */
  instructions?: string;
}

export interface ManifestAction {
  /** Unique action ID, e.g. "search_tracks" */
  id: string;
  /** Human-readable description for the LLM */
  description: string;
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Path relative to base_url, supports {param} templates */
  path: string;
  /** Parameters (from path, query, headers, body) */
  parameters: ManifestParameter[];
  /** Whether this action mutates state (LLM will ask for confirmation) */
  confirm?: boolean;
}

export interface ManifestParameter {
  name: string;
  description: string;
  in: 'query' | 'path' | 'header' | 'body';
  required: boolean;
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  default?: any;
  enum?: string[];
}

/**
 * Simplified OpenAPI 3.x types (we only parse what we need)
 */
export interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info: { title: string; description?: string; version: string };
  servers?: { url: string; description?: string }[];
  host?: string;        // Swagger 2.0
  basePath?: string;    // Swagger 2.0
  schemes?: string[];   // Swagger 2.0
  paths: Record<string, PathItem>;
  components?: { schemas?: Record<string, any>; securitySchemes?: Record<string, any> };
  securityDefinitions?: Record<string, any>; // Swagger 2.0
}

export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
  parameters?: ParameterObject[];
}

export interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: ParameterObject[];
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: any }>;
  };
  security?: Record<string, string[]>[];
  tags?: string[];
}

export interface ParameterObject {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema?: { type?: string; default?: any; enum?: string[] };
  type?: string;  // Swagger 2.0
}
