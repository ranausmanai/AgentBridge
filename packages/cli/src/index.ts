#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { AgentBridgeEngine } from '@agentbridgeai/core';
import { ClaudeProvider, OpenAIProvider } from '@agentbridgeai/llm';
import {
  APIRegistry,
  convertOpenAPIToManifest,
  discoverFromDomain,
  type AgentBridgeManifest,
} from '@agentbridgeai/openapi';
import { startRepl } from './repl.js';
import { runInit } from './commands.js';
import { CLI_VERSION } from './version.js';
import { existsSync, readFileSync } from 'fs';
import { createServer } from 'http';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { spawn } from 'child_process';
import Conf from 'conf';
import { join } from 'path';
import { homedir } from 'os';

const REGISTRY_URL = process.env.AGENTBRIDGE_REGISTRY || 'https://agentbridge.cc';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
const GEMINI_DEFAULT_MODEL = 'gemini-2.0-flash';
const CLI_AUTH_PATH = '/api/cli-auth/start';
const config = new Conf<{ registryToken?: string; registryUrl?: string }>({ projectName: 'agentbridge' });
const LOCAL_REGISTRY_FILE = join(homedir(), '.agentbridge', 'registry.json');
const DEFAULT_MCP_CLIENTS = ['claude', 'codex', 'cursor', 'windsurf'] as const;
type McpClient = (typeof DEFAULT_MCP_CLIENTS)[number];

const program = new Command();

