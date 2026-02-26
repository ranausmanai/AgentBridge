import * as readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { convertOpenAPIToManifest, type AgentBridgeManifest } from '@agentbridgeai/openapi';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import Conf from 'conf';

const REGISTRY_URL = process.env.AGENTBRIDGE_REGISTRY || 'https://agentbridge.cc';
const CLI_AUTH_PATH = '/api/cli-auth/start';
const config = new Conf<{ registryToken?: string; registryUrl?: string }>({ projectName: 'agentbridge' });

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve));
}

async function askOnce(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await ask(rl, question);
  rl.close();
  return answer;
}

function getRegistryAuthHeaders(registryUrl: string): Record<string, string> {
  const envToken = process.env.AGENTBRIDGE_TOKEN;
  const savedToken = config.get('registryToken');
  const savedRegistry = config.get('registryUrl');
  const token = envToken || (savedRegistry === registryUrl ? savedToken : undefined);
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function promptYesNo(question: string, defaultYes = true): Promise<boolean> {
  const answer = await askOnce(question);
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

  return new Promise(resolve => {
    const server = createServer(async (req, res) => {
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
      if (ok) {
        config.set('registryToken', token!);
        config.set('registryUrl', registryUrl);
      }
      resolve(!!ok);
    });

    server.listen(0, '127.0.0.1', async () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        resolve(false);
        return;
      }

      const callbackUrl = `http://127.0.0.1:${address.port}/callback`;
      const loginUrl = `${registryUrl}${CLI_AUTH_PATH}?callback_url=${encodeURIComponent(callbackUrl)}&state=${encodeURIComponent(state)}`;

      console.log('');
      console.log(chalk.bold.cyan('    AgentBridge Login'));
      console.log(chalk.gray(`    Registry: ${registryUrl}`));
      console.log(chalk.gray('    Complete login in your browser, then return here.'));
      console.log(chalk.white(`    ${loginUrl}`));

      const opened = await openBrowser(loginUrl);
      if (opened) {
        console.log(chalk.gray('    Opened browser window for login.'));
      } else {
        console.log(chalk.yellow('    Could not open browser automatically.'));
      }

      const timeout = setTimeout(() => {
        server.close();
        resolve(false);
      }, 180000);

      server.on('close', () => clearTimeout(timeout));
    });
  });
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const PANEL_WIDTH = 69;

