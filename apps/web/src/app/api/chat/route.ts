import { NextResponse } from 'next/server';
import { getApiByName } from '@/lib/db';
import { createEngine, type LLMProviderType } from '@/lib/bridge';
import type { AgentBridgeManifest } from '@agentbridgeai/openapi';

// Store sessions in memory (per-server instance)
const sessions = new Map<string, { engineSessionId: string; engine: any }>();

export async function POST(request: Request) {
  try {
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
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }
    if (!llmKey) {
      return NextResponse.json({ error: 'llmKey is required' }, { status: 400 });
    }
    if (!apis || apis.length === 0) {
      return NextResponse.json({ error: 'Select at least one API' }, { status: 400 });
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
      return NextResponse.json({ error: 'No valid APIs found' }, { status: 400 });
    }

    // Reuse or create session
    let session = sessionId ? sessions.get(sessionId) : undefined;

    if (!session) {
      const engine = createEngine(llmProvider ?? 'openai', llmKey, manifests, llmModel, apiCredentials);
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

      const response = await session.engine.chat(session.engineSessionId, message, {
        onToolCall: (tc: any) => {
          toolCalls.push({
            action: `${tc.pluginName}.${tc.actionName}`,
            params: tc.parameters,
          });
        },
      });

      return NextResponse.json({
        response,
        sessionId: newSessionId,
        toolCalls,
      });
    }

    const toolCalls: { action: string; params: any }[] = [];

    const response = await session.engine.chat(session.engineSessionId, message, {
      onToolCall: (tc: any) => {
        toolCalls.push({
          action: `${tc.pluginName}.${tc.actionName}`,
          params: tc.parameters,
        });
      },
    });

    return NextResponse.json({
      response,
      sessionId,
      toolCalls,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
