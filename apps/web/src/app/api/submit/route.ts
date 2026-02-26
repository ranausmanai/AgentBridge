import { NextResponse } from 'next/server';
import { insertApi } from '@/lib/db';
import { convertOpenAPIToManifest, type AgentBridgeManifest } from '@agentbridgeai/openapi';

/**
 * Submit API endpoint — API owners submit their URL to the directory.
 *
 * POST /api/submit
 * { "url": "https://api.spotify.com/.well-known/agentbridge.json" }
 *
 * OR submit an OpenAPI spec URL:
 * { "openapi_url": "https://api.spotify.com/openapi.json", "tags": "music,streaming" }
 *
 * We fetch the manifest from THEIR server, validate it, and index it.
 * We DON'T host their data — we just point to it (like Google indexes websites).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, openapi_url, tags, category } = body as {
      url?: string;
      openapi_url?: string;
      tags?: string;
      category?: string;
    };

    let manifest: AgentBridgeManifest;
    let sourceUrl: string;

    if (url) {
      // Fetch .agentbridge.json manifest directly
      sourceUrl = url;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) {
        return NextResponse.json(
          { error: `Failed to fetch manifest from ${url}: HTTP ${res.status}` },
          { status: 400 },
        );
      }
      manifest = await res.json() as AgentBridgeManifest;

      // Basic validation
      if (!manifest.name || !manifest.actions || !Array.isArray(manifest.actions)) {
        return NextResponse.json(
          { error: 'Invalid manifest: must have name and actions array' },
          { status: 400 },
        );
      }
    } else if (openapi_url) {
      // Fetch and convert OpenAPI spec
      sourceUrl = openapi_url;
      const res = await fetch(openapi_url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) {
        return NextResponse.json(
          { error: `Failed to fetch OpenAPI spec from ${openapi_url}: HTTP ${res.status}` },
          { status: 400 },
        );
      }
      const specContent = await res.text();
      manifest = convertOpenAPIToManifest(specContent);
    } else {
      return NextResponse.json(
        { error: 'Provide either "url" (.agentbridge.json URL) or "openapi_url" (OpenAPI spec URL)' },
        { status: 400 },
      );
    }

    // Index it in our directory
    insertApi({
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      base_url: manifest.base_url,
      auth_type: manifest.auth?.type ?? 'none',
      auth_config: manifest.auth ? JSON.stringify(manifest.auth) : null,
      manifest: JSON.stringify(manifest),
      openapi_spec: null,
      actions: manifest.actions.map(a => ({
        action_id: a.id,
        description: a.description,
        method: a.method,
        path: a.path,
      })),
    });

    // Update tags and category if provided
    const db = (await import('@/lib/db')).getDb();
    if (tags || category || sourceUrl) {
      db.prepare(`
        UPDATE apis SET tags = ?, category = ?, source_url = ? WHERE name = ?
      `).run(tags ?? '', category ?? 'other', sourceUrl, manifest.name);
    }

    return NextResponse.json({
      success: true,
      name: manifest.name,
      description: manifest.description,
      action_count: manifest.actions.length,
      message: `Indexed "${manifest.name}" — it's now discoverable by agents worldwide.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
