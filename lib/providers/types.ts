import type { AgentLimitSnapshot, AssistantRecord, CostBreakdown, Pricing, UserRecord } from '../types';

export type ProviderId = 'claude' | 'codex' | 'cursor' | 'antigravity';

export interface ProviderCapabilities {
  hasCacheCreation: boolean;
  hasReasoningTokens: boolean;
  blockWindowMs: number;
}

export type PricingMatchType =
  | 'exact'
  | 'date-stripped'
  | 'prefix-stripped'
  | 'family-fallback'
  | 'none';

export interface PricingResolution {
  pricing: Pricing | null;
  matchType: PricingMatchType;
  matchedKey: string | null;
}

/**
 * A session started by a command run from INSIDE another session's turn
 * (`codex review`). The child writes its own top-level rollout with no
 * `parent_thread_id`, so the only evidence of the relationship lives in the
 * spawning transcript — hence a per-file side channel rather than a field on
 * the child's records.
 */
export interface SpawnedSessionLink {
  /** `session_meta.id` of the spawned session. */
  sessionId: string;
  /** UserRecord uuid of the turn that ran the command. */
  parentUuid: string;
}

export interface ParsedFile {
  assistant: AssistantRecord[];
  user: UserRecord[];
  parentLinks: Array<[string, string | null]>;
  spawnedSessions?: SpawnedSessionLink[];
  limitSnapshot?: AgentLimitSnapshot;
}

export interface ProviderAdapter {
  id: ProviderId;
  displayName: { en: string; zh: string };
  shortLabel: string;
  color: { fg: string; bg: string };

  logoSrc: string;
  /** When false, the Limits page explains that this CLI does not emit quota snapshots in JSONL. */
  exportsLimitTelemetry: boolean;
  capabilities: ProviderCapabilities;

  parserVersion: string;

  getDirs(): string[];
  shouldSkipDir(name: string): boolean;
  /** Optional file filter for providers whose root also contains databases or artifacts. */
  isCandidateFile?(file: string): boolean;
  /** Defaults to JSONL. Kept on the adapter so legacy local transcript layouts can opt in. */
  fileExtensions?: string[];
  parseFile(file: string): Promise<ParsedFile>;

  resolvePricing(model: string): PricingResolution;
  shortenModel(model: string): string;
  // `model` lets a provider apply model-specific cost adjustments (e.g. Codex's
  // per-model fast/priority-tier multiplier). Providers that don't need it ignore it.
  costFromUsage(
    usage: AssistantRecord['usage'],
    pricing: Pricing | null,
    model?: string,
  ): CostBreakdown;

  costFootnoteKey: string | null;
}
