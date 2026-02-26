#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { AgentBridgeEngine } from '@agentbridgeai/core';
import { ClaudeProvider, OpenAIProvider } from '@agentbridgeai/llm';
import { APIRegistry, convertOpenAPIToManifest, discoverFromDomain } from '@agentbridgeai/openapi';
import { startRepl } from './repl.js';
import { runInit } from './commands.js';
import { readFileSync } from 'fs';

const REGISTRY_URL = process.env.AGENTBRIDGE_REGISTRY || 'https://agentbridge.cc';

const program = new Command();

program
  .name('agentbridge')
  .description('Make any API agent-ready — interact with any service using natural language')
  .version('0.1.0');

// ---- Main chat command (default) ----
// Supports: `agentbridge chat` (all installed APIs)
//           `agentbridge chat spotify` (search + auto-install + chat)
program
  .command('chat [api]', { isDefault: true })
  .description('Start chatting — optionally specify an API name to auto-install from the directory')
  .option('--token <token>', 'API auth token for the target API')
  .action(async (apiName?: string, opts?: any) => {
    const llm = createLLMProvider();
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
                console.log(chalk.gray(`  Run: agentbridge auth ${manifest.name} --token YOUR_TOKEN`));
                console.log(chalk.gray(`  Or: agentbridge chat ${manifest.name} --token YOUR_TOKEN`));
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

    if (allPlugins.length === 2) {
      // Only built-in plugins
      console.log(chalk.gray('\n  No APIs installed. Using built-in weather & todo plugins.'));
      console.log(chalk.gray('  Install an API: agentbridge chat <api-name>'));
      console.log(chalk.gray('  Or browse: agentbridge search <query>\n'));
    }

    const engine = new AgentBridgeEngine({
      llmProvider: llm,
      plugins: allPlugins,
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
        console.log(chalk.gray(`  agentbridge auth ${manifest.name} --token YOUR_TOKEN`));
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
        console.log(chalk.gray(`  agentbridge auth ${manifest.name} --token YOUR_TOKEN`));
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, is_public: !opts?.private }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error(chalk.red(`  Failed: ${data.error}`));
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
          console.log(chalk.yellow(`  Requires auth. Run: agentbridge chat ${manifest.name} --token YOUR_TOKEN`));
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

// ---- Helper ----
function createLLMProvider() {
  if (process.env.ANTHROPIC_API_KEY) {
    return new ClaudeProvider({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.AGENTBRIDGE_MODEL || undefined,
    });
  }

  if (process.env.OPENAI_API_KEY) {
    return new OpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.AGENTBRIDGE_MODEL || undefined,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
  }

  console.error(chalk.red('No LLM API key found. Set one of:'));
  console.error('  ANTHROPIC_API_KEY=sk-ant-...');
  console.error('  OPENAI_API_KEY=sk-...');
  console.error('  OPENAI_API_KEY=gsk_... OPENAI_BASE_URL=https://api.groq.com/openai/v1');
  process.exit(1);
}

program.parse();
