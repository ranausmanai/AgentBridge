import Database from 'better-sqlite3';
import { join } from 'path';
import { createHash, randomBytes } from 'crypto';
import { decryptJson, encryptJson, isCredentialVaultConfigured } from './crypto';
import { getAllBuiltinApis } from '@agentbridgeai/openapi';

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

  // CLI login tokens
  db.exec(`
    CREATE TABLE IF NOT EXISTS cli_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      last_used_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_cli_tokens_owner ON cli_tokens(owner_id);
    CREATE INDEX IF NOT EXISTS idx_cli_tokens_expiry ON cli_tokens(expires_at);
  `);

  // Encrypted consumer credential vault (owner + API scoped)
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_credentials (
      owner_id TEXT NOT NULL,
      api_name TEXT NOT NULL,
      ciphertext TEXT NOT NULL,
      iv TEXT NOT NULL,
      tag TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (owner_id, api_name)
    );
    CREATE INDEX IF NOT EXISTS idx_api_credentials_owner ON api_credentials(owner_id);
  `);

  // OAuth browser flow sessions
  db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_sessions (
      state TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      api_name TEXT NOT NULL,
      code_verifier TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_oauth_sessions_owner ON oauth_sessions(owner_id);
    CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expiry ON oauth_sessions(expires_at);
  `);

  seedBuiltinApis(db);
}

