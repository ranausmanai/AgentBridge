import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createCliToken } from '@/lib/db';

function isAllowedCallback(url: URL): boolean {
  return url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
}

function getOrigin(request: Request): string {
  const reqUrl = new URL(request.url);
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  return forwardedProto && forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : reqUrl.origin;
}

async function getSupabaseUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

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

export async function GET(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'CLI login is unavailable when auth is disabled' }, { status: 400 });
  }

  const url = new URL(request.url);
  const callbackUrlRaw = url.searchParams.get('callback_url');
  const state = url.searchParams.get('state') ?? '';

  if (!callbackUrlRaw) {
    return NextResponse.json({ error: 'callback_url is required' }, { status: 400 });
  }

  let callbackUrl: URL;
  try {
    callbackUrl = new URL(callbackUrlRaw);
  } catch {
    return NextResponse.json({ error: 'Invalid callback_url' }, { status: 400 });
  }

  if (!isAllowedCallback(callbackUrl)) {
    return NextResponse.json({ error: 'callback_url must be localhost/127.0.0.1 over http' }, { status: 400 });
  }

  const user = await getSupabaseUser();
  if (!user) {
    const origin = getOrigin(request);
    const retryPath = `/api/cli-auth/start?callback_url=${encodeURIComponent(callbackUrlRaw)}&state=${encodeURIComponent(state)}`;
    return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(retryPath)}`);
  }

  const token = createCliToken(user.id);
  const redirectUrl = new URL(callbackUrl.toString());
  redirectUrl.searchParams.set('token', token);
  if (state) redirectUrl.searchParams.set('state', state);

  return NextResponse.redirect(redirectUrl.toString());
}
