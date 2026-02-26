import Database from 'better-sqlite3';
import { join } from 'path';

const DB_PATH = process.env.DATABASE_PATH || join(process.cwd(), 'agentbridge.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS apis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      version TEXT,
      base_url TEXT NOT NULL,
      auth_type TEXT DEFAULT 'none',
      auth_config TEXT,
      manifest TEXT NOT NULL,
      openapi_spec TEXT,
      source_url TEXT,
      tags TEXT DEFAULT '',
      category TEXT DEFAULT 'other',
      is_verified INTEGER DEFAULT 0,
      is_public INTEGER DEFAULT 1,
      owner_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS api_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_id INTEGER REFERENCES apis(id) ON DELETE CASCADE,
      action_id TEXT NOT NULL,
      description TEXT,
      method TEXT,
      path TEXT
    );
  `);

  // Add owner_id column if missing (migration for existing DBs)
  try {
    db.exec('ALTER TABLE apis ADD COLUMN owner_id TEXT');
  } catch {
    // Column already exists
  }

  // Add is_public column if missing (migration for existing DBs)
  try {
    db.exec('ALTER TABLE apis ADD COLUMN is_public INTEGER DEFAULT 1');
  } catch {
    // Column already exists
  }

  // Analytics events table
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_name TEXT NOT NULL,
      event_type TEXT NOT NULL,
      action_id TEXT,
      user_agent TEXT,
      ip_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_api_events_name ON api_events(api_name);
    CREATE INDEX IF NOT EXISTS idx_api_events_created ON api_events(created_at);
  `);
}

export interface ApiRow {
  id: number;
  name: string;
  description: string;
  version: string;
  base_url: string;
  auth_type: string;
  auth_config: string | null;
  manifest: string;
  openapi_spec: string | null;
  owner_id: string | null;
  is_public: number;
  created_at: string;
  updated_at: string;
}

export interface ApiActionRow {
  id: number;
  api_id: number;
  action_id: string;
  description: string;
  method: string;
  path: string;
}

export function getAllApis(): ApiRow[] {
  return getDb().prepare('SELECT * FROM apis ORDER BY created_at DESC').all() as ApiRow[];
}

export function getAllPublicApis(): ApiRow[] {
  return getDb().prepare('SELECT * FROM apis WHERE is_public = 1 ORDER BY created_at DESC').all() as ApiRow[];
}

export function getApiByName(name: string): ApiRow | undefined {
  return getDb().prepare('SELECT * FROM apis WHERE name = ?').get(name) as ApiRow | undefined;
}

export function getApiActions(apiId: number): ApiActionRow[] {
  return getDb().prepare('SELECT * FROM api_actions WHERE api_id = ?').all(apiId) as ApiActionRow[];
}

export function getApisByOwner(ownerId: string): ApiRow[] {
  return getDb().prepare('SELECT * FROM apis WHERE owner_id = ? ORDER BY created_at DESC').all(ownerId) as ApiRow[];
}

export function insertApi(data: {
  name: string;
  description: string;
  version: string;
  base_url: string;
  auth_type: string;
  auth_config: string | null;
  manifest: string;
  openapi_spec: string | null;
  owner_id?: string;
  is_public?: boolean;
  actions: { action_id: string; description: string; method: string; path: string }[];
}) {
  const db = getDb();
  const insertApiStmt = db.prepare(`
    INSERT INTO apis (name, description, version, base_url, auth_type, auth_config, manifest, openapi_spec, owner_id, is_public)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertActionStmt = db.prepare(`
    INSERT INTO api_actions (api_id, action_id, description, method, path)
    VALUES (?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    // Delete existing if re-importing (only if same owner or no owner)
    const existing = getApiByName(data.name);
    if (existing) {
      if (existing.owner_id && data.owner_id && existing.owner_id !== data.owner_id) {
        throw new Error(`API "${data.name}" is already registered by another user`);
      }
      db.prepare('DELETE FROM api_actions WHERE api_id = ?').run(existing.id);
      db.prepare('DELETE FROM apis WHERE id = ?').run(existing.id);
    }

    const result = insertApiStmt.run(
      data.name, data.description, data.version, data.base_url,
      data.auth_type, data.auth_config, data.manifest, data.openapi_spec,
      data.owner_id ?? null,
      data.is_public === false ? 0 : 1,
    );
    const apiId = result.lastInsertRowid as number;

    for (const action of data.actions) {
      insertActionStmt.run(apiId, action.action_id, action.description, action.method, action.path);
    }

    return apiId;
  });

  return transaction();
}

