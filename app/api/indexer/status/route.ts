import { NextResponse } from 'next/server';
import { getIndexerStatus } from '@/lib/data-loader/scan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(): NextResponse {
  return NextResponse.json(
    { ok: true, indexer: getIndexerStatus() },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}
