import type { AgentBridgeManifest } from '../types.js';
import { spotifyManifest, SPOTIFY_CLIENT_ID, SPOTIFY_CLI_CALLBACK_PORT } from './spotify.js';
import { gmailManifest } from './gmail.js';
import { googleCalendarManifest } from './google-calendar.js';
import { GOOGLE_CLIENT_ID, GOOGLE_CLI_CALLBACK_PORT } from './google-oauth.js';

export interface BuiltinApi {
  manifest: AgentBridgeManifest;
  /** Default OAuth client ID (public / PKCE-safe) */
  oauthClientId?: string;
  /** OAuth client secret — only used server-side (web token exchange) */
  oauthClientSecret?: string;
  /** Fixed localhost port for CLI OAuth callback (Spotify requires pre-registered URIs) */
  cliCallbackPort?: number;
}

const BUILTINS: Record<string, BuiltinApi> = {
  spotify: {
    manifest: spotifyManifest,
    oauthClientId: SPOTIFY_CLIENT_ID,
    cliCallbackPort: SPOTIFY_CLI_CALLBACK_PORT,
  },
  gmail: {
    manifest: gmailManifest,
    oauthClientId: GOOGLE_CLIENT_ID,
    cliCallbackPort: GOOGLE_CLI_CALLBACK_PORT,
  },
  'google-calendar': {
    manifest: googleCalendarManifest,
    oauthClientId: GOOGLE_CLIENT_ID,
    cliCallbackPort: GOOGLE_CLI_CALLBACK_PORT,
  },
};

export function getBuiltinApi(name: string): BuiltinApi | undefined {
  return BUILTINS[name.toLowerCase()];
}

export function getAllBuiltinApis(): Record<string, BuiltinApi> {
  return { ...BUILTINS };
}

export function isBuiltinApi(name: string): boolean {
  return name.toLowerCase() in BUILTINS;
}
