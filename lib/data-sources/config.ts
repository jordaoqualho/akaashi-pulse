import { promises as fs, readFileSync } from 'node:fs';
import path from 'node:path';
import { getPulseStateDir } from '../runtime-paths.mjs';
import type { ProviderId } from '@/lib/providers';

export type ConfigurableSource = ProviderId;

interface SourceDirectoryConfig {
  [source: string]: string[] | undefined;
}

interface PulseConfig {
  sourceDirectories?: SourceDirectoryConfig;
  /** Undefined means automatic project-root detection; [] explicitly means all roots. */
  projectRoots?: string[];
}

const CONFIG_FILE = () => path.join(getPulseStateDir(), 'config.json');

/**
 * Reads optional local source overrides synchronously because provider
 * adapters expose `getDirs()` synchronously. Invalid config is ignored so a
 * damaged preference file can never stop the dashboard from starting.
 */
export function getConfiguredSourceDirs(source: ConfigurableSource): string[] {
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_FILE(), 'utf8')) as PulseConfig;
    const values = parsed.sourceDirectories?.[source];
    if (!Array.isArray(values)) return [];
    return values
      .filter((value): value is string => typeof value === 'string')
      .map(expandUserPath)
      .filter((value) => path.isAbsolute(value));
  } catch {
    return [];
  }
}

export function getConfiguredProjectRoots(): string[] | undefined {
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_FILE(), 'utf8')) as PulseConfig;
    if (!Array.isArray(parsed.projectRoots)) return undefined;
    return parsed.projectRoots
      .filter((value): value is string => typeof value === 'string')
      .map(expandUserPath)
      .filter((value) => path.isAbsolute(value));
  } catch {
    return undefined;
  }
}

export async function setConfiguredProjectRoots(roots: string[] | undefined): Promise<string[] | undefined> {
  const normalized = roots?.map(normalizeDirectory).filter((value): value is string => Boolean(value));
  const current = await readConfig();
  const next: PulseConfig = { ...current };
  if (normalized === undefined) delete next.projectRoots;
  else next.projectRoots = Array.from(new Set(normalized));
  await writePulseConfig(next);
  return next.projectRoots;
}

export async function addConfiguredSourceDir(
  source: ConfigurableSource,
  directory: string,
): Promise<string[]> {
  const normalized = normalizeDirectory(directory);
  if (!normalized) throw new Error('The source directory must be an absolute path or start with ~.');
  const current = getConfiguredSourceDirs(source);
  const next = Array.from(new Set([...current, normalized]));
  await writeConfig({ source, directories: next });
  return next;
}

export async function removeConfiguredSourceDir(
  source: ConfigurableSource,
  directory: string,
): Promise<string[]> {
  const normalized = normalizeDirectory(directory);
  const next = getConfiguredSourceDirs(source).filter((value) => value !== normalized);
  await writeConfig({ source, directories: next });
  return next;
}

export function expandUserPath(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '~') return process.env.HOME ?? trimmed;
  if (trimmed.startsWith('~/')) return path.join(process.env.HOME ?? '~', trimmed.slice(2));
  return trimmed;
}

function normalizeDirectory(value: string): string | null {
  const expanded = expandUserPath(value);
  if (!expanded || !path.isAbsolute(expanded)) return null;
  return path.normalize(expanded);
}

async function writeConfig(input: { source: ConfigurableSource; directories: string[] }): Promise<void> {
  const current = await readConfig();
  const next: PulseConfig = {
    ...current,
    sourceDirectories: {
      ...current.sourceDirectories,
      [input.source]: input.directories,
    },
  };
  await writePulseConfig(next);
}

async function readConfig(): Promise<PulseConfig> {
  try {
    return JSON.parse(await fs.readFile(CONFIG_FILE(), 'utf8')) as PulseConfig;
  } catch {
    return {};
  }
}

async function writePulseConfig(next: PulseConfig): Promise<void> {
  const file = CONFIG_FILE();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  await fs.writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(tmp, file);
}
