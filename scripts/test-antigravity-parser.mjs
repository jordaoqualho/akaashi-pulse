#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { parseAntigravityTranscript } = await import(path.join(root, 'lib/providers/antigravity/parse-antigravity-transcript.ts'));
const temp = await mkdtemp(path.join(tmpdir(), 'akaashi-pulse-antigravity-'));
try {
  const brain = path.join(temp, 'antigravity', 'brain', 'brain-1');
  const logDir = path.join(brain, '.system_generated', 'logs');
  await mkdir(logDir, { recursive: true });
  await writeFile(path.join(temp, 'antigravity', 'history.jsonl'), JSON.stringify({ conversation_id: 'brain-1', workspace_uri: '/tmp/antigravity-project' }));
  const file = path.join(logDir, 'transcript.jsonl');
  await writeFile(file, [
    JSON.stringify({ source: 'USER_EXPLICIT', type: 'USER_INPUT', content: 'Build a report', created_at: '2026-10-10T10:00:00Z' }),
    JSON.stringify({ source: 'MODEL', type: 'PLANNER_RESPONSE', model: 'gemini-test', content: 'Working', usage: { input_tokens: 8, output_tokens: 3 }, created_at: '2026-10-10T10:00:01Z' }),
  ].join('\n'));
  const parsed = await parseAntigravityTranscript(file);
  assert.equal(parsed.user.length, 1);
  assert.equal(parsed.assistant.length, 1);
  assert.equal(parsed.assistant[0].source, 'antigravity');
  assert.equal(parsed.assistant[0].cwd, '/tmp/antigravity-project');
  assert.equal(parsed.assistant[0].usage.output_tokens, 3);
  console.log('antigravity parser fixture OK');
} finally {
  await rm(temp, { recursive: true, force: true });
}
