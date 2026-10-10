import { NextResponse } from 'next/server';
import { syncWithAkaashiOs } from '@/lib/integration/akaashi-os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const result = await syncWithAkaashiOs();
  return NextResponse.json(result, { status: result.status === 'synced' ? 200 : 409 });
}
