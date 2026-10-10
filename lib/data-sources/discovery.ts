import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type ExternalAgentId = 'cursor' | 'antigravity';

export interface ExternalAgentPath {
  path: string;
  kind: 'directory' | 'database';
  exists: boolean;
}

export interface ExternalAgentDiscovery {
  id: ExternalAgentId;
  name: string;
  detected: boolean;
  paths: ExternalAgentPath[];
  conversations: number | null;
  steps: number | null;
  lastActivity: string | null;
  capability: 'metadata-only';
}

export async function discoverExternalAgents(): Promise<ExternalAgentDiscovery[]> {
  const home = os.homedir();
  const appSupport = path.join(home, 'Library', 'Application Support');
  const xdgConfig = process.env.XDG_CONFIG_HOME ?? path.join(home, '.config');
  const cursorDatabasePaths = unique([
    path.join(appSupport, 'Cursor', 'User', 'globalStorage', 'conversation-search.db'),
    path.join(xdgConfig, 'Cursor', 'User', 'globalStorage', 'conversation-search.db'),
    path.join(home, 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'conversation-search.db'),
  ]);
  const cursorProjectPaths = unique([
    path.join(home, '.cursor', 'projects'),
    path.join(xdgConfig, 'Cursor', 'User', 'workspaceStorage'),
  ]);
  const antigravityDatabasePaths = unique([
    path.join(home, '.gemini', 'antigravity', 'conversation_summaries.db'),
    path.join(appSupport, 'Antigravity', 'conversation_summaries.db'),
  ]);
  const antigravityConversationPaths = unique([
    path.join(home, '.gemini', 'antigravity', 'conversations'),
    path.join(home, '.gemini', 'antigravity', 'brain'),
  ]);

  const [cursorDatabase, cursorProjects, antigravityDatabase, antigravityConversations] = await Promise.all([
    existingPaths(cursorDatabasePaths, 'database'),
    existingPaths(cursorProjectPaths, 'directory'),
    existingPaths(antigravityDatabasePaths, 'database'),
    existingPaths(antigravityConversationPaths, 'directory'),
  ]);

  const cursorStats = await readCursorStats(cursorDatabase.find((item) => item.exists)?.path);
  const antigravityStats = await readAntigravityStats(antigravityDatabase.find((item) => item.exists)?.path);

  return [
    {
      id: 'cursor',
      name: 'Cursor',
      detected: cursorDatabase.some((item) => item.exists) || cursorProjects.some((item) => item.exists),
      paths: [...cursorDatabase, ...cursorProjects],
      conversations: cursorStats?.conversations ?? null,
      steps: null,
      lastActivity: cursorStats?.lastActivity ?? null,
      capability: 'metadata-only',
    },
    {
      id: 'antigravity',
      name: 'Antigravity',
      detected: antigravityDatabase.some((item) => item.exists) || antigravityConversations.some((item) => item.exists),
      paths: [...antigravityDatabase, ...antigravityConversations],
      conversations: antigravityStats?.conversations ?? null,
      steps: antigravityStats?.steps ?? null,
      lastActivity: antigravityStats?.lastActivity ?? null,
      capability: 'metadata-only',
    },
  ];
}

async function existingPaths(paths: string[], kind: ExternalAgentPath['kind']): Promise<ExternalAgentPath[]> {
  return Promise.all(paths.map(async (candidate) => ({
    path: candidate,
    kind,
    exists: await exists(candidate),
  })));
}

async function readCursorStats(file: string | undefined): Promise<{ conversations: number; lastActivity: string | null } | null> {
  if (!file) return null;
  const row = await querySqlite(file, `
    SELECT COUNT(*) AS conversations, MAX(updated_at) AS lastActivity
    FROM conversations
    WHERE source = 'local'
  `);
  if (!row) return null;
  const lastActivity = numberValue(row.lastActivity);
  return {
    conversations: numberValue(row.conversations) ?? 0,
    lastActivity: lastActivity == null ? null : new Date(lastActivity).toISOString(),
  };
}

async function readAntigravityStats(file: string | undefined): Promise<{ conversations: number; steps: number; lastActivity: string | null } | null> {
  if (!file) return null;
  const row = await querySqlite(file, `
    SELECT COUNT(*) AS conversations,
           COALESCE(SUM(step_count), 0) AS steps,
           MAX(last_user_input_time) AS lastActivity
    FROM conversation_summaries
  `);
  if (!row) return null;
  const lastActivity = row.lastActivity == null ? null : new Date(String(row.lastActivity)).toISOString();
  return {
    conversations: numberValue(row.conversations) ?? 0,
    steps: numberValue(row.steps) ?? 0,
    lastActivity,
  };
}

async function querySqlite(file: string, sql: string): Promise<Record<string, unknown> | null> {
  try {
    // `node:sqlite` is available in newer Node versions. The immutable URI
    // avoids SQLite creating sidecar journal files while Pulse is read-only.
    const sqlite = await import('node:sqlite');
    const db = new sqlite.DatabaseSync(`file:${file}?immutable=1`, { readOnly: true });
    try {
      return db.prepare(sql).get() as Record<string, unknown>;
    } finally {
      db.close();
    }
  } catch {
    // Detection still works on Node versions without node:sqlite; only the
    // optional counts disappear.
    return null;
  }
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function numberValue(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