function parseMaybeJson(text: string): any | null {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function isLikelyHtml(text: string): boolean {
  const v = text.trimStart().toLowerCase();
  return v.startsWith('<!doctype html') || v.startsWith('<html');
}

function isExitSignal(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === '/exit' || v === 'exit' || v === 'quit';
}

function parseMcpClients(input: string): McpClient[] {
  const normalized = (input || 'all').trim().toLowerCase();
  if (!normalized || normalized === 'all') return [...DEFAULT_MCP_CLIENTS];

  const parts = normalized.split(',').map(s => s.trim()).filter(Boolean);
  const clients: McpClient[] = [];
  for (const part of parts) {
    if ((DEFAULT_MCP_CLIENTS as readonly string[]).includes(part) && !clients.includes(part as McpClient)) {
      clients.push(part as McpClient);
    }
  }
  return clients;
}

function buildMcpSnippet(apiName: string): string {
  return JSON.stringify({
    mcpServers: {
      [apiName]: {
        command: 'npx',
        args: ['@agentbridgeai/mcp', '--api', apiName],
      },
    },
  }, null, 2);
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

program
  .name('agentbridge')
  .description('Make any API agent-ready — interact with any service using natural language')
  .version(CLI_VERSION);

// ---- Main chat command (default) ----
// Supports: `agentbridge chat` (all installed APIs)
//           `agentbridge chat spotify` (search + auto-install + chat)
program
  .command('chat [api]', { isDefault: true })
  .description('Start chatting — optionally specify an API name to auto-install from the directory')
  .option('--token <token>', 'API auth token for the target API')
  .action(async (apiName?: string, opts?: any) => {
    const llm = await createLLMProvider();
    const registry = new APIRegistry();

    // If user specified an API name, try to find and install it
    if (apiName) {
      const existing = registry.getManifest(apiName);
      if (!existing) {
        // Search the directory and auto-install
        console.log(chalk.gray(`  Searching for "${apiName}"...`));
        try {
          const res = await fetch(`${REGISTRY_URL}/api/discover?q=${encodeURIComponent(apiName)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.apis && data.apis.length > 0) {
              const match = data.apis[0];
              const manifestUrl = `${REGISTRY_URL}/api/${match.name}/manifest`;
              const manifest = await registry.addFromURL(manifestUrl);
              console.log(chalk.green(`  Installed "${manifest.name}" (${manifest.actions.length} actions)`));

              // Set auth if provided
              if (opts?.token && manifest.auth) {
                registry.setCredentials(manifest.name, { token: opts.token, api_key: opts.token });
                console.log(chalk.green(`  Auth configured for "${manifest.name}"`));
              } else if (manifest.auth) {
                console.log(chalk.yellow(`  This API requires auth (${manifest.auth.type}).`));
                if (manifest.auth.type === 'oauth2') {
                  console.log(chalk.gray(`  Run: agentbridge connect ${manifest.name}`));
                } else {
                  console.log(chalk.gray(`  Run: agentbridge auth ${manifest.name} --token YOUR_TOKEN`));
                  console.log(chalk.gray(`  Or: agentbridge chat ${manifest.name} --token YOUR_TOKEN`));
                }
              }
            } else {
              console.log(chalk.yellow(`  No API found for "${apiName}" — chatting with installed APIs only.`));
            }
          }
        } catch {
          console.log(chalk.gray(`  Could not reach directory — chatting with installed APIs only.`));
        }
      }
    }

    // Load all plugins
    const registryPlugins = registry.toPlugins();
    const allPlugins = [...registryPlugins];

    if (allPlugins.length === 0) {
      console.log(chalk.gray('\n  No APIs installed yet.'));
      console.log(chalk.gray('  Install an API: agentbridge chat <api-name>'));
      console.log(chalk.gray('  Or browse: agentbridge search <query>\n'));
    }

    const engine = new AgentBridgeEngine({
      llmProvider: llm,
      plugins: allPlugins,
      maxToolsPerTurn: Math.max(1, Number(process.env.AGENTBRIDGE_MAX_TOOLS || '8')),
    });

    await startRepl(engine);
  });

// ---- Add an API from manifest URL ----
program
  .command('add <url>')
  .description('Add an API from a manifest URL')
  .action(async (url: string) => {
    const registry = new APIRegistry();
    try {
      const manifest = await registry.addFromURL(url);
      console.log(chalk.green(`Added "${manifest.name}" (${manifest.actions.length} actions)`));
      if (manifest.auth) {
        console.log(chalk.yellow(`This API requires auth (${manifest.auth.type}). Set credentials with:`));
        console.log(chalk.gray(
          manifest.auth.type === 'oauth2'
            ? `  agentbridge connect ${manifest.name}`
            : `  agentbridge auth ${manifest.name} --token YOUR_TOKEN`,
        ));
      }
    } catch (err: any) {
      console.error(chalk.red(`Failed to add API: ${err.message}`));
    }
  });

// ---- Import from OpenAPI spec (local file) ----
program
  .command('import <file>')
  .description('Import an API from a local OpenAPI/Swagger spec file')
  .option('--base-url <url>', 'Override the base URL')
  .option('--max-actions <n>', 'Max number of actions to import', parseInt)
  .option('--tags <tags>', 'Only include operations with these tags (comma-separated)')
  .action(async (file: string, opts: any) => {
    const registry = new APIRegistry();
    try {
      const specContent = readFileSync(file, 'utf-8');
      const manifest = convertOpenAPIToManifest(specContent, {
        baseUrl: opts.baseUrl,
        maxActions: opts.maxActions,
        includeTags: opts.tags?.split(','),
      });
      registry.addManifest(manifest);
      console.log(chalk.green(`Imported "${manifest.name}" with ${manifest.actions.length} actions:`));
      for (const action of manifest.actions) {
        console.log(`  ${chalk.cyan(action.id)} — ${action.description}`);
      }
      if (manifest.auth) {
        console.log(chalk.yellow(`\nThis API requires auth (${manifest.auth.type}). Set credentials with:`));
        console.log(chalk.gray(
          manifest.auth.type === 'oauth2'
            ? `  agentbridge connect ${manifest.name}`
            : `  agentbridge auth ${manifest.name} --token YOUR_TOKEN`,
        ));
      }
    } catch (err: any) {
      console.error(chalk.red(`Failed to import: ${err.message}`));
    }
  });

// ---- Publish: register your API on agentbridge.cc directly from CLI ----
program
  .command('publish [file]')
  .description('Publish your API to the AgentBridge directory (agentbridge.cc)')
  .option('--url <url>', 'URL to your OpenAPI spec (instead of local file)')
  .option('--private', 'Do not list on the public directory')
  .option('--registry <url>', 'Custom registry URL')
  .action(async (file?: string, opts?: any) => {
    const registryUrl = opts?.registry || REGISTRY_URL;

    console.log('');
    console.log(chalk.bold.cyan('  Publishing to AgentBridge'));
    console.log('');

    try {
      let body: Record<string, string>;

      if (opts?.url) {
        console.log(chalk.gray(`  Fetching spec from ${opts.url}...`));
        body = { url: opts.url };
      } else if (file) {
        console.log(chalk.gray(`  Reading ${file}...`));
        const specContent = readFileSync(file, 'utf-8');
        body = { spec: specContent };
      } else {
        // Try common file names
        const candidates = ['openapi.json', 'openapi.yaml', 'openapi.yml', 'swagger.json', 'swagger.yaml', '.agentbridge.json'];
        let found = '';
        for (const c of candidates) {
          try {
            readFileSync(c, 'utf-8');
            found = c;
            break;
          } catch {}
        }
        if (!found) {
          console.error(chalk.red('  No OpenAPI spec found. Provide a file path or --url:'));
          console.error(chalk.gray('    agentbridge publish openapi.json'));
          console.error(chalk.gray('    agentbridge publish --url https://api.example.com/openapi.json'));
          return;
        }
        console.log(chalk.gray(`  Found ${found}`));
        body = { spec: readFileSync(found, 'utf-8') };
      }

      const res = await fetch(`${registryUrl}/api/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getRegistryAuthHeaders(registryUrl),
        },
        body: JSON.stringify({ ...body, is_public: !opts?.private }),
      });

      const raw = await res.text();
      const data = parseMaybeJson(raw);

      if (!res.ok) {
        if (res.status === 401 || data?.code === 'AUTH_REQUIRED') {
          console.error(chalk.yellow('  Login required to publish on this registry.'));
          const shouldLogin = await promptYesNo('  Open login in browser now? (Y/n): ');
          if (shouldLogin) {
            const ok = await loginToRegistry(registryUrl);
            if (!ok) {
              console.error(chalk.red('  Login failed or was cancelled.'));
              return;
            }

            const retryRes = await fetch(`${registryUrl}/api/import`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...getRegistryAuthHeaders(registryUrl),
              },
              body: JSON.stringify({ ...body, is_public: !opts?.private }),
            });
            const retryRaw = await retryRes.text();
            const retryData = parseMaybeJson(retryRaw);
            if (!retryRes.ok) {
              const msg = retryData?.error || `Unexpected response (${retryRes.status})`;
              console.error(chalk.red(`  Failed after login: ${msg}`));
              if (!retryData && retryRaw) {
                const preview = retryRaw.replace(/\s+/g, ' ').slice(0, 140);
                console.error(chalk.gray(`  Server response preview: ${preview}${retryRaw.length > 140 ? '…' : ''}`));
              }
              return;
            }
            if (!retryData) {
              console.error(chalk.red('  Failed after login: server did not return JSON.'));
              const preview = retryRaw.replace(/\s+/g, ' ').slice(0, 140);
              console.error(chalk.gray(`  Server response preview: ${preview}${retryRaw.length > 140 ? '…' : ''}`));
              return;
            }

            console.log('');
            console.log(chalk.green.bold(`  Published${opts?.private ? ' (private)' : ''}: ${retryData.name}`));
            console.log(chalk.gray(`  ${retryData.description}`));
            console.log(chalk.gray(`  ${retryData.action_count} actions registered`));
            console.log('');
            console.log(chalk.white('  Your API is now live at:'));
            console.log(chalk.cyan(`    ${registryUrl}/api/${retryData.name}`));
            console.log('');
            return;
          }
          return;
        }
        const msg = data?.error || `Unexpected response (${res.status})`;
        console.error(chalk.red(`  Failed: ${msg}`));
        if (!data && raw) {
          const preview = raw.replace(/\s+/g, ' ').slice(0, 140);
          console.error(chalk.gray(`  Server response preview: ${preview}${raw.length > 140 ? '…' : ''}`));
          if (isLikelyHtml(raw)) {
            console.error(chalk.yellow(`  Registry at ${registryUrl} returned HTML instead of API JSON.`));
            console.error(chalk.gray('  Check AGENTBRIDGE_REGISTRY (wrong host/port is likely).'));
          }
        }
        return;
      }

      if (!data) {
        console.error(chalk.red('  Failed: server did not return JSON.'));
        const preview = raw.replace(/\s+/g, ' ').slice(0, 140);
        console.error(chalk.gray(`  Server response preview: ${preview}${raw.length > 140 ? '…' : ''}`));
        if (isLikelyHtml(raw)) {
          console.error(chalk.yellow(`  Registry at ${registryUrl} returned HTML instead of API JSON.`));
          console.error(chalk.gray('  Check AGENTBRIDGE_REGISTRY (wrong host/port is likely).'));
        }
        return;
      }

      console.log('');
      console.log(chalk.green.bold(`  Published${opts?.private ? ' (private)' : ''}: ${data.name}`));
      console.log(chalk.gray(`  ${data.description}`));
      console.log(chalk.gray(`  ${data.action_count} actions registered`));
      console.log('');
      console.log(chalk.white('  Your API is now live at:'));
      console.log(chalk.cyan(`    ${registryUrl}/api/${data.name}`));
      console.log('');
      console.log(chalk.white('  Anyone can now use it:'));
      console.log(chalk.gray(`    Web:  ${registryUrl}/chat`));
      console.log(chalk.gray(`    CLI:  agentbridge chat ${data.name}`));
      console.log(chalk.gray(`    SDK:  fetch("${registryUrl}/api/${data.name}/manifest")`));
      console.log('');
      console.log(chalk.white('  MCP (Claude Desktop / Cursor / Windsurf):'));
      console.log(chalk.gray(`    {`));
      console.log(chalk.gray(`      "mcpServers": {`));
      console.log(chalk.gray(`        "${data.name}": {`));
      console.log(chalk.gray(`          "command": "npx",`));
      console.log(chalk.gray(`          "args": ["@agentbridgeai/mcp", "--api", "${data.name}"]`));
      console.log(chalk.gray(`        }`));
      console.log(chalk.gray(`      }`));
      console.log(chalk.gray(`    }`));
      console.log('');
    } catch (err: any) {
      console.error(chalk.red(`  Publish failed: ${err.message}`));
    }
  });

