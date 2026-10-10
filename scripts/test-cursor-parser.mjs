#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { parseCursorTranscript } = await import(path.join(root, 'lib/providers/cursor/parse-cursor-transcript.ts'));
const temp = await mkdtemp(path.join(tmpdir(), 'akaashi-pulse-cursor-'));
try {
  const file = path.join(temp, 'projects', 'demo-project', 'agent-transcripts', 'session-1', 'session-1.jsonl');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, [
    JSON.stringify({ role: 'user', message: { content: [{ type: 'text', text: 'Inspect this project' }] }, timestamp: '2026-10-10T10:00:00Z' }),
    JSON.stringify({ role: 'assistant', model: 'gpt-5', message: { content: [{ type: 'text', text: 'Done' }] }, usage: { input_tokens: 12, output_tokens: 4 }, timestamp: '2026-10-10T10:00:01Z' }),
  ].join('\n'));
  const parsed = await parseCursorTranscript(file);
  assert.equal(parsed.user.length, 1);
  assert.equal(parsed.assistant.length, 1);
  assert.equal(parsed.assistant[0].source, 'cursor');
  assert.equal(parsed.assistant[0].usage.input_tokens, 12);
  assert.equal(parsed.assistant[0].cwd, 'cursor:demo-project');
  assert.equal(parsed.assistant[0].parentUuid, parsed.user[0].uuid);
  console.log('cursor parser fixture OK');
} finally {
  await rm(temp, { recursive: true, force: true });
}
