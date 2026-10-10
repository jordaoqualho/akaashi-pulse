import { NextResponse } from 'next/server';
import { testAkaashiOsConnection } from '@/lib/integration/akaashi-os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json(await testAkaashiOsConnection());
}
