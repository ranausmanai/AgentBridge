import { NextResponse } from 'next/server';
import { attachOwnerCookie, resolveRequestOwner } from '@/lib/auth';
import {
  deleteApiCredential,
  getApiCredentials,
  getApiByName,
  upsertApiCredential,
} from '@/lib/db';
import { isCredentialVaultConfigured } from '@/lib/crypto';

function parseApiNames(searchParams: URLSearchParams): string[] {
  const raw = searchParams.get('apis') || '';
  return raw
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

export async function GET(request: Request) {
  const owner = await resolveRequestOwner(request, { allowAnonymous: true });
  if (!owner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isCredentialVaultConfigured()) {
    const response = NextResponse.json({
      configured: false,
      error: 'Credential vault is not configured on this server.',
      statuses: {},
    }, { status: 503 });
    return attachOwnerCookie(response, owner);
  }

  const url = new URL(request.url);
  const apiNames = parseApiNames(url.searchParams);
  const stored = getApiCredentials(owner.ownerId, apiNames.length > 0 ? apiNames : undefined);

  const statuses: Record<string, {
    configured: boolean;
    oauthConnected: boolean;
    hasClientConfig: boolean;
    updatedAt?: string;
  }> = {};

  const names = apiNames.length > 0 ? apiNames : Object.keys(stored);
  for (const apiName of names) {
    const row = stored[apiName];
    const creds = row?.credentials ?? {};
    const oauth = (creds.oauth && typeof creds.oauth === 'object') ? creds.oauth : {};
    statuses[apiName] = {
      configured: !!row,
      oauthConnected: !!(oauth.access_token || creds.token),
      hasClientConfig: !!(creds.oauth_client_id || oauth.client_id),
      updatedAt: row?.updatedAt,
    };
  }

  const response = NextResponse.json({
    configured: true,
    statuses,
  });
  return attachOwnerCookie(response, owner);
}

export async function POST(request: Request) {
  const owner = await resolveRequestOwner(request, { allowAnonymous: true });
  if (!owner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isCredentialVaultConfigured()) {
    const response = NextResponse.json(
      { error: 'Credential vault is not configured. Set AGENTBRIDGE_ENCRYPTION_KEY.' },
      { status: 503 },
    );
    return attachOwnerCookie(response, owner);
  }

  const body = await request.json();
  const { apiName, credentials } = body as {
    apiName?: string;
    credentials?: Record<string, any>;
  };

  if (!apiName || typeof apiName !== 'string') {
    return NextResponse.json({ error: 'apiName is required' }, { status: 400 });
  }
  if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) {
    return NextResponse.json({ error: 'credentials object is required' }, { status: 400 });
  }

  const api = getApiByName(apiName);
  if (!api) {
    return NextResponse.json({ error: `Unknown API: ${apiName}` }, { status: 404 });
  }

  upsertApiCredential(owner.ownerId, apiName, credentials);
  const response = NextResponse.json({ success: true });
  return attachOwnerCookie(response, owner);
}

export async function DELETE(request: Request) {
  const owner = await resolveRequestOwner(request, { allowAnonymous: true });
  if (!owner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const apiName = url.searchParams.get('api');
  if (!apiName) {
    return NextResponse.json({ error: 'api query parameter is required' }, { status: 400 });
  }

  deleteApiCredential(owner.ownerId, apiName);
  const response = NextResponse.json({ success: true });
  return attachOwnerCookie(response, owner);
}
