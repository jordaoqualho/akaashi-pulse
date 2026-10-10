import { NextResponse } from 'next/server';
import { buildPayload, privacyContract } from '@/lib/integration/akaashi-os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ payload: await buildPayload(), privacy: privacyContract() });
}
