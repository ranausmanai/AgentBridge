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
  actions: { action_id: string; description: string; method: string; path: string }[];
}) {
  const db = getDb();
  const insertApiStmt = db.prepare(`
    INSERT INTO apis (name, description, version, base_url, auth_type, auth_config, manifest, openapi_spec, owner_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
