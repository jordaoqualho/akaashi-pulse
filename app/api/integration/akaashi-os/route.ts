import { NextResponse } from 'next/server';
import { getPublicConfig, saveConfig } from '@/lib/integration/akaashi-os';
import { AkaashiOsConfigInputSchema } from '@/lib/integration/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getPublicConfig());
}

export async function PUT(request: Request) {
  const parsed = AkaashiOsConfigInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid AKAASHI OS configuration.' }, { status: 400 });
  return NextResponse.json(saveConfig(parsed.data));
}
