'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DISPLAY_CURRENCY_COOKIE,
  type DisplayCurrency,
} from '@/lib/currency';

interface CurrencyContextValue {
  currency: DisplayCurrency;
  setCurrency: (currency: DisplayCurrency) => void;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: 'USD',
  setCurrency: () => {},
});

export function CurrencyProvider({
  initialCurrency,
  children,
}: {
  initialCurrency: DisplayCurrency;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [currency, setCurrencyState] = useState<DisplayCurrency>(initialCurrency);

  const setCurrency = useCallback((next: DisplayCurrency) => {
    setCurrencyState(next);
    document.cookie = `${DISPLAY_CURRENCY_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  }, [router]);

  const value = useMemo(() => ({ currency, setCurrency }), [currency, setCurrency]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  return useContext(CurrencyContext);
}