// ---- Set auth credentials ----
program
  .command('auth <name>')
  .description('Set authentication credentials for a registered API')
  .option('--token <token>', 'Bearer token or API key')
  .option('--key <key>', 'API key value')
  .action((name: string, opts: any) => {
    const registry = new APIRegistry();
    const creds: Record<string, string> = {};
    if (opts.token) creds.token = opts.token;
    if (opts.key) creds.api_key = opts.key;

    if (Object.keys(creds).length === 0) {
      console.error(chalk.red('Provide at least --token or --key'));
      return;
    }

    try {
      registry.setCredentials(name, creds);
      console.log(chalk.green(`Credentials saved for "${name}"`));
    } catch (err: any) {
      console.error(chalk.red(err.message));
    }
  });

// ---- OAuth connect for APIs that expose oauth2 in manifest ----
program
  .command('connect <name>')
  .description('Connect an OAuth2 API and store access token locally')
  .option('--client-id <id>', 'OAuth client ID')
  .option('--client-secret <secret>', 'OAuth client secret (if required by provider)')
  .option('--scope <scope>', 'Override OAuth scopes (space-separated)')
  .action(async (name: string, opts: any) => {
    try {
      await connectOAuthApi(name, {
        clientId: opts.clientId,
        clientSecret: opts.clientSecret,
        scope: opts.scope,
      });
      console.log(chalk.green(`  OAuth connected for "${name}".`));
      console.log(chalk.gray(`  You can now run: agentbridge chat ${name}`));
    } catch (err: any) {
      console.error(chalk.red(`  OAuth failed: ${err.message}`));
      process.exit(1);
    }
  });

const mcpCommand = program
  .command('mcp')
  .description('MCP onboarding and configuration helpers');

