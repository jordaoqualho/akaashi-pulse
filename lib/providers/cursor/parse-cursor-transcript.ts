import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ParsedFile } from '../types.ts';
import { makeAssistantRecord, makeUserRecord, readLocalTranscript } from '../local-transcript.ts';

function sessionIdFrom(file: string): string {
  const base = path.basename(file, path.extname(file));
  const transcriptIndex = file.split(path.sep).lastIndexOf('agent-transcripts');
  const parent = transcriptIndex >= 0 ? file.split(path.sep)[transcriptIndex + 1] : base;
  return parent || base || 'cursor-session';
}

function projectFrom(file: string): string {
  const parts = file.split(path.sep);
  const index = parts.lastIndexOf('agent-transcripts');
  const slug = index > 0 ? parts[index - 1] : parts.at(-2) ?? 'cursor';
  return `cursor:${slug || 'workspace'}`;
}

async function readLegacyText(file: string) {
  const content = await fs.readFile(file, 'utf8');
  const fallback = new Date((await fs.stat(file)).mtimeMs).toISOString();
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = /^(user|assistant|human|agent)\s*:\s*(.*)$/i.exec(line);
      return {
        role: (match?.[1]?.toLowerCase() === 'user' || match?.[1]?.toLowerCase() === 'human') ? 'user' as const : 'assistant' as const,
        text: (match?.[2] ?? line).slice(0, 200),
        timestamp: fallback,
        model: '',
        toolNames: [],
        usage: undefined,
        line: index,
      };
    });
}

export async function parseCursorTranscript(file: string): Promise<ParsedFile> {
  const events = file.endsWith('.txt')
    ? await readLegacyText(file)
    : await readLocalTranscript(file);
  const sessionId = sessionIdFrom(file);
  const cwd = projectFrom(file);
  const assistant = [];
  const user = [];
  const parentLinks: Array<[string, string | null]> = [];
  let previousUuid: string | null = null;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.role !== 'user' && event.role !== 'assistant') continue;
    const uuid = `cursor:${sessionId}:${index}`;
    parentLinks.push([uuid, previousUuid]);
    if (event.role === 'user') {
      user.push(makeUserRecord({
        source: 'cursor',
        uuid,
        parentUuid: previousUuid,
        timestamp: event.timestamp,
        sessionId,
        cwd,
        textPreview: event.text,
        filePath: file,
      }));
    } else {
      assistant.push(makeAssistantRecord({
        source: 'cursor',
        uuid,
        parentUuid: previousUuid,
        timestamp: event.timestamp,
        sessionId,
        cwd,
        model: event.model || 'cursor',
        usage: event.usage,
        toolNames: event.toolNames,
        textPreview: event.text,
        filePath: file,
      }));
    }
    previousUuid = uuid;
  }
  return { assistant, user, parentLinks };
}
