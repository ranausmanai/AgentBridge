import { NextResponse } from 'next/server';
import { getAllPublicApis, getApiActions, deleteApi } from '@/lib/db';
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

async function deleteWithAuth(name: string) {
  const authEnabled = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!authEnabled) {
    deleteApi(name);
    return NextResponse.json({ success: true });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    deleteApi(name, user.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}

export async function GET() {
  const apis = getAllPublicApis();
  const result = apis.map(api => ({
    id: api.id,
    name: api.name,
    description: api.description,
    version: api.version,
    base_url: api.base_url,
    auth_type: api.auth_type,
    action_count: getApiActions(api.id).length,
    is_builtin: api.owner_id === '__builtin__',
    created_at: api.created_at,
  }));
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const { action, name } = await request.json();
  if (action === 'delete') {
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    return deleteWithAuth(name);
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function DELETE(request: Request) {
  const { name } = await request.json();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  return deleteWithAuth(name);
}
