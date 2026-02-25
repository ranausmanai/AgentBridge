import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMTool, LLMResponse, Message, ToolCall } from '@agentbridge/core';
import { randomUUID } from 'crypto';

export interface ClaudeProviderOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

export class ClaudeProvider implements LLMProvider {
  name = 'claude';
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(options: ClaudeProviderOptions = {}) {
    this.client = new Anthropic({ apiKey: options.apiKey });
    this.model = options.model ?? 'claude-sonnet-4-20250514';
    this.maxTokens = options.maxTokens ?? 4096;
  }

  async chat(messages: Message[], tools: LLMTool[]): Promise<LLMResponse> {
    // Separate system message from the rest
    const systemMsg = messages.find(m => m.role === 'system');
    const nonSystemMsgs = messages.filter(m => m.role !== 'system');

    // Convert to Anthropic message format
    const anthropicMessages = this.convertMessages(nonSystemMsgs);

    // Convert tools to Anthropic format
    const anthropicTools = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool['input_schema'],
    }));

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemMsg?.content ?? '',
      messages: anthropicMessages,
      tools: anthropicTools.length > 0 ? anthropicTools : undefined,
    });

    return this.parseResponse(response);
  }

  private convertMessages(messages: Message[]): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'user') {
        result.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        const content: Anthropic.ContentBlockParam[] = [];
        if (msg.content) {
          content.push({ type: 'text', text: msg.content });
        }
        if (msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            content.push({
              type: 'tool_use',
              id: tc.id,
              name: `${tc.pluginName}__${tc.actionName}`,
              input: tc.parameters,
            });
          }
        }
        result.push({ role: 'assistant', content });
      } else if (msg.role === 'tool') {
        result.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.toolCallId!,
              content: msg.content,
            },
          ],
        });
      }
    }

    return result;
  }

  private parseResponse(response: Anthropic.Message): LLMResponse {
    let text = '';
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text;
      } else if (block.type === 'tool_use') {
        const [pluginName, actionName] = block.name.split('__');
        toolCalls.push({
          id: block.id,
          pluginName,
          actionName,
          parameters: block.input as Record<string, any>,
        });
      }
    }

    return {
      text: text || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}
