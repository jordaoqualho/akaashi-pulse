'use client';

import { useEffect, useState } from 'react';
import { Check, Clipboard, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { useT } from '@/lib/i18n/context';

type CheckState = 'idle' | 'checking' | 'ok' | 'error';

export function McpConnectionSettings() {
  const t = useT();
  const [endpoint, setEndpoint] = useState('http://127.0.0.1:3737/api/mcp');
  const [copied, setCopied] = useState<'endpoint' | 'command' | null>(null);
  const [checkState, setCheckState] = useState<CheckState>('idle');

  useEffect(() => {
    setEndpoint(`${window.location.origin}/api/mcp`);
  }, []);

  async function copy(value: string, kind: 'endpoint' | 'command') {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  }

  async function checkEndpoint() {
    setCheckState('checking');
    try {
      const response = await fetch('/api/mcp', {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
          'MCP-Protocol-Version': '2025-06-18',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'akaashi-pulse-settings', version: '1.0.0' },
          },
        }),
      });
      if (!response.ok) throw new Error('MCP endpoint returned an error');
      const payload = (await response.json()) as { result?: { serverInfo?: { name?: string } } };
      if (payload.result?.serverInfo?.name !== 'akaashi-pulse') throw new Error('Unexpected MCP server');
      setCheckState('ok');
    } catch {
      setCheckState('error');
    }
  }

  const command = 'node bin/cli.mjs mcp';

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-card border border-border bg-bg-surface p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <ShieldCheck size={16} className="text-success" aria-hidden />
                {t('settings.mcp.readOnly')}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{t('settings.mcp.endpointDesc')}</p>
            </div>
            <span className="pill border border-success/20 bg-success/10 text-success">{t('settings.mcp.localOnly')}</span>
          </div>
          <div className="mt-4 flex gap-2">
            <input className="field min-w-0 font-mono text-xs" value={endpoint} readOnly aria-label={t('settings.mcp.endpoint')} />
            <button type="button" className="btn btn-line btn-sm shrink-0" onClick={() => void copy(endpoint, 'endpoint')}>
              {copied === 'endpoint' ? <Check size={14} aria-hidden /> : <Clipboard size={14} aria-hidden />}
              <span className="hidden sm:inline">{copied === 'endpoint' ? t('settings.mcp.copied') : t('settings.mcp.copy')}</span>
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-ink btn-sm" onClick={() => void checkEndpoint()} disabled={checkState === 'checking'}>
              <RefreshCw size={14} className={checkState === 'checking' ? 'animate-spin' : ''} aria-hidden />
              {checkState === 'checking' ? t('settings.mcp.checking') : t('settings.mcp.check')}
            </button>
            {checkState === 'ok' && <span className="text-xs text-success">{t('settings.mcp.ready')}</span>}
            {checkState === 'error' && <span className="text-xs text-danger">{t('settings.mcp.checkFailed')}</span>}
          </div>
        </div>

        <div className="rounded-card border border-border bg-bg-surface p-4 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <ExternalLink size={16} className="text-faint" aria-hidden />
            {t('settings.mcp.chatgptTitle')}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{t('settings.mcp.chatgptDesc')}</p>
          <ol className="mt-4 space-y-2 text-xs leading-relaxed text-text-secondary">
            <li><span className="mr-2 font-mono text-text-primary">01</span>{t('settings.mcp.chatgptStep1')}</li>
            <li><span className="mr-2 font-mono text-text-primary">02</span>{t('settings.mcp.chatgptStep2')}</li>
            <li><span className="mr-2 font-mono text-text-primary">03</span>{t('settings.mcp.chatgptStep3')}</li>
          </ol>
        </div>
      </div>

      <div className="rounded-card border border-border bg-bg-surface-hi p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-text-primary">{t('settings.mcp.localTitle')}</div>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">{t('settings.mcp.localDesc')}</p>
          </div>
          <button type="button" className="btn btn-line btn-sm" onClick={() => void copy(command, 'command')}>
            {copied === 'command' ? <Check size={14} aria-hidden /> : <Clipboard size={14} aria-hidden />}
            {copied === 'command' ? t('settings.mcp.copied') : t('settings.mcp.copy')}
          </button>
        </div>
        <code className="mt-3 block overflow-x-auto rounded-button border border-border bg-bg-surface px-3 py-2.5 font-mono text-xs text-text-primary">{command}</code>
      </div>

      <p className="text-xs leading-relaxed text-text-tertiary">{t('settings.mcp.readOnlyNote')}</p>
    </div>
  );
}
