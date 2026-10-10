import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';

const STATE_DIR = process.env.AKAASHI_PULSE_STATE_DIR || join(os.homedir(), '.akaashi-pulse');
const SERVICE_LABEL = 'com.akaashi.pulse';
const SERVICE_STATE_FILE = join(STATE_DIR, 'service.json');
const BACKGROUND_STATE_FILE = join(STATE_DIR, 'state.json');

interface JsonObject {
  [key: string]: unknown;
}

export interface LocalServiceSnapshot {
  service: {
    installed: boolean;
    running: boolean;
    url: string | null;
    port: number | null;
    mode: string | null;
    logFile: string | null;
    installedAt: string | null;
  };
  background: {
    running: boolean;
    pid: number | null;
    url: string | null;
    port: number | null;
  };
  canStop: boolean;
}

function servicePaths() {
  if (process.platform === 'darwin') {
    const uid = typeof process.getuid === 'function' ? process.getuid() : 501;
    return {
      platform: 'launchd' as const,
      file: join(os.homedir(), 'Library', 'LaunchAgents', `${SERVICE_LABEL}.plist`),
      target: `gui/${uid}/${SERVICE_LABEL}`,
    };
  }
  if (process.platform === 'linux') {
    const configHome = process.env.XDG_CONFIG_HOME || join(os.homedir(), '.config');
    return {
      platform: 'systemd' as const,
      file: join(configHome, 'systemd', 'user', `${SERVICE_LABEL}.service`),
      target: SERVICE_LABEL,
    };
  }
  return null;
}

async function readJson(path: string): Promise<JsonObject | null> {
  try {
    const value: unknown = JSON.parse(await readFile(path, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null;
  } catch {
    return null;
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function runSystemCommand(command: string, args: string[]): { ok: boolean; output: string } {
  try {
    return {
      ok: true,
      output: execFileSync(command, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 2_000,
      }),
    };
  } catch {
    return { ok: false, output: '' };
  }
}

function systemServiceRunning(paths: ReturnType<typeof servicePaths>): boolean {
  if (!paths) return false;
  if (paths.platform === 'launchd') {
    return runSystemCommand('launchctl', ['print', paths.target]).ok;
  }
  return runSystemCommand('systemctl', ['--user', 'is-active', paths.target]).output.trim() === 'active';
}

function processIsRunning(pid: number | null): boolean {
  if (!pid || pid <= 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function getLocalServiceSnapshot(): Promise<LocalServiceSnapshot> {
  const paths = servicePaths();
  const serviceConfig = await readJson(SERVICE_STATE_FILE);
  const serviceInstalled = Boolean(paths && existsSync(paths.file) && serviceConfig);
  const serviceRunning = serviceInstalled && systemServiceRunning(paths);
  const backgroundState = await readJson(BACKGROUND_STATE_FILE);
  const backgroundPid = numberValue(backgroundState?.pid);
  const backgroundRunning = processIsRunning(backgroundPid);

  return {
    service: {
      installed: serviceInstalled,
      running: serviceRunning,
      url: stringValue(serviceConfig?.url),
      port: numberValue(serviceConfig?.port),
      mode: stringValue(serviceConfig?.mode),
      logFile: stringValue(serviceConfig?.logFile),
      installedAt: stringValue(serviceConfig?.installedAt),
    },
    background: {
      running: backgroundRunning,
      pid: backgroundRunning ? backgroundPid : null,
      url: stringValue(backgroundState?.url),
      port: numberValue(backgroundState?.port),
    },
    canStop: serviceRunning || backgroundRunning,
  };
}

export async function stopLocalService(): Promise<void> {
  const paths = servicePaths();
  const serviceConfig = await readJson(SERVICE_STATE_FILE);

  if (paths && (existsSync(paths.file) || serviceConfig)) {
    if (paths.platform === 'launchd') {
      runSystemCommand('launchctl', ['bootout', paths.target]);
    } else {
      runSystemCommand('systemctl', ['--user', 'disable', '--now', paths.target]);
      runSystemCommand('systemctl', ['--user', 'daemon-reload']);
    }
    await rm(paths.file, { force: true });
    await rm(SERVICE_STATE_FILE, { force: true });
  }

  const backgroundState = await readJson(BACKGROUND_STATE_FILE);
  const backgroundPid = numberValue(backgroundState?.pid);
  if (processIsRunning(backgroundPid)) {
    try { process.kill(backgroundPid!, 'SIGTERM'); } catch { /* already stopped */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (processIsRunning(backgroundPid)) {
      try { process.kill(backgroundPid!, 'SIGKILL'); } catch { /* already stopped */ }
    }
  }
  await rm(BACKGROUND_STATE_FILE, { force: true });
}
