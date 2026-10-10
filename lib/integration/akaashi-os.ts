import { createHash, randomUUID } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getPulseStateDir } from '@/lib/runtime-paths';
import { aggregateBySession } from '@/lib/aggregator';
import { getCachedScan } from '@/lib/data-loader/scan';
import { projectNameFromCwd } from '@/lib/utils';
import { resolveProjectRootCwd } from '@/lib/project-label';
import {
  ConnectionStatusSchema,
  SyncModeSchema,
  type AkaashiOsConfigInput,
  type AkaashiOsPublicConfig,
  type ConnectionStatus,
  type NormalizedAnalyticsPayload,
  type SyncMode,
} from './types';

interface StoredState {
  machineId: string;
  endpoint: string;
  token: string;
  enabled: boolean;
  syncMode: SyncMode;
  status: ConnectionStatus;
  lastSyncAt: string | null;
  lastSyncStatus: ConnectionStatus | null;
  lastSyncError: string | null;
  syncedSessionIds: string[];
}

const DEFAULT_STATE: Omit<StoredState, 'machineId'> = {
  endpoint: '',
  token: '',
  enabled: false,
  syncMode: 'manual',
  status: 'not-configured',
  lastSyncAt: null,
  lastSyncStatus: null,
  lastSyncError: null,
  syncedSessionIds: [],
};

function statePath(): string {
  return join(getPulseStateDir(), 'akaashi-os.json');
}

function readState(): StoredState {
  try {
    const parsed = JSON.parse(readFileSync(statePath(), 'utf8')) as Partial<StoredState>;
    return {
      machineId: parsed.machineId || randomUUID(),
      ...DEFAULT_STATE,
      ...parsed,
      syncMode: SyncModeSchema.catch('manual').parse(parsed.syncMode),
      status: ConnectionStatusSchema.catch('not-configured').parse(parsed.status),
      syncedSessionIds: Array.isArray(parsed.syncedSessionIds) ? parsed.syncedSessionIds : [],
    };
  } catch {
    return { machineId: randomUUID(), ...DEFAULT_STATE };
  }
}

function writeState(state: StoredState): void {
  const file = statePath();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 });
  chmodSync(file, 0o600);
}

function updateState(update: Partial<StoredState>): StoredState {
  const next = { ...readState(), ...update };
  writeState(next);
  return next;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 20);
}

function projectId(source: string, cwd: string): string {
  return `project_${hash(`${source}:${cwd}`)}`;
}

export async function getPublicConfig(): Promise<AkaashiOsPublicConfig> {
  const state = readState();
  let pendingSessions = 0;
  try {
    const payload = await buildPayload();
    pendingSessions = payload.sessions.filter((session) => !state.syncedSessionIds.includes(session.externalId)).length;
  } catch {
    pendingSessions = 0;
  }
  return {
    endpoint: state.endpoint,
    tokenConfigured: Boolean(state.token),
    enabled: state.enabled,
    syncMode: state.syncMode,
    status: state.status,
    lastSyncAt: state.lastSyncAt,
    lastSyncStatus: state.lastSyncStatus,
    lastSyncError: state.lastSyncError,
    syncedSessions: state.syncedSessionIds.length,
    pendingSessions,
  };
}

export function saveConfig(input: AkaashiOsConfigInput): AkaashiOsPublicConfig {
  const current = readState();
  const next = updateState({
    endpoint: input.endpoint,
    token: input.clearToken ? '' : input.token || current.token,
    enabled: input.enabled,
    syncMode: input.syncMode,
    status: input.endpoint && (input.token || current.token) ? 'configured' : 'not-configured',
    lastSyncError: null,
  });
  return {
    endpoint: next.endpoint,
    tokenConfigured: Boolean(next.token),
    enabled: next.enabled,
    syncMode: next.syncMode,
    status: next.status,
    lastSyncAt: next.lastSyncAt,
    lastSyncStatus: next.lastSyncStatus,
    lastSyncError: next.lastSyncError,
    syncedSessions: next.syncedSessionIds.length,
    pendingSessions: 0,
  };
}

