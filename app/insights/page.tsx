import { getCachedScan } from '@/lib/data-loader/scan';
import { aggregateBySession } from '@/lib/aggregator';
import { EmptyState, PageShell } from '@/components/section';
import { RangePicker } from '@/components/range-picker';
import { InsightsDashboard } from '@/components/insights-dashboard';
import { buildSessionInsights } from '@/lib/session-insights';
import { getServerLocale, getServerT } from '@/lib/i18n/server';
import { resolveSource, filterBySource, expandSources } from '@/lib/source';
import { normalizeUsageRange, parseCustomRange, rangeToDates } from '@/lib/range';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string;
    range?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const sp = await searchParams;
  const t = await getServerT();
  const locale = await getServerLocale();
  const source = await resolveSource(sp.source);
  const range = normalizeUsageRange(sp.range, '30d');
  const dates = range === 'custom' ? parseCustomRange(sp.from, sp.to) : rangeToDates(range);
  const scan = await getCachedScan();
  const records = filterBySource(scan.records, source);
  const userRecords = filterBySource(scan.userRecords, source);
  const sessionsBetween = (from?: Date, to?: Date) => expandSources(source).flatMap((provider) => aggregateBySession(records, userRecords, {
    source: provider,
    from,
    to,
  }));
  const sessions = sessionsBetween(dates.from, dates.to);
  // Compare against the equal-length window right before the selected one.
  // Open-ended ranges ("All") have no previous window.
  const previous = dates.from
    ? (() => {
        const span = (dates.to ?? new Date()).getTime() - dates.from.getTime();
        return sessionsBetween(new Date(dates.from.getTime() - span), new Date(dates.from.getTime() - 1));
      })()
    : undefined;

  return (
    <PageShell
      title={t('insights.title')}
      desc={t('insights.subtitle', { count: sessions.length })}
      right={<RangePicker defaultValue="30d" />}
    >
      {sessions.length === 0 ? (
        <EmptyState title={t('insights.empty.title')} desc={t('insights.empty.desc')} />
      ) : (
        <InsightsDashboard
          data={buildSessionInsights({ sessions, previousSessions: previous, records, from: dates.from, to: dates.to, locale })}
          range={range}
        />
      )}
    </PageShell>
  );
}
