import { cookies } from 'next/headers';
import {
  DEFAULT_DISPLAY_CURRENCY,
  DISPLAY_CURRENCY_COOKIE,
  isDisplayCurrency,
  type DisplayCurrency,
} from '@/lib/currency';

export async function getServerCurrency(): Promise<DisplayCurrency> {
  const value = (await cookies()).get(DISPLAY_CURRENCY_COOKIE)?.value;
  return isDisplayCurrency(value) ? value : DEFAULT_DISPLAY_CURRENCY;
}
