import { NextResponse } from 'next/server';
import { getAllApis, getApiActions, deleteApi } from '@/lib/db';

export async function GET() {
  const apis = getAllApis();
  const result = apis.map(api => ({
    id: api.id,
    name: api.name,
    description: api.description,
    version: api.version,
    base_url: api.base_url,
    auth_type: api.auth_type,
    action_count: getApiActions(api.id).length,
    created_at: api.created_at,
  }));
  return NextResponse.json(result);
}

export async function DELETE(request: Request) {
  const { name } = await request.json();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  deleteApi(name);
  return NextResponse.json({ success: true });
}
