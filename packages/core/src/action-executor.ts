import type { ActionContext, ActionResult, ToolCall, ToolResult, Session } from './types.js';
import { PluginRegistry } from './plugin-registry.js';

export class ActionExecutor {
  constructor(private registry: PluginRegistry) {}

  async execute(
    toolCall: ToolCall,
    session: Session,
    askUser: (question: string) => Promise<string>,
  ): Promise<ToolResult> {
    const action = this.registry.getAction(toolCall.pluginName, toolCall.actionName);

    if (!action) {
      return {
        toolCallId: toolCall.id,
        result: {
          success: false,
          message: `Unknown action: ${toolCall.pluginName}.${toolCall.actionName}`,
        },
      };
    }

    // Validate parameters against the action's zod schema
    const parseResult = action.parameters.safeParse(toolCall.parameters);
    if (!parseResult.success) {
      return {
        toolCallId: toolCall.id,
        result: {
          success: false,
          message: `Invalid parameters: ${parseResult.error.issues.map(i => i.message).join(', ')}`,
        },
      };
    }

    const context: ActionContext = {
      session,
      ask: askUser,
    };

    try {
      const result = await action.execute(parseResult.data, context);
      return { toolCallId: toolCall.id, result };
    } catch (error: any) {
      return {
        toolCallId: toolCall.id,
        result: {
          success: false,
          message: `Action failed: ${error.message}`,
        },
      };
    }
  }

  async executeAll(
    toolCalls: ToolCall[],
    session: Session,
    askUser: (question: string) => Promise<string>,
  ): Promise<ToolResult[]> {
    return Promise.all(
      toolCalls.map(tc => this.execute(tc, session, askUser)),
    );
  }
}
