import Link from 'next/link';
import { getCachedScan } from '@/lib/data-loader/scan';
import { aggregateBySession } from '@/lib/aggregator';
import { PageShell, EmptyState } from '@/components/section';
import { KpiCard } from '@/components/kpi-card';
import { SessionsToolbar } from '@/components/sessions-toolbar';
import {
  formatTokensCompact,
  formatCurrency,
  formatRelative,
  formatDuration,
  shortHash,
} from '@/lib/utils';
import { getServerT, getServerLocale } from '@/lib/i18n/server';
import { getServerCurrency } from '@/lib/currency/server';
import { resolveSource, filterBySource, expandSources } from '@/lib/source';
import { getProvider } from '@/lib/providers';
import { getAllModels, getAllProjects } from '@/lib/data-loader/derived';
import { normalizeUsageRange, parseCustomRange, rangeToDates } from '@/lib/range';
import { resolveProjectRootCwd } from '@/lib/project-label';
import { ClickableTableRow } from '@/components/clickable-table-row';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string;
    q?: string;
    models?: string;
    projects?: string;
    range?: string;
    from?: string;
    to?: string;
    sort?: string;
    page?: string;
    perPage?: string;
  }>;
}) {
  const sp = await searchParams;
  const source = await resolveSource(sp.source);
  const t = await getServerT();
  const locale = await getServerLocale();
  const currency = await getServerCurrency();
  const scan = await getCachedScan();
  const records = filterBySource(scan.records, source);
  const userRecords = filterBySource(scan.userRecords, source);
  const sources = expandSources(source);
  const models = sp.models ? sp.models.split(',').filter(Boolean) : [];
  const projects = sp.projects
    ? sp.projects.split(',').filter(Boolean).map(resolveProjectRootCwd)
    : [];
  const query = sp.q?.trim() ?? '';
  const range = normalizeUsageRange(sp.range, 'all');
  const dates = range === 'custom' ? parseCustomRange(sp.from, sp.to) : rangeToDates(range);
  const sort = resolveSessionSort(sp.sort);
  const pageSize = resolvePageSize(sp.perPage);
  const requestedPage = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);

  const shortenFor = (s: { source: typeof sources[number] }) => (m: string) =>
    getProvider(s.source).shortenModel(m);

  if (records.length === 0) {
    return (
      <PageShell title={t('sessions.title')}>
        <EmptyState title={t('sessions.empty')} />
      </PageShell>
    );
  }

  const sessions = sources
    .flatMap((s) => aggregateBySession(records, userRecords, {
      source: s,
      from: dates.from,
      to: dates.to,
      models,
      projects,
    }))
    .filter((session) => matchesQuery(session, query))
    .sort((a, b) => compareSessions(a, b, sort));

  const totalPages = Math.max(1, Math.ceil(sessions.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const pageRows = sessions.slice((page - 1) * pageSize, page * pageSize);
  const firstRow = sessions.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, sessions.length);
  const totalCost = sessions.reduce((sum, session) => sum + session.cost, 0);
  const totalTokens = sessions.reduce((sum, session) => sum + session.totalTokens, 0);
  const totalRequests = sessions.reduce((sum, session) => sum + session.requests, 0);
  const allModels = getAllModels(records);
  const allProjects = getAllProjects(records);
  const queryWithoutPage = Object.fromEntries(
    Object.entries(sp).filter(([key]) => key !== 'page' && key !== 'perPage'),
  );

  return (
    <PageShell
      title={t('sessions.title')}
      desc={t('sessions.subtitle', { count: sessions.length })}
    >
      <SessionsToolbar
        allModels={allModels}
        allProjects={allProjects}
        selectedModels={models}
        selectedProjects={projects}
        query={query}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label={t('sessions.summary.sessions')} value={String(sessions.length)} />
        <KpiCard label={t('sessions.summary.requests')} value={totalRequests.toLocaleString(locale)} accent="brand" />
        <KpiCard label={t('sessions.summary.tokens')} value={formatTokensCompact(totalTokens, locale)} accent="success" />
        <KpiCard label={t('sessions.summary.cost')} value={formatCurrency(totalCost, currency)} accent="warning" />
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title={t('sessions.noMatches')}
          desc={t('sessions.noMatchesDesc')}
          action={<Link href={buildSessionsHref({ source: sp.source })} className="btn btn-line btn-sm">{t('sessions.clearFilters')}</Link>}
        />
      ) : (
        <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-surface-hi/30">
                <Th>{t('sessions.col.session')}</Th>
                <Th>{t('sessions.col.project')}</Th>
                <Th>{t('sessions.col.models')}</Th>
                <Th align="right">{t('sessions.col.requests')}</Th>
                <Th align="right">{t('sessions.col.tokens')}</Th>
                <Th align="right">{t('sessions.col.cost')}</Th>
                <Th align="right">{t('sessions.col.duration')}</Th>
                <Th align="right">{t('sessions.col.lastActivity')}</Th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((s) => (
                <ClickableTableRow
                  key={`${s.source}:${s.sessionId}`}
                  href={`/sessions/${encodeURIComponent(s.sessionId)}?source=${s.source}`}
                  ariaLabel={s.title || t('sessions.untitled', { hash: shortHash(s.sessionId) })}
                  className="group border-b border-border last:border-b-0 hover:bg-bg-surface-hi/40"
                >
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/sessions/${encodeURIComponent(s.sessionId)}?source=${s.source}`}
                      className="block text-text-primary hover:text-brand"
                    >
                      <div className="font-medium truncate max-w-[280px]" title={s.title || s.sessionId}>
                        {s.title || t('sessions.untitled', { hash: shortHash(s.sessionId) })}
                      </div>
                      <div className="num-mono text-xs text-text-tertiary">{shortHash(s.sessionId, 12)}</div>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-text-secondary truncate max-w-[180px]" title={s.cwd}>
                    {s.projectLabel}
                  </td>
                  <td className="px-3 py-2.5 text-text-secondary text-xs">
                    {s.models.map(shortenFor(s)).join(', ')}
                  </td>
                  <td className="px-3 py-2.5 num-mono text-right text-text-secondary">{s.requests}</td>
                  <td className="px-3 py-2.5 num-mono text-right text-text-secondary">
                    {formatTokensCompact(s.totalTokens, locale)}
                  </td>
                  <td className="px-3 py-2.5 num-mono text-right text-text-primary font-medium">
                    {formatCurrency(s.cost, currency)}
                  </td>
                  <td className="px-3 py-2.5 num-mono text-right text-text-tertiary">
                    {formatDuration(s.durationMs)}
                  </td>
                  <td className="px-3 py-2.5 num-mono text-right text-text-tertiary text-xs whitespace-nowrap">
                    {formatRelative(s.endTime, locale)}
                  </td>
                </ClickableTableRow>
              ))}
            </tbody>
          </table>
        </div>
          <SessionPagination
            page={page}
            totalPages={totalPages}
            firstRow={firstRow}
            lastRow={lastRow}
            totalRows={sessions.length}
            query={queryWithoutPage}
            labels={{
              showing: t('sessions.pagination.showing'),
              previous: t('sessions.pagination.previous'),
              next: t('sessions.pagination.next'),
              page: t('sessions.pagination.page'),
            }}
          />
        </div>
      )}
    </PageShell>
  );
}

type SessionSort = 'recent' | 'cost' | 'tokens' | 'duration';

function resolveSessionSort(value?: string): SessionSort {
  return value === 'cost' || value === 'tokens' || value === 'duration' ? value : 'recent';
}

function resolvePageSize(value?: string): number {
  const parsed = Number.parseInt(value ?? '25', 10);
  return parsed === 50 || parsed === 100 ? parsed : 25;
}

function matchesQuery(session: {
  sessionId: string;
  cwd: string;
  projectLabel: string;
  title?: string;
  firstUserMessage?: string;
  models: string[];
}, query: string): boolean {
  if (!query) return true;
  const needle = query.toLocaleLowerCase();
  return [
    session.sessionId,
    session.cwd,
    session.projectLabel,
    session.title ?? '',
    session.firstUserMessage ?? '',
    ...session.models,
  ].some((value) => value.toLocaleLowerCase().includes(needle));
}

function compareSessions(
  a: { endTime: string; cost: number; totalTokens: number; durationMs: number },
  b: { endTime: string; cost: number; totalTokens: number; durationMs: number },
  sort: SessionSort,
): number {
  const primary = sort === 'cost'
    ? b.cost - a.cost
    : sort === 'tokens'
      ? b.totalTokens - a.totalTokens
      : sort === 'duration'
        ? b.durationMs - a.durationMs
        : b.endTime.localeCompare(a.endTime);
  return primary || b.endTime.localeCompare(a.endTime);
}

function buildSessionsHref(query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== '') params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/sessions?${qs}` : '/sessions';
}

function SessionPagination({
  page,
  totalPages,
  firstRow,
  lastRow,
  totalRows,
  query,
  labels,
}: {
  page: number;
  totalPages: number;
  firstRow: number;
  lastRow: number;
  totalRows: number;
  query: Record<string, string | undefined>;
  labels: { showing: string; previous: string; next: string; page: string };
}) {
  if (totalPages <= 1) {
    return (
      <div className="border-t border-border px-4 py-3 text-xs text-text-tertiary">
        {labels.showing.replace('{from}', String(firstRow)).replace('{to}', String(lastRow)).replace('{total}', String(totalRows))}
      </div>
    );
  }

  const pages = Array.from(new Set([
    1,
    page - 1,
    page,
    page + 1,
    totalPages,
  ].filter((value) => value >= 1 && value <= totalPages)));
  const hrefFor = (value: number) => buildSessionsHref({ ...query, page: String(value) });
  const showing = labels.showing
    .replace('{from}', String(firstRow))
    .replace('{to}', String(lastRow))
    .replace('{total}', String(totalRows));

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs text-text-tertiary">{showing}</span>
      <nav className="flex items-center gap-1" aria-label={labels.page}>
        <Link
          href={hrefFor(Math.max(1, page - 1))}
          aria-disabled={page === 1}
          className={`btn-ghost btn-sm ${page === 1 ? 'pointer-events-none opacity-40' : ''}`}
        >
          {labels.previous}
        </Link>
        {pages.map((value) => (
          <Link
            key={value}
            href={hrefFor(value)}
            aria-current={value === page ? 'page' : undefined}
            className={`inline-flex h-7 min-w-7 items-center justify-center rounded-button px-2 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
              value === page
                ? 'bg-brand-strong text-white'
                : 'text-text-tertiary hover:bg-bg-surface-hi hover:text-text-primary'
            }`}
          >
            {value}
          </Link>
        ))}
        <Link
          href={hrefFor(Math.min(totalPages, page + 1))}
          aria-disabled={page === totalPages}
          className={`btn-ghost btn-sm ${page === totalPages ? 'pointer-events-none opacity-40' : ''}`}
        >
          {labels.next}
        </Link>
      </nav>
    </div>
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
