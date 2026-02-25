import { NextResponse } from 'next/server';
import { getApiByName } from '@/lib/db';

/**
 * Returns the raw AgentBridge manifest for an API.
 * This is the URL that CLI and agents use to add an API:
 *
 *   agentbridge add https://agentbridge.cc/api/pet-store/manifest
 *
 * Returns the .agentbridge.json format directly.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const api = getApiByName(name);

  if (!api) {
    return NextResponse.json({ error: `API "${name}" not found` }, { status: 404 });
  }

  const manifest = JSON.parse(api.manifest);

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
