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
        const compactSchema = this.compactJsonSchema(parameterSchema);

        tools.push({
          name: `${plugin.name}__${action.name}`,
          description: `[${plugin.name}] ${action.description}`,
          parameters: compactSchema,
        });
      }
    }
    return tools;
  }

  /**
   * Return a relevance-ranked subset of tools for the current user request.
   * This keeps tool payload small for providers with strict token/request limits.
   */
  selectLLMTools(userInput: string, maxTools: number): LLMTool[] {
    const allTools = this.toLLMTools();
    if (maxTools <= 0 || allTools.length <= maxTools) return allTools;

    const queryTokens = this.expandQueryTokens(this.tokenize(userInput));
    const rawInput = userInput.toLowerCase().trim();
    const pluginNames = new Set(Array.from(this.plugins.keys()).map(n => n.toLowerCase()));
    const mentionedPlugins = new Set(
      Array.from(pluginNames).filter(p => queryTokens.has(p) || userInput.toLowerCase().includes(p)),
    );

    const scored = allTools
      .map(tool => {
        const { pluginName, actionName } = PluginRegistry.parseToolName(tool.name);
        const actionTokens = this.tokenize(actionName.replace(/_/g, ' '));
        const descTokens = this.tokenize(tool.description);
        const overlapAction = this.countOverlap(queryTokens, actionTokens);
        const overlapDesc = this.countOverlap(queryTokens, descTokens);
        const basePriority = this.actionBasePriority(actionName);

        let score = basePriority + overlapAction * 8 + overlapDesc * 3;
        if (mentionedPlugins.has(pluginName.toLowerCase())) score += 30;
        if (rawInput.length > 2 && tool.name.toLowerCase().includes(rawInput)) score += 20;

        return { tool, pluginName, score };
      })
      .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name));

    // If user explicitly mentioned plugin(s), prioritize only those first.
    if (mentionedPlugins.size > 0) {
      const focused = scored
        .filter(s => mentionedPlugins.has(s.pluginName.toLowerCase()))
        .slice(0, maxTools)
        .map(s => s.tool);
      if (focused.length >= maxTools) return focused;

      const rest = scored
        .filter(s => !mentionedPlugins.has(s.pluginName.toLowerCase()))
        .slice(0, maxTools - focused.length)
        .map(s => s.tool);
      return [...focused, ...rest];
    }

    return scored.slice(0, maxTools).map(s => s.tool);
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

  private compactJsonSchema(value: any): any {
    if (Array.isArray(value)) return value.map(v => this.compactJsonSchema(v));
    if (!value || typeof value !== 'object') return value;

    const out: Record<string, any> = {};
    for (const [key, raw] of Object.entries(value)) {
      // Keep only fields required for tool-calling argument validation.
      if (['description', 'default', 'examples', 'title', '$id', '$comment'].includes(key)) continue;
      out[key] = this.compactJsonSchema(raw);
    }
    return out;
  }

  private tokenize(text: string): Set<string> {
    const stopwords = new Set([
      'the', 'a', 'an', 'to', 'for', 'with', 'and', 'or', 'of', 'in', 'on', 'at', 'is', 'are',
      'can', 'could', 'would', 'should', 'please', 'me', 'my', 'you', 'your', 'it', 'this', 'that',
      'any', 'from', 'via', 'by',
    ]);
    const tokens = (text.toLowerCase().match(/[a-z0-9_]+/g) ?? []).filter(t => !stopwords.has(t));
    const normalized = new Set<string>();
    for (const token of tokens) {
      normalized.add(token);
      if (token.endsWith('s') && token.length > 3) {
        normalized.add(token.slice(0, -1));
      }
    }
    return normalized;
  }

  private expandQueryTokens(tokens: Set<string>): Set<string> {
    const expanded = new Set(tokens);
    const synonyms: Record<string, string[]> = {
      song: ['track', 'music'],
      songs: ['tracks', 'music'],
      find: ['search', 'lookup', 'get'],
      discover: ['search', 'recommendations'],
      play: ['playback', 'start'],
      pause: ['playback'],
      skip: ['next', 'previous'],
      liked: ['saved', 'library'],
    };

    for (const token of Array.from(tokens)) {
      for (const add of synonyms[token] ?? []) expanded.add(add);
    }
    return expanded;
  }

  private countOverlap(a: Set<string>, b: Set<string>): number {
    let overlap = 0;
    for (const token of a) {
      if (b.has(token)) overlap++;
    }
    return overlap;
  }

  private actionBasePriority(actionName: string): number {
    const n = actionName.toLowerCase();
    if (n.includes('search') || n.includes('find')) return 18;
    if (n.includes('list')) return 12;
    if (n.startsWith('get_') || n.includes('get')) return 10;
    if (n.includes('create') || n.includes('add') || n.includes('start')) return 8;
    if (n.includes('update') || n.includes('edit') || n.includes('save')) return 7;
    if (n.includes('delete') || n.includes('remove')) return 6;
    return 4;
  }
}
