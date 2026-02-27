import { NextResponse } from 'next/server';
import { consumeOAuthSession, getApiByName, getApiCredential, upsertApiCredential } from '@/lib/db';
import type { AgentBridgeManifest } from '@agentbridgeai/openapi';
import { getRequestOrigin } from '@/lib/oauth';

function getManifest(apiName: string): AgentBridgeManifest | null {
  const api = getApiByName(apiName);
  if (!api?.manifest) return null;
  return JSON.parse(api.manifest) as AgentBridgeManifest;
}

function redirectToChat(request: Request, params: Record<string, string>) {
  const origin = getRequestOrigin(request);
  const url = new URL('/chat', origin);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url.toString());
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (error) {
    return redirectToChat(request, { oauth: 'error', reason: error });
  }
  if (!code || !state) {
    return redirectToChat(request, { oauth: 'error', reason: 'missing_code_or_state' });
  }

  const session = consumeOAuthSession(state);
  if (!session) {
    return redirectToChat(request, { oauth: 'error', reason: 'invalid_or_expired_state' });
  }

  const manifest = getManifest(session.apiName);
  if (!manifest || manifest.auth?.type !== 'oauth2' || !manifest.auth.oauth2?.token_url) {
    return redirectToChat(request, { oauth: 'error', reason: 'oauth_not_configured_on_api' });
  }

  const existing = getApiCredential(session.ownerId, session.apiName)?.credentials ?? {};
  const existingOauth = (existing.oauth && typeof existing.oauth === 'object') ? existing.oauth : {};
  const clientId = existing.oauth_client_id || existingOauth.client_id;
  const clientSecret = existing.oauth_client_secret || existingOauth.client_secret;
  if (!clientId) {
    return redirectToChat(request, { oauth: 'error', reason: 'missing_client_id' });
  }

  const tokenBody = new URLSearchParams();
  tokenBody.set('grant_type', 'authorization_code');
  tokenBody.set('code', code);
  tokenBody.set('redirect_uri', session.redirectUri);
  tokenBody.set('client_id', String(clientId));
  tokenBody.set('code_verifier', session.codeVerifier);
  if (clientSecret) tokenBody.set('client_secret', String(clientSecret));

  const tokenRes = await fetch(manifest.auth.oauth2.token_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: tokenBody.toString(),
  });

  const tokenText = await tokenRes.text();
  let tokenJson: any = null;
  try {
    tokenJson = tokenText ? JSON.parse(tokenText) : null;
  } catch {
    tokenJson = null;
  }

  if (!tokenRes.ok || !tokenJson?.access_token) {
    return redirectToChat(request, {
      oauth: 'error',
      reason: tokenJson?.error || `token_exchange_failed_${tokenRes.status}`,
    });
  }

  const expiresAt = tokenJson.expires_in
    ? new Date(Date.now() + Number(tokenJson.expires_in) * 1000).toISOString()
    : undefined;

  const merged = {
    ...existing,
    token: tokenJson.access_token,
    oauth: {
      ...(existingOauth || {}),
      client_id: clientId,
      client_secret: clientSecret,
      token_url: manifest.auth.oauth2.token_url,
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token,
      token_type: tokenJson.token_type ?? 'Bearer',
      scope: tokenJson.scope,
      expires_at: expiresAt,
    },
  };

  upsertApiCredential(session.ownerId, session.apiName, merged);

  return redirectToChat(request, {
    oauth: 'connected',
    api: session.apiName,
  });
}
