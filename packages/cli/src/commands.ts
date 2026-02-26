import * as readline from 'readline';
import chalk from 'chalk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { convertOpenAPIToManifest, type AgentBridgeManifest } from '@agentbridgeai/openapi';

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve));
}

/**
 * Interactive init command: guides API owners through making their API agent-ready.
 *
 *   npx agentbridge init
 *   npx agentbridge init -y --spec openapi.json
 *
 * 1. Ask for OpenAPI spec (file path or URL)
 * 2. Parse and preview actions
 * 3. Generate .agentbridge.json manifest
 * 4. Optionally generate MCP server config
 */
export async function runInit(opts?: { yes?: boolean; spec?: string }) {
  const nonInteractive = opts?.yes;

  console.log('');
  console.log(chalk.bold.cyan('  AgentBridge Init'));
  console.log(chalk.gray('  Make your API agent-ready in 30 seconds'));
  console.log('');

  // Step 1: Get the OpenAPI spec
  let specSource = opts?.spec;

  if (!specSource && nonInteractive) {
    // Auto-detect spec file
    const candidates = ['openapi.json', 'openapi.yaml', 'openapi.yml', 'swagger.json', 'swagger.yaml'];
    for (const c of candidates) {
      if (existsSync(c)) {
        specSource = c;
        console.log(chalk.gray(`  Auto-detected: ${c}`));
        break;
      }
    }
    if (!specSource) {
      console.error(chalk.red('  No OpenAPI spec found. Provide --spec <path>'));
      return;
    }
  }

  if (!specSource) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    specSource = await ask(rl, chalk.white('  Path to your OpenAPI spec (or URL): '));
    rl.close();
  }

  let specContent: string;
  try {
    if (specSource.startsWith('http')) {
      console.log(chalk.gray('  Fetching...'));
      const res = await fetch(specSource);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      specContent = await res.text();
    } else if (existsSync(specSource)) {
      specContent = readFileSync(specSource, 'utf-8');
    } else {
      console.error(chalk.red(`  File not found: ${specSource}`));
      return;
    }
  } catch (err: any) {
    console.error(chalk.red(`  Failed to load spec: ${err.message}`));
    return;
  }

  // Step 2: Convert and preview
  let manifest: AgentBridgeManifest;
  try {
    manifest = convertOpenAPIToManifest(specContent);
  } catch (err: any) {
    console.error(chalk.red(`  Failed to parse spec: ${err.message}`));
    return;
  }

  console.log('');
  console.log(chalk.green('  Detected API:'));
  console.log(`    Name: ${chalk.bold(manifest.name)}`);
  console.log(`    Description: ${manifest.description}`);
  console.log(`    Base URL: ${manifest.base_url}`);
  console.log(`    Auth: ${manifest.auth?.type ?? 'none'}`);
  console.log(`    Actions: ${manifest.actions.length}`);

  for (const action of manifest.actions.slice(0, 10)) {
    console.log(`      ${chalk.cyan(action.id)} ${chalk.gray(`[${action.method}]`)} — ${action.description}`);
  }
  if (manifest.actions.length > 10) {
    console.log(chalk.gray(`      ... and ${manifest.actions.length - 10} more`));
  }
  console.log('');

  if (nonInteractive) {
    // Auto-generate both files
    const manifestPath = '.agentbridge.json';
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(chalk.green(`  Created ${manifestPath}`));

    const mcpConfig = {
      mcpServers: {
        [manifest.name]: {
          command: 'npx',
          args: ['@agentbridgeai/mcp', '--manifest', './.agentbridge.json'],
        },
      },
    };
    const mcpPath = 'mcp-config.json';
    writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2));
    console.log(chalk.green(`  Created ${mcpPath}`));
  } else {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    // Step 3: Confirm and save
    const confirm = await ask(rl, chalk.white('  Generate .agentbridge.json? (Y/n): '));
    if (confirm.toLowerCase() === 'n') {
      console.log(chalk.gray('  Cancelled.'));
      rl.close();
      return;
    }

    const manifestPath = '.agentbridge.json';
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(chalk.green(`  Created ${manifestPath}`));

    // Step 4: MCP config
    const mcpAnswer = await ask(rl, chalk.white('  Generate MCP server config for Claude/Cursor? (Y/n): '));
    if (mcpAnswer.toLowerCase() !== 'n') {
      const mcpConfig = {
        mcpServers: {
          [manifest.name]: {
            command: 'npx',
            args: ['@agentbridgeai/mcp', '--manifest', './.agentbridge.json'],
          },
        },
      };

      const mcpPath = 'mcp-config.json';
      writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2));
      console.log(chalk.green(`  Created ${mcpPath}`));
      console.log('');
      console.log(chalk.gray('  To use with Claude Desktop, add the config to:'));
      console.log(chalk.gray('  ~/.claude/claude_desktop_config.json'));
    }

    rl.close();
  }

  console.log('');
  console.log(chalk.bold.green('  Your API is now agent-ready!'));
  console.log('');
  console.log(chalk.gray('  Next steps:'));
  console.log(chalk.gray('  1. Host .agentbridge.json alongside your API'));
  console.log(chalk.gray('  2. Users can: agentbridge add https://your-api.com/.agentbridge.json'));
  console.log(chalk.gray('  3. Or use MCP: npx @agentbridgeai/mcp --manifest .agentbridge.json'));
  console.log('');
}