// ---- MCP setup: one command onboarding for Claude/Codex/Cursor/Windsurf ----
mcpCommand
  .command('setup [api]')
  .description('Guided setup: install API, configure auth, configure client(s), and run a health check')
  .option('--client <clients>', 'Target clients: all|claude|codex|cursor|windsurf or comma-separated list', 'all')
  .option('--registry <url>', 'Registry URL (default: AGENTBRIDGE_REGISTRY or https://agentbridge.cc)')
  .option('--token <token>', 'Token/key for bearer or api_key APIs')
  .option('--client-id <id>', 'OAuth client ID override')
  .option('--client-secret <secret>', 'OAuth client secret override (if provider requires it)')
  .option('--scope <scope>', 'OAuth scopes override (space-separated)')
  .option('-y, --yes', 'Non-interactive defaults where possible')
  .action(async (apiArg: string | undefined, opts: any) => {
    const registry = new APIRegistry();
    const registryUrl = (opts?.registry || REGISTRY_URL).trim();

    console.log('');
    console.log(chalk.bold.cyan('  AgentBridge MCP Setup'));
    console.log(chalk.gray('  One flow: API install + auth + client config + health check'));
    console.log('');

    let requestedApi = (apiArg || '').trim();
    if (!requestedApi) {
      requestedApi = await askText('  API name (e.g. spotify, gmail, extractly-api): ');
      if (!requestedApi || isExitSignal(requestedApi)) {
        console.log(chalk.gray('  Setup cancelled.'));
        return;
      }
    }

    const clients = parseMcpClients(opts?.client || 'all');
    if (clients.length === 0) {
      console.error(chalk.red('  Invalid --client value. Use all|claude|codex|cursor|windsurf.'));
      return;
    }

    const manifest = await ensureManifestInstalled(registry, requestedApi, registryUrl);
    if (!manifest) return;

    const apiName = manifest.name;
    const initialCreds = readStoredApiCredentials(apiName);

    if (!hasConfiguredAuth(manifest, initialCreds)) {
      if (manifest.auth?.type === 'oauth2') {
        console.log(chalk.yellow(`  ${apiName} requires OAuth authorization.`));
        const doConnect = opts?.yes ? true : await promptYesNo('  Open OAuth flow now? (Y/n): ', true);
        if (!doConnect) {
          console.log(chalk.yellow('  Skipped OAuth. MCP tools may fail with 401 until connected.'));
        } else {
          try {
            await connectOAuthApi(apiName, {
              clientId: opts?.clientId,
              clientSecret: opts?.clientSecret,
              scope: opts?.scope,
            });
            console.log(chalk.green(`  OAuth connected for "${apiName}".`));
          } catch (err: any) {
            console.error(chalk.red(`  OAuth setup failed: ${err.message}`));
            return;
          }
        }
      } else if (manifest.auth && manifest.auth.type !== 'none') {
        let token = (opts?.token || '').trim();
        if (!token && !opts?.yes) {
          token = await askText('  API token/key (or press Enter to skip): ');
        }
        if (isExitSignal(token)) {
          console.log(chalk.gray('  Setup cancelled.'));
          return;
        }
        if (token) {
          registry.setCredentials(apiName, {
            ...initialCreds,
            token,
            api_key: token,
          });
          console.log(chalk.green(`  Credentials saved for "${apiName}".`));
        } else {
          console.log(chalk.yellow('  No token provided. MCP tools may fail with 401 until token is set.'));
          console.log(chalk.gray(`  Set later: agentbridge auth ${apiName} --token YOUR_TOKEN`));
        }
      }
    }

    const serverName = apiName;
    const summary: Array<{ client: McpClient; ok: boolean; message: string }> = [];

    for (const client of clients) {
      if (client === 'claude') {
        const result = await setupClaudeMcp(serverName, apiName, registryUrl);
        summary.push({ client, ...result });
      } else if (client === 'codex') {
        const result = await setupCodexMcp(serverName, apiName, registryUrl);
        summary.push({ client, ...result });
      } else if (client === 'cursor' || client === 'windsurf') {
        summary.push({
          client,
          ok: true,
          message: `Manual step required in ${client} settings. Use the snippet shown below.`,
        });
      }
    }

    const smoke = await runMcpStartupCheck(apiName, registryUrl);

    console.log('');
    console.log(chalk.bold('  Setup Summary'));
    for (const item of summary) {
      const status = item.ok ? chalk.green('✓') : chalk.red('✖');
      console.log(`  ${status} ${item.client}: ${item.message}`);
    }
    console.log(`  ${smoke.ok ? chalk.green('✓') : chalk.red('✖')} mcp-health: ${smoke.message}`);

    console.log('');
    console.log(chalk.white('  MCP config snippet (Cursor / Windsurf):'));
    console.log(chalk.gray(buildMcpSnippet(apiName)));

    if (registryUrl !== 'https://agentbridge.cc') {
      console.log('');
      console.log(chalk.yellow('  Custom registry detected.'));
      console.log(chalk.gray(`  Ensure MCP server runs with AGENTBRIDGE_REGISTRY=${registryUrl}`));
    }

    console.log('');
    console.log(chalk.white('  Try now:'));
    console.log(chalk.gray(`    claude`));
    console.log(chalk.gray(`    Ask: Use ${apiName} tools and run a quick read-only action.`));
    console.log('');
  });

// ---- List registered APIs ----
program
  .command('list')
  .description('List all registered APIs')
  .action(() => {
    const registry = new APIRegistry();
    const apis = registry.list();

    if (apis.length === 0) {
      console.log(chalk.gray('No APIs registered. Try:'));
      console.log(chalk.gray('  agentbridge chat <api-name>     Search & install & chat'));
      console.log(chalk.gray('  agentbridge search <query>      Browse the directory'));
      console.log(chalk.gray('  agentbridge import openapi.json Import a local spec'));
      return;
    }

    console.log(chalk.bold('\nRegistered APIs:'));
    for (const api of apis) {
      console.log(`  ${chalk.cyan(api.name)} v${api.version} — ${api.description} (${api.actionCount} actions)`);
    }
    console.log('');
  });

// ---- Remove an API ----
program
  .command('remove <name>')
  .description('Remove a registered API')
  .action((name: string) => {
    const registry = new APIRegistry();
    registry.remove(name);
    console.log(chalk.green(`Removed "${name}"`));
  });

// ---- Discover: auto-detect agent-ready APIs on any domain ----
program
  .command('discover <domain>')
  .description('Check if a domain has an agent-ready API (via /.well-known/agentbridge.json)')
  .action(async (domain: string) => {
    console.log(chalk.gray(`  Checking ${domain}...`));
    const manifest = await discoverFromDomain(domain);
    if (!manifest) {
      console.log(chalk.yellow(`  No agent-ready API found at ${domain}`));
      console.log(chalk.gray('  The domain needs to host /.well-known/agentbridge.json'));
      return;
    }
    console.log(chalk.green(`  Found: ${manifest.name} (${manifest.actions.length} actions)`));
    console.log(`  ${manifest.description}`);
    for (const a of manifest.actions.slice(0, 5)) {
      console.log(`    ${chalk.cyan(a.id)} — ${a.description}`);
    }
    if (manifest.actions.length > 5) {
      console.log(chalk.gray(`    ... and ${manifest.actions.length - 5} more`));
    }

    const registry = new APIRegistry();
    registry.addManifest(manifest, `https://${domain.replace(/^https?:\/\//, '')}/.well-known/agentbridge.json`);
    console.log(chalk.green(`\n  Auto-registered "${manifest.name}" to your local registry.`));
  });

