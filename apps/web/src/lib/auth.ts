import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { verifyCliToken } from './db';
import type { NextResponse } from 'next/server';

const ANON_COOKIE = 'ab_anon_id';

export interface RequestOwner {
  ownerId: string;
  userId?: string;
  source: 'cli' | 'user' | 'anonymous';
  setAnonCookie?: string;
}

function isAuthEnabled(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (!auth) return null;
  const [scheme, token] = auth.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim();
}

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  const parts = header.split(';').map(v => v.trim());
  for (const part of parts) {
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq);
    if (key !== name) continue;
    return decodeURIComponent(part.slice(eq + 1));
  }
  return null;
}

async function getSupabaseUser() {
  if (!isAuthEnabled()) return null;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    },
  );
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function resolveRequestOwner(
  request: Request,
  options?: { allowAnonymous?: boolean },
): Promise<RequestOwner | null> {
  const allowAnonymous = options?.allowAnonymous !== false;

  const bearer = getBearerToken(request);
  if (bearer) {
    const verified = verifyCliToken(bearer);
    if (verified) {
      return { ownerId: verified.ownerId, userId: verified.ownerId, source: 'cli' };
    }
  }

  const user = await getSupabaseUser();
  if (user?.id) {
    return { ownerId: user.id, userId: user.id, source: 'user' };
  }

  if (!allowAnonymous) return null;

  const existingAnon = getCookie(request, ANON_COOKIE);
  if (existingAnon) {
    return { ownerId: `anon:${existingAnon}`, source: 'anonymous' };
  }

  const anonId = `abanon_${randomBytes(16).toString('hex')}`;
  return {
    ownerId: `anon:${anonId}`,
    source: 'anonymous',
    setAnonCookie: anonId,
  };
}

export function attachOwnerCookie(
  response: NextResponse,
  owner: RequestOwner | null,
) {
  if (!owner?.setAnonCookie) return response;
  response.cookies.set(ANON_COOKIE, owner.setAnonCookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export function authModeEnabled(): boolean {
  return isAuthEnabled();
}
