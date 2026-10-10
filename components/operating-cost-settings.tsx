'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowUpRight, Check, ChevronDown, CircleDollarSign, ExternalLink, Loader2 } from 'lucide-react';
import type { ProviderId } from '@/lib/providers/types';
import type { OperatingCostBasis, OperatingCostConfig, OperatingCostCurrency } from '@/lib/data-sources/config';
import { getOperatingCostPlanPreset, getOperatingCostPlanPresets, type OperatingCostPlanPreset, OPERATING_COST_PRICE_SNAPSHOT } from '@/lib/operating-cost-plans';
import { useI18n, useT } from '@/lib/i18n/context';

type PlanForm = Record<ProviderId, { monthlyCost: string; enabled: boolean; planId: string }>;
type SaveState = 'loading' | 'saved' | 'saving' | 'error';

type StyledSelectOption = {
  value: string;
  label: string;
  meta?: string;
};

export type OperatingCostProvider = {
  id: ProviderId;
  displayName: { en: string; zh: string };
  logoSrc: string;
};

function emptyPlans(providers: OperatingCostProvider[]): PlanForm {
  return Object.fromEntries(providers.map((provider) => [provider.id, { monthlyCost: '', enabled: true, planId: '' }])) as PlanForm;
}

export function OperatingCostSettings({ providers }: { providers: OperatingCostProvider[] }) {
  const t = useT();
  const { locale } = useI18n();
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>(providers[0]?.id ?? 'claude');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [basis, setBasis] = useState<OperatingCostBasis>('estimated-cost');
  const [currency, setCurrency] = useState<OperatingCostCurrency>('USD');
  const [plans, setPlans] = useState<PlanForm>(() => emptyPlans(providers));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('loading');

  const selected = providers.find((provider) => provider.id === selectedProvider) ?? providers[0];
  const selectedPlan = selected ? plans[selected.id] : null;
  const selectedPresets = selected ? getOperatingCostPlanPresets(selected.id) : [];
  const selectedPreset = selected && selectedPlan ? getOperatingCostPlanPreset(selected.id, selectedPlan.planId) : undefined;
  const configuredCount = Object.values(plans).filter((plan) => plan.planId && plan.enabled).length;

  useEffect(() => {
    let active = true;
    void fetch('/api/operating-cost')
      .then((response) => response.json() as Promise<OperatingCostConfig>)
      .then((config) => {
        if (!active) return;
        setMonth(config.month);
        setBasis(config.basis);
        setCurrency(config.currency);
        setPlans((current) => {
          const next = { ...current };
          for (const provider of providers) {
            const plan = config.plans?.[provider.id];
            if (!plan) continue;
            const inferredPreset = plan.planId
              ? plan.planId
              : plan.monthlyCost > 0
                ? getOperatingCostPlanPresets(provider.id).find((preset) => preset.monthlyCost === plan.monthlyCost)?.id ?? 'custom'
                : '';
            next[provider.id] = { monthlyCost: String(plan.monthlyCost), enabled: plan.enabled, planId: inferredPreset };
          }
          return next;
        });
        setHydrated(true);
        setSaveState('saved');
      })
      .catch(() => { if (active) setSaveState('error'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [providers]);

  function updatePlan(source: ProviderId, patch: Partial<PlanForm[ProviderId]>) {
    setPlans((current) => ({ ...current, [source]: { ...current[source], ...patch } }));
    setDirty(true);
  }

  function updateMonth(value: string) {
    setMonth(value);
    setDirty(true);
  }

  function updateBasis(value: string) {
    setBasis(value as OperatingCostBasis);
    setDirty(true);
  }

  function updateCurrency(value: string) {
    setCurrency(value as OperatingCostCurrency);
    setDirty(true);
  }

  function choosePreset(source: ProviderId, planId: string) {
    if (planId === 'custom') {
      updatePlan(source, { planId: 'custom' });
      return;
    }
    const preset = getOperatingCostPlanPreset(source, planId);
    if (!preset) return;
    updatePlan(source, {
      planId,
      monthlyCost: preset.monthlyCost == null ? '' : String(preset.monthlyCost),
    });
    if (preset.currency !== currency) updateCurrency(preset.currency);
  }

  const persist = useCallback(async () => {
    if (!month || saving) return;
    setSaving(true);
    setSaveState('saving');
    try {
      const response = await fetch('/api/operating-cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          basis,
          currency,
          plans: Object.fromEntries(providers.map((provider) => [provider.id, {
            monthlyCost: Number(plans[provider.id].monthlyCost || 0),
            enabled: plans[provider.id].enabled,
            planId: plans[provider.id].planId,
          }])),
        }),
      });
      if (!response.ok) throw new Error('save failed');
      setDirty(false);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    } finally {
      setSaving(false);
    }
  }, [basis, currency, month, plans, providers, saving]);

  useEffect(() => {
    if (!hydrated || !dirty || saving) return;
    const timer = window.setTimeout(() => { void persist(); }, 550);
    return () => window.clearTimeout(timer);
  }, [dirty, hydrated, persist, saving]);

  const saveStatusLabel = saveState === 'saving'
    ? t('settings.operatingCost.saving')
    : saveState === 'error'
      ? t('settings.operatingCost.saveError')
      : t('settings.operatingCost.autosaved');

  return (
    <div className="space-y-5">
      <div className="relative rounded-card border border-brand-strong bg-brand-strong text-white shadow-sm">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/65">
                <CircleDollarSign size={15} aria-hidden />
                {t('settings.operatingCost.ledgerEyebrow')}
              </div>
              <span aria-live="polite" className="cost-save-badge">
                {saveState === 'saving' ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <span className={`cost-save-dot ${saveState === 'error' ? 'is-error' : ''}`} aria-hidden />}
                {saveStatusLabel}
                {saveState === 'error' && (
                  <button type="button" className="cost-save-retry" onClick={() => void persist()} disabled={saving || loading}>
                    {t('settings.operatingCost.retry')}
                  </button>
                )}
              </span>
            </div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">{t('settings.operatingCost.explainerTitle')}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/70">{t('settings.operatingCost.explainerDesc')}</p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-button border border-white/15 bg-white/15 text-center">
            <div className="min-w-[88px] bg-white/10 px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.08em] text-white/55">{t('settings.operatingCost.configured')}</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{configuredCount}/{providers.length}</div>
            </div>
            <div className="min-w-[88px] bg-white/10 px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.08em] text-white/55">{t('settings.operatingCost.snapshot')}</div>
              <div className="mt-1 text-sm font-medium tabular-nums">{OPERATING_COST_PRICE_SNAPSHOT}</div>
            </div>
          </div>
        </div>
        <div className="grid gap-3 border-t border-white/10 bg-black/10 p-4 sm:grid-cols-3 sm:px-6">
          <Field label={t('settings.operatingCost.month')}>
            <input type="month" value={month} onChange={(event) => updateMonth(event.target.value)} className="cost-ledger-input" disabled={loading || saving} />
          </Field>
          <Field label={t('settings.operatingCost.basis')}>
            <StyledSelect
              value={basis}
              onChange={updateBasis}
              disabled={loading || saving}
              variant="dark"
              ariaLabel={t('settings.operatingCost.basis')}
              options={[
                { value: 'estimated-cost', label: t('settings.operatingCost.basisEstimated') },
                { value: 'tokens', label: t('settings.operatingCost.basisTokens') },
                { value: 'requests', label: t('settings.operatingCost.basisRequests') },
                { value: 'tracked-time', label: t('settings.operatingCost.basisTime') },
              ]}
            />
          </Field>
          <Field label={t('settings.operatingCost.currency')}>
            <StyledSelect
              value={currency}
              onChange={updateCurrency}
              disabled={loading || saving}
              variant="dark"
              ariaLabel={t('settings.operatingCost.currency')}
              options={[
                { value: 'USD', label: t('settings.operatingCost.currencyUSD') },
                { value: 'BRL', label: t('settings.operatingCost.currencyBRL') },
                { value: 'EUR', label: t('settings.operatingCost.currencyEUR') },
              ]}
            />
          </Field>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-text-tertiary">{t('settings.operatingCost.basisHint')}</p>

      <div className="cost-ledger relative rounded-card border border-border bg-bg-surface">
        <div className="grid min-h-[390px] lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="border-b border-border bg-bg-surface-hi/45 lg:border-b-0 lg:border-r">
            <div className="border-b border-border px-4 py-3">
              <div className="label">{t('settings.operatingCost.providers')}</div>
              <p className="mt-1 text-xs text-text-tertiary">{t('settings.operatingCost.providersHint')}</p>
            </div>
            <div className="divide-y divide-border lg:divide-y-0 lg:p-2">
              {providers.map((provider) => {
                const plan = plans[provider.id];
                const preset = getOperatingCostPlanPreset(provider.id, plan.planId);
                const active = provider.id === selectedProvider;
                return (
                  <button
                    key={provider.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedProvider(provider.id)}
                    className="cost-ledger-provider w-full text-left"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={provider.logoSrc} alt="" aria-hidden className="h-7 w-7 shrink-0 rounded-[6px] object-contain" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-text-primary">{provider.displayName[locale]}</span>
                        <span className="mt-0.5 block truncate text-xs text-text-tertiary">
                          {preset?.label ?? (plan.planId === 'custom' ? t('settings.operatingCost.custom') : t('settings.operatingCost.notConfigured'))}
                        </span>
                      </span>
                    </span>
                    <span className={`cost-ledger-status ${plan.enabled && plan.planId ? 'is-on' : ''}`} aria-hidden />
                  </button>
                );
              })}
            </div>
          </aside>

          {selected && selectedPlan ? (
            <section className="min-w-0 p-5 sm:p-6">
              <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selected.logoSrc} alt="" aria-hidden className="h-10 w-10 rounded-[8px] object-contain" />
                  <div className="min-w-0">
                    <div className="label">{t('settings.operatingCost.selectedProvider')}</div>
                    <h3 className="mt-1 truncate text-lg font-semibold tracking-tight text-text-primary">{selected.displayName[locale]}</h3>
                  </div>
                </div>
                <label className="inline-flex shrink-0 items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={selectedPlan.enabled}
                    onChange={(event) => updatePlan(selected.id, { enabled: event.target.checked })}
                    disabled={loading || saving}
                  />
                  {t('settings.operatingCost.include')}
                </label>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_220px]">
                <div>
                  <div className="block space-y-2">
                    <span className="label">{t('settings.operatingCost.plan')}</span>
                    <StyledSelect
                      value={selectedPlan.planId}
                      onChange={(value) => choosePreset(selected.id, value)}
                      disabled={loading || saving}
                      ariaLabel={t('settings.operatingCost.plan')}
                      options={[
                        { value: '', label: t('settings.operatingCost.choosePlan') },
                        ...selectedPresets.map((preset) => ({
                          value: preset.id,
                          label: preset.label,
                          meta: preset.monthlyCost == null ? t('settings.operatingCost.regionPrice') : formatPresetAmount(preset),
                        })),
                        { value: 'custom', label: t('settings.operatingCost.custom') },
                      ]}
                    />
                  </div>
                  {selectedPreset && (
                    <div className="mt-3 flex items-start gap-2 rounded-button border border-brand/20 bg-brand/5 px-3 py-2.5 text-xs text-text-secondary">
                      <Check size={14} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                      <span>{selectedPreset.note}</span>
                    </div>
                  )}
                  {selectedPreset?.monthlyCost == null && (
                    <p className="mt-3 text-xs leading-relaxed text-warning">{t('settings.operatingCost.regionPriceHint')}</p>
                  )}
                  {(selectedPlan.planId === 'custom' || selectedPreset?.monthlyCost == null) && (
                    <label className="mt-4 block space-y-1.5">
                      <span className="label">{t('settings.operatingCost.customAmount', { currency })}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={selectedPlan.monthlyCost}
                        onChange={(event) => updatePlan(selected.id, { monthlyCost: event.target.value })}
                        className="field w-full num-mono"
                        placeholder="0.00"
                        disabled={loading || saving}
                      />
                      <span className="block text-xs text-text-tertiary">{t('settings.operatingCost.customHint')}</span>
                    </label>
                  )}
                </div>

                <div className="flex flex-col justify-between border-t border-border pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
                  <div>
                    <div className="label">{t('settings.operatingCost.monthlyAmount', { currency })}</div>
                    <div className="mt-2 text-3xl font-semibold tracking-tight text-text-primary tabular-nums">
                      {selectedPlan.monthlyCost ? formatCurrency(Number(selectedPlan.monthlyCost), currency) : '—'}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-text-tertiary">{t('settings.operatingCost.amountHint')}</p>
                  </div>
                  {selectedPreset && (
                    <a href={selectedPreset.sourceUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline">
                      <ExternalLink size={13} aria-hidden />
                      {t('settings.operatingCost.verifySource')}
                      <ArrowUpRight size={12} className="shrink-0" aria-hidden />
                    </a>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <div className="flex items-center justify-center p-8 text-center text-sm text-text-tertiary">{t('settings.operatingCost.noProvider')}</div>
          )}
        </div>
      </div>

    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-white/55">{label}</span>
      {children}
    </div>
  );
}

function formatPresetAmount(preset: OperatingCostPlanPreset): string {
  if (preset.monthlyCost == null) return '—';
  return `$${preset.monthlyCost.toFixed(preset.monthlyCost % 1 === 0 ? 0 : 2)}/mo`;
}

function formatCurrency(value: number, currency: OperatingCostCurrency): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function StyledSelect({
  value,
  options,
  onChange,
  disabled = false,
  variant = 'light',
  ariaLabel,
}: {
  value: string;
  options: StyledSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  variant?: 'light' | 'dark';
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];
  const isDark = variant === 'dark';

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function selectOption(option: StyledSelectOption) {
    if (disabled) return;
    onChange(option.value);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="cost-select">
      <button
        type="button"
        className={`cost-select-trigger ${isDark ? 'is-dark' : ''}`}
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0 truncate">{selected?.label ?? '—'}</span>
        <ChevronDown size={15} className="ml-auto shrink-0" aria-hidden />
      </button>
      {open && (
        <div className={`cost-select-menu ${isDark ? 'is-dark' : ''}`} role="listbox" aria-label={ariaLabel}>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                className="cost-select-option"
                onClick={() => selectOption(option)}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                <span className="ml-auto flex shrink-0 items-center gap-2">
                  {option.meta && <span className="cost-select-meta">{option.meta}</span>}
                  {active && <Check size={14} aria-hidden />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
