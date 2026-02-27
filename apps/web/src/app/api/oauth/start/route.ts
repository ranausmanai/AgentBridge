import { NextResponse } from 'next/server';
import { attachOwnerCookie, resolveRequestOwner } from '@/lib/auth';
import {
  createOAuthSession,
  getApiByName,
  getApiCredential,
} from '@/lib/db';
import { createOAuthState, createPkcePair, getRequestOrigin } from '@/lib/oauth';
import type { AgentBridgeManifest } from '@agentbridgeai/openapi';

function getManifest(apiName: string): AgentBridgeManifest | null {
  const api = getApiByName(apiName);
  if (!api?.manifest) return null;
  return JSON.parse(api.manifest) as AgentBridgeManifest;
}

function buildScopes(manifest: AgentBridgeManifest, requested: string | null): string {
  if (requested && requested.trim()) return requested.trim();
  const scopes = manifest.auth?.oauth2?.scopes ? Object.keys(manifest.auth.oauth2.scopes) : [];
  return scopes.join(' ');
}

export async function GET(request: Request) {
  const owner = await resolveRequestOwner(request, { allowAnonymous: true });
  if (!owner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const apiName = url.searchParams.get('api');
  const scope = url.searchParams.get('scope');
  const format = (url.searchParams.get('format') || '').toLowerCase();

  if (!apiName) {
    return NextResponse.json({ error: 'api is required' }, { status: 400 });
  }

  const manifest = getManifest(apiName);
  if (!manifest) {
    return NextResponse.json({ error: `Unknown API: ${apiName}` }, { status: 404 });
  }
  if (manifest.auth?.type !== 'oauth2' || !manifest.auth.oauth2?.authorization_url || !manifest.auth.oauth2.token_url) {
    return NextResponse.json({ error: `${apiName} does not expose OAuth2 auth in its manifest` }, { status: 400 });
  }

  const existing = getApiCredential(owner.ownerId, apiName)?.credentials ?? {};
  const oauth = (existing.oauth && typeof existing.oauth === 'object') ? existing.oauth : {};
  const clientId = existing.oauth_client_id || oauth.client_id;
  if (!clientId) {
    return NextResponse.json({
      error: 'OAuth client is not configured. Save oauth_client_id via /api/credentials first.',
    }, { status: 400 });
  }

  const origin = getRequestOrigin(request);
  const redirectUri = `${origin}/api/oauth/callback`;
  const { verifier, challenge } = createPkcePair();
  const state = createOAuthState();

  createOAuthSession(owner.ownerId, apiName, state, verifier, redirectUri);

  const authUrl = new URL(manifest.auth.oauth2.authorization_url);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', String(clientId));
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const finalScopes = buildScopes(manifest, scope);
  if (finalScopes) authUrl.searchParams.set('scope', finalScopes);

  if (format === 'json') {
    const response = NextResponse.json({
      url: authUrl.toString(),
      api: apiName,
      scope: finalScopes,
    });
    return attachOwnerCookie(response, owner);
  }

  const response = NextResponse.redirect(authUrl.toString());
  return attachOwnerCookie(response, owner);
}