export function deleteApi(name: string, ownerId?: string) {
  const db = getDb();
  const api = getApiByName(name);
  if (!api) return;
  if (ownerId && api.owner_id && api.owner_id !== ownerId) {
    throw new Error('You can only delete your own APIs');
  }
  db.prepare('DELETE FROM api_actions WHERE api_id = ?').run(api.id);
  db.prepare('DELETE FROM apis WHERE id = ?').run(api.id);
}

// ---- Analytics ----

export function trackEvent(
  apiName: string,
  eventType: string,
  actionId?: string,
  userAgent?: string,
  ipHash?: string,
) {
  try {
    getDb().prepare(
      'INSERT INTO api_events (api_name, event_type, action_id, user_agent, ip_hash) VALUES (?, ?, ?, ?, ?)',
    ).run(apiName, eventType, actionId ?? null, userAgent ?? null, ipHash ?? null);
  } catch {
    // Never let tracking break the request
  }
}

export function getAllStats(days = 30) {
  const db = getDb();
  const apis = getAllApis();
  if (apis.length === 0) return { apis: [], totals: { manifest_fetches: 0, chat_uses: 0, action_calls: 0, discover_hits: 0 } };

  const names = apis.map(a => a.name);
  return computeStats(db, apis, names, days);
}

export function getOwnerStats(ownerId: string, days = 30) {
  const db = getDb();
  const apis = getApisByOwner(ownerId);
  if (apis.length === 0) return { apis: [], totals: { manifest_fetches: 0, chat_uses: 0, action_calls: 0, discover_hits: 0 } };

  const names = apis.map(a => a.name);
  return computeStats(db, apis, names, days);
}

function computeStats(db: Database.Database, apis: ApiRow[], names: string[], days: number) {
  const placeholders = names.map(() => '?').join(',');
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();

  // Aggregate counts per API
  const stats = db.prepare(`
    SELECT api_name, event_type, COUNT(*) as count
    FROM api_events
    WHERE api_name IN (${placeholders}) AND created_at >= ?
    GROUP BY api_name, event_type
  `).all(...names, cutoff) as { api_name: string; event_type: string; count: number }[];

  // Top actions per API
  const topActions = db.prepare(`
    SELECT api_name, action_id, COUNT(*) as count
    FROM api_events
    WHERE api_name IN (${placeholders}) AND event_type = 'action_call' AND action_id IS NOT NULL AND created_at >= ?
    GROUP BY api_name, action_id
    ORDER BY count DESC
  `).all(...names, cutoff) as { api_name: string; action_id: string; count: number }[];

  // Daily timeseries
  const timeseries = db.prepare(`
    SELECT api_name, DATE(created_at) as date, event_type, COUNT(*) as count
    FROM api_events
    WHERE api_name IN (${placeholders}) AND created_at >= ?
    GROUP BY api_name, DATE(created_at), event_type
    ORDER BY date
  `).all(...names, cutoff) as { api_name: string; date: string; event_type: string; count: number }[];

  const totals = { manifest_fetches: 0, chat_uses: 0, action_calls: 0, discover_hits: 0 };

  const apiStats = apis.map(api => {
    const apiEvents = stats.filter(s => s.api_name === api.name);
    const counts = {
      manifest_fetches: 0, chat_uses: 0, action_calls: 0, discover_hits: 0,
    };
    for (const e of apiEvents) {
      if (e.event_type === 'manifest_fetch') counts.manifest_fetches = e.count;
      if (e.event_type === 'chat_use') counts.chat_uses = e.count;
      if (e.event_type === 'action_call') counts.action_calls = e.count;
      if (e.event_type === 'discover_hit') counts.discover_hits = e.count;
    }
    totals.manifest_fetches += counts.manifest_fetches;
    totals.chat_uses += counts.chat_uses;
    totals.action_calls += counts.action_calls;
    totals.discover_hits += counts.discover_hits;

    const apiTopActions = topActions
      .filter(a => a.api_name === api.name)
      .slice(0, 5)
      .map(a => ({ action_id: a.action_id, count: a.count }));

    // Build timeseries map
    const tsMap = new Map<string, { manifest_fetch: number; chat_use: number; action_call: number; discover_hit: number }>();
    for (const t of timeseries.filter(t => t.api_name === api.name)) {
      if (!tsMap.has(t.date)) tsMap.set(t.date, { manifest_fetch: 0, chat_use: 0, action_call: 0, discover_hit: 0 });
      const entry = tsMap.get(t.date)!;
      if (t.event_type in entry) (entry as any)[t.event_type] = t.count;
    }
    const ts = Array.from(tsMap.entries()).map(([date, counts]) => ({ date, ...counts }));

    return {
      name: api.name,
      description: api.description,
      ...counts,
      top_actions: apiTopActions,
      timeseries: ts,
    };
  });

  return { apis: apiStats, totals };
}
