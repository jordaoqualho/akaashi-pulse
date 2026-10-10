import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Nav } from '@/components/nav';
import { Providers } from '@/components/providers';
import { NoFlashScript } from '@/components/no-flash-script';
import { getServerLocale } from '@/lib/i18n/server';
import { getServerTheme } from '@/lib/theme/server';
import { PricingWarmup } from '@/components/pricing-warmup';
import { RefreshController } from '@/components/refresh-controller';
import type { SourceSwitcherProviderInfo } from '@/components/source-switcher';
import { detectAvailableProviders, listProviders } from '@/lib/providers';
import { resolveSource } from '@/lib/source';
import { cookies } from 'next/headers';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'AKAASHI Pulse',
    description: 'Local AI development analytics for Claude Code and Codex.',
    icons: {
      icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
      shortcut: '/favicon.svg',
      apple: '/favicon.svg',
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getServerLocale();
  const theme = await getServerTheme();
  const initialClass = theme === 'light' ? 'theme-light' : 'theme-dark';
  const sidebarCollapsed = (await cookies()).get('ak_sidebar')?.value === 'collapsed';
  const availableSources = await detectAvailableProviders();
  const source = await resolveSource(null, availableSources);
  const sourceProviders: SourceSwitcherProviderInfo[] = listProviders().map((provider) => ({
    id: provider.id,
    shortLabel: provider.shortLabel,
    fg: provider.color.fg,
    bg: provider.color.bg,
    displayEn: provider.displayName.en,
    displayZh: provider.displayName.zh,
    logoSrc: provider.logoSrc,
  }));

  return (
    <html lang="en" className={initialClass} suppressHydrationWarning>
      <head>
        <NoFlashScript />
      </head>
      <body className="min-h-screen bg-bg text-text-primary">
        <Providers locale={locale} theme={theme}>
          <Nav
            initialSidebarCollapsed={sidebarCollapsed}
            sourceSwitcher={{
              available: availableSources,
              initial: source,
              providers: sourceProviders,
            }}
          >
            {children}
          </Nav>
          <RefreshController />
          <PricingWarmup />
        </Providers>
      </body>
    </html>
  );
}
