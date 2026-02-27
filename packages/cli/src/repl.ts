import * as readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import type { AgentBridgeEngine, ToolCall, ActionResult } from '@agentbridgeai/core';
import { CLI_VERSION } from './version.js';

export async function startRepl(engine: AgentBridgeEngine): Promise<void> {
  const sessionId = engine.createSession();
  const plugins = engine.getPlugins();

  // In case a previous prompt (e.g. API key setup) paused stdin, resume it.
  if (!process.stdin.destroyed) process.stdin.resume();

  console.log('');
  console.log(chalk.bold.cyan('  AgentBridge') + chalk.gray(` v${CLI_VERSION}`));
  console.log(chalk.gray(`  Loaded plugins: ${plugins.map(p => p.name).join(', ') || 'none'}`));
  console.log(chalk.gray('  Type naturally, or use /help, /plugins, /quit'));
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green('> '),
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    // Handle slash commands
    if (input.startsWith('/')) {
      handleCommand(input, engine);
      rl.prompt();
      return;
    }

    const spinner = ora({
      text: 'Thinking...',
      color: 'cyan',
      // Keep readline stable in interactive chat; ora's default stdin handling
      // can interfere with subsequent prompts in a REPL.
      discardStdin: false,
    }).start();

    try {
      const response = await engine.chat(sessionId, input, {
        onToolCall: (tc: ToolCall) => {
          spinner.text = `Running ${tc.pluginName}.${tc.actionName}...`;
        },
        onToolResult: (name: string, result: ActionResult) => {
          if (!result.success) {
            spinner.warn(chalk.yellow(`${name} failed: ${result.message}`));
          }
        },
        askUser: async (question: string) => {
          spinner.stop();
          return new Promise<string>((resolve) => {
            rl.question(chalk.yellow(`  ${question} `), (answer) => {
              resolve(answer);
              spinner.start();
            });
          });
        },
      });

      spinner.stop();
      console.log('');
      console.log(chalk.white(`  ${response}`));
      console.log('');
    } catch (error: any) {
      spinner.fail(chalk.red(`Error: ${error.message}`));
      console.log('');
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log(chalk.gray('\nGoodbye!'));
    process.exit(0);
  });
}

function handleCommand(input: string, engine: AgentBridgeEngine): void {
  const cmd = input.toLowerCase();

  if (cmd === '/quit' || cmd === '/exit' || cmd === '/q') {
    console.log(chalk.gray('\nGoodbye!'));
    process.exit(0);
  }

  if (cmd === '/plugins') {
    const plugins = engine.getPlugins();
    if (plugins.length === 0) {
      console.log(chalk.gray('  No plugins installed.'));
      return;
    }
    console.log('');
    console.log(chalk.bold('  Installed Plugins:'));
    for (const p of plugins) {
      console.log(`  ${chalk.cyan(p.name)} ${chalk.gray(`v${p.version}`)} — ${p.description}`);
      for (const a of p.actions) {
        console.log(`    ${chalk.green(a.name)} — ${a.description}`);
      }
    }
    console.log('');
    return;
  }

  if (cmd === '/help') {
    console.log('');
    console.log(chalk.bold('  AgentBridge Commands:'));
    console.log(`  ${chalk.green('/plugins')}  — List installed plugins and their actions`);
    console.log(`  ${chalk.green('/help')}     — Show this help message`);
    console.log(`  ${chalk.green('/quit')}     — Exit AgentBridge`);
    console.log('');
    console.log(chalk.gray('  Or just type naturally! e.g. "what\'s the weather in Tokyo?"'));
    console.log('');
    return;
  }

  console.log(chalk.yellow(`  Unknown command: ${input}. Type /help for available commands.`));
}
