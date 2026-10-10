import { NextResponse } from 'next/server';
import { getCachedScan, getIndexerStatus } from '@/lib/data-loader/scan';
import { detectAvailableProviders } from '@/lib/providers';
import { withApiErrorHandling } from '@/lib/api/error-handler';
import { getPublicConfig, syncWithAkaashiOs } from '@/lib/integration/akaashi-os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withApiErrorHandling(async () => {
  const result = await getCachedScan({ force: true });
  const integration = await getPublicConfig();
  const sync = integration.enabled && integration.syncMode === 'after-indexing'
    ? await syncWithAkaashiOs()
    : null;
  const available = await detectAvailableProviders();
  return NextResponse.json({
    ok: true,
    stats: result.stats,
    bySource: result.bySource,
    rateLimits: result.rateLimits,
    availableProviders: available,
    indexer: getIndexerStatus(),
    sync,
  });
});

export const GET = withApiErrorHandling(async () => {
  const result = await getCachedScan();
  const available = await detectAvailableProviders();
  return NextResponse.json({
    ok: true,
    stats: result.stats,
    bySource: result.bySource,
    rateLimits: result.rateLimits,
    availableProviders: available,
    indexer: getIndexerStatus(),
  });
});
