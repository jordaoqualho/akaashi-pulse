import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCachedScan } from '@/lib/data-loader/scan';
import { aggregateBySession, aggregateByTime, aggregateTotals } from '@/lib/aggregator';
import { Section, PageShell } from '@/components/section';
import { KpiCard } from '@/components/kpi-card';
import { TokenStackChart, type TokenStackDatum } from '@/components/charts/token-stack-chart';
import {
  formatTokensCompact,
  formatCurrency,
  formatRelative,
  formatDuration,
  projectNameFromCwd,
  shortHash,
} from '@/lib/utils';
import { getServerT, getServerLocale } from '@/lib/i18n/server';
import { getServerCurrency } from '@/lib/currency/server';
import { resolveSource, filterBySource, expandSources } from '@/lib/source';
import { combineTimeBuckets, combineTotals } from '@/lib/source-merge';
import { getProvider } from '@/lib/providers';
import { costOfRecord } from '@/lib/pricing/calculate';
import { resolveCanonicalCwd, resolveProjectRootCwd } from '@/lib/project-label';
import { ClickableTableRow } from '@/components/clickable-table-row';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const source = await resolveSource(sp.source);
  const cwd = decodeURIComponent(id);

  const canonicalCwd = resolveProjectRootCwd(cwd);
  const t = await getServerT();
  const locale = await getServerLocale();
  const currency = await getServerCurrency();
  const scan = await getCachedScan();
  const sources = expandSources(source);

  const shortenFor = (s: { source: typeof sources[number] }) => (m: string) =>
    getProvider(s.source).shortenModel(m);

  const records = filterBySource(scan.records, source)
    .filter((r) => resolveProjectRootCwd(r.cwd) === canonicalCwd);
  if (records.length === 0) notFound();
  const userRecords = filterBySource(scan.userRecords, source);

  const folderMap = new Map<string, {
    path: string;
    requests: number;
    sessions: Set<string>;
    totalTokens: number;
    cost: number;
  }>();
  for (const record of records) {
    const path = resolveCanonicalCwd(record.cwd);
    const existing = folderMap.get(path) ?? {
      path,
      requests: 0,
      sessions: new Set<string>(),
      totalTokens: 0,
      cost: 0,
    };
    existing.requests += 1;
    existing.sessions.add(record.sessionId);
    existing.totalTokens +=
      record.usage.input_tokens +
      record.usage.output_tokens +
      record.usage.cache_read_input_tokens +
      record.usage.cache_creation_input_tokens;
    existing.cost += costOfRecord(record).total;
    folderMap.set(path, existing);
  }
  const folders = Array.from(folderMap.values()).sort((a, b) => b.cost - a.cost);

  const totals = combineTotals(sources.map((s) => aggregateTotals(records, { source: s })));

  const sessions = sources
    .flatMap((s) => aggregateBySession(records, userRecords, { source: s }))
    .sort((a, b) => b.endTime.localeCompare(a.endTime));

  const thirtyAgo = new Date();
  thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const trendBuckets = combineTimeBuckets(
    sources.map((s) => aggregateByTime(records, 'day', { source: s, from: thirtyAgo })),
  );
  const trend: TokenStackDatum[] = trendBuckets.map((b) => ({
    label: b.label,
    input: b.inputTokens,
    output: b.outputTokens,
    cacheRead: b.cacheReadTokens,
    cacheCreation: b.cacheCreationTokens,
    cost: b.cost,
    requests: b.requests,
  }));

  return (
    <PageShell
      title={projectNameFromCwd(canonicalCwd)}
      desc={canonicalCwd}
      right={
        <Link href={`/projects?source=${source}`} className="btn-ghost">
          {t('common.allProjectsLink')}
        </Link>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label={t('projects.stat.sessions')} value={String(sessions.length)} />
        <KpiCard label={t('projects.stat.requests')} value={String(totals.requests)} />
        <KpiCard label={t('usage.kpi.totalTokens')} value={formatTokensCompact(totals.totalTokens, locale)} />
        <KpiCard
          label={t('usage.kpi.totalCost')}
          value={formatCurrency(totals.cost, currency)}
          hint={t('common.savedViaCache', { amount: formatCurrency(totals.saved, currency) })}
          warning={
            totals.unpricedRequests > 0
              ? t('common.unpricedCalls', { count: totals.unpricedRequests })
              : undefined
          }
        />
      </div>

      {folders.length > 1 && (
        <Section title={t('project.folders.title')} desc={t('project.folders.desc')}>
          <div className="grid gap-3 sm:grid-cols-2">
            {folders.map((folder) => {
              const relativePath = folder.path.startsWith(canonicalCwd)
                ? folder.path.slice(canonicalCwd.length).replace(/^[/\\]+/, '') || '.'
                : folder.path;
              return (
                <div key={folder.path} className="min-w-0 rounded-card border border-border bg-bg-surface p-4">
                  <div className="truncate font-medium text-text-primary" title={folder.path}>
                    {relativePath === '.' ? t('project.folders.root') : relativePath}
                  </div>
                  <div className="mt-1 truncate text-xs text-text-tertiary" title={folder.path}>
                    {folder.path}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                    <div>
                      <div className="text-text-tertiary">{t('projects.stat.sessions')}</div>
                      <div className="num-mono mt-0.5 text-text-primary">{folder.sessions.size}</div>
                    </div>
                    <div>
                      <div className="text-text-tertiary">{t('projects.stat.requests')}</div>
                      <div className="num-mono mt-0.5 text-text-primary">{folder.requests}</div>
                    </div>
                    <div>
                      <div className="text-text-tertiary">{t('projects.stat.cost')}</div>
                      <div className="num-mono mt-0.5 text-text-primary">{formatCurrency(folder.cost, currency)}</div>
                    </div>
                    <div>
                      <div className="text-text-tertiary">{t('projects.stat.tokens')}</div>
                      <div className="num-mono mt-0.5 text-text-primary">{formatTokensCompact(folder.totalTokens, locale)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <Section title={t('project.activity')}>
        <TokenStackChart data={trend} />
      </Section>

      <Section title={t('project.sessions.title', { count: sessions.length })}>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-surface-hi/30">
                  <Th>{t('sessions.col.session')}</Th>
                  <Th>{t('sessions.col.models')}</Th>
                  <Th align="right">{t('sessions.col.requests')}</Th>
                  <Th align="right">{t('sessions.col.tokens')}</Th>
                  <Th align="right">{t('sessions.col.cost')}</Th>
                  <Th align="right">{t('sessions.col.duration')}</Th>
                  <Th align="right">{t('sessions.col.lastActivity')}</Th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <ClickableTableRow
                    key={s.sessionId}
                    href={`/sessions/${encodeURIComponent(s.sessionId)}?source=${s.source}`}
                    ariaLabel={s.title || t('sessions.untitled', { hash: shortHash(s.sessionId) })}
                    className="border-b border-border last:border-b-0 hover:bg-bg-surface-hi/40"
                  >
                    <td className="px-3 py-2.5">
                      <Link href={`/sessions/${encodeURIComponent(s.sessionId)}?source=${s.source}`} className="hover:text-brand">
                        <div className="font-medium truncate max-w-[280px]">
                          {s.title || t('sessions.untitled', { hash: shortHash(s.sessionId) })}
                        </div>
                        <div className="num-mono text-xs text-text-tertiary">{shortHash(s.sessionId, 12)}</div>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-text-secondary">
                      {s.models.map(shortenFor(s)).join(', ')}
                    </td>
                    <td className="px-3 py-2.5 num-mono text-right">{s.requests}</td>
                    <td className="px-3 py-2.5 num-mono text-right">{formatTokensCompact(s.totalTokens, locale)}</td>
                    <td className="px-3 py-2.5 num-mono text-right font-medium">{formatCurrency(s.cost, currency)}</td>
                    <td className="px-3 py-2.5 num-mono text-right text-text-tertiary">
                      {formatDuration(s.durationMs)}
                    </td>
                    <td className="px-3 py-2.5 num-mono text-right text-xs text-text-tertiary whitespace-nowrap">
                      {formatRelative(s.endTime, locale)}
                    </td>
                  </ClickableTableRow>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>
    </PageShell>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`px-3 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      {children}
    </th>
  );
}