// ---- Search: find APIs on the AgentBridge directory ----
program
  .command('search <query>')
  .description('Search for APIs on the AgentBridge directory')
  .option('--install', 'Auto-install the first result')
  .option('--registry <url>', 'Custom registry URL')
  .action(async (query: string, opts: any) => {
    const registryUrl = opts?.registry || REGISTRY_URL;
    console.log(chalk.gray(`  Searching for "${query}"...`));

    try {
      const res = await fetch(`${registryUrl}/api/discover?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!data.apis || data.apis.length === 0) {
        console.log(chalk.yellow(`  No APIs found for "${query}"`));
        return;
      }

      console.log(chalk.bold(`\n  Found ${data.apis.length} API(s):\n`));
      for (const api of data.apis) {
        const authBadge = api.auth_type && api.auth_type !== 'none'
          ? chalk.yellow(` [${api.auth_type}]`)
          : '';
        console.log(`  ${chalk.cyan(api.name)}${authBadge} — ${api.description}`);
        console.log(chalk.gray(`    ${api.actions.length} actions`));
        console.log(chalk.gray(`    Chat: agentbridge chat ${api.name}`));
        console.log('');
      }

      if (opts?.install) {
        const first = data.apis[0];
        const manifestUrl = `${registryUrl}/api/${first.name}/manifest`;
        console.log(chalk.gray(`  Installing ${first.name}...`));
        const registry = new APIRegistry();
        const manifest = await registry.addFromURL(manifestUrl);
        console.log(chalk.green(`  Installed "${manifest.name}" (${manifest.actions.length} actions)`));
        if (manifest.auth) {
          console.log(chalk.yellow(
            manifest.auth.type === 'oauth2'
              ? `  Requires OAuth. Run: agentbridge connect ${manifest.name}`
              : `  Requires auth. Run: agentbridge chat ${manifest.name} --token YOUR_TOKEN`,
          ));
        }
      }
    } catch (err: any) {
      console.error(chalk.red(`  Search failed: ${err.message}`));
    }
  });

// ---- Init: make your API agent-ready (local) ----
program
  .command('init')
  .description('Generate .agentbridge.json from your OpenAPI spec (local only, use "publish" for directory)')
  .option('-y, --yes', 'Skip prompts, use defaults')
  .option('--spec <path>', 'Path or URL to OpenAPI spec')
  .action(async (opts?: any) => {
    await runInit({ yes: opts?.yes, spec: opts?.spec });
  });

// ---- Login: authenticate CLI with hosted registry ----
program
  .command('login')
  .description('Login to AgentBridge registry from CLI')
  .option('--registry <url>', 'Custom registry URL')
  .action(async (opts?: any) => {
    const registryUrl = opts?.registry || REGISTRY_URL;
    const ok = await loginToRegistry(registryUrl);
    if (!ok) process.exit(1);
  });

// ---- Helper ----
function getRegistryAuthHeaders(registryUrl: string): Record<string, string> {
  const envToken = process.env.AGENTBRIDGE_TOKEN;
  const savedToken = config.get('registryToken');
  const savedRegistry = config.get('registryUrl');
  const token = envToken || (savedRegistry === registryUrl ? savedToken : undefined);
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function ensureManifestInstalled(registry: APIRegistry, apiName: string, registryUrl: string): Promise<AgentBridgeManifest | null> {
  const local = registry.getManifest(apiName);
  if (local) return local;

  try {
    const res = await fetch(`${registryUrl}/api/${encodeURIComponent(apiName)}/manifest`);
    const raw = await res.text();
    const data = parseMaybeJson(raw) as AgentBridgeManifest | null;
    if (!res.ok || !data) {
      const msg = (data as any)?.error || `API "${apiName}" not found on ${registryUrl}`;
      console.error(chalk.red(`  ${msg}`));
      if (!data && raw) {
        const preview = raw.replace(/\s+/g, ' ').slice(0, 140);
        console.error(chalk.gray(`  Server response preview: ${preview}${raw.length > 140 ? '…' : ''}`));
      }
      return null;
    }
    registry.addManifest(data, `${registryUrl}/api/${data.name}/manifest`);
    console.log(chalk.green(`  Installed "${data.name}" (${data.actions.length} actions)`));
    return data;
  } catch (err: any) {
    console.error(chalk.red(`  Failed to install "${apiName}": ${err.message}`));
    return null;
  }
}

function hasConfiguredAuth(manifest: AgentBridgeManifest, creds: Record<string, any>): boolean {
  if (!manifest.auth || manifest.auth.type === 'none') return true;
  if (manifest.auth.type === 'oauth2') {
    const oauth = (creds.oauth && typeof creds.oauth === 'object') ? creds.oauth as Record<string, any> : {};
    return Boolean(creds.token || creds.access_token || oauth.access_token);
  }
  return Boolean(creds.token || creds.api_key || creds.key);
}

async function connectOAuthApi(
  name: string,
  opts: { clientId?: string; clientSecret?: string; scope?: string } = {},
): Promise<void> {
  const registry = new APIRegistry();
  const manifest = registry.getManifest(name);

  if (!manifest) {
    throw new Error(`API "${name}" is not installed locally. Run: agentbridge chat ${name}`);
  }
  if (manifest.auth?.type !== 'oauth2' || !manifest.auth.oauth2?.authorization_url || !manifest.auth.oauth2.token_url) {
    throw new Error(`"${name}" does not define oauth2 authorization/token URLs in its manifest.`);
  }

  const current = readStoredApiCredentials(name);
  const currentOauth = (current.oauth && typeof current.oauth === 'object') ? current.oauth : {};

  const builtinDefaults = registry.getBuiltinDefaults(name);
  const clientId = opts.clientId || current.oauth_client_id || currentOauth.client_id || builtinDefaults?.clientId || await askText('  OAuth client ID: ');
  if (!clientId) {
    throw new Error('OAuth client ID is required.');
  }

  const clientSecret = opts.clientSecret ?? current.oauth_client_secret ?? currentOauth.client_secret
    ?? (builtinDefaults?.clientId ? '' : await askText('  OAuth client secret (optional): '));
  const defaultScope = Object.keys(manifest.auth.oauth2.scopes ?? {}).join(' ');
  const scope = opts.scope ?? defaultScope;

  const { verifier, challenge } = createPkcePair();
  const state = randomUUID();

  const fixedPort = builtinDefaults?.callbackPort;
  const callbackData = await waitForOAuthCode(state, manifest, clientId, challenge, scope, fixedPort);
  if (!callbackData) {
    throw new Error('OAuth flow did not complete.');
  }

  const tokenBody = new URLSearchParams();
  tokenBody.set('grant_type', 'authorization_code');
  tokenBody.set('code', callbackData.code);
  tokenBody.set('redirect_uri', callbackData.redirectUri);
  tokenBody.set('client_id', clientId);
  tokenBody.set('code_verifier', verifier);
  if (clientSecret) tokenBody.set('client_secret', clientSecret);

  const tokenRes = await fetch(manifest.auth.oauth2.token_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: tokenBody.toString(),
  });

  const tokenText = await tokenRes.text();
  let tokenJson: any = null;
  try {
    tokenJson = tokenText ? JSON.parse(tokenText) : null;
  } catch {
    tokenJson = null;
  }

  if (!tokenRes.ok || !tokenJson?.access_token) {
    const errorText = tokenJson?.error ? `: ${tokenJson.error}` : '';
    throw new Error(`Token exchange failed (${tokenRes.status})${errorText}`);
  }

  const expiresAt = tokenJson.expires_in
    ? new Date(Date.now() + Number(tokenJson.expires_in) * 1000).toISOString()
    : undefined;

  registry.setCredentials(name, {
    ...current,
    token: tokenJson.access_token,
    oauth_client_id: clientId,
    ...(clientSecret ? { oauth_client_secret: clientSecret } : {}),
    oauth: {
      ...(currentOauth || {}),
      client_id: clientId,
      ...(clientSecret ? { client_secret: clientSecret } : {}),
      token_url: manifest.auth.oauth2.token_url,
      authorization_url: manifest.auth.oauth2.authorization_url,
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token,
      token_type: tokenJson.token_type ?? 'Bearer',
      scope: tokenJson.scope ?? scope,
      expires_at: expiresAt,
    },
  });
}

async function runCommandCapture(
  command: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
  timeoutMs = 20000,
): Promise<{ ok: boolean; code: number | null; stdout: string; stderr: string; error?: string }> {
  return new Promise(resolve => {
    let done = false;
    let timer: NodeJS.Timeout | null = null;
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: env || process.env,
    });

    let stdout = '';
    let stderr = '';
    const finish = (value: { ok: boolean; code: number | null; stdout: string; stderr: string; error?: string }) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      resolve(value);
    };

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', err => finish({ ok: false, code: null, stdout, stderr, error: err.message }));
    child.on('close', code => finish({ ok: code === 0, code, stdout, stderr }));

    timer = setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch {}
      finish({ ok: false, code: null, stdout, stderr, error: `Command timed out after ${Math.round(timeoutMs / 1000)}s` });
    }, timeoutMs);
  });
}

function summarizeProcessOutput(stdout: string, stderr: string): string {
  const merged = `${stderr}\n${stdout}`.replace(/\s+/g, ' ').trim();
  return merged.slice(0, 180) || 'unknown error';
}

function findCodexBinary(): string {
  if (process.env.AGENTBRIDGE_CODEX_BIN?.trim()) return process.env.AGENTBRIDGE_CODEX_BIN.trim();

  const preferred = ['/opt/homebrew/bin/codex', '/usr/local/bin/codex'];
  for (const candidate of preferred) {
    if (existsSync(candidate)) return candidate;
  }

  const npmPrefix = process.env.npm_config_prefix || '';
  if (npmPrefix) {
    const candidate = join(npmPrefix, 'bin', 'codex');
    if (existsSync(candidate)) return candidate;
  }

  return 'codex';
}

async function setupClaudeMcp(serverName: string, apiName: string, registryUrl: string): Promise<{ ok: boolean; message: string }> {
  await runCommandCapture('claude', ['mcp', 'remove', serverName]);

  const args = ['mcp', 'add'];
  if (registryUrl !== 'https://agentbridge.cc') {
    args.push('-e', `AGENTBRIDGE_REGISTRY=${registryUrl}`);
  }
  args.push(serverName, '--', 'npx', '-y', '@agentbridgeai/mcp', '--api', apiName);
  const result = await runCommandCapture('claude', args);
  if (!result.ok) {
    if (result.error?.includes('ENOENT')) {
      return { ok: false, message: 'Claude CLI not found. Install Claude Code first.' };
    }
    return { ok: false, message: summarizeProcessOutput(result.stdout, result.stderr) };
  }
  return { ok: true, message: `Configured "${serverName}"` };
}

async function setupCodexMcp(serverName: string, apiName: string, registryUrl: string): Promise<{ ok: boolean; message: string }> {
  const codexBin = findCodexBinary();
  await runCommandCapture(codexBin, ['mcp', 'remove', serverName]);

  const args = ['mcp', 'add'];
  if (registryUrl !== 'https://agentbridge.cc') {
    args.push('--env', `AGENTBRIDGE_REGISTRY=${registryUrl}`);
  }
  args.push(serverName, '--', 'npx', '-y', '@agentbridgeai/mcp', '--api', apiName);
  const result = await runCommandCapture(codexBin, args);
  if (!result.ok) {
    if (result.error?.includes('ENOENT')) {
      return { ok: false, message: 'Codex CLI not found. Install Codex CLI first.' };
    }
    return { ok: false, message: summarizeProcessOutput(result.stdout, result.stderr) };
  }
  return { ok: true, message: `Configured "${serverName}"` };
}

async function runMcpStartupCheck(apiName: string, registryUrl: string): Promise<{ ok: boolean; message: string }> {
  return new Promise(resolve => {
    let settled = false;
    let combined = '';
    const child = spawn('npx', ['-y', '@agentbridgeai/mcp', '--api', apiName], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...(registryUrl ? { AGENTBRIDGE_REGISTRY: registryUrl } : {}),
      },
    });

    const finish = (ok: boolean, message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimeout);
      clearTimeout(successTimer);
      try {
        child.kill('SIGTERM');
      } catch {}
      resolve({ ok, message });
    };

    const onData = (data: Buffer) => {
      const text = data.toString();
      combined += text;
      if (combined.includes('AgentBridge MCP Server starting with')) {
        const actionMatch = combined.match(new RegExp(`-\\s+${escapeRegExp(apiName)}\\s+\\((\\d+) actions\\)`));
        const detail = actionMatch ? `Server started (${actionMatch[1]} actions)` : 'Server started';
        finish(true, detail);
      } else if (combined.toLowerCase().includes('failed to fetch')) {
        finish(false, summarizeProcessOutput('', combined));
      }
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', err => finish(false, err.message));
    child.on('close', code => {
      if (!settled) {
        finish(false, summarizeProcessOutput('', combined || `Process exited (${code})`));
      }
    });

    // If process stays alive a few seconds, startup is healthy even if stderr format changes.
    const successTimer = setTimeout(() => {
      finish(true, 'Server process started');
    }, 5000);

    const hardTimeout = setTimeout(() => {
      finish(false, 'Timed out starting MCP server');
    }, 30000);
  });
}

function readStoredApiCredentials(name: string): Record<string, any> {
  try {
    if (!existsSync(LOCAL_REGISTRY_FILE)) return {};
    const raw = JSON.parse(readFileSync(LOCAL_REGISTRY_FILE, 'utf-8')) as {
      entries?: Record<string, { credentials?: Record<string, any> }>;
    };
    return raw.entries?.[name]?.credentials ?? {};
  } catch {
    return {};
  }
}

async function askText(question: string): Promise<string> {
  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>(resolve => rl.question(chalk.white(question), resolve));
  rl.close();
  return answer.trim();
}

function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

async function waitForOAuthCode(
  state: string,
  manifest: AgentBridgeManifest,
  clientId: string,
  codeChallenge: string,
  scope: string,
  fixedPort?: number,
): Promise<{ code: string; redirectUri: string } | null> {
  return new Promise(resolve => {
    const server = createServer((req, res) => {
      const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
      if (reqUrl.pathname !== '/callback') {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }

      const code = reqUrl.searchParams.get('code');
      const returnedState = reqUrl.searchParams.get('state');
      const error = reqUrl.searchParams.get('error');
      const ok = !!code && returnedState === state && !error;

      res.statusCode = ok ? 200 : 400;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(ok
        ? '<h2>AgentBridge OAuth connection complete.</h2><p>You can close this tab and return to terminal.</p>'
        : `<h2>OAuth failed.</h2><p>${error || 'Invalid state or missing code.'}</p>`);

      const address = server.address();
      const redirectUri = address && typeof address !== 'string'
        ? `http://127.0.0.1:${address.port}/callback`
        : '';

      server.close();
      if (!ok) {
        resolve(null);
        return;
      }
      resolve({ code: code!, redirectUri });
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && fixedPort) {
        console.error(chalk.red(`  Port ${fixedPort} is already in use. Close the other process and retry.`));
      }
      resolve(null);
    });

    server.listen(fixedPort ?? 0, '127.0.0.1', async () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        resolve(null);
        return;
      }

      const redirectUri = `http://127.0.0.1:${address.port}/callback`;
      const authUrl = new URL(manifest.auth!.oauth2!.authorization_url);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      if (scope?.trim()) authUrl.searchParams.set('scope', scope.trim());

      console.log('');
      console.log(chalk.bold.cyan('  OAuth Connect'));
      console.log(chalk.gray(`  API: ${manifest.name}`));
      console.log(chalk.gray('  Complete authorization in your browser:'));
      console.log(chalk.white(`  ${authUrl.toString()}`));

      const opened = await openBrowser(authUrl.toString());
      if (opened) {
        console.log(chalk.gray('  Opened browser window.'));
      } else {
        console.log(chalk.yellow('  Could not open browser automatically.'));
      }

      const timeout = setTimeout(() => {
        server.close();
        resolve(null);
      }, 240000);
      server.on('close', () => clearTimeout(timeout));
    });
  });
}

