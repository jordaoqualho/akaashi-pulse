'use client';

import { useT } from '@/lib/i18n/context';
import { requestRefresh, useRefreshState } from '@/components/refresh-controller';

export function ScanRefresh() {
  const t = useT();
  const { active: busy } = useRefreshState();

  return (
    <button onClick={() => requestRefresh('manual')} disabled={busy} className="btn">
      {busy ? t('settings.rescanning') : t('settings.rescan')}
    </button>
  );
}
