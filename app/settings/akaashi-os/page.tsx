import { PageShell } from '@/components/section';
import { SettingsNav } from '@/components/settings-nav';
import { AkaashiOsSettings } from '@/components/akaashi-os-settings';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AkaashiOsSettingsPage() {
  return (
    <PageShell title="AKAASHI OS" desc="Optional, aggregate-only synchronization for your development analytics.">
      <div className="grid gap-6 lg:grid-cols-[176px_minmax(0,1fr)] lg:items-start">
        <SettingsNav active="akaashi-os" />
        <AkaashiOsSettings />
      </div>
    </PageShell>
  );
}