async function promptYesNo(question: string, defaultYes = true): Promise<boolean> {
  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>(resolve => rl.question(chalk.white(question), resolve));
  rl.close();
  const normalized = answer.trim().toLowerCase();
  if (!normalized) return defaultYes;
  if (['y', 'yes'].includes(normalized)) return true;
  if (['n', 'no'].includes(normalized)) return false;
  return defaultYes;
}

function openBrowser(url: string): Promise<boolean> {
  return new Promise(resolve => {
    const platform = process.platform;
    const cmd =
      platform === 'darwin' ? 'open' :
      platform === 'win32' ? 'cmd' :
      'xdg-open';
    const args =
      platform === 'win32' ? ['/c', 'start', '', url] : [url];

    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.once('error', () => resolve(false));
    child.once('spawn', () => {
      child.unref();
      resolve(true);
    });
  });
}

async function loginToRegistry(registryUrl: string): Promise<boolean> {
  const state = randomUUID();
  const callbackData = await waitForCliLoginCallback(state, registryUrl);
  if (!callbackData) return false;

  config.set('registryToken', callbackData.token);
  config.set('registryUrl', registryUrl);

  console.log(chalk.green('  Login successful. CLI is authenticated for publish operations.'));
  return true;
}

async function waitForCliLoginCallback(state: string, registryUrl: string): Promise<{ token: string } | null> {
  return new Promise(async resolve => {
    const server = createServer((req, res) => {
      const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
      if (reqUrl.pathname !== '/callback') {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }

      const token = reqUrl.searchParams.get('token');
      const returnedState = reqUrl.searchParams.get('state');
      const ok = token && returnedState === state;

      res.statusCode = ok ? 200 : 400;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(ok
        ? '<h2>AgentBridge CLI login complete.</h2><p>You can close this tab and return to terminal.</p>'
        : '<h2>AgentBridge CLI login failed.</h2><p>Invalid callback state.</p>');

      server.close();
      resolve(ok ? { token: token! } : null);
    });

    server.listen(0, '127.0.0.1', async () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        resolve(null);
        return;
      }

      const callbackUrl = `http://127.0.0.1:${address.port}/callback`;
      const loginUrl = `${registryUrl}${CLI_AUTH_PATH}?callback_url=${encodeURIComponent(callbackUrl)}&state=${encodeURIComponent(state)}`;

      console.log('');
      console.log(chalk.bold.cyan('  AgentBridge Login'));
      console.log(chalk.gray(`  Registry: ${registryUrl}`));
      console.log(chalk.gray('  Complete login in your browser, then return here.'));
      console.log(chalk.white(`  ${loginUrl}`));

      const opened = await openBrowser(loginUrl);
      if (opened) {
        console.log(chalk.gray('  Opened browser window for login.'));
      } else {
        console.log(chalk.yellow('  Could not open browser automatically.'));
      }

      const timeout = setTimeout(() => {
        server.close();
        resolve(null);
      }, 180000);

      server.on('close', () => clearTimeout(timeout));
    });
  });
}

