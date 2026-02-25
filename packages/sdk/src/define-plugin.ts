import type { Plugin, Action, AuthConfig } from '@agentbridge/core';
import { z } from 'zod';

export interface PluginDefinition {
  name: string;
  description: string;
  version: string;
  auth?: AuthConfig;
  actions: ActionDefinition[];
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

export interface ActionDefinition {
  name: string;
  description: string;
  parameters: z.ZodType<any>;
  execute: Action['execute'];
  confirm?: boolean;
}

/**
 * Helper to define a plugin with full type safety.
 *
 * Usage:
 * ```ts
 * import { definePlugin } from '@agentbridge/sdk';
 * import { z } from 'zod';
 *
 * export default definePlugin({
 *   name: 'my-plugin',
 *   description: 'Does cool things',
 *   version: '1.0.0',
 *   actions: [{
 *     name: 'do_thing',
 *     description: 'Does the thing',
 *     parameters: z.object({ input: z.string() }),
 *     execute: async ({ input }) => ({
 *       success: true,
 *       message: `Did the thing with ${input}`,
 *     }),
 *   }],
 * });
 * ```
 */
export function definePlugin(definition: PluginDefinition): Plugin {
  return {
    name: definition.name,
    description: definition.description,
    version: definition.version,
    auth: definition.auth,
    setup: definition.setup,
    teardown: definition.teardown,
    actions: definition.actions.map(a => ({
      name: a.name,
      description: a.description,
      parameters: a.parameters,
      execute: a.execute,
      confirm: a.confirm,
    })),
  };
}
