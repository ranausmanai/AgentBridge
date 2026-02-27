import { NextResponse } from 'next/server';
import { getApiByName, getApiCredentials, trackEvent } from '@/lib/db';
import { createEngine, type LLMProviderType } from '@/lib/bridge';
import type { AgentBridgeManifest } from '@agentbridgeai/openapi';
import { attachOwnerCookie, resolveRequestOwner } from '@/lib/auth';

// Store sessions in memory (per-server instance)
const sessions = new Map<string, { engineSessionId: string; engine: any }>();

export async function POST(request: Request) {
  let owner: Awaited<ReturnType<typeof resolveRequestOwner>> = null;
  try {
    owner = await resolveRequestOwner(request, { allowAnonymous: true });
    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      message,
      apis,
      llmProvider,
      llmKey,
      llmModel,
      sessionId,
      apiCredentials,
    } = body as {
      message: string;
      apis: string[];
      llmProvider: LLMProviderType;
      llmKey: string;
      llmModel?: string;
      sessionId?: string;
      apiCredentials?: Record<string, Record<string, string>>;
    };

    if (!message) {
      const response = NextResponse.json({ error: 'message is required' }, { status: 400 });
      return attachOwnerCookie(response, owner);
    }
    if (!llmKey) {
      const response = NextResponse.json({ error: 'llmKey is required' }, { status: 400 });
      return attachOwnerCookie(response, owner);
    }
    if (!apis || apis.length === 0) {
      const response = NextResponse.json({ error: 'Select at least one API' }, { status: 400 });
      return attachOwnerCookie(response, owner);
    }

    // Load manifests for selected APIs
    const manifests: AgentBridgeManifest[] = [];
    for (const name of apis) {
      const api = getApiByName(name);
      if (api) {
        manifests.push(JSON.parse(api.manifest));
      }
    }

    if (manifests.length === 0) {
      const response = NextResponse.json({ error: 'No valid APIs found' }, { status: 400 });
      return attachOwnerCookie(response, owner);
    }

    const storedCredentials = getApiCredentials(owner.ownerId, apis);
    const mergedCredentials: Record<string, Record<string, string>> = {};

    for (const apiName of apis) {
      const fromStored = storedCredentials[apiName]?.credentials ?? {};
      const fromBody = (apiCredentials && apiCredentials[apiName]) ? apiCredentials[apiName] : {};
      const oauth = (fromStored.oauth && typeof fromStored.oauth === 'object') ? fromStored.oauth : {};
      const token =
        fromBody.token ||
        fromBody.api_key ||
        fromStored.token ||
        fromStored.api_key ||
        oauth.access_token;
      const apiKey = fromBody.api_key || fromStored.api_key || token;

      if (token || apiKey) {
        mergedCredentials[apiName] = {
          ...(token ? { token: String(token) } : {}),
          ...(apiKey ? { api_key: String(apiKey) } : {}),
        };
      }
    }

    // Reuse or create session
    let session = sessionId ? sessions.get(sessionId) : undefined;

    if (!session) {
      const engine = createEngine(llmProvider ?? 'openai', llmKey, manifests, llmModel, mergedCredentials);
      const engineSessionId = engine.createSession();
      const newSessionId = crypto.randomUUID();
      session = { engineSessionId, engine };
      sessions.set(newSessionId, session);

      // Clean up old sessions (keep max 100)
      if (sessions.size > 100) {
        const oldest = sessions.keys().next().value;
        if (oldest) sessions.delete(oldest);
      }

      const toolCalls: { action: string; params: any }[] = [];

      const modelResponse = await session.engine.chat(session.engineSessionId, message, {
        onToolCall: (tc: any) => {
          toolCalls.push({
            action: `${tc.pluginName}.${tc.actionName}`,
            params: tc.parameters,
          });
        },
      });

      // Track usage
      for (const name of apis) trackEvent(name, 'chat_use');
      for (const tc of toolCalls) {
        const [apiName, actionId] = tc.action.split('.');
        if (apiName) trackEvent(apiName, 'action_call', actionId);
      }

      const responsePayload = {
        response: modelResponse,
        sessionId: newSessionId,
        toolCalls,
      };
      const jsonResponse = NextResponse.json(responsePayload);
      return attachOwnerCookie(jsonResponse, owner);
    }

    const toolCalls: { action: string; params: any }[] = [];

    const modelResponse = await session.engine.chat(session.engineSessionId, message, {
      onToolCall: (tc: any) => {
        toolCalls.push({
          action: `${tc.pluginName}.${tc.actionName}`,
          params: tc.parameters,
        });
      },
    });

    // Track usage
    for (const name of apis) trackEvent(name, 'chat_use');
    for (const tc of toolCalls) {
      const [apiName, actionId] = tc.action.split('.');
      if (apiName) trackEvent(apiName, 'action_call', actionId);
    }

    const responsePayload = {
      response: modelResponse,
      sessionId,
      toolCalls,
    };
    const jsonResponse = NextResponse.json(responsePayload);
    return attachOwnerCookie(jsonResponse, owner);
  } catch (err: any) {
    const status = (typeof err?.status === 'number' && err.status >= 400 && err.status < 600)
      ? err.status
      : 500;
    const message = String(err?.message ?? 'Chat request failed');
    const response = NextResponse.json({ error: message }, { status });
    return attachOwnerCookie(response, owner);
  }
}
