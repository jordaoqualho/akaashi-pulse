'use client';

import { I18nProvider } from '@/lib/i18n/context';
import { ThemeProvider } from '@/lib/theme/context';
import type { Locale } from '@/lib/i18n/dict';
import type { Theme } from '@/lib/theme/shared';
import { CurrencyProvider } from '@/lib/currency/context';
import type { DisplayCurrency } from '@/lib/currency';

export function Providers({
  locale,
  theme,
  currency,
  children,
}: {
  locale: Locale;
  theme: Theme;
  currency: DisplayCurrency;
  children: React.ReactNode;
}) {
  return (
    <I18nProvider initialLocale={locale}>
      <ThemeProvider initialTheme={theme}>
        <CurrencyProvider initialCurrency={currency}>{children}</CurrencyProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
