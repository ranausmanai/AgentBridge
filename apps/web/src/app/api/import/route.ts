import { NextResponse } from 'next/server';
import { convertOpenAPIToManifest } from '@agentbridgeai/openapi';
import { insertApi, verifyCliToken } from '@/lib/db';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (!auth) return null;
  const [scheme, token] = auth.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim();
}

async function getUser(request: Request) {
  const bearer = getBearerToken(request);
  if (bearer) {
    const verified = verifyCliToken(bearer);
    if (verified) return { id: verified.ownerId };
  }

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

export async function POST(request: Request) {
  try {
    const authEnabled = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const body = await request.json();
    const { spec, url, is_public } = body as { spec?: string; url?: string; is_public?: boolean };

    // Hosted mode parity: publishing requires identity whenever auth is enabled.
    const user = await getUser(request);
    if (authEnabled && !user) {
      return NextResponse.json(
        { error: 'Login required to publish APIs', code: 'AUTH_REQUIRED' },
        { status: 401 },
      );
    }

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
      is_public: is_public !== false,
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
