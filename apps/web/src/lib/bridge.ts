import { AgentBridgeEngine } from '@agentbridgeai/core';
import { ClaudeProvider, OpenAIProvider } from '@agentbridgeai/llm';
import { manifestToPlugin, type AgentBridgeManifest } from '@agentbridgeai/openapi';

export type LLMProviderType = 'openai' | 'claude' | 'groq' | 'gemini';

export function createEngine(
  provider: LLMProviderType,
  apiKey: string,
  manifests: AgentBridgeManifest[],
  model?: string,
  apiCredentials?: Record<string, Record<string, string>>,
) {
  const llm = createProvider(provider, apiKey, model);
  const plugins = manifests.map(m =>
    manifestToPlugin(m, {
      credentials: apiCredentials?.[m.name],
    }),
  );
  const maxToolsPerTurn = provider === 'groq' ? 6 : 12;

  return new AgentBridgeEngine({
    llmProvider: llm,
    plugins,
    maxToolsPerTurn,
  });
}

function createProvider(type: LLMProviderType, apiKey: string, model?: string) {
  switch (type) {
    case 'claude':
      return new ClaudeProvider({ apiKey, model });
    case 'groq':
      return new OpenAIProvider({
        apiKey,
        baseURL: 'https://api.groq.com/openai/v1',
        model: model ?? 'llama-3.3-70b-versatile',
      });
    case 'gemini':
      return new OpenAIProvider({
        apiKey,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        model: model ?? 'gemini-2.0-flash',
      });
    case 'openai':
    default:
      return new OpenAIProvider({ apiKey, model });
  }
}
