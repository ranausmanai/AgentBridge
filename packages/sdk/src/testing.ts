import type { Plugin, ActionResult, Session } from '@agentbridge/core';
import { randomUUID } from 'crypto';

/**
 * Test harness for plugin developers to test their plugins without needing an LLM.
 */
export class PluginTester {
  private plugin: Plugin;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  async setup(): Promise<void> {
    if (this.plugin.setup) await this.plugin.setup();
  }

  async teardown(): Promise<void> {
    if (this.plugin.teardown) await this.plugin.teardown();
  }

  async executeAction(
    actionName: string,
    params: Record<string, any>,
    options?: { askResponses?: Record<string, string> },
  ): Promise<ActionResult> {
    const action = this.plugin.actions.find(a => a.name === actionName);
    if (!action) {
      throw new Error(`Action "${actionName}" not found in plugin "${this.plugin.name}"`);
    }

    const parsed = action.parameters.parse(params);

    const session: Session = {
      id: randomUUID(),
      messages: [],
      metadata: {},
    };

    const result = await action.execute(parsed, {
      session,
      ask: async (question: string) => {
        return options?.askResponses?.[question] ?? '';
      },
    });

    return result;
  }

  getActionNames(): string[] {
    return this.plugin.actions.map(a => a.name);
  }
}
