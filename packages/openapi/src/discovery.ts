import type { AgentBridgeManifest } from './types.js';

const WELL_KNOWN_PATH = '/.well-known/agentbridge.json';

/**
 * Discover if a domain has an agent-ready API by checking
 * /.well-known/agentbridge.json (the standard convention).
 *
 * Like robots.txt for agents — any domain can host this file
 * to declare "I'm agent-ready, here are my capabilities."
 */
export async function discoverFromDomain(domain: string): Promise<AgentBridgeManifest | null> {
  // Normalize domain
  let baseUrl = domain.trim();
  if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
  baseUrl = baseUrl.replace(/\/$/, '');

  const url = `${baseUrl}${WELL_KNOWN_PATH}`;

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const manifest = await res.json() as AgentBridgeManifest;

    // Basic validation
    if (!manifest.name || !manifest.actions || !Array.isArray(manifest.actions)) {
      return null;
    }

    return manifest;
  } catch {
    return null;
  }
}

/**
 * Discover from multiple domains in parallel.
 */
export async function discoverFromDomains(domains: string[]): Promise<{ domain: string; manifest: AgentBridgeManifest }[]> {
  const results = await Promise.allSettled(
    domains.map(async domain => {
      const manifest = await discoverFromDomain(domain);
      if (!manifest) throw new Error('not found');
      return { domain, manifest };
    }),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<{ domain: string; manifest: AgentBridgeManifest }> =>
      r.status === 'fulfilled',
    )
    .map(r => r.value);
}

/**
 * Generate the well-known file content for API owners to host.
 */
export function generateWellKnownFile(manifest: AgentBridgeManifest): string {
  return JSON.stringify(manifest, null, 2);
}