function seedBuiltinApis(db: Database.Database) {
  const builtins = getAllBuiltinApis();
  const insertApiStmt = db.prepare(`
    INSERT OR IGNORE INTO apis (name, description, version, base_url, auth_type, auth_config, manifest, owner_id, is_public)
    VALUES (?, ?, ?, ?, ?, ?, ?, '__builtin__', 1)
  `);
  const insertActionStmt = db.prepare(`
    INSERT INTO api_actions (api_id, action_id, description, method, path)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const [, builtin] of Object.entries(builtins)) {
    const m = builtin.manifest;
    const existing = db.prepare('SELECT id FROM apis WHERE name = ?').get(m.name) as { id: number } | undefined;
    if (existing) continue;

    const result = insertApiStmt.run(
      m.name,
      m.description,
      m.version,
      m.base_url,
      m.auth?.type ?? 'none',
      m.auth ? JSON.stringify(m.auth) : null,
      JSON.stringify(m),
    );
    const apiId = result.lastInsertRowid as number;
    if (apiId) {
      for (const action of m.actions) {
        insertActionStmt.run(apiId, action.id, action.description, action.method, action.path);
      }
    }
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

// ---- CLI Auth Tokens ----

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createCliToken(ownerId: string, ttlDays = 30): string {
  const token = `abt_${randomBytes(24).toString('hex')}`;
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlDays * 86400000).toISOString();

  getDb().prepare(
    'INSERT INTO cli_tokens (owner_id, token_hash, expires_at) VALUES (?, ?, ?)',
  ).run(ownerId, tokenHash, expiresAt);

  return token;
}

export function verifyCliToken(token: string): { ownerId: string } | null {
  if (!token || !token.startsWith('abt_')) return null;
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();

  const row = getDb().prepare(
    'SELECT owner_id, expires_at FROM cli_tokens WHERE token_hash = ?',
  ).get(tokenHash) as { owner_id: string; expires_at: string } | undefined;

  if (!row) return null;
  if (row.expires_at <= now) return null;

  getDb().prepare(
    'UPDATE cli_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE token_hash = ?',
  ).run(tokenHash);

  return { ownerId: row.owner_id };
}

// ---- Encrypted API Credentials ----

export interface ApiCredential {
  apiName: string;
  credentials: Record<string, any>;
  updatedAt: string;
}

export function upsertApiCredential(
  ownerId: string,
  apiName: string,
  credentials: Record<string, any>,
): void {
  if (!isCredentialVaultConfigured()) {
    throw new Error('Credential vault is not configured. Set AGENTBRIDGE_ENCRYPTION_KEY.');
  }
  const sealed = encryptJson(credentials);
  getDb().prepare(`
    INSERT INTO api_credentials (owner_id, api_name, ciphertext, iv, tag)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(owner_id, api_name) DO UPDATE SET
      ciphertext = excluded.ciphertext,
      iv = excluded.iv,
      tag = excluded.tag,
      updated_at = CURRENT_TIMESTAMP
  `).run(ownerId, apiName, sealed.ciphertext, sealed.iv, sealed.tag);
}

export function getApiCredential(ownerId: string, apiName: string): ApiCredential | null {
  const row = getDb().prepare(`
    SELECT api_name, ciphertext, iv, tag, updated_at
    FROM api_credentials
    WHERE owner_id = ? AND api_name = ?
  `).get(ownerId, apiName) as {
    api_name: string;
    ciphertext: string;
    iv: string;
    tag: string;
    updated_at: string;
  } | undefined;

  if (!row) return null;
  const credentials = decryptJson<Record<string, any>>({
    ciphertext: row.ciphertext,
    iv: row.iv,
    tag: row.tag,
  });
  return {
    apiName: row.api_name,
    credentials,
    updatedAt: row.updated_at,
  };
}

export function getApiCredentials(
  ownerId: string,
  apiNames?: string[],
): Record<string, ApiCredential> {
  const db = getDb();
  let rows: Array<{
    api_name: string;
    ciphertext: string;
    iv: string;
    tag: string;
    updated_at: string;
  }> = [];

  if (apiNames && apiNames.length > 0) {
    const placeholders = apiNames.map(() => '?').join(',');
    rows = db.prepare(`
      SELECT api_name, ciphertext, iv, tag, updated_at
      FROM api_credentials
      WHERE owner_id = ? AND api_name IN (${placeholders})
    `).all(ownerId, ...apiNames) as typeof rows;
  } else {
    rows = db.prepare(`
      SELECT api_name, ciphertext, iv, tag, updated_at
      FROM api_credentials
      WHERE owner_id = ?
    `).all(ownerId) as typeof rows;
  }

  const result: Record<string, ApiCredential> = {};
  for (const row of rows) {
    try {
      result[row.api_name] = {
        apiName: row.api_name,
        updatedAt: row.updated_at,
        credentials: decryptJson<Record<string, any>>({
          ciphertext: row.ciphertext,
          iv: row.iv,
          tag: row.tag,
        }),
      };
    } catch {
      // Skip corrupted rows to avoid breaking chat requests.
    }
  }

  return result;
}

export function deleteApiCredential(ownerId: string, apiName: string): void {
  getDb().prepare(
    'DELETE FROM api_credentials WHERE owner_id = ? AND api_name = ?',
  ).run(ownerId, apiName);
}

// ---- OAuth flow sessions ----

export interface OAuthSession {
  state: string;
  ownerId: string;
  apiName: string;
  codeVerifier: string;
  redirectUri: string;
  expiresAt: string;
}

export function createOAuthSession(
  ownerId: string,
  apiName: string,
  state: string,
  codeVerifier: string,
  redirectUri: string,
  ttlMinutes = 10,
): void {
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
  getDb().prepare(`
    INSERT INTO oauth_sessions (state, owner_id, api_name, code_verifier, redirect_uri, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(state, ownerId, apiName, codeVerifier, redirectUri, expiresAt);
}

export function consumeOAuthSession(state: string): OAuthSession | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT state, owner_id, api_name, code_verifier, redirect_uri, expires_at
    FROM oauth_sessions
    WHERE state = ?
  `).get(state) as {
    state: string;
    owner_id: string;
    api_name: string;
    code_verifier: string;
    redirect_uri: string;
    expires_at: string;
  } | undefined;

  if (!row) return null;
  db.prepare('DELETE FROM oauth_sessions WHERE state = ?').run(state);

  if (row.expires_at <= new Date().toISOString()) return null;
  return {
    state: row.state,
    ownerId: row.owner_id,
    apiName: row.api_name,
    codeVerifier: row.code_verifier,
    redirectUri: row.redirect_uri,
    expiresAt: row.expires_at,
  };
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
