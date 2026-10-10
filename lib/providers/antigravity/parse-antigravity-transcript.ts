import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ParsedFile } from '../types.ts';
import { makeAssistantRecord, makeUserRecord, readLocalTranscript } from '../local-transcript.ts';

function sessionIdFrom(file: string): string {
  const parts = file.split(path.sep);
  const index = parts.lastIndexOf('brain');
  return (index >= 0 ? parts[index + 1] : path.basename(path.dirname(path.dirname(file)))) || 'antigravity-session';
}

function workspaceFromEvent(raw: Record<string, unknown>): string {
  const value = raw.workspace ?? raw.workspace_uri ?? raw.workspaceUri ?? raw.cwd ?? raw.project;
  return typeof value === 'string' && value.trim() ? value.trim() : 'Antigravity';
}

async function workspaceFromHistory(file: string, sessionId: string): Promise<string> {
  const parts = file.split(path.sep);
  const brainIndex = parts.lastIndexOf('brain');
  if (brainIndex < 1) return 'Antigravity';
  const root = parts.slice(0, brainIndex).join(path.sep);
  try {
    const history = await fs.readFile(path.join(root, 'history.jsonl'), 'utf8');
    for (const line of history.split(/\r?\n/)) {
      try {
        const raw = JSON.parse(line) as Record<string, unknown>;
        const id = String(raw.conversation_id ?? raw.conversationId ?? raw.session_id ?? raw.sessionId ?? '');
        if (id !== sessionId) continue;
        const workspace = workspaceFromEvent(raw);
        if (workspace !== 'Antigravity') return workspace;
      } catch {
        // Ignore malformed history lines.
      }
    }
  } catch {
    // History is optional and is not present in every Antigravity install.
  }
  return 'Antigravity';
}

export async function parseAntigravityTranscript(file: string): Promise<ParsedFile> {
  const events = await readLocalTranscript(file);
  const sessionId = sessionIdFrom(file);
  const historyWorkspace = await workspaceFromHistory(file, sessionId);
  const assistant = [];
  const user = [];
  const parentLinks: Array<[string, string | null]> = [];
  let previousUuid: string | null = null;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.role !== 'user' && event.role !== 'assistant') continue;
    const uuid = `antigravity:${sessionId}:${index}`;
    parentLinks.push([uuid, previousUuid]);
    const cwd = workspaceFromEvent(event.raw) === 'Antigravity' ? historyWorkspace : workspaceFromEvent(event.raw);
    if (event.role === 'user') {
      user.push(makeUserRecord({
        source: 'antigravity', uuid, parentUuid: previousUuid, timestamp: event.timestamp,
        sessionId, cwd, textPreview: event.text, filePath: file,
      }));
    } else {
      assistant.push(makeAssistantRecord({
        source: 'antigravity', uuid, parentUuid: previousUuid, timestamp: event.timestamp,
        sessionId, cwd, model: event.model || 'antigravity', usage: event.usage,
        toolNames: event.toolNames, textPreview: event.text, filePath: file,
      }));
    }
    previousUuid = uuid;
  }
  return { assistant, user, parentLinks };
}
