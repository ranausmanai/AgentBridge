import type {
  AgentBridgeConfig,
  Plugin,
  LLMProvider,
  Message,
  ToolCall,
  ActionResult,
} from './types.js';
import { PluginRegistry } from './plugin-registry.js';
import { ActionExecutor } from './action-executor.js';
import { ConversationManager } from './conversation.js';

const DEFAULT_SYSTEM_PROMPT = `You are AgentBridge, a helpful AI assistant that can interact with various apps and services on behalf of the user.

You have access to tools provided by installed plugins. Use them when the user asks you to perform actions.

When a tool call fails or parameters are missing, ask the user for the needed information.

Be concise and helpful. When you perform an action, report the result clearly.`;

export class AgentBridgeEngine {
  private registry: PluginRegistry;
  private executor: ActionExecutor;
  private conversations: ConversationManager;
  private llm: LLMProvider;
  private systemPrompt: string;

  constructor(config: AgentBridgeConfig) {
    this.registry = new PluginRegistry();
    this.executor = new ActionExecutor(this.registry);
    this.conversations = new ConversationManager();
    this.llm = config.llmProvider;
    this.systemPrompt = config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

    if (config.plugins) {
      for (const plugin of config.plugins) {
        this.registerPlugin(plugin);
      }
    }
  }

  async registerPlugin(plugin: Plugin): Promise<void> {
    await this.registry.register(plugin);
  }

  getPlugins(): Plugin[] {
    return this.registry.getAllPlugins();
  }

  createSession(): string {
    const session = this.conversations.create();
    // Add system message
    this.conversations.addMessage(session.id, {
      role: 'system',
      content: this.buildSystemPrompt(),
    });
    return session.id;
  }

  private buildSystemPrompt(): string {
    const plugins = this.registry.getAllPlugins();
    const pluginList = plugins
      .map(p => `- **${p.name}**: ${p.description}`)
      .join('\n');

    return `${this.systemPrompt}

## Available Plugins
${pluginList || 'No plugins installed.'}`;
  }

  /**
   * Process a user message and return the assistant's response.
   * Handles the full loop: LLM call → tool execution → follow-up LLM call.
   */
  async chat(
    sessionId: string,
    userMessage: string,
    options?: {
      askUser?: (question: string) => Promise<string>;
      onToolCall?: (toolCall: ToolCall) => void;
      onToolResult?: (actionName: string, result: ActionResult) => void;
    },
  ): Promise<string> {
    const session = this.conversations.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    // Add user message
    this.conversations.addMessage(sessionId, {
      role: 'user',
      content: userMessage,
    });

    const tools = this.registry.toLLMTools();
    const maxIterations = 10; // prevent infinite tool-calling loops

    for (let i = 0; i < maxIterations; i++) {
      const messages = this.conversations.getMessages(sessionId);
      const response = await this.llm.chat(messages, tools);

      // If no tool calls, return the text response
      if (!response.toolCalls || response.toolCalls.length === 0) {
        const text = response.text ?? 'I have nothing to say.';
        this.conversations.addMessage(sessionId, {
          role: 'assistant',
          content: text,
        });
        return text;
      }

      // Add assistant message with tool calls
      this.conversations.addMessage(sessionId, {
        role: 'assistant',
        content: response.text ?? '',
        toolCalls: response.toolCalls,
      });

      // Execute each tool call
      const askUser = options?.askUser ?? (async () => '');
      const toolResults = await this.executor.executeAll(
        response.toolCalls,
        session,
        askUser,
      );

      // Add tool results as messages
      for (const tr of toolResults) {
        const tc = response.toolCalls.find(t => t.id === tr.toolCallId);
        if (options?.onToolCall && tc) options.onToolCall(tc);
        if (options?.onToolResult && tc) {
          options.onToolResult(`${tc.pluginName}.${tc.actionName}`, tr.result);
        }

        this.conversations.addMessage(sessionId, {
          role: 'tool',
          content: JSON.stringify(tr.result),
          toolCallId: tr.toolCallId,
        });
      }

      // Loop back so the LLM can process the tool results
    }

    return 'I got stuck in a loop. Please try again.';
  }
}
