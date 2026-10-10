
import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import { projectNameFromCwd } from './utils.ts';

interface LabelResult {

  label: string;

  isWorktree: boolean;

  mainName: string;

  worktreeName: string;

  canonicalCwd: string;
}

const cache = new Map<string, LabelResult>();

const GITDIR_PATTERN = /^(.+?)[/\\]\.git[/\\]worktrees[/\\]([^/\\]+)[/\\]?$/;

const CWD_WORKTREE_PATTERN = /^(.+?)[/\\](?:\.git|\.claude)[/\\]worktrees[/\\]([^/\\]+)(?:[/\\].*)?$/;

function resolveRaw(cwd: string): LabelResult {
  const fallbackName = projectNameFromCwd(cwd);
  if (!cwd) {
    return { label: fallbackName, isWorktree: false, mainName: fallbackName, worktreeName: '', canonicalCwd: cwd };
  }

  const pathMatch = CWD_WORKTREE_PATTERN.exec(cwd);
  if (pathMatch) {
    const mainRepoPath = pathMatch[1];
    const worktreeName = pathMatch[2];
    const mainName = basename(mainRepoPath) || mainRepoPath;
    return {
      label: `${mainName} (${worktreeName})`,
      isWorktree: true,
      mainName,
      worktreeName,
      canonicalCwd: mainRepoPath,
    };
  }

  try {
    const gitPath = `${cwd}/.git`;
    const s = statSync(gitPath);

    if (!s.isFile()) {
      return { label: fallbackName, isWorktree: false, mainName: fallbackName, worktreeName: '', canonicalCwd: cwd };
    }
    const text = readFileSync(gitPath, 'utf8').trim();

    const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
    const m = /^gitdir:\s*(.+)$/.exec(firstLine);
    if (!m) {
      return { label: fallbackName, isWorktree: false, mainName: fallbackName, worktreeName: '', canonicalCwd: cwd };
    }
    const gitdir = m[1].trim();
    const wt = GITDIR_PATTERN.exec(gitdir);
    if (!wt) {

      return { label: fallbackName, isWorktree: false, mainName: fallbackName, worktreeName: '', canonicalCwd: cwd };
    }
    const mainRepoPath = wt[1];
    const worktreeName = wt[2];
    const mainName = basename(mainRepoPath) || mainRepoPath;
    return {
      label: `${mainName} (${worktreeName})`,
      isWorktree: true,
      mainName,
      worktreeName,
      canonicalCwd: mainRepoPath,
    };
  } catch {
    return { label: fallbackName, isWorktree: false, mainName: fallbackName, worktreeName: '', canonicalCwd: cwd };
  }
}

export function resolveProjectLabel(cwd: string): string {
  const cached = cache.get(cwd);
  if (cached) return cached.label;
  const r = resolveRaw(cwd);
  cache.set(cwd, r);
  return r.label;
}

export function resolveProjectMeta(cwd: string): LabelResult {
  const cached = cache.get(cwd);
  if (cached) return cached;
  const r = resolveRaw(cwd);
  cache.set(cwd, r);
  return r;
}

export function resolveCanonicalCwd(cwd: string): string {
  return resolveProjectMeta(cwd).canonicalCwd;
}

/**
 * Collapse a working directory to the project folder directly below a
 * `workspaces` directory. Session records can be written from nested package
 * folders, but the dashboard should count them as one project. The original
 * record cwd remains available to detail pages for the subfolder breakdown.
 */
export function resolveProjectRootCwd(cwd: string): string {
  const canonical = resolveCanonicalCwd(cwd);
  const parts = canonical.split(/[\\/]+/).filter(Boolean);
  const workspaceIndex = parts.findIndex((part) => part.toLowerCase() === 'workspaces');
  if (workspaceIndex < 0 || workspaceIndex + 1 >= parts.length) return canonical;

  const separator = canonical.includes('\\') ? '\\' : '/';
  const prefix = /^[\\/]/.test(canonical) ? separator : '';
  return prefix + parts.slice(0, workspaceIndex + 2).join(separator);
}

export function clearProjectLabelCache(): void {
  cache.clear();
}
