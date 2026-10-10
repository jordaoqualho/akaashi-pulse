import { promises as fs } from 'node:fs';
import type { AssistantRecord, Usage, UserRecord } from '@/lib/types';

export interface LocalTranscriptEvent {
  raw: Record<string, unknown>;
  role: 'user' | 'assistant' | 'tool' | 'unknown';
  text: string;
  toolNames: string[];
  model: string;
  timestamp: string;
  usage: AssistantRecord['usage'];
  hasActualUsage: boolean;
}

const EMPTY_USAGE: AssistantRecord['usage'] = {
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  cache_creation_5m: 0,
  cache_creation_1h: 0,
};

function objectOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function finiteNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function firstString(...values: unknown[]): string {
  return values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim() ?? '';
}

function textFrom(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(textFrom).filter(Boolean).join('\n');
  const object = objectOf(value);
  if (!object) return '';
  return firstString(object.text, object.content, object.message, object.output, object.prompt);
}

function contentOf(raw: Record<string, unknown>): unknown {
  const message = objectOf(raw.message);
  return raw.content ?? message?.content ?? raw.text ?? message?.text;
}

function usageFrom(value: unknown): { usage: AssistantRecord['usage']; hasActualUsage: boolean } {
  const raw = objectOf(value);
  if (!raw) return { usage: { ...EMPTY_USAGE }, hasActualUsage: false };
  const nestedCache = objectOf(raw.cache_creation);
  const input = finiteNumber(raw.input_tokens) ?? finiteNumber(raw.prompt_tokens) ?? 0;
  const output = finiteNumber(raw.output_tokens) ?? finiteNumber(raw.completion_tokens) ?? 0;
  const cacheRead = finiteNumber(raw.cache_read_input_tokens) ?? finiteNumber(raw.cache_read_tokens) ?? 0;
  const cacheCreation = finiteNumber(raw.cache_creation_input_tokens) ?? finiteNumber(raw.cache_creation_tokens) ?? 0;
  const cache5m = finiteNumber(raw.cache_creation_5m) ?? finiteNumber(nestedCache?.ephemeral_5m_input_tokens) ?? 0;
  const cache1h = finiteNumber(raw.cache_creation_1h) ?? finiteNumber(nestedCache?.ephemeral_1h_input_tokens) ?? 0;
  const reasoning = finiteNumber(raw.reasoning_tokens);
  const hasActualUsage = [
    'input_tokens', 'output_tokens', 'prompt_tokens', 'completion_tokens',
    'cache_read_input_tokens', 'cache_creation_input_tokens', 'total_tokens',
  ].some((key) => Object.hasOwn(raw, key));
  return {
    usage: {
      input_tokens: input,
      output_tokens: output,
      cache_creation_input_tokens: cacheCreation,
      cache_read_input_tokens: cacheRead,
      cache_creation_5m: cache5m,
      cache_creation_1h: cache1h,
      ...(reasoning === null ? {} : { reasoning_tokens: reasoning }),
    },
    hasActualUsage,
  };
}

function isoTimestamp(value: unknown, fallback: string): string {
  const number = finiteNumber(value);
  const date = number !== null
    ? new Date(number < 1_000_000_000_000 ? number * 1000 : number)
    : new Date(typeof value === 'string' ? value : fallback);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function roleOf(raw: Record<string, unknown>): LocalTranscriptEvent['role'] {
  const message = objectOf(raw.message);
  const role = firstString(raw.role, message?.role, raw.author, raw.actor, raw.source, raw.type).toLowerCase();
  if (role.includes('user') || role.includes('human') || role.includes('prompt')) return 'user';
  if (role.includes('assistant') || role.includes('model') || role.includes('agent')) return 'assistant';
  if (role.includes('tool') || role.includes('function')) return 'tool';
  return 'unknown';
}

export function parseLocalTranscriptLine(raw: Record<string, unknown>, fallbackTimestamp: string): LocalTranscriptEvent {
  const message = objectOf(raw.message);
  const content = contentOf(raw);
  const blocks = Array.isArray(content) ? content : [];
  const toolNames = blocks
    .map((block) => objectOf(block))
    .filter((block): block is Record<string, unknown> => Boolean(block))
    .filter((block) => firstString(block.type).toLowerCase().includes('tool'))
    .map((block) => firstString(block.name, block.tool_name, block.toolName))
    .filter(Boolean);
  const usageResult = usageFrom(raw.usage ?? message?.usage ?? raw.token_usage ?? message?.token_usage);
  return {
    raw,
    role: roleOf(raw),
    text: textFrom(content).slice(0, 200),
    toolNames: Array.from(new Set(toolNames)),
    model: firstString(raw.model, raw.model_name, raw.modelName, message?.model),
    timestamp: isoTimestamp(raw.timestamp ?? raw.created_at ?? raw.createdAt ?? raw.time, fallbackTimestamp),
    usage: usageResult.usage,
    hasActualUsage: usageResult.hasActualUsage,
  };
}

export async function readLocalTranscript(file: string): Promise<LocalTranscriptEvent[]> {
  const text = await fs.readFile(file, 'utf8');
  const fallback = new Date((await fs.stat(file)).mtimeMs).toISOString();
  const events: LocalTranscriptEvent[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const raw = JSON.parse(line) as unknown;
      const object = objectOf(raw);
      if (object) events.push(parseLocalTranscriptLine(object, fallback));
    } catch {
      // A partial or legacy line should not make the entire local index fail.
    }
  }
  return events;
}

export function makeUserRecord(input: {
  source: UserRecord['source'];
  uuid: string;
  parentUuid: string | null;
  timestamp: string;
  sessionId: string;
  cwd: string;
  textPreview: string;
  filePath: string;
}): UserRecord {
  return { type: 'user', ...input };
}

export function makeAssistantRecord(input: {
  source: AssistantRecord['source'];
  uuid: string;
  parentUuid: string | null;
  timestamp: string;
  sessionId: string;
  cwd: string;
  model: string;
  usage?: AssistantRecord['usage'];
  toolNames: string[];
  textPreview: string;
  filePath: string;
}): AssistantRecord {
  return {
    type: 'assistant',
    source: input.source,
    uuid: input.uuid,
    parentUuid: input.parentUuid,
    timestamp: input.timestamp,
    sessionId: input.sessionId,
    requestId: input.uuid,
    cwd: input.cwd,
    model: input.model || input.source,
    messageId: input.uuid,
    usage: input.usage ?? { ...EMPTY_USAGE },
    toolNames: input.toolNames,
    hasThinking: false,
    textPreview: input.textPreview,
    filePath: input.filePath,
  };
}

export function emptyUsage(): AssistantRecord['usage'] {
  return { ...EMPTY_USAGE };
}

export function usageObject(value: unknown): Usage | null {
  return objectOf(value) as Usage | null;
}
