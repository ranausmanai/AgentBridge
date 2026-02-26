import { NextResponse } from 'next/server';
import { getApiByName, trackEvent } from '@/lib/db';
import { createHash } from 'crypto';

/**
 * Returns the raw AgentBridge manifest for an API.
 * This is the URL that CLI and agents use to add an API:
 *
 *   agentbridge add https://agentbridge.cc/api/pet-store/manifest
 *
 * Returns the .agentbridge.json format directly.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const api = getApiByName(name);

  if (!api) {
    return NextResponse.json({ error: `API "${name}" not found` }, { status: 404 });
  }

  const manifest = JSON.parse(api.manifest);

  // Track manifest fetch
  const ua = request.headers.get('user-agent') ?? undefined;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16);
  trackEvent(name, 'manifest_fetch', undefined, ua, ipHash);

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
