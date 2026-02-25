import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Plugin, Action, LLMTool } from './types.js';

export class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();

  async register(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered`);
    }
    if (plugin.setup) {
      await plugin.setup();
    }
    this.plugins.set(plugin.name, plugin);
  }

  unregister(name: string): void {
    const plugin = this.plugins.get(name);
    if (plugin?.teardown) {
      plugin.teardown();
    }
    this.plugins.delete(name);
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  getAction(pluginName: string, actionName: string): Action | undefined {
    const plugin = this.plugins.get(pluginName);
    return plugin?.actions.find(a => a.name === actionName);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Convert all plugin actions into LLM tool definitions.
   * Tool names are formatted as "pluginName__actionName" so the LLM
   * can call them and we can route back to the right plugin.
   */
  toLLMTools(): LLMTool[] {
    const tools: LLMTool[] = [];
    for (const plugin of this.plugins.values()) {
      for (const action of plugin.actions) {
        const jsonSchema = zodToJsonSchema(action.parameters, {
          target: 'openApi3',
        });

        // Remove the top-level $schema key that zodToJsonSchema adds
        const { $schema, ...parameterSchema } = jsonSchema as any;

        tools.push({
          name: `${plugin.name}__${action.name}`,
          description: `[${plugin.name}] ${action.description}`,
          parameters: parameterSchema,
        });
      }
    }
    return tools;
  }

  /**
   * Parse a tool name like "weather__get_weather" back into plugin + action names
   */
  static parseToolName(toolName: string): { pluginName: string; actionName: string } {
    const [pluginName, actionName] = toolName.split('__');
    if (!pluginName || !actionName) {
      throw new Error(`Invalid tool name format: "${toolName}". Expected "pluginName__actionName"`);
    }
    return { pluginName, actionName };
  }
}
