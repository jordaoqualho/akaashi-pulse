'use client';

import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_LOCALE, type Locale, tFn } from './dict';

interface Ctx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<Ctx>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (k) => k,
});

const LS_KEY = 'akaashi-pulse.locale';

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    try { localStorage.removeItem(LS_KEY); } catch {}
  }, []);

  const setLocale = useCallback(
    (_l: Locale) => {
      router.refresh();
    },
    [router],
  );

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => tFn(initialLocale, key, vars),
    [initialLocale],
  );

  const value = useMemo<Ctx>(() => ({ locale: initialLocale, setLocale, t }), [initialLocale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function useT() {
  return useContext(I18nContext).t;
}
