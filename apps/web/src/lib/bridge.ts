import { AgentBridgeEngine } from '@agentbridgeai/core';
import { ClaudeProvider, OpenAIProvider } from '@agentbridgeai/llm';
import { manifestToPlugin, type AgentBridgeManifest } from '@agentbridgeai/openapi';

export type LLMProviderType = 'openai' | 'claude' | 'groq' | 'gemini';

export function createEngine(
  provider: LLMProviderType,
  apiKey: string,
  manifests: AgentBridgeManifest[],
  model?: string,
  apiCredentials?: Record<string, Record<string, any>>,
) {
  const llm = createProvider(provider, apiKey, model);
  const plugins = manifests.map(m => {
    const credentials = apiCredentials?.[m.name];
    const plugin = manifestToPlugin(m, { credentials });
    if (m.name === 'spotify') {
      const createPlaylist = plugin.actions.find(a => a.name === 'create_playlist');
      if (createPlaylist) {
        const originalExecute = createPlaylist.execute;
        createPlaylist.execute = async (params, context) => {
          const result = await originalExecute(params, context);
          const requestedPublic = params?.public === undefined
            ? true
            : params?.public === true || params?.public === 'true';
          if (result.success || !result.message.includes('API returned 403')) {
            return result;
          }

          const scopeText = typeof credentials?.oauth?.scope === 'string'
            ? credentials.oauth.scope
            : '';
          const scopes = scopeText.split(/\s+/).filter(Boolean);
          const neededScope = requestedPublic ? 'playlist-modify-public' : 'playlist-modify-private';
          const hasNeededScope = scopes.includes(neededScope);
          const hasPublicScope = scopes.includes('playlist-modify-public');
          const hasPrivateScope = scopes.includes('playlist-modify-private');
          const insufficientScope = String(result.message).toLowerCase().includes('insufficient client scope');

          const grantedScopes = scopes.length > 0 ? scopes.join(', ') : 'unknown';
          const reason = insufficientScope
            ? `Spotify returned "Insufficient client scope" for required scope ${neededScope}.`
            : hasNeededScope
              ? `Token includes ${neededScope}, so Spotify is rejecting creation at account/app policy level.`
              : `Token likely missing ${neededScope}.`;
          const next = hasPublicScope && hasPrivateScope
            ? 'Reconnect Spotify (force consent) once, then retry. If it still fails, check Spotify app mode/user access.'
            : `Reconnect Spotify and grant both playlist-modify-public and playlist-modify-private scopes.`;

          return {
            ...result,
            message: `${result.message}\n\nSpotify diagnostics:\n- requested public: ${requestedPublic}\n- required scope: ${neededScope}\n- granted scopes: ${grantedScopes}\n- ${reason}\n- Next step: ${next}`,
          };
        };
      }
    }
    return plugin;
  });
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
