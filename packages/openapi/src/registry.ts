import type { Plugin } from '@agentbridge/core';
import type { AgentBridgeManifest } from './types.js';
import { manifestToPlugin } from './manifest-to-plugin.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const REGISTRY_DIR = join(homedir(), '.agentbridge');
const REGISTRY_FILE = join(REGISTRY_DIR, 'registry.json');

interface RegistryEntry {
  /** URL where the manifest is hosted */
  url: string;
  /** Cached manifest */
  manifest: AgentBridgeManifest;
  /** When it was last fetched */
  lastFetched: string;
  /** Stored credentials for this API */
  credentials?: Record<string, string>;
}

interface RegistryData {
  entries: Record<string, RegistryEntry>;
}

/**
 * Federated API registry.
 * - API owners host manifests at their URLs
 * - Users add APIs by URL: `agentbridge add https://api.spotify.com/.agentbridge.json`
 * - Registry caches manifests locally and converts them to live plugins
 */
export class APIRegistry {
  private data: RegistryData;

  constructor() {
    this.data = this.load();
  }

  private load(): RegistryData {
    if (!existsSync(REGISTRY_FILE)) {
      return { entries: {} };
    }
    try {
      return JSON.parse(readFileSync(REGISTRY_FILE, 'utf-8'));
    } catch {
      return { entries: {} };
    }
  }

  private save(): void {
    if (!existsSync(REGISTRY_DIR)) {
      mkdirSync(REGISTRY_DIR, { recursive: true });
    }
    writeFileSync(REGISTRY_FILE, JSON.stringify(this.data, null, 2));
  }

  /**
   * Add an API to the registry by its manifest URL.
   * Fetches the manifest and caches it locally.
   */
  async addFromURL(url: string): Promise<AgentBridgeManifest> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch manifest from ${url}: ${res.status}`);
    }
    const manifest = await res.json() as AgentBridgeManifest;
    return this.addManifest(manifest, url);
  }

  /**
   * Add a manifest directly (e.g., from local file or OpenAPI conversion).
   */
  addManifest(manifest: AgentBridgeManifest, url?: string): AgentBridgeManifest {
    this.data.entries[manifest.name] = {
      url: url ?? `local://${manifest.name}`,
      manifest,
      lastFetched: new Date().toISOString(),
    };
    this.save();
    return manifest;
  }

  /**
   * Set credentials for a registered API.
   */
  setCredentials(name: string, credentials: Record<string, string>): void {
    const entry = this.data.entries[name];
    if (!entry) throw new Error(`API "${name}" not found in registry`);
    entry.credentials = credentials;
    this.save();
  }

  /**
   * Remove an API from the registry.
   */
  remove(name: string): void {
    delete this.data.entries[name];
    this.save();
  }

  /**
   * List all registered APIs.
   */
  list(): { name: string; description: string; version: string; url: string; actionCount: number }[] {
    return Object.values(this.data.entries).map(e => ({
      name: e.manifest.name,
      description: e.manifest.description,
      version: e.manifest.version,
      url: e.url,
      actionCount: e.manifest.actions.length,
    }));
  }

  /**
   * Get a specific manifest.
   */
  getManifest(name: string): AgentBridgeManifest | undefined {
    return this.data.entries[name]?.manifest;
  }

  /**
   * Convert all registered APIs into live plugins, ready for the engine.
   */
  toPlugins(): Plugin[] {
    return Object.values(this.data.entries).map(entry =>
      manifestToPlugin(entry.manifest, {
        credentials: entry.credentials,
      }),
    );
  }

  /**
   * Convert a single registered API into a plugin.
   */
  toPlugin(name: string): Plugin | undefined {
    const entry = this.data.entries[name];
    if (!entry) return undefined;
    return manifestToPlugin(entry.manifest, {
      credentials: entry.credentials,
    });
  }

  /**
   * Refresh a manifest from its URL.
   */
  async refresh(name: string): Promise<AgentBridgeManifest> {
    const entry = this.data.entries[name];
    if (!entry) throw new Error(`API "${name}" not found in registry`);
    if (entry.url.startsWith('local://')) {
      throw new Error(`Cannot refresh local manifest "${name}"`);
    }
    return this.addFromURL(entry.url);
  }
}
