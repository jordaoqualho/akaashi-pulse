import os from 'node:os';
import path from 'node:path';
import { costFromUsage } from '@/lib/pricing/cost-from-usage';
import type { ProviderAdapter, PricingResolution } from '../types';
import { getConfiguredSourceDirs } from '@/lib/data-sources/config';
import { parseAntigravityTranscript } from './parse-antigravity-transcript';

function getRoot(): string {
  return process.env.AKAASHI_PULSE_ANTIGRAVITY_DIR || path.join(os.homedir(), '.gemini');
}

function getDirs(): string[] {
  const root = getRoot();
  const base = path.basename(root);
  if (base === 'brain' || base === 'antigravity' || base === 'antigravity-cli') {
    return Array.from(new Set([root, ...getConfiguredSourceDirs('antigravity')]));
  }
  return Array.from(new Set([
    path.join(root, 'antigravity'),
    path.join(root, 'antigravity-cli'),
    ...getConfiguredSourceDirs('antigravity'),
  ]));
}

function isCandidateFile(file: string): boolean {
  return file.endsWith(`${path.sep}transcript.jsonl`)
    && file.includes(`${path.sep}.system_generated${path.sep}logs${path.sep}`);
}

const noPricing: PricingResolution = { pricing: null, matchType: 'none', matchedKey: null };

export const antigravityAdapter: ProviderAdapter = {
  id: 'antigravity',
  displayName: { en: 'Antigravity', zh: 'Antigravity' },
  shortLabel: 'Ag',
  color: { fg: '#7c3aed', bg: '#ede9fe' },
  logoSrc: '/antigravity-logo.svg',
  exportsLimitTelemetry: false,
  parserVersion: 'antigravity-v1-transcript',
  capabilities: { hasCacheCreation: false, hasReasoningTokens: false, blockWindowMs: 5 * 60 * 60 * 1000 },
  getDirs,
  shouldSkipDir: (name) => name === 'node_modules' || name === 'crashes' || name === 'cache',
  isCandidateFile,
  fileExtensions: ['.jsonl'],
  parseFile: parseAntigravityTranscript,
  resolvePricing: () => noPricing,
  shortenModel: (model) => model || 'Antigravity',
  costFromUsage: (usage, pricing) => costFromUsage(usage, pricing),
  costFootnoteKey: null,
};
