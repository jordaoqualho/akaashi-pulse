import os from 'node:os';
import path from 'node:path';
import { costFromUsage } from '@/lib/pricing/cost-from-usage';
import type { ProviderAdapter, PricingResolution } from '../types';
import { getConfiguredSourceDirs } from '@/lib/data-sources/config';
import { parseCursorTranscript } from './parse-cursor-transcript';

function getCursorRoot(): string {
  return process.env.AKAASHI_PULSE_CURSOR_DIR || process.env.CURSOR_AGENT_HOME || path.join(os.homedir(), '.cursor');
}

function getDirs(): string[] {
  const root = getCursorRoot();
  const base = path.basename(root);
  return Array.from(new Set([
    base === 'projects' || base === 'agent-transcripts' ? root : path.join(root, 'projects'),
    ...getConfiguredSourceDirs('cursor'),
  ]));
}

function isCandidateFile(file: string): boolean {
  return file.endsWith('.jsonl') || file.endsWith('.txt');
}

const noPricing: PricingResolution = { pricing: null, matchType: 'none', matchedKey: null };

export const cursorAdapter: ProviderAdapter = {
  id: 'cursor',
  displayName: { en: 'Cursor', zh: 'Cursor' },
  shortLabel: 'Cu',
  color: { fg: '#2563eb', bg: '#dbeafe' },
  logoSrc: '/cursor-logo.svg',
  exportsLimitTelemetry: false,
  parserVersion: 'cursor-v1-flat-and-nested-transcripts',
  capabilities: { hasCacheCreation: false, hasReasoningTokens: false, blockWindowMs: 5 * 60 * 60 * 1000 },
  getDirs,
  shouldSkipDir: (name) => name === 'node_modules' || name === '.git' || name === 'uploads',
  isCandidateFile,
  fileExtensions: ['.jsonl', '.txt'],
  parseFile: parseCursorTranscript,
  resolvePricing: () => noPricing,
  shortenModel: (model) => model || 'Cursor',
  costFromUsage: (usage, pricing) => costFromUsage(usage, pricing),
  costFootnoteKey: null,
};
