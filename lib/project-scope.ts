import os from 'node:os';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { getConfiguredProjectRoots, expandUserPath } from './data-sources/config.ts';
import type { ProviderId } from './providers';

const AUTO_ROOT_NAMES = ['Workspaces', 'workspaces'];

let cachedRoots: string[] | null = null;
let cachedAutomatic: boolean | null = null;

function normalize(value: string): string {
  return path.normalize(expandUserPath(value).replace(/[\\/]+$/, ''));
}

function envRoots(): string[] | undefined {
  const raw = process.env.AKAASHI_PULSE_PROJECT_ROOTS ?? process.env.AKAASHI_PULSE_PROJECT_ROOT;
  if (raw === undefined) return undefined;
  return raw
    .split(',')
    .map((value) => normalize(value.trim()))
    .filter((value) => path.isAbsolute(value));
}

/**
 * Returns the roots used for project/session analytics. An explicit config or
 * environment value wins; otherwise a conventional ~/Workspaces directory is
 * used when it exists. An empty result means unrestricted discovery, which is
 * the safe default on machines without that convention.
 */
export function getProjectRoots(): string[] {
  if (cachedRoots) return cachedRoots.slice();

  const fromEnv = envRoots();
  if (fromEnv !== undefined) {
    cachedRoots = Array.from(new Set(fromEnv));
    cachedAutomatic = false;
    return cachedRoots.slice();
  }
  const configured = getConfiguredProjectRoots();
  if (configured !== undefined) {
    cachedRoots = Array.from(new Set(configured.map(normalize)));
    cachedAutomatic = false;
    return cachedRoots.slice();
  }
  const home = os.homedir();
  cachedRoots = AUTO_ROOT_NAMES
    .map((name) => path.join(home, name))
    .filter((root) => existsSync(root));
  cachedAutomatic = true;
  return cachedRoots.slice();
}

export function isTrackedProjectPath(cwd: string, source?: ProviderId): boolean {
  const roots = getProjectRoots();
  if (roots.length === 0) return true;
  // Cursor and Antigravity may expose only a provider-local workspace label,
  // not an absolute path. Keep those records visible because there is no safe
  // filesystem location to compare; absolute paths are still strictly scoped.
  if (!path.isAbsolute(cwd)) return source === 'cursor' || source === 'antigravity';
  const normalizedCwd = normalize(cwd);
  return roots.some((root) => {
    const normalizedRoot = normalize(root);
    return normalizedCwd === normalizedRoot || normalizedCwd.startsWith(`${normalizedRoot}${path.sep}`);
  });
}

export function projectScopeIsAutomatic(): boolean {
  getProjectRoots();
  return cachedAutomatic === true;
}

/** Clears the per-process root cache after Settings or tests change config. */
export function resetProjectScopeCache(): void {
  cachedRoots = null;
  cachedAutomatic = null;
}
