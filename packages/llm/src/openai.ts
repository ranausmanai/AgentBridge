import OpenAI from 'openai';
import type { LLMProvider, LLMTool, LLMResponse, Message, ToolCall } from '@agentbridgeai/core';

export interface OpenAIProviderOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  baseURL?: string;
}

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private client: OpenAI;
  private model: string;
  private maxTokens: number;

  constructor(options: OpenAIProviderOptions = {}) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
    });
    this.model = options.model ?? 'gpt-4o';
    this.maxTokens = options.maxTokens ?? 4096;
  }

  async chat(messages: Message[], tools: LLMTool[]): Promise<LLMResponse> {
    const openaiMessages = this.convertMessages(messages);

    const openaiTools: OpenAI.ChatCompletionTool[] = tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: openaiMessages,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
      });

      return this.parseResponse(response);
    } catch (err: any) {
      // Groq/some providers fail on tool calls with "failed_generation" —
      // retry once without tools so the user still gets a text response.
      if (err?.status === 400 && String(err?.message ?? '').includes('Failed to')) {
        const fallback = await this.client.chat.completions.create({
          model: this.model,
          max_tokens: this.maxTokens,
          messages: openaiMessages,
        });
        return this.parseResponse(fallback);
      }
      // Some providers reject oversized tool payloads (e.g., 413).
      // Retry with a smaller subset before failing hard.
      if (err?.status === 413 && openaiTools.length > 0) {
        const reducedTools = openaiTools.slice(0, Math.max(1, Math.floor(openaiTools.length / 2)));
        const fallback = await this.client.chat.completions.create({
          model: this.model,
          max_tokens: this.maxTokens,
          messages: openaiMessages,
          tools: reducedTools,
        });
        return this.parseResponse(fallback);
      }
      throw err;
    }
  }

  private convertMessages(messages: Message[]): OpenAI.ChatCompletionMessageParam[] {
    const result: OpenAI.ChatCompletionMessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        result.push({ role: 'system', content: msg.content });
      } else if (msg.role === 'user') {
        result.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        const toolCalls = msg.toolCalls?.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: `${tc.pluginName}__${tc.actionName}`,
            arguments: JSON.stringify(tc.parameters),
          },
        }));
        result.push({
          role: 'assistant',
          content: msg.content || null,
          tool_calls: toolCalls,
        });
      } else if (msg.role === 'tool') {
        result.push({
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.toolCallId!,
        });
      }
    }

    return result;
  }

  private parseResponse(response: OpenAI.ChatCompletion): LLMResponse {
    const choice = response.choices[0];
    if (!choice) return { text: 'No response from LLM.' };

    const message = choice.message;
    const toolCalls: ToolCall[] = [];

    if (message.tool_calls) {
      for (const tc of message.tool_calls) {
        const [pluginName, actionName] = tc.function.name.split('__');
        toolCalls.push({
          id: tc.id,
          pluginName,
          actionName,
          parameters: JSON.parse(tc.function.arguments),
        });
      }
    }

    return {
      text: message.content ?? undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}
