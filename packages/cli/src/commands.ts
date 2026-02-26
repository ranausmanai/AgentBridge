import * as readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { convertOpenAPIToManifest, type AgentBridgeManifest } from '@agentbridgeai/openapi';

const REGISTRY_URL = process.env.AGENTBRIDGE_REGISTRY || 'https://agentbridge.cc';

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve));
}

async function askOnce(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await ask(rl, question);
  rl.close();
  return answer;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function printHeader() {
  console.log('');
  console.log(chalk.cyan('    ╔══════════════════════════════════════╗'));
  console.log(chalk.cyan('    ║') + chalk.bold.white('    ⚡ AgentBridge                     ') + chalk.cyan('║'));
  console.log(chalk.cyan('    ║') + chalk.gray('    Make any API agent-ready           ') + chalk.cyan('║'));
  console.log(chalk.cyan('    ╚══════════════════════════════════════╝'));
  console.log('');
}

function printDivider() {
  console.log(chalk.gray('    ──────────────────────────────────────'));
}

function printStep(step: number, total: number, label: string) {
  console.log('');
  console.log(chalk.cyan(`    Step ${step}/${total}`) + chalk.gray(` · ${label}`));
  console.log('');
}

/**
 * Interactive init command: guides API owners through making their API agent-ready.
 */
export async function runInit(opts?: { yes?: boolean; spec?: string }) {
  const nonInteractive = opts?.yes;

  printHeader();

  // Step 1: Get the OpenAPI spec
  let specSource = opts?.spec;

  if (!specSource && nonInteractive) {
    const candidates = ['openapi.json', 'openapi.yaml', 'openapi.yml', 'swagger.json', 'swagger.yaml'];
    for (const c of candidates) {
      if (existsSync(c)) {
        specSource = c;
        break;
      }
    }
    if (!specSource) {
      console.error(chalk.red('    ✗ No OpenAPI spec found. Provide --spec <path>'));
      return;
    }
  }

  if (!specSource) {
    printStep(1, 5, 'Load your OpenAPI spec');
    specSource = await askOnce(chalk.white('    Path or URL: '));
  }

  // Load spec
  const spinner = ora({ text: 'Loading spec...', indent: 4 }).start();
  let specContent: string;
  try {
    if (specSource.startsWith('http')) {
      spinner.text = `Fetching from ${specSource}...`;
      const res = await fetch(specSource);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      specContent = await res.text();
    } else if (existsSync(specSource)) {
      specContent = readFileSync(specSource, 'utf-8');
    } else {
      spinner.fail(`File not found: ${specSource}`);
      return;
    }
    spinner.succeed('Spec loaded');
  } catch (err: any) {
    spinner.fail(`Failed to load spec: ${err.message}`);
    return;
  }

  // Parse spec
  const parseSpinner = ora({ text: 'Parsing OpenAPI spec...', indent: 4 }).start();
  let manifest: AgentBridgeManifest;
  try {
    manifest = convertOpenAPIToManifest(specContent);
    await sleep(300); // Brief pause so user sees the spinner
    parseSpinner.succeed(`Detected ${chalk.bold(manifest.name)}`);
  } catch (err: any) {
    parseSpinner.fail(`Failed to parse spec: ${err.message}`);
    return;
  }

  // Preview
  console.log('');
  printDivider();
  console.log('');
  console.log(chalk.white('    API Details'));
  console.log('');
  console.log(`    ${chalk.gray('Name')}         ${chalk.bold.white(manifest.name)}`);
  console.log(`    ${chalk.gray('Description')}  ${manifest.description}`);
  console.log(`    ${chalk.gray('Base URL')}     ${chalk.cyan(manifest.base_url)}`);
  console.log(`    ${chalk.gray('Auth')}         ${manifest.auth?.type ?? chalk.gray('none')}`);
  console.log(`    ${chalk.gray('Actions')}      ${chalk.bold(String(manifest.actions.length))}`);
  console.log('');

  for (const action of manifest.actions.slice(0, 10)) {
    const method = action.method.toUpperCase().padEnd(6);
    const methodColor = action.method === 'GET' ? chalk.green : action.method === 'POST' ? chalk.yellow : action.method === 'PUT' ? chalk.blue : chalk.red;
    console.log(`    ${methodColor(method)} ${chalk.cyan(action.id)}`);
    console.log(`           ${chalk.gray(action.description)}`);
  }
  if (manifest.actions.length > 10) {
    console.log(chalk.gray(`           ... and ${manifest.actions.length - 10} more`));
  }
  console.log('');
  printDivider();

  if (nonInteractive) {
    // Auto-generate all files + publish
    console.log('');
    const genSpinner = ora({ text: 'Generating .agentbridge.json...', indent: 4 }).start();
    writeFileSync('.agentbridge.json', JSON.stringify(manifest, null, 2));
    await sleep(200);
    genSpinner.succeed('Created .agentbridge.json');

    const mcpSpinner = ora({ text: 'Generating mcp-config.json...', indent: 4 }).start();
    const mcpConfig = {
      mcpServers: {
        [manifest.name]: {
          command: 'npx',
          args: ['@agentbridgeai/mcp', '--manifest', './.agentbridge.json'],
        },
      },
    };
    writeFileSync('mcp-config.json', JSON.stringify(mcpConfig, null, 2));
    await sleep(200);
    mcpSpinner.succeed('Created mcp-config.json');

    await doPublish(specContent, manifest.name);
  } else {
    // Step 3: Generate manifest
    printStep(2, 5, 'Generate manifest');
    const confirm = await askOnce(chalk.white('    Create .agentbridge.json? ') + chalk.gray('(Y/n) '));
    if (confirm.toLowerCase() === 'n') {
      console.log(chalk.gray('    Cancelled.'));
      return;
    }

    const genSpinner = ora({ text: 'Generating .agentbridge.json...', indent: 4 }).start();
    writeFileSync('.agentbridge.json', JSON.stringify(manifest, null, 2));
    await sleep(200);
    genSpinner.succeed('Created .agentbridge.json');

    // Step 4: MCP config
    printStep(3, 5, 'MCP server config');
    const mcpAnswer = await askOnce(chalk.white('    Generate for Claude Desktop / Cursor / Windsurf? ') + chalk.gray('(Y/n) '));
    if (mcpAnswer.toLowerCase() !== 'n') {
      const mcpSpinner = ora({ text: 'Generating mcp-config.json...', indent: 4 }).start();
      const mcpConfig = {
        mcpServers: {
          [manifest.name]: {
            command: 'npx',
            args: ['@agentbridgeai/mcp', '--manifest', './.agentbridge.json'],
          },
        },
      };
      writeFileSync('mcp-config.json', JSON.stringify(mcpConfig, null, 2));
      await sleep(200);
      mcpSpinner.succeed('Created mcp-config.json');
    }

    // Step 5: Publish
    printStep(4, 5, 'Publish to directory');
    const publishAnswer = await askOnce(chalk.white('    Publish to AgentBridge directory? ') + chalk.gray('(Y/n) '));
    if (publishAnswer.toLowerCase() !== 'n') {
      await doPublish(specContent, manifest.name);
    }
  }

  // Final summary
  printSuccess(manifest.name);
}

async function doPublish(specContent: string, name: string) {
  const spinner = ora({ text: `Publishing to ${REGISTRY_URL}...`, indent: 4 }).start();

  try {
    const res = await fetch(`${REGISTRY_URL}/api/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec: specContent, is_public: true }),
    });

    const data = await res.json();

    if (!res.ok) {
      spinner.fail(`Publish failed: ${data.error}`);
      return;
    }

    spinner.succeed(`Published to ${chalk.cyan(`${REGISTRY_URL}/api/${data.name}`)}`);
  } catch (err: any) {
    spinner.fail(`Publish failed: ${err.message}`);
  }
}

function printSuccess(name: string) {
  console.log('');
  console.log(chalk.green('    ╔══════════════════════════════════════╗'));
  console.log(chalk.green('    ║') + chalk.bold.white('    ✓ Your API is agent-ready!         ') + chalk.green('║'));
  console.log(chalk.green('    ╚══════════════════════════════════════╝'));
  console.log('');
  console.log(chalk.white('    Use it now:'));
  console.log('');
  console.log(`    ${chalk.gray('Chat')}   ${chalk.cyan(`npx agentbridge chat ${name}`)}`);
  console.log(`    ${chalk.gray('Web')}    ${chalk.cyan(`${REGISTRY_URL}/chat`)}`);
  console.log(`    ${chalk.gray('Browse')} ${chalk.cyan(`${REGISTRY_URL}/api/${name}`)}`);
  console.log('');
  printDivider();
  console.log('');
  console.log(chalk.white('    MCP config') + chalk.gray(' (Claude Desktop / Cursor / Windsurf)'));
  console.log('');
  console.log(chalk.gray('    Add to your MCP settings:'));
  console.log('');
  console.log(chalk.white('    {'));
  console.log(chalk.white('      "mcpServers": {'));
  console.log(chalk.white(`        "${name}": {`));
  console.log(chalk.white('          "command": "npx",'));
  console.log(chalk.white(`          "args": ["@agentbridgeai/mcp", "--api", "${name}"]`));
  console.log(chalk.white('        }'));
  console.log(chalk.white('      }'));
  console.log(chalk.white('    }'));
  console.log('');
}
