import type { AgentBridgeManifest, ManifestAction, ManifestParameter } from '@agentbridgeai/openapi';

/**
 * Convert AgentBridge manifest actions into MCP tool definitions.
 * Each action becomes a callable MCP tool.
 */
export function manifestToMCPTools(manifest: AgentBridgeManifest) {
  return manifest.actions.map(action => ({
    name: `${manifest.name}__${action.id}`,
    description: `[${manifest.name}] ${action.description}`,
    inputSchema: actionToJsonSchema(action),
  }));
}

function actionToJsonSchema(action: ManifestAction) {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const param of action.parameters) {
    properties[param.name] = paramToJsonSchema(param);
    if (param.required) required.push(param.name);
  }

  return {
    type: 'object' as const,
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

function paramToJsonSchema(param: ManifestParameter) {
  const schema: Record<string, any> = {
    type: param.type === 'integer' ? 'integer' : param.type,
    description: param.description,
  };
  if (param.enum) schema.enum = param.enum;
  if (param.default !== undefined) schema.default = param.default;
  return schema;
}
