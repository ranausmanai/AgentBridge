import { NextResponse } from 'next/server';
import { convertOpenAPIToManifest } from '@agentbridgeai/openapi';
import { insertApi } from '@/lib/db';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function getUser() {
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { spec, url } = body as { spec?: string; url?: string };

    // Get authenticated user (optional for CLI/API usage, required for web)
    const user = await getUser();

    let specContent: string;

    if (url) {
      const res = await fetch(url);
      if (!res.ok) {
        return NextResponse.json(
          { error: `Failed to fetch spec from URL: ${res.status}` },
          { status: 400 },
        );
      }
      specContent = await res.text();
    } else if (spec) {
      specContent = spec;
    } else {
      return NextResponse.json(
        { error: 'Provide either "spec" (OpenAPI JSON/YAML) or "url"' },
        { status: 400 },
      );
    }

    const manifest = convertOpenAPIToManifest(specContent);

    insertApi({
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      base_url: manifest.base_url,
      auth_type: manifest.auth?.type ?? 'none',
      auth_config: manifest.auth ? JSON.stringify(manifest.auth) : null,
      manifest: JSON.stringify(manifest),
      openapi_spec: specContent,
      owner_id: user?.id,
      actions: manifest.actions.map(a => ({
        action_id: a.id,
        description: a.description,
        method: a.method,
        path: a.path,
      })),
    });

    return NextResponse.json({
      success: true,
      name: manifest.name,
      description: manifest.description,
      action_count: manifest.actions.length,
      actions: manifest.actions.map(a => ({ id: a.id, description: a.description })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