async function createLLMProvider() {
  if (process.env.ANTHROPIC_API_KEY) {
    return new ClaudeProvider({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.AGENTBRIDGE_MODEL || undefined,
    });
  }

  if (process.env.OPENAI_API_KEY) {
    const isGroq = process.env.OPENAI_BASE_URL === GROQ_BASE_URL;
    return new OpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.AGENTBRIDGE_MODEL || (isGroq ? GROQ_DEFAULT_MODEL : undefined),
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
  }

  // Interactive key setup
  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> => new Promise(resolve => rl.question(q, resolve));
  const closePrompt = () => {
    rl.close();
    // Ensure stdin remains active for the REPL that starts next.
    if (!process.stdin.destroyed) process.stdin.resume();
  };

  console.log('');
  console.log(chalk.cyan('    ╔══════════════════════════════════════╗'));
  console.log(chalk.cyan('    ║') + chalk.bold.white('    LLM API Key Required              ') + chalk.cyan('║'));
  console.log(chalk.cyan('    ╚══════════════════════════════════════╝'));
  console.log('');
  console.log(chalk.white('    AgentBridge needs an LLM key to chat with APIs.'));
  console.log(chalk.white('    Your key stays local — never sent to AgentBridge.'));
  console.log('');
  console.log(chalk.gray('    Supported providers:'));
  console.log(`      ${chalk.cyan('1.')} Anthropic (Claude)  — ${chalk.gray('https://console.anthropic.com/settings/keys')}`);
  console.log(`      ${chalk.cyan('2.')} OpenAI (GPT)        — ${chalk.gray('https://platform.openai.com/api-keys')}`);
  console.log(`      ${chalk.cyan('3.')} Groq (fast & free)  — ${chalk.gray('https://console.groq.com/keys')}`);
  console.log(`      ${chalk.cyan('4.')} Gemini (free)       — ${chalk.gray('https://aistudio.google.com/apikey')}`);
  console.log('');

  const choice = await ask(chalk.white('    Choose provider (1/2/3/4): '));
  console.log('');

  if (choice === '1') {
    const key = await ask(chalk.white('    Anthropic API key: '));
    closePrompt();
    if (!key.trim()) {
      console.log(chalk.red('    No key provided.'));
      process.exit(1);
    }
    process.env.ANTHROPIC_API_KEY = key.trim();
    console.log('');
    console.log(chalk.green('    ✔ Key set for this session'));
    console.log(chalk.gray('    To persist, add to your shell profile:'));
    console.log(chalk.gray(`    export ANTHROPIC_API_KEY=${key.trim().slice(0, 10)}...`));
    console.log('');
    return new ClaudeProvider({
      apiKey: key.trim(),
      model: process.env.AGENTBRIDGE_MODEL || undefined,
    });
  } else if (choice === '2') {
    const key = await ask(chalk.white('    OpenAI API key: '));
    closePrompt();
    if (!key.trim()) {
      console.log(chalk.red('    No key provided.'));
      process.exit(1);
    }
    console.log('');
    console.log(chalk.green('    ✔ Key set for this session'));
    console.log(chalk.gray('    To persist, add to your shell profile:'));
    console.log(chalk.gray(`    export OPENAI_API_KEY=${key.trim().slice(0, 10)}...`));
    console.log('');
    return new OpenAIProvider({
      apiKey: key.trim(),
      model: process.env.AGENTBRIDGE_MODEL || undefined,
    });
  } else if (choice === '3') {
    const key = await ask(chalk.white('    Groq API key: '));
    closePrompt();
    if (!key.trim()) {
      console.log(chalk.red('    No key provided.'));
      process.exit(1);
    }
    console.log('');
    console.log(chalk.green('    ✔ Key set for this session'));
    console.log(chalk.gray('    To persist, add to your shell profile:'));
    console.log(chalk.gray(`    export OPENAI_API_KEY=${key.trim().slice(0, 10)}...`));
    console.log(chalk.gray('    export OPENAI_BASE_URL=https://api.groq.com/openai/v1'));
    console.log('');
    return new OpenAIProvider({
      apiKey: key.trim(),
      model: process.env.AGENTBRIDGE_MODEL || GROQ_DEFAULT_MODEL,
      baseURL: GROQ_BASE_URL,
    });
  } else if (choice === '4') {
    const key = await ask(chalk.white('    Gemini API key: '));
    closePrompt();
    if (!key.trim()) {
      console.log(chalk.red('    No key provided.'));
      process.exit(1);
    }
    console.log('');
    console.log(chalk.green('    ✔ Key set for this session'));
    console.log(chalk.gray('    To persist, add to your shell profile:'));
    console.log(chalk.gray(`    export OPENAI_API_KEY=${key.trim().slice(0, 10)}...`));
    console.log(chalk.gray('    export OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/'));
    console.log('');
    return new OpenAIProvider({
      apiKey: key.trim(),
      model: process.env.AGENTBRIDGE_MODEL || GEMINI_DEFAULT_MODEL,
      baseURL: GEMINI_BASE_URL,
    });
  } else {
    closePrompt();
    console.log(chalk.red('    Invalid choice.'));
    process.exit(1);
  }
}

program.parse();
