import { NextResponse } from 'next/server';
import { getOwnerStats, getAllStats } from '@/lib/db';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function getUser() {
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
  const authEnabled = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') ?? '30');

  if (!authEnabled) {
    // No auth — return stats for all APIs
    const stats = getAllStats(days);
    return NextResponse.json(stats);
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats = getOwnerStats(user.id, days);
  return NextResponse.json(stats);
}
