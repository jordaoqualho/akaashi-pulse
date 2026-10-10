import { z } from 'zod';

export const SyncModeSchema = z.enum(['manual', 'after-indexing', 'scheduled']);
export type SyncMode = z.infer<typeof SyncModeSchema>;

export const ConnectionStatusSchema = z.enum([
  'not-configured',
  'configured',
  'testing',
  'connected',
  'authentication-failed',
  'server-unavailable',
  'syncing',
  'synced',
  'partially-synced',
  'sync-failed',
]);
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;

export const AkaashiOsConfigInputSchema = z.object({
  endpoint: z.string().trim().url().or(z.literal('')),
  token: z.string().trim().optional().default(''),
  clearToken: z.boolean().optional().default(false),
  enabled: z.boolean().default(false),
  syncMode: SyncModeSchema.default('manual'),
});
export type AkaashiOsConfigInput = z.infer<typeof AkaashiOsConfigInputSchema>;

export interface AkaashiOsPublicConfig {
  endpoint: string;
  tokenConfigured: boolean;
  enabled: boolean;
  syncMode: SyncMode;
  status: ConnectionStatus;
  lastSyncAt: string | null;
  lastSyncStatus: ConnectionStatus | null;
  lastSyncError: string | null;
  syncedSessions: number;
  pendingSessions: number;
}

export interface NormalizedAnalyticsPayload {
  schemaVersion: 1;
  source: 'akaashi-pulse';
  generatedAt: string;
  machineId: string;
  projects: Array<{
    id: string;
    repositoryId: string;
    name: string;
    providers: string[];
  }>;
  sessions: Array<{
    externalId: string;
    sessionId: string;
    projectId: string;
    provider: string;
    startedAt: string;
    endedAt: string;
    estimatedActiveTimeMs: number;
    requests: number;
    tokens: {
      input: number;
      output: number;
      cacheRead: number;
      cacheCreation: number;
      total: number;
    };
    modelUsage: Array<{ model: string; requests: number; tokens: number; estimatedCostUsd: number }>;
    estimatedCostUsd: number;
  }>;
}