function stripAnsi(input: string): string {
  return input.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

function padAnsi(input: string, width: number): string {
  const visible = stripAnsi(input).length;
  return input + ' '.repeat(Math.max(0, width - visible));
}

function panelLine(content = '') {
  console.log(chalk.cyan('    │ ') + padAnsi(content, PANEL_WIDTH - 4) + chalk.cyan(' │'));
}

function panelDivider() {
  console.log(chalk.cyan('    ├' + '─'.repeat(PANEL_WIDTH) + '┤'));
}

async function printHeader(animate = false) {
  const lines = [
    '',
    chalk.cyan('    ╭' + '─'.repeat(PANEL_WIDTH) + '╮'),
    panelLineString(chalk.bold.white('AgentBridge Init') + chalk.gray('  ·  Make any API agent-ready')),
    panelLineString(chalk.gray('OpenAPI / Swagger → Manifest → MCP-ready config')),
    panelLineString(),
    panelLineString(chalk.white('Workflow')),
    panelLineString(chalk.gray('1') + ' Load spec      ' + chalk.gray('2') + ' Preview actions   ' + chalk.gray('3') + ' Generate manifest'),
    panelLineString(chalk.gray('4') + ' MCP config     ' + chalk.gray('5') + ' Publish (optional)'),
    panelDividerString(),
    panelLineString(chalk.white('Quick Tips')),
    panelLineString(chalk.gray('• Local file paths and HTTPS URLs are both supported')),
    panelLineString(chalk.gray('• ') + chalk.cyan('--spec <path|url>') + chalk.gray(' skips the first prompt')),
    panelLineString(chalk.gray('• ') + chalk.cyan('--yes') + chalk.gray(' runs a fast non-interactive setup')),
    panelLineString(chalk.gray('Type ') + chalk.cyan('/exit') + chalk.gray(' anytime to cancel setup')),
    chalk.cyan('    ╰' + '─'.repeat(PANEL_WIDTH) + '╯'),
    '',
  ];

  if (!animate) {
    for (const line of lines) console.log(line);
    return;
  }

  for (const line of lines) {
    console.log(line);
    if (line) await sleep(18);
  }
}

function panelLineString(content = '') {
  return chalk.cyan('    │ ') + padAnsi(content, PANEL_WIDTH - 4) + chalk.cyan(' │');
}

function panelDividerString() {
  return chalk.cyan('    ├' + '─'.repeat(PANEL_WIDTH) + '┤');
}

function printDivider() {
  console.log(chalk.gray('    ──────────────────────────────────────'));
}

function printStep(step: number, total: number, label: string) {
  console.log('');
  console.log(chalk.cyan(`    ● Step ${step}/${total}`) + chalk.gray(`  ${label}`));
  console.log(chalk.gray('    ' + '─'.repeat(Math.min(48, label.length + 14))));
  console.log('');
}

function isExitCommand(value: string | undefined) {
  const v = (value ?? '').trim().toLowerCase();
  return v === '/exit' || v === '/quit' || v === '/q';
}

/**
 * Interactive init command: guides API owners through making their API agent-ready.
 */
export async function runInit(opts?: { yes?: boolean; spec?: string }) {
  const nonInteractive = opts?.yes;

  await printHeader(!nonInteractive && !!process.stdout.isTTY);

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

  let specContent: string | undefined;
  let manifest: AgentBridgeManifest | undefined;

  while (!specContent || !manifest) {
    if (!specSource) {
      printStep(1, 5, 'Load your OpenAPI spec');
      specSource = await askOnce(chalk.white('    Path or URL: '));
    }

    if (isExitCommand(specSource)) {
      console.log(chalk.gray('    Cancelled.'));
      return;
    }

    const spinner = ora({ text: 'Loading spec...', indent: 4 }).start();
    try {
      if (specSource.startsWith('http')) {
        spinner.text = `Fetching from ${specSource}...`;
        const res = await fetch(specSource);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        specContent = await res.text();
      } else if (existsSync(specSource)) {
        specContent = readFileSync(specSource, 'utf-8');
      } else {
        throw new Error(`File not found: ${specSource}`);
      }
      spinner.succeed('Spec loaded');
    } catch (err: any) {
      spinner.fail(err.message || `Failed to load spec: ${err.message}`);
      if (nonInteractive || opts?.spec) return;
      console.log(chalk.gray('    Try again, or type /exit to cancel.'));
      console.log('');
      specSource = undefined;
      continue;
    }

    const parseSpinner = ora({ text: 'Parsing OpenAPI spec...', indent: 4 }).start();
    try {
      manifest = convertOpenAPIToManifest(specContent);
      await sleep(300); // Brief pause so user sees the spinner
      parseSpinner.succeed(`Detected ${chalk.bold(manifest.name)}`);
    } catch (err: any) {
      parseSpinner.fail(`Failed to parse spec: ${err.message}`);
      if (nonInteractive || opts?.spec) return;
      console.log(chalk.gray('    Try a different spec, or type /exit to cancel.'));
      console.log('');
      specSource = undefined;
      specContent = undefined;
      continue;
    }
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

  let publishAttempted = false;
  let publishSucceeded = false;

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

    publishAttempted = true;
    publishSucceeded = await doPublish(specContent, manifest.name, true);
  } else {
    // Step 3: Generate manifest
    printStep(2, 5, 'Generate manifest');
    const confirm = await askOnce(chalk.white('    Create .agentbridge.json? ') + chalk.gray('(Y/n) '));
    if (isExitCommand(confirm)) {
      console.log(chalk.gray('    Cancelled.'));
      return;
    }
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
    if (isExitCommand(mcpAnswer)) {
      console.log(chalk.gray('    Cancelled.'));
      return;
    }
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
    if (isExitCommand(publishAnswer)) {
      console.log(chalk.gray('    Cancelled.'));
      return;
    }
    if (publishAnswer.toLowerCase() !== 'n') {
      const visibility = await askOnce(
        chalk.white('    Visibility ') +
        chalk.gray('[public/private] ') +
        chalk.gray('(default: public): '),
      );
      if (isExitCommand(visibility)) {
        console.log(chalk.gray('    Cancelled.'));
        return;
      }

      const normalized = visibility.trim().toLowerCase();
      let finalIsPublic = true;
      if (normalized === 'private' || normalized === 'pr') {
        finalIsPublic = false;
      } else if (normalized === '' || normalized === 'public' || normalized === 'p') {
        finalIsPublic = true;
      } else {
        console.log(chalk.yellow('    Unknown visibility. Using public.'));
      }

      if (!finalIsPublic) {
        console.log(chalk.gray('    Private APIs may require registry auth/ownership on hosted instances.'));
      }

      publishAttempted = true;
      publishSucceeded = await doPublish(specContent, manifest.name, finalIsPublic);
    }
  }

  // Final summary
  printSuccess(manifest.name, publishAttempted, publishSucceeded);
}

async function doPublish(specContent: string, name: string, isPublic = true): Promise<boolean> {
  const spinner = ora({
    text: `Publishing ${isPublic ? 'public' : 'private'} API to ${REGISTRY_URL}...`,
    indent: 4,
  }).start();

  try {
    const res = await fetch(`${REGISTRY_URL}/api/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getRegistryAuthHeaders(REGISTRY_URL),
      },
      body: JSON.stringify({ spec: specContent, is_public: isPublic }),
    });

    const responseText = await res.text();
    let data: any = null;
    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      data = null;
    }

    const redirectedToLogin = res.redirected && res.url.includes('/login');

    const looksLikeHtml = responseText.trimStart().toLowerCase().startsWith('<!doctype html') ||
      responseText.trimStart().toLowerCase().startsWith('<html');

    if (!res.ok || !data || redirectedToLogin) {
      const authRequired = res.status === 401 || data?.code === 'AUTH_REQUIRED' || redirectedToLogin;
      const errorMessage =
        data?.error ??
        (redirectedToLogin ? 'Login required to publish APIs' : `Unexpected response (${res.status})`);
      spinner.fail(`Publish failed: ${errorMessage}`);

      if (authRequired && process.stdout.isTTY) {
        console.log(chalk.gray(`    Login required on ${REGISTRY_URL} before publishing.`));
        const shouldLogin = await promptYesNo('    Open login window in browser now? (Y/n): ');
        if (shouldLogin) {
          const ok = await loginToRegistry(REGISTRY_URL);
          if (!ok) {
            console.log(chalk.red('    Login failed or timed out.'));
            return false;
          }
          return doPublish(specContent, name, isPublic);
        }
      }

      if (!data && responseText && process.stdout.isTTY) {
        const preview = responseText.replace(/\s+/g, ' ').slice(0, 140);
        console.log(chalk.gray(`    Server response preview: ${preview}${responseText.length > 140 ? '…' : ''}`));
        if (looksLikeHtml) {
          console.log(chalk.yellow(`    Registry at ${REGISTRY_URL} returned HTML instead of API JSON.`));
          console.log(chalk.gray('    Check AGENTBRIDGE_REGISTRY (wrong host/port is likely).'));
          console.log(chalk.gray('    Example: unset AGENTBRIDGE_REGISTRY  (to use https://agentbridge.cc)'));
        }
      }

      if (!isPublic) {
        console.log(chalk.gray('    Tip: private publish may require logging in on the web UI or registry auth support in CLI.'));
      }
      return false;
    }

    spinner.succeed(`${isPublic ? 'Published' : 'Published (private)'} to ${chalk.cyan(`${REGISTRY_URL}/api/${data.name}`)}`);
    return true;
  } catch (err: any) {
    spinner.fail(`Publish failed: ${err.message}`);
    return false;
  }
}

function printSuccess(name: string, publishAttempted: boolean, publishSucceeded: boolean) {
  console.log('');
  if (publishAttempted && !publishSucceeded) {
    console.log(chalk.yellow('    ╔══════════════════════════════════════╗'));
    console.log(chalk.yellow('    ║') + chalk.bold.white('    ✓ Local setup complete              ') + chalk.yellow('║'));
    console.log(chalk.yellow('    ╚══════════════════════════════════════╝'));
    console.log(chalk.yellow('    Publish did not complete. Local files were created.'));
  } else {
    console.log(chalk.green('    ╔══════════════════════════════════════╗'));
    console.log(chalk.green('    ║') + chalk.bold.white('    ✓ Your API is agent-ready!         ') + chalk.green('║'));
    console.log(chalk.green('    ╚══════════════════════════════════════╝'));
  }
  console.log('');
  console.log(chalk.white('    Use it now:'));
  console.log('');
  console.log(`    ${chalk.gray('Chat')}   ${chalk.cyan(`npx agentbridge chat ${name}`)}`);
  if (!publishAttempted || publishSucceeded) {
    console.log(`    ${chalk.gray('Web')}    ${chalk.cyan(`${REGISTRY_URL}/chat`)}`);
    console.log(`    ${chalk.gray('Browse')} ${chalk.cyan(`${REGISTRY_URL}/api/${name}`)}`);
  } else {
    console.log(`    ${chalk.gray('Publish')} ${chalk.cyan('agentbridge login')} ${chalk.gray('then retry init/publish')}`);
  }
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
