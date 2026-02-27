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
  const manifests = new Map<string, AgentBridgeManifest>();
  const credentials: Record<string, Record<string, any>> = {};
  const localRegistry = new APIRegistry();

  const addManifest = (manifest: AgentBridgeManifest) => {
    manifests.set(manifest.name, manifest);
    const localCreds = localRegistry.getCredentials(manifest.name);
    if (localCreds && Object.keys(localCreds).length > 0) {
      credentials[manifest.name] = {
        ...localCreds,
        ...(credentials[manifest.name] || {}),
      };
    }
  };

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
      addManifest(manifest);
    } else if (arg === '--openapi' || arg === '-o') {
      const filePath = args[++i];
      if (!filePath || !existsSync(filePath)) {
        console.error(`OpenAPI file not found: ${filePath}`);
        process.exit(1);
      }
      const content = readFileSync(filePath, 'utf-8');
      const manifest = convertOpenAPIToManifest(content);
      addManifest(manifest);
    } else if (arg === '--url' || arg === '-u') {
      const url = args[++i];
      if (!url) {
        console.error('Missing URL argument for --url');
        process.exit(1);
      }
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const manifest = await res.json() as AgentBridgeManifest;
        addManifest(manifest);
      } catch (err: any) {
        console.error(`Failed to fetch manifest from ${url}: ${err.message}`);
        process.exit(1);
      }
    } else if (arg === '--api' || arg === '-a') {
      const apiName = args[++i];
      if (!apiName) {
        console.error('Missing API name argument for --api');
        process.exit(1);
      }
      const localManifest = localRegistry.getManifest(apiName);
      if (localManifest) {
        addManifest(localManifest);
      } else {
        const registryUrl = process.env.AGENTBRIDGE_REGISTRY || 'https://agentbridge.cc';
        try {
          const res = await fetch(`${registryUrl}/api/${apiName}/manifest`);
          if (!res.ok) throw new Error(`API "${apiName}" not found (HTTP ${res.status})`);
          const manifest = await res.json() as AgentBridgeManifest;
          addManifest(manifest);
        } catch (err: any) {
          console.error(`Failed to fetch "${apiName}" from registry: ${err.message}`);
          process.exit(1);
        }
      }
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
  agentbridge-mcp --api extractly-api          # Load from agentbridge.cc by name
  agentbridge-mcp --url https://example.com/m  # Load manifest from any URL
  agentbridge-mcp --manifest api.json          # Load from local manifest file
  agentbridge-mcp --openapi openapi.yaml       # Load from local OpenAPI spec
  agentbridge-mcp --token api-name:token       # Set auth token
  agentbridge-mcp                              # Load from local registry

Claude Desktop (~/.claude/claude_desktop_config.json):
  {
    "mcpServers": {
      "extractly": {
        "command": "npx",
        "args": ["@agentbridgeai/mcp", "--api", "extractly-api"]
      }
    }
  }
`);
      process.exit(0);
    }

    i++;
  }

  // If no explicit manifests provided, load from local registry
  if (manifests.size === 0) {
    const entries = localRegistry.list();
    for (const entry of entries) {
      const manifest = localRegistry.getManifest(entry.name);
      if (manifest) addManifest(manifest);
    }
  }

  const manifestList = Array.from(manifests.values());

  if (manifestList.length === 0) {
    console.error('No APIs loaded. Use --manifest, --openapi, or register APIs first.');
    console.error('Run: agentbridge-mcp --help');
    process.exit(1);
  }

  console.error(`AgentBridge MCP Server starting with ${manifestList.length} API(s):`);
  for (const m of manifestList) {
    console.error(`  - ${m.name} (${m.actions.length} actions)`);
  }

  const server = createMCPServer({ manifests: manifestList, credentials });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
