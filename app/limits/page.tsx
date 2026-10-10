import { getCachedScan } from '@/lib/data-loader/scan';
import { listProviders } from '@/lib/providers';
import { getServerT } from '@/lib/i18n/server';
import { resolveSource } from '@/lib/source';
import { PageShell } from '@/components/section';
import { AutoRefresh } from '@/components/auto-refresh';
import { LimitsDashboard } from '@/components/limits-dashboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LimitsPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const sp = await searchParams;
  const t = await getServerT();
  const scan = await getCachedScan();
  const source = await resolveSource(sp.source);
  const agents = listProviders()
    .filter((provider) => source === 'all' || provider.id === source)
    .map((provider) => ({
    id: provider.id,
    label: provider.displayName.en,
    logoSrc: provider.logoSrc,
    exportsLimitTelemetry: provider.exportsLimitTelemetry,
    }));
  const limits: typeof scan.rateLimits = source === 'all'
    ? scan.rateLimits
    : { [source]: scan.rateLimits[source] };

  return (
    <PageShell title={t('limits.title')} desc={t('limits.subtitle')}>
      <AutoRefresh intervalMs={30_000} />
      <LimitsDashboard
        agents={agents}
        limits={limits}
        labels={{
          remaining: t('limits.remaining'),
          used: t('limits.used'),
          resetIn: t('limits.resetIn'),
          resetAt: t('limits.resetAt'),
          observed: t('limits.observed'),
          available: t('limits.available'),
          nearLimit: t('limits.nearLimit'),
          exhausted: t('limits.exhausted'),
          afterReset: t('limits.afterReset'),
          primary: t('limits.primary'),
          secondary: t('limits.secondary'),
          window: t('limits.window'),
          plan: t('limits.plan'),
          credits: t('limits.credits'),
          unlimited: t('limits.unlimited'),
          noTelemetry: t('limits.noTelemetry'),
          noTelemetryHint: t('limits.noTelemetryHint'),
          claudeNoTelemetryHint: t('limits.claudeNoTelemetryHint'),
          notSupported: t('limits.notSupported'),
          notSupportedSummary: t('limits.notSupportedSummary'),
          notSupportedHint: {
            cursor: t('limits.cursorNotSupportedHint'),
            antigravity: t('limits.antigravityNotSupportedHint'),
          },
          note: t('limits.note'),
        }}
      />
    </PageShell>
  );
}
