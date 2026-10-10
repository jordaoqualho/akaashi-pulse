import Link from 'next/link';
import { getCachedScan } from '@/lib/data-loader/scan';
import { aggregateByProject, aggregateBySession } from '@/lib/aggregator';
import { PageShell, EmptyState, Section } from '@/components/section';
import { KpiCard } from '@/components/kpi-card';
import { ProjectSpendChart, type ProjectSpendDatum } from '@/components/charts/project-spend-chart';
import {
  formatTokensCompact,
  formatCurrency,
  formatDuration,
  formatRelative,
  projectNameFromCwd,
} from '@/lib/utils';
import { getServerT, getServerLocale } from '@/lib/i18n/server';
import { getServerCurrency } from '@/lib/currency/server';
import { resolveSource, filterBySource, expandSources } from '@/lib/source';
import { getProvider } from '@/lib/providers';
import { resolveProjectRootCwd } from '@/lib/project-label';
import type { AssistantRecord, ProjectSummary } from '@/lib/types';
import { getOperatingCostConfig } from '@/lib/data-sources/config';
import { calculateOperatingCostReport } from '@/lib/operating-cost';
import { ClickableTableRow } from '@/components/clickable-table-row';
import type { DisplayCurrency } from '@/lib/currency';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function mergeWorktreeProjects(
  projects: ProjectSummary[],
  records: AssistantRecord[],
): ProjectSummary[] {
  const grouped = new Map<string, ProjectSummary>();

  for (const p of projects) {
    const canonical = resolveProjectRootCwd(p.cwd);

    const key = `${p.source}::${canonical}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        ...p,
        cwd: canonical,
        projectName: projectNameFromCwd(canonical),
      });
    } else {
      existing.requests += p.requests;
      existing.inputTokens += p.inputTokens;
      existing.outputTokens += p.outputTokens;
      existing.cacheReadTokens += p.cacheReadTokens;
      existing.cacheCreationTokens += p.cacheCreationTokens;
      existing.totalTokens += p.totalTokens;
      existing.cost += p.cost;
      existing.saved += p.saved;
      if (p.firstActivity < existing.firstActivity) existing.firstActivity = p.firstActivity;
      if (p.lastActivity > existing.lastActivity) existing.lastActivity = p.lastActivity;
      for (const m of p.models) {
        if (!existing.models.includes(m)) existing.models.push(m);
      }
    }
  }

  const sessionSets = new Map<string, Set<string>>();
  for (const r of records) {
    const key = `${r.source}::${resolveProjectRootCwd(r.cwd)}`;
    let set = sessionSets.get(key);
    if (!set) {
      set = new Set();
      sessionSets.set(key, set);
    }
    set.add(r.sessionId);
  }
  for (const [key, p] of grouped) {
    const set = sessionSets.get(key);
    if (set) p.sessions = set.size;
  }

  return Array.from(grouped.values());
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const sp = await searchParams;
  const source = await resolveSource(sp.source);
  const t = await getServerT();
  const locale = await getServerLocale();
  const currency = await getServerCurrency();
  const scan = await getCachedScan();
  const records = filterBySource(scan.records, source);
  const sources = expandSources(source);

  if (records.length === 0) {
    return (
      <PageShell title={t('projects.title')}>
        <EmptyState title={t('projects.empty')} />
      </PageShell>
    );
  }

  const rawProjects = sources.flatMap((s) => aggregateByProject(records, { source: s }));
  const projects = mergeWorktreeProjects(rawProjects, records).sort((a, b) => b.cost - a.cost);
  const totalCost = projects.reduce((s, p) => s + p.cost, 0);
  const userRecords = filterBySource(scan.userRecords, source);
  const durations = new Map<string, number>();
  const durationKey = (provider: typeof sources[number], cwd: string) =>
    `${provider}::${resolveProjectRootCwd(cwd)}`;
  for (const provider of sources) {
    for (const session of aggregateBySession(records, userRecords, { source: provider })) {
      const key = durationKey(provider, session.cwd);
      durations.set(key, (durations.get(key) ?? 0) + session.durationMs);
    }
  }
  const operatingCost = calculateOperatingCostReport({
    records: scan.records,
    userRecords: scan.userRecords,
    source,
    config: getOperatingCostConfig(),
  });
  const actualCostByProject = new Map<string, number>();
  for (const row of operatingCost.rows) {
    for (const provider of row.providers) {
      actualCostByProject.set(`${provider.source}::${row.cwd}`, provider.actualCost);
    }
  }
  const projectRows: ProjectSpendDatum[] = projects.map((project) => ({
    name: project.projectName,
    cost: project.cost,
    durationMs: durations.get(durationKey(project.source, project.cwd)) ?? 0,
    sessions: project.sessions,
    requests: project.requests,
    actualCost: operatingCost.hasConfiguredPlans
      ? actualCostByProject.get(`${project.source}::${project.cwd}`) ?? 0
      : undefined,
    href: `/projects/${encodeURIComponent(project.cwd)}?source=${project.source}`,
  }));
  const totalDuration = projectRows.reduce((sum, project) => sum + project.durationMs, 0);
  const costPerHour = totalDuration > 0 ? totalCost / (totalDuration / 3_600_000) : 0;

  const shortenFor = (p: { source: typeof sources[number] }) => (m: string) =>
    getProvider(p.source).shortenModel(m);

  return (
    <PageShell title={t('projects.title')} desc={t('projects.subtitle', { count: projects.length })}>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label={t('projects.summary.projects')} value={String(projects.length)} />
          <KpiCard label={t('projects.summary.spend')} value={formatCurrency(totalCost, currency)} accent="brand" />
        <KpiCard label={t('projects.summary.time')} value={formatDuration(totalDuration)} accent="success" />
        <KpiCard
          label={t('projects.summary.rate')}
          value={totalDuration > 0 ? `${formatCurrency(costPerHour, currency, { minFrac: 3, maxFrac: 3 })}/h` : '—'}
          hint={t('projects.summary.rateHint')}
          accent="warning"
        />
      </div>

      <Section title={t('projects.summary.title')} desc={t('projects.summary.desc')}>
        <ProjectSpendChart
          data={projectRows}
          costTitle={t('projects.summary.estimated')}
          timeTitle={t('overview.projects.time')}
          rateLabel={t('overview.projects.rate')}
          emptyLabel={t('overview.projects.empty')}
          sessionsLabel={t('projects.stat.sessions')}
          requestsLabel={t('projects.stat.requests')}
          actualCostTitle={t('projects.summary.real', { month: operatingCost.month })}
          actualCostTotal={operatingCost.hasConfiguredPlans ? operatingCost.actualTotal : undefined}
          actualCostCurrency={currency}
          actualCostUnavailableLabel={operatingCost.hasConfiguredPlans
            ? t('projects.summary.noCurrentAllocation')
            : t('projects.summary.realUnavailable')}
          actualShareLabel={t('projects.summary.realShare')}
          maxRows={8}
        />
      </Section>

      <Section
        title={t('projects.realCost.title')}
        desc={t('projects.realCost.desc', { month: operatingCost.month })}
        right={<Link href="/settings?tab=costs" className="btn btn-line btn-sm">{t('projects.realCost.configure')}</Link>}
      >
        {!operatingCost.hasConfiguredPlans ? (
          <div className="rounded-button border border-dashed border-border-hi bg-bg-surface-hi/30 px-4 py-5 text-sm text-text-secondary">
            {t('projects.realCost.empty')}
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label={t('projects.realCost.estimated')} value={formatCurrency(operatingCost.estimatedTotal, currency)} />
              <Stat label={t('projects.realCost.allocated')} value={formatCurrency(operatingCost.actualTotal, currency)} />
              <Stat label={t('projects.realCost.monthlyPlans')} value={formatCurrency(operatingCost.configuredMonthlyCost, currency)} />
              <Stat label={t('projects.realCost.basis')} value={operatingCostBasisLabel(operatingCost.basis, t)} />
            </div>
            <div className="overflow-x-auto rounded-button border border-border">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-border bg-bg-surface-hi/50 text-xs text-text-tertiary">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t('projects.realCost.project')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('projects.realCost.metric')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('projects.realCost.estimated')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('projects.realCost.allocated')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('projects.realCost.share')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {operatingCost.rows.map((row) => {
                    const share = operatingCost.actualTotal > 0 ? row.actualCost / operatingCost.actualTotal : 0;
                    return (
                      <ClickableTableRow
                        key={row.cwd}
                        href={`/projects/${encodeURIComponent(row.cwd)}?source=${source}`}
                        ariaLabel={row.projectName}
                        className="text-text-secondary hover:bg-bg-surface-hi/40"
                      >
                        <td className="max-w-[260px] px-4 py-3">
                          <Link href={`/projects/${encodeURIComponent(row.cwd)}?source=${source}`} className="font-medium text-text-primary hover:text-brand">
                            {row.projectName}
                          </Link>
                          <div className="mt-0.5 truncate text-xs text-text-tertiary" title={row.cwd}>{row.cwd}</div>
                        </td>
                        <td className="px-4 py-3 text-right num-mono">{formatOperatingMetric(row, operatingCost.basis, locale, currency)}</td>
                        <td className="px-4 py-3 text-right num-mono">{formatCurrency(row.estimatedCost, currency)}</td>
                        <td className="px-4 py-3 text-right num-mono text-text-primary">{row.actualCost > 0 ? formatCurrency(row.actualCost, currency) : '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-bg-surface-hi">
                              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, share * 100)}%` }} />
                            </div>
                            <span className="num-mono text-xs">{(share * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                      </ClickableTableRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-text-tertiary">{t('projects.realCost.hint')}</p>
          </>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => {
          const pct = totalCost > 0 ? p.cost / totalCost : 0;
          const durationMs = durations.get(durationKey(p.source, p.cwd)) ?? 0;
          const projectRate = durationMs > 0 ? p.cost / (durationMs / 3_600_000) : 0;
          return (
            <Link

              key={`${p.source}:${p.cwd}`}
              href={`/projects/${encodeURIComponent(p.cwd)}?source=${p.source}`}
              className="card card-pad h-full min-h-[240px] transition-colors group hover:border-border-hi"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-text-primary truncate group-hover:text-brand transition-colors flex items-center gap-2">
                    <span className="truncate">{p.projectName}</span>
                    {source === 'all' && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-text-tertiary font-medium shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getProvider(p.source).logoSrc}
                          alt=""
                          aria-hidden
                          className="w-3.5 h-3.5 rounded-[3px] object-contain"
                        />
                        {getProvider(p.source).displayName.en}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-text-tertiary truncate mt-0.5" title={p.cwd}>
                    {p.cwd}
                  </div>
                </div>
                <div className="num-mono text-text-primary text-right whitespace-nowrap">{formatCurrency(p.cost, currency)}</div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <Stat label={t('projects.stat.sessions')} value={p.sessions} />
                <Stat label={t('projects.stat.requests')} value={p.requests} />
                <Stat label={t('projects.stat.tokens')} value={formatTokensCompact(p.totalTokens, locale)} />
                <Stat label={t('projects.stat.time')} value={formatDuration(durationMs)} />
              </div>

              <div className="mt-4 h-1.5 bg-bg-surface-hi rounded overflow-hidden">
                <div className="h-full bg-brand rounded" style={{ width: `${pct * 100}%` }} />
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 text-xs text-text-tertiary">
                <span className="whitespace-nowrap">
                  {t('common.lastActivity')} {formatRelative(p.lastActivity, locale)}
                </span>
                <span className="truncate text-right">
                  {p.models.map(shortenFor(p)).join(', ')} · {projectRate > 0 ? `${formatCurrency(projectRate, currency, { minFrac: 3, maxFrac: 3 })}/h` : '—'}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-text-tertiary">{label}</div>
      <div className="num-mono text-text-primary mt-0.5">{value}</div>
    </div>
  );
}

function operatingCostBasisLabel(
  basis: 'estimated-cost' | 'tokens' | 'requests' | 'tracked-time',
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (basis === 'tokens') return t('settings.operatingCost.basisTokens');
  if (basis === 'requests') return t('settings.operatingCost.basisRequests');
  if (basis === 'tracked-time') return t('settings.operatingCost.basisTime');
  return t('settings.operatingCost.basisEstimated');
}

function formatOperatingMetric(
  row: { metric: number; tokens: number; requests: number; durationMs: number },
  basis: 'estimated-cost' | 'tokens' | 'requests' | 'tracked-time',
  locale: 'en' | 'zh',
  currency: DisplayCurrency,
): string {
  if (basis === 'tokens') return formatTokensCompact(row.tokens, locale);
  if (basis === 'requests') return row.requests.toLocaleString();
  if (basis === 'tracked-time') return formatDuration(row.durationMs);
  return formatCurrency(row.metric, currency);
}
