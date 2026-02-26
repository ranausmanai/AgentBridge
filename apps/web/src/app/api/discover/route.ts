import { NextResponse } from 'next/server';
import { getDb, trackEvent } from '@/lib/db';

/**
 * Discovery API — agents query this to find APIs by capability.
 *
 * GET /api/discover?q=search+music
 * GET /api/discover?category=music
 * GET /api/discover?tag=streaming
 *
 * Returns matching APIs with their actions, so agents know what's available.
 * This is the "Google for agent-ready APIs."
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') ?? '';
  const category = url.searchParams.get('category');
  const tag = url.searchParams.get('tag');
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100);

  const db = getDb();
  let query = `
    SELECT a.*, GROUP_CONCAT(aa.action_id || ': ' || aa.description, '; ') as action_summary
    FROM apis a
    LEFT JOIN api_actions aa ON aa.api_id = a.id
  `;
  const conditions: string[] = ['a.is_public = 1'];
  const params: any[] = [];

  if (q) {
    conditions.push(`(
      a.name LIKE ? OR
      a.description LIKE ? OR
      a.tags LIKE ? OR
      aa.action_id LIKE ? OR
      aa.description LIKE ?
    )`);
    const pattern = `%${q}%`;
    params.push(pattern, pattern, pattern, pattern, pattern);
  }

  if (category) {
    conditions.push('a.category = ?');
    params.push(category);
  }

  if (tag) {
    conditions.push('a.tags LIKE ?');
    params.push(`%${tag}%`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' GROUP BY a.id ORDER BY a.is_verified DESC, a.created_at DESC';
  query += ` LIMIT ${limit}`;

  const results = db.prepare(query).all(...params) as any[];

  // Format for agent consumption
  const apis = results.map(row => {
    const manifest = JSON.parse(row.manifest);
    return {
      name: row.name,
      description: row.description,
      version: row.version,
      base_url: row.base_url,
      category: row.category,
      tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      auth_type: row.auth_type,
      verified: row.is_verified === 1,
      actions: manifest.actions.map((a: any) => ({
        id: a.id,
        description: a.description,
        method: a.method,
      })),
      manifest_url: row.source_url ?? null,
    };
  });

  // Track discover hits
  for (const api of apis) trackEvent(api.name, 'discover_hit');

  return NextResponse.json({
    count: apis.length,
    query: q || undefined,
    category: category || undefined,
    apis,
  });
}
