'use client';

import { CircleDollarSign } from 'lucide-react';
import { useT } from '@/lib/i18n/context';
import { useCurrency } from '@/lib/currency/context';
import type { DisplayCurrency } from '@/lib/currency';

export function CurrencySwitcher() {
  const t = useT();
  const { currency, setCurrency } = useCurrency();
  const next: DisplayCurrency = currency === 'USD' ? 'BRL' : 'USD';
  const nextLabel = next === 'USD' ? t('currency.usd') : t('currency.brl');

  return (
    <button
      type="button"
      onClick={() => setCurrency(next)}
      className="btn btn-line btn-sm inline-flex w-9 items-center justify-center gap-1.5 px-0 sm:w-auto sm:px-2.5"
      title={t('currency.switchTo', { currency: nextLabel })}
      aria-label={t('currency.switchTo', { currency: nextLabel })}
    >
      <CircleDollarSign size={14} aria-hidden />
      <span className="hidden sm:inline">{currency}</span>
    </button>
  );
}
