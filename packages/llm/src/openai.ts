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
  private baseURL?: string;

  constructor(options: OpenAIProviderOptions = {}) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
    });
    this.model = options.model ?? 'gpt-4o';
    this.maxTokens = options.maxTokens ?? 4096;
    this.baseURL = options.baseURL;
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
      const status = typeof err?.status === 'number' ? err.status : undefined;
      const msg = String(err?.message ?? '');

      // Retry strategy for tool-related provider failures:
      // 1) try fewer tools, 2) then try no tools.
      if (openaiTools.length > 0 && (status === 400 || status === 413)) {
        try {
          const reducedTools = openaiTools.slice(0, Math.max(1, Math.floor(openaiTools.length / 2)));
          const reduced = await this.client.chat.completions.create({
            model: this.model,
            max_tokens: this.maxTokens,
            messages: openaiMessages,
            tools: reducedTools,
          });
          return this.parseResponse(reduced);
        } catch {}

        // Groq often returns malformed function-call errors on tool mode.
        if (status === 413 || status === 400 || msg.includes('Failed to') || msg.includes('no body')) {
          try {
            const fallback = await this.client.chat.completions.create({
              model: this.model,
              max_tokens: this.maxTokens,
              messages: openaiMessages,
            });
            return this.parseResponse(fallback);
          } catch {}
        }
      }

      throw this.enrichProviderError(err);
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

  private enrichProviderError(err: any): Error {
    const status = typeof err?.status === 'number' ? err.status : 500;
    const raw = String(err?.message ?? 'Provider request failed');
    const provider = this.detectProvider();

    let detail = raw;
    if (status === 429) {
      detail = `${provider} rate limit/quota exceeded (429). Check API key quota or billing.`;
    } else if (status === 401) {
      detail = `${provider} authentication failed (401). Check API key.`;
    } else if (status === 400 && raw.includes('no body')) {
      detail = `${provider} rejected the request (400). This is often model/tool compatibility or key restrictions.`;
    }

    const wrapped = new Error(detail);
    (wrapped as any).status = status;
    return wrapped;
  }

  private detectProvider(): string {
    const b = (this.baseURL ?? '').toLowerCase();
    if (b.includes('groq')) return 'Groq';
    if (b.includes('generativelanguage.googleapis.com')) return 'Gemini';
    return 'LLM provider';
  }
}
