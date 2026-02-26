#!/usr/bin/env node

/**
 * AgentBridge MCP Server
 *
 * Standalone MCP server that exposes AgentBridge-registered APIs as tools.
 *
 * Usage:
 *   # From a manifest file:
 *   agentbridge-mcp --manifest ./my-api.agentbridge.json
 *
 *   # From an OpenAPI spec:
 *   agentbridge-mcp --openapi ./openapi.json
 *
 *   # From the local registry (all registered APIs):
 *   agentbridge-mcp
 *
 * Add to Claude Desktop config (~/.claude/claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "agentbridge": {
 *         "command": "npx",
 *         "args": ["@agentbridgeai/mcp", "--manifest", "./my-api.agentbridge.json"]
 *       }
 *     }
 *   }
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMCPServer } from './mcp-server.js';
import { convertOpenAPIToManifest, APIRegistry, type AgentBridgeManifest } from '@agentbridgeai/openapi';
import { readFileSync, existsSync } from 'fs';
import { parse as parseYAML } from 'yaml';

async function main() {
  const args = process.argv.slice(2);
  const manifests: AgentBridgeManifest[] = [];
  const credentials: Record<string, Record<string, string>> = {};

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--manifest' || arg === '-m') {
      const filePath = args[++i];
      if (!filePath || !existsSync(filePath)) {
        console.error(`Manifest file not found: ${filePath}`);
        process.exit(1);
      }
      const content = readFileSync(filePath, 'utf-8');
      const manifest = JSON.parse(content) as AgentBridgeManifest;
      manifests.push(manifest);
    } else if (arg === '--openapi' || arg === '-o') {
      const filePath = args[++i];
      if (!filePath || !existsSync(filePath)) {
        console.error(`OpenAPI file not found: ${filePath}`);
        process.exit(1);
      }
      const content = readFileSync(filePath, 'utf-8');
      const manifest = convertOpenAPIToManifest(content);
      manifests.push(manifest);
    } else if (arg === '--token' || arg === '-t') {
      // --token api-name:token-value
      const tokenArg = args[++i];
      if (tokenArg) {
        const [apiName, token] = tokenArg.split(':');
        if (apiName && token) {
          credentials[apiName] = { token };
        }
      }
    } else if (arg === '--help' || arg === '-h') {
      console.error(`
AgentBridge MCP Server — Expose any API as MCP tools

Usage:
  agentbridge-mcp                              # Load from local registry
  agentbridge-mcp --manifest api.json          # Load from manifest file
  agentbridge-mcp --openapi openapi.yaml       # Load from OpenAPI spec
  agentbridge-mcp --token api-name:token       # Set auth token

Add to Claude Desktop (~/.claude/claude_desktop_config.json):
  {
    "mcpServers": {
      "my-api": {
        "command": "npx",
        "args": ["@agentbridgeai/mcp", "--openapi", "./openapi.json"]
      }
    }
  }
`);
      process.exit(0);
    }

    i++;
  }

  // If no explicit manifests provided, load from local registry
  if (manifests.length === 0) {
    const registry = new APIRegistry();
    const entries = registry.list();
    for (const entry of entries) {
      const manifest = registry.getManifest(entry.name);
      if (manifest) manifests.push(manifest);
    }
  }

  if (manifests.length === 0) {
    console.error('No APIs loaded. Use --manifest, --openapi, or register APIs first.');
    console.error('Run: agentbridge-mcp --help');
    process.exit(1);
  }

  console.error(`AgentBridge MCP Server starting with ${manifests.length} API(s):`);
  for (const m of manifests) {
    console.error(`  - ${m.name} (${m.actions.length} actions)`);
  }

  const server = createMCPServer({ manifests, credentials });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