export async function buildPayload(): Promise<NormalizedAnalyticsPayload> {
  const state = readState();
  const scan = await getCachedScan();
  const sessionRows = scan.bySource.flatMap(({ source }) => aggregateBySession(scan.records, scan.userRecords, { source }));
  const projects = new Map<string, NormalizedAnalyticsPayload['projects'][number]>();

  const sessions = sessionRows.map((session) => {
    const projectCwd = resolveProjectRootCwd(session.cwd);
    const id = projectId(session.source, projectCwd);
    const project = projects.get(id) ?? {
      id,
      repositoryId: `repository_${hash(projectCwd)}`,
      name: projectNameFromCwd(projectCwd),
      providers: [],
    };
    if (!project.providers.includes(session.source)) project.providers.push(session.source);
    projects.set(id, project);
    return {
      externalId: `${session.source}:${state.machineId}:${session.sessionId}`,
      sessionId: session.sessionId,
      projectId: id,
      provider: session.source,
      startedAt: session.startTime,
      endedAt: session.endTime,
      estimatedActiveTimeMs: session.durationMs,
      requests: session.requests,
      tokens: {
        input: session.inputTokens,
        output: session.outputTokens,
        cacheRead: session.cacheReadTokens,
        cacheCreation: session.cacheCreationTokens,
        total: session.totalTokens,
      },
      modelUsage: Object.entries(session.modelBreakdown).map(([model, usage]) => ({
        model,
        requests: usage.requests,
        tokens: usage.tokens,
        estimatedCostUsd: usage.cost,
      })),
      estimatedCostUsd: session.cost,
    };
  });

  return {
    schemaVersion: 1,
    source: 'akaashi-pulse',
    generatedAt: new Date().toISOString(),
    machineId: state.machineId,
    projects: Array.from(projects.values()),
    sessions,
  };
}

export function privacyContract() {
  return {
    included: ['Project identifier', 'Repository identifier', 'Provider', 'Session metadata', 'Model usage', 'Token counts', 'Estimated active time', 'API-equivalent cost'],
    excluded: ['Prompts', 'AI responses', 'Source code', 'Files', 'MCP content', 'Environment variables', 'Secrets', 'Absolute local paths'],
  };
}

export async function syncWithAkaashiOs(): Promise<{ status: ConnectionStatus; synced: number; pending: number; error?: string }> {
  const state = readState();
  if (!state.enabled) {
    return { status: state.endpoint && state.token ? 'configured' : 'not-configured', synced: 0, pending: 0, error: 'Synchronization is disabled.' };
  }
  if (!state.endpoint || !state.token) {
    return { status: 'not-configured', synced: 0, pending: 0, error: 'Configure an endpoint and integration token first.' };
  }

  updateState({ status: 'syncing', lastSyncError: null });
  const payload = await buildPayload();
  const pending = payload.sessions.filter((session) => !state.syncedSessionIds.includes(session.externalId));
  if (pending.length === 0) {
    updateState({ status: 'synced', lastSyncAt: new Date().toISOString(), lastSyncStatus: 'synced' });
    return { status: 'synced', synced: 0, pending: 0 };
  }

  const outgoing = { ...payload, sessions: pending };
  try {
    const response = await fetch(state.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.token}`,
        'Content-Type': 'application/json',
        'X-AKAASHI-PULSE-SCHEMA': '1',
        'Idempotency-Key': hash(JSON.stringify(outgoing)),
      },
      body: JSON.stringify(outgoing),
      cache: 'no-store',
    });
    if (!response.ok) {
      const status: ConnectionStatus = response.status === 401 || response.status === 403 ? 'authentication-failed' : 'server-unavailable';
      const error = `AKAASHI OS returned HTTP ${response.status}.`;
      updateState({ status, lastSyncStatus: status, lastSyncError: error });
      return { status, synced: 0, pending: pending.length, error };
    }
    updateState({
      status: 'synced',
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: 'synced',
      syncedSessionIds: Array.from(new Set([...state.syncedSessionIds, ...pending.map((session) => session.externalId)])),
    });
    return { status: 'synced', synced: pending.length, pending: 0 };
  } catch {
    const error = 'AKAASHI OS could not be reached. Check the endpoint and try again.';
    updateState({ status: 'server-unavailable', lastSyncStatus: 'server-unavailable', lastSyncError: error });
    return { status: 'server-unavailable', synced: 0, pending: pending.length, error };
  }
}

export async function testAkaashiOsConnection(): Promise<{ status: ConnectionStatus; error?: string }> {
  const state = readState();
  if (!state.endpoint || !state.token) return { status: 'not-configured', error: 'Configure an endpoint and integration token first.' };
  updateState({ status: 'testing', lastSyncError: null });
  try {
    const response = await fetch(state.endpoint, { method: 'HEAD', headers: { Authorization: `Bearer ${state.token}` }, cache: 'no-store' });
    const status: ConnectionStatus = response.ok ? 'connected' : response.status === 401 || response.status === 403 ? 'authentication-failed' : 'server-unavailable';
    updateState({ status, lastSyncStatus: status, lastSyncError: status === 'connected' ? null : `AKAASHI OS returned HTTP ${response.status}.` });
    return { status, error: status === 'connected' ? undefined : `AKAASHI OS returned HTTP ${response.status}.` };
  } catch {
    const error = 'AKAASHI OS could not be reached. Check the endpoint and try again.';
    updateState({ status: 'server-unavailable', lastSyncStatus: 'server-unavailable', lastSyncError: error });
    return { status: 'server-unavailable', error };
  }
}
