import { getCachedScan, getScannedDirsBySource, getIndexerStatus } from '@/lib/data-loader/scan';
import { filterBySource, resolveSource } from '@/lib/source';
import { getClaudePricing, getOpenAIPricing, getPricingMeta } from '@/lib/pricing/store';
import { listProviders, detectAvailableProviders } from '@/lib/providers';
import type { ProviderId } from '@/lib/providers';
import { PageShell, Section } from '@/components/section';
import { ScanRefresh } from '@/components/scan-refresh';
import { PricingTable, type PricingRow } from '@/components/pricing-table';
import { PricingRefresh } from '@/components/pricing-refresh';
import { McpConnectionSettings } from '@/components/mcp-connection-settings';
import { LocalServiceControl } from '@/components/local-service-control';
import { SettingsNav, type SettingsTab } from '@/components/settings-nav';
import { SourceDirectoryManager } from '@/components/source-directory-manager';
import { ProjectScopeManager } from '@/components/project-scope-manager';
import { ExternalAgentSources } from '@/components/external-agent-sources';
import { OperatingCostSettings } from '@/components/operating-cost-settings';
import { getConfiguredSourceDirs } from '@/lib/data-sources/config';
import { discoverExternalAgents } from '@/lib/data-sources/discovery';
import { getProjectRoots, projectScopeIsAutomatic } from '@/lib/project-scope';
import { resolveProjectRootCwd } from '@/lib/project-label';
import { getServerT, getServerLocale } from '@/lib/i18n/server';
import pkg from '../../package.json' assert { type: 'json' };

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VERSION = pkg.version;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; source?: string }>;
}) {
  const t = await getServerT();
  const locale = await getServerLocale();
  const params = await searchParams;
  const tab = normalizeSettingsTab(params.tab);
  const providers = listProviders();

  // Keep the settings shell light. Only the selected area reads its data; the
  // pricing tables and indexer stats no longer make every settings visit wait.
  const scan = tab === 'providers' || tab === 'analytics' ? await getCachedScan() : null;
  const dirsBySource = tab === 'providers' ? getScannedDirsBySource() : [];
  const available = tab === 'providers' ? await detectAvailableProviders() : [];
  const indexerStatus = tab === 'analytics' ? getIndexerStatus() : null;
  const externalAgents = tab === 'providers' ? await discoverExternalAgents() : [];
  const projectRoots = tab === 'providers' || tab === 'analytics' ? getProjectRoots() : [];
  const projectScopeAutomatic = tab === 'providers' || tab === 'analytics' ? projectScopeIsAutomatic() : true;
  const analyticsSource = tab === 'analytics' ? await resolveSource(params.source) : null;
  const trackedRecords = tab === 'analytics' && scan ? filterBySource(scan.records, 'all') : [];
  const trackedUserRecords = tab === 'analytics' && scan ? filterBySource(scan.userRecords, 'all') : [];
  const trackedProjects = new Set(
    trackedRecords.map((record) => resolveProjectRootCwd(record.cwd || '(unknown)')),
  );
  const trackedSessions = new Set(
    trackedRecords.map((record) => `${record.source}:${record.sessionId || record.uuid}`),
  );
  const cacheReusePercent = indexerStatus && indexerStatus.scanTotal > 0
    ? Math.round((indexerStatus.cacheHits / indexerStatus.scanTotal) * 100)
    : null;
  const analyticsSourceLabel = analyticsSource === 'all'
    ? t('settings.analytics.allSources')
    : analyticsSource
      ? providers.find((provider) => provider.id === analyticsSource)?.displayName[locale] ?? analyticsSource
      : '—';

  const pricingMeta = tab === 'pricing' ? getPricingMeta() : null;
  const pricingFetchedLabel = pricingMeta?.fetchedAt
    ? new Date(pricingMeta.fetchedAt).toLocaleString()
    : null;
  const pricingTablesBySource: Record<ProviderId, PricingRow[]> = {
    claude: tab === 'pricing'
      ? Object.entries(getClaudePricing())
          .filter(([model]) => isClaudeModelShown(model))
          .map(([model, p]) => ({
            model,
            input: p.input,
            output: p.output,
            cacheCreation5m: p.cacheCreation5m,
            cacheCreation1h: p.cacheCreation1h,
            cacheRead: p.cacheRead,
          }))
      : [],
    codex: tab === 'pricing'
      ? Object.entries(getOpenAIPricing())
          .filter(([model]) => isCodexModelShown(model))
          .map(([model, p]) => ({
            model,
            input: p.input,
            output: p.output,
            cacheCreation5m: p.cacheCreation5m,
            cacheCreation1h: p.cacheCreation1h,
            cacheRead: p.cacheRead,
          }))
      : [],
    cursor: [],
    antigravity: [],
  };
  const firstPricedId = providers.find((p) => pricingTablesBySource[p.id]?.length)?.id;

  return (
    <PageShell title={t('settings.title')} desc={t('settings.subtitle')}>
      <div className="grid gap-6 lg:grid-cols-[190px_minmax(0,1fr)] lg:items-start">
        <SettingsNav active={tab} />
        <div className="min-w-0 space-y-5 sm:space-y-6">
          {tab === 'general' && (
            <>
              <Section title={t('settings.preferences.title')}>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-button border border-line bg-wash p-3">
                    <div className="text-sm font-medium text-ink">{t('settings.preferences.language')}</div>
                    <div className="mt-0.5 text-xs text-muted">English only</div>
                  </div>
                  <div className="rounded-button border border-line bg-wash p-3">
                    <div className="text-sm font-medium text-ink">{t('settings.preferences.theme')}</div>
                    <div className="mt-0.5 text-xs text-muted">Light theme, shared with AKAASHI OS</div>
                  </div>
                </div>
              </Section>

              <Section title={t('settings.about.title')} desc={t('settings.about.subtitle', { version: VERSION })}>
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">{t('settings.about.serverTitle')}</h3>
                    <p className="mt-1.5 max-w-[72ch] text-sm leading-relaxed text-text-secondary">
                      {t('settings.about.serverDesc')}
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <AboutFact title={t('settings.about.server.localTitle')} desc={t('settings.about.server.localDesc')} />
                      <AboutFact title={t('settings.about.server.backgroundTitle')} desc={t('settings.about.server.backgroundDesc')} />
                      <AboutFact title={t('settings.about.server.productionTitle')} desc={t('settings.about.server.productionDesc')} />
                    </div>
                  </div>

                  <LocalServiceControl />

                  <div className="border-t border-border pt-5">
                    <p className="meta mb-2">{t('settings.about.detailsTitle')}</p>
                    <ul className="space-y-1.5 text-sm text-muted">
                      <li>• {t('settings.about.line1')}</li>
                      <li>• {t('settings.about.line2')}</li>
                      <li>• {t('settings.about.line3')}</li>
                      <li>• {t('settings.about.line4')}</li>
                    </ul>
                  </div>
                </div>
              </Section>
            </>
          )}

          {tab === 'providers' && scan && (
            <>
              <Section title={t('settings.dataSources.title')} desc={t('settings.dataSources.desc')}>
                <div className="space-y-5">
                  {dirsBySource.map(({ source, dirs }) => {
                    const provider = providers.find((p) => p.id === source)!;
                    const isAvail = available.includes(source);
                    const sourceStat = scan.bySource.find((s) => s.source === source);
                    const configuredDirectories = getConfiguredSourceDirs(source);
                    return (
                      <div key={source} className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={provider.logoSrc}
                              alt=""
                              aria-hidden
                              className="w-5 h-5 rounded-[4px] object-contain shrink-0"
                            />
                            <span className="text-sm font-semibold text-text-primary">
                              {provider.displayName[locale]}
                            </span>
                            {isAvail ? (
                              <span className="pill bg-success/10 text-success border border-success/20 text-xs">
                                {t('settings.dataSources.active')}
                              </span>
                            ) : (
                              <span className="pill bg-bg-surface-hi text-text-tertiary text-xs">
                                {t('settings.dataSources.notPresent')}
                              </span>
                            )}
                          </div>
                          {sourceStat && isAvail && (
                            <span className="text-xs text-text-tertiary num-mono">
                              {sourceStat.filesScanned} files · {sourceStat.assistantRecords.toLocaleString()} records
                            </span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          {dirs.map((d) => {
                            const present = scan.stats.scannedDirs.includes(d);
                            return (
                              <div
                                key={d}
                                className="flex items-center justify-between gap-3 px-3 py-2 rounded-button border border-border bg-bg-surface-hi/30"
                              >
                                <span className="num-mono text-sm text-text-primary truncate">{d}</span>
                                <span
                                  className={`pill text-xs whitespace-nowrap ${
                                    present
                                      ? 'bg-success/10 text-success border border-success/20'
                                      : 'bg-bg-surface-hi text-text-tertiary'
                                  }`}
                                >
                                  {present ? t('settings.dataSources.active') : t('settings.dataSources.notPresent')}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <SourceDirectoryManager source={source} configuredDirectories={configuredDirectories} />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 text-xs text-text-secondary">
                  {t('settings.dataSources.envHint', {
                    env1: 'AKAASHI_PULSE_CONFIG_DIR / CLAUDE_CONFIG_DIR',
                    env2: 'AKAASHI_PULSE_CODEX_DIR / CODEX_HOME',
                    appendix: 'AKAASHI_PULSE_CURSOR_DIR / CURSOR_AGENT_HOME · AKAASHI_PULSE_ANTIGRAVITY_DIR',
                  })}
                </div>
                <ProjectScopeManager roots={projectRoots} automatic={projectScopeAutomatic} />
                <div className="mt-4">
                  <ScanRefresh />
                </div>
              </Section>

              <Section title={t('settings.external.title')} desc={t('settings.external.desc')}>
                <ExternalAgentSources agents={externalAgents} />
              </Section>
            </>
          )}

          {tab === 'analytics' && indexerStatus && scan && (
            <div className="space-y-5">
              <Section title={t('settings.nav.analytics')} desc={t('settings.indexer.desc')}>
                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <Stat label={t('settings.scanStats.files')} value={String(scan.stats.filesScanned)} />
                  <Stat label={t('settings.scanStats.records')} value={scan.stats.recordsParsed.toLocaleString()} />
                  <Stat label={t('settings.scanStats.assistant')} value={scan.stats.assistantRecords.toLocaleString()} />
                  <Stat
                    label={t('settings.indexer.lastIndexedAt')}
                    value={indexerStatus.lastIndexedAt ? new Date(indexerStatus.lastIndexedAt).toLocaleTimeString() : 'Not available'}
                  />
                  <Stat
                    label={t('settings.indexer.indexDuration')}
                    value={indexerStatus.indexDurationMs != null ? `${indexerStatus.indexDurationMs} ms` : 'Not available'}
                  />
                  <Stat label={t('settings.indexer.watchers')} value={String(indexerStatus.watchers)} />
                  <Stat
                    label={t('settings.indexer.loadedFromDisk')}
                    value={indexerStatus.loadedFromDisk ? t('common.yes') : t('common.no')}
                  />
                  <Stat
                    label={t('settings.indexer.status')}
                    value={indexerStatus.isIndexing ? t('settings.indexer.indexing') : t('settings.indexer.idle')}
                  />
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-button border border-border bg-bg-surface-hi/40 p-4">
                    <div className="label">{t('settings.analytics.sourceContext')}</div>
                    <div className="mt-1 text-sm font-semibold text-text-primary">{analyticsSourceLabel}</div>
                    <p className="mt-1 text-xs leading-relaxed text-text-secondary">{t('settings.analytics.sourceContextHint')}</p>
                  </div>
                  <div className="rounded-button border border-border bg-bg-surface-hi/40 p-4">
                    <div className="label">{t('settings.analytics.indexerPhase')}</div>
                    <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-text-primary">
                      <span className={`h-2 w-2 rounded-full ${indexerStatus.phase === 'error' ? 'bg-danger' : indexerStatus.isIndexing ? 'bg-warning' : 'bg-success'}`} aria-hidden />
                      {indexerStatus.phase === 'error'
                        ? t('settings.indexer.error')
                        : indexerStatus.isIndexing
                          ? t('settings.indexer.indexing')
                          : t('settings.indexer.ready')}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-text-secondary">{t('settings.analytics.indexerPhaseHint')}</p>
                  </div>
                </div>

                {indexerStatus.errors.length > 0 && (
                  <div className="mt-4 space-y-1 text-xs text-warning">
                    <div className="font-medium">{t('settings.indexer.recentErrors')}</div>
                    <ul className="list-disc list-inside space-y-0.5 num-mono text-text-tertiary">
                      {indexerStatus.errors.slice(-3).map((error, index) => (
                        <li key={index} className="truncate" title={error}>
                          {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Section>

              <Section title={t('settings.analytics.coverageTitle')} desc={t('settings.analytics.coverageDesc')}>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Stat label={t('settings.analytics.activeSources')} value={String(scan.bySource.filter((item) => item.filesScanned > 0).length)} />
                  <Stat label={t('settings.analytics.directories')} value={String(scan.stats.scannedDirs.length)} />
                  <Stat label={t('settings.analytics.userRecords')} value={trackedUserRecords.length.toLocaleString()} />
                  <Stat label={t('settings.analytics.projects')} value={trackedProjects.size.toLocaleString()} />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
                  <Stat label={t('settings.analytics.sessions')} value={trackedSessions.size.toLocaleString()} />
                  <Stat label={t('settings.analytics.trackedRecords')} value={trackedRecords.length.toLocaleString()} />
                  <Stat label={t('settings.analytics.parentLinks')} value={Object.keys(scan.parentMap).length.toLocaleString()} />
                </div>

                <div className="mt-5 divide-y divide-border rounded-button border border-border">
                  {providers.map((provider) => {
                    const sourceStat = scan.bySource.find((item) => item.source === provider.id);
                    if (!sourceStat) return null;
                    return (
                      <div key={provider.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={provider.logoSrc} alt="" aria-hidden className="h-5 w-5 shrink-0 rounded-[4px] object-contain" />
                          <span className="text-sm font-medium text-text-primary">{provider.displayName[locale]}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
                          <span>{sourceStat.filesScanned.toLocaleString()} {t('settings.analytics.files').toLowerCase()}</span>
                          <span>{sourceStat.recordsParsed.toLocaleString()} {t('settings.analytics.records').toLowerCase()}</span>
                          <span>{sourceStat.assistantRecords.toLocaleString()} {t('settings.analytics.assistant').toLowerCase()}</span>
                          <span>{sourceStat.scannedDirs.length} {t('settings.analytics.directories').toLowerCase()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>

              <Section title={t('settings.analytics.cacheTitle')} desc={t('settings.analytics.cacheDesc')}>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  <Stat label={t('settings.analytics.filesDiscovered')} value={indexerStatus.filesDiscovered.toLocaleString()} />
                  <Stat label={t('settings.analytics.filesProcessed')} value={indexerStatus.filesProcessed.toLocaleString()} />
                  <Stat label={t('settings.analytics.cacheHits')} value={indexerStatus.cacheHits.toLocaleString()} />
                  <Stat label={t('settings.analytics.cacheReuse')} value={cacheReusePercent == null ? '—' : `${cacheReusePercent}%`} />
                  <Stat label={t('settings.analytics.pending')} value={indexerStatus.pendingReconciles.toLocaleString()} />
                </div>
                <div className="mt-5 rounded-button border border-border bg-bg-surface-hi/40 p-4">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium text-text-primary">{t('settings.analytics.cacheReuse')}</span>
                    <span className="num-mono text-text-secondary">{cacheReusePercent == null ? '—' : `${cacheReusePercent}%`}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg-surface-hi">
                    <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${cacheReusePercent ?? 0}%` }} />
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-text-tertiary">{t('settings.analytics.cacheReuseHint')}</p>
                </div>
              </Section>

              <Section title={t('settings.analytics.scopeTitle')} desc={t('settings.analytics.scopeDesc')}>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-button border border-border bg-bg-surface-hi/40 px-4 py-3">
                  <div>
                    <div className="label">{t('settings.analytics.scopeMode')}</div>
                    <div className="mt-1 text-sm font-semibold text-text-primary">
                      {projectScopeAutomatic ? t('settings.projectScope.automatic') : projectRoots.length > 0 ? t('settings.projectScope.manual') : t('settings.analytics.scopeUnrestricted')}
                    </div>
                  </div>
                  <span className="pill-muted">{projectRoots.length} {t('settings.analytics.roots')}</span>
                </div>
                {projectRoots.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {projectRoots.map((root) => (
                      <div key={root} className="num-mono rounded-button border border-border bg-bg-surface-hi/30 px-3 py-2 text-xs text-text-secondary">
                        {root}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-relaxed text-text-secondary">{t('settings.analytics.scopeUnrestrictedHint')}</p>
                )}
              </Section>
            </div>
          )}

          {tab === 'mcp' && (
            <Section title={t('settings.mcp.title')} desc={t('settings.mcp.desc')}>
              <McpConnectionSettings />
            </Section>
          )}

          {tab === 'costs' && (
            <Section title={t('settings.operatingCost.title')} desc={t('settings.operatingCost.desc')}>
              <OperatingCostSettings providers={providers.map((provider) => ({
                id: provider.id,
                displayName: provider.displayName,
                logoSrc: provider.logoSrc,
              }))} />
            </Section>
          )}

          {tab === 'pricing' && (
            <>
              {providers.map((provider) => {
                const rows = pricingTablesBySource[provider.id];
                if (!rows || rows.length === 0 || !pricingMeta) return null;
                return (
                  <Section
                    key={provider.id}
                    title={`${provider.displayName[locale]} · ${t('settings.pricing.title')}`}
                    desc={provider.costFootnoteKey ? t(provider.costFootnoteKey) : t('settings.pricing.desc')}
                    right={provider.id === firstPricedId ? <PricingRefresh meta={pricingMeta} fetchedLabel={pricingFetchedLabel} /> : undefined}
                  >
                    <PricingTable rows={rows} />
                  </Section>
                );
              })}
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function normalizeSettingsTab(value: string | undefined): SettingsTab {
  if (value === 'providers' || value === 'analytics' || value === 'costs' || value === 'mcp' || value === 'pricing') return value;
  return 'general';
}

// Display filters for the settings pricing tables. Underlying BUILTIN_PRICING
// keeps full data so legacy model usage still computes accurate costs; this
// only controls which rows are visible in the settings UI.
function isClaudeModelShown(model: string): boolean {
  if (model.startsWith('claude-fable-')) return true;
  if (model === 'claude-haiku-4-5') return true;
  // 8 位日期后缀不剥掉会被正则捕获成 minor（如 sonnet-4-20250514 → minor=20250514 ≥ 6 误放行）
  const m = model.replace(/-\d{8}$/, '').match(/^claude-(sonnet|opus)-(\d+)(?:-(\d+))?$/);
  if (!m) return false;
  const major = Number(m[2]);
  const minor = m[3] ? Number(m[3]) : 0;
  return major > 4 || (major === 4 && minor >= 6);
}

function isCodexModelShown(model: string): boolean {
  const m = model.toLowerCase().match(/^gpt-(\d+)/);
  return !!m && Number(m[1]) >= 5;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card card-pad py-4">
      <div className="label">{label}</div>
      <div className="num-mid mt-1">{value}</div>
    </div>
  );
}

function AboutFact({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-button border border-border bg-bg-surface-hi p-3">
      <div className="text-[13px] font-semibold text-text-primary">{title}</div>
      <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{desc}</p>
    </div>
  );
}
