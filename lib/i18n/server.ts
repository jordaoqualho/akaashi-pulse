import { DEFAULT_LOCALE, type Locale, tFn } from './dict';

export { LOCALE_COOKIE } from './shared';

export async function getServerLocale(): Promise<Locale> {
  // Pulse is intentionally English-only. Keep the dictionary layer in place
  // so upstream translation work remains easy to merge, but ignore legacy
  // Ignore legacy locale cookies from older installs.
  return DEFAULT_LOCALE;
}

export async function getServerT(): Promise<(key: string, vars?: Record<string, string | number>) => string> {
  const locale = await getServerLocale();
  return (key: string, vars?: Record<string, string | number>) => tFn(locale, key, vars);
}
