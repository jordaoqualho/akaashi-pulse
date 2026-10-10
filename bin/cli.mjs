#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process';
import { closeSync, createReadStream, existsSync, openSync } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = resolve(__dirname, '..');
const pkg = require(join(packageRoot, 'package.json'));

const { Command } = await import('commander');
async function loadGetPort() {
  const mod = await import('get-port');
  return mod.default;
}
async function loadOpenBrowser() {
  const mod = await import('open');
  return mod.default;
}

const STATE_DIR = process.env.AKAASHI_PULSE_STATE_DIR || join(os.homedir(), '.akaashi-pulse');
const STATE_FILE = join(STATE_DIR, 'state.json');
const DEFAULT_LOG_FILE = join(STATE_DIR, 'akaashi-pulse.log');
const STATE_VERSION = 1;
const DEFAULT_PORT = '3737';
const DEFAULT_HOST = '127.0.0.1';
const SERVICE_LABEL = 'com.akaashi.pulse';
const SERVICE_STATE_FILE = join(STATE_DIR, 'service.json');
const COMMAND_NAMES = new Set([
  'start', 'stop', 'restart', 'status', 'open', 'logs', 'mcp',
  'report', 'doctor', 'service',
]);

const START_OPTIONS = new Map([
  ['-p', true], ['--port', true],
  ['-H', true], ['--host', true],
  ['--dir', true],
  ['--log', true],
  ['-q', false], ['--quiet', false],
  ['-b', false], ['--background', false],
  ['--no-open', false],
  ['--strict-port', false],
]);

function browserHost(host) {
  if (!host || host === '0.0.0.0' || host === '::' || host === '[::]') return '127.0.0.1';
  return host;
}

function buildUrl(host, port) {
  return `http://${browserHost(host)}:${port}`;
}

function shouldUseColor({ forceOff = false } = {}) {
  if (forceOff) return false;
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return Boolean(process.stdout.isTTY);
}

function safeKill(pid, signal) {
  if (!pid) return false;
  try {
    process.kill(pid, signal);
    return true;
  } catch (err) {
    if (err && err.code === 'ESRCH') return false;
    throw err;
  }
}

function addStartOptions(cmd) {
  return cmd
    .option('-p, --port <port>', 'preferred port', DEFAULT_PORT)
    .option('-H, --host <host>', 'bind host', DEFAULT_HOST)
    .option('--no-open', 'do not auto-open the browser (foreground only)')
    .option('--dir <path>', 'add <path>/projects as an extra Claude source (does not replace the defaults)')
    .option('-q, --quiet', 'silence Next.js output')
    .option('-b, --background', 'run in the background')
    .option('--strict-port', 'fail if the preferred port is unavailable')
    .option('--log <path>', 'background log file', DEFAULT_LOG_FILE);
}

function shouldOpenBrowser(opts) {
  if (opts.background) return false;
  return opts.open !== false;
}

async function inheritFromState(opts, cmd) {
  const prev = await readState();
  if (!prev) return { ...opts };
  const isDefault = (key) => cmd.getOptionValueSource(key) === 'default';

  const isProvided = (key) => cmd.getOptionValueSource(key) === 'cli';
  const merged = { ...opts };
  if (isDefault('port') && prev.port) merged.port = String(prev.port);
  if (isDefault('host') && prev.host) merged.host = prev.host;
  if (isDefault('log') && prev.logFile) merged.log = prev.logFile;
  if (!isProvided('dir') && prev.dataDir) merged.dir = prev.dataDir;
  return merged;
}

const program = new Command();
program
  .name('akaashi-pulse')
  .description(pkg.description ?? 'Local Usage Dashboard')
  .version(pkg.version ?? '0.0.0');

addStartOptions(program.command('start').description('start the dashboard'))
  .action(async (opts) => {
    await start(opts);
  });

program
  .command('stop')
  .description('stop a background dashboard')
  .option('--force', 'force kill the background process')
  .action(async (opts) => {
    await stop({ force: opts.force, verbose: true });
  });

addStartOptions(program.command('restart').description('restart the background dashboard'))
  .action(async (opts, cmd) => {
    const merged = await inheritFromState(opts, cmd);
    await stop({ force: false, verbose: false });
    await start({ ...merged, background: true });
  });

program
  .command('status')
  .description('show background dashboard status')
  .option('--json', 'print machine-readable JSON')
  .action(async (opts) => {
    await status(opts);
  });

program
  .command('open')
  .description('open the running background dashboard')
  .action(async () => {
    await openRunningDashboard();
  });

program
  .command('logs')
  .description('show background dashboard logs')
  .option('-f, --follow', 'follow log output')
  .option('-n, --lines <lines>', 'number of lines to show', '80')
  .action(async (opts) => {
    await logs(opts);
  });

program
  .command('mcp')
  .description('start the MCP server (stdio) so LLMs can query usage data')
  .option('--check', 'verify the bundle + indexer; print one line per provider and exit')
  .action(async (opts) => {
    await startMcp(opts);
  });

program
  .command('doctor')
  .description('print a one-screen diagnostic: env, build artifacts, state, indexer')
  .action(async () => {
    await doctor();
  });

const service = program
  .command('service')
  .description('install or manage an always-on local dashboard service');

service
  .command('install')
  .description('install the fast standalone dashboard and restart it automatically if it exits')
  .option('-p, --port <port>', 'local port', DEFAULT_PORT)
  .option('-H, --host <host>', 'local bind host', DEFAULT_HOST)
  .option('--log <path>', 'service log file', DEFAULT_LOG_FILE)
  .option('--dev', 'use the source tree with Next.js hot reload instead of the standalone build')
  .option('--production', 'explicitly use the standalone build (the default)')
  .action(async (opts) => {
    await installService(opts);
  });

service
  .command('uninstall')
  .description('remove the login service and stop the local dashboard')
  .action(async () => {
    await uninstallService();
  });

service
  .command('status')
  .description('show whether the login service is installed and running')
  .action(async () => {
    await serviceStatus();
  });

service
  .command('restart')
  .description('restart the installed login service without changing its settings')
  .action(async () => {
    await restartService();
  });

service
  .command('run', { hidden: true })
  .option('-p, --port <port>', 'local port', DEFAULT_PORT)
  .option('-H, --host <host>', 'local bind host', DEFAULT_HOST)
  .option('--no-open', 'never open a browser')
  .option('--dev', 'run the source tree with Next.js hot reload')
  .action(async (opts) => {
    assertLocalHost(opts.host);
    const serverEntry = opts.dev ? assertNextDevEntry() : assertStandaloneEntry();
    await startForeground(serverEntry, {
      ...opts,
      background: false,
      open: false,
      strictPort: true,
      waitForReady: false,
    });
  });

function addReportOptions(cmd) {
  return cmd
    .option('-r, --range <range>', 'today | 1d | 7d | 30d | 90d | all', '7d')
    .option('-s, --source <provider>', 'claude | codex | all', 'all')
    .option('-b, --by <dim>', 'breakdown dimension: model | project | session', 'model')
    .option('-g, --gran <granularity>', 'trend granularity: hour | day | week | month', 'day')
    .option('-n, --limit <n>', 'rows in breakdown table', '10')
    .option('--since <date>', 'override range start (ISO date or YYYY-MM-DD)')
    .option('--until <date>', 'override range end (ISO date or YYYY-MM-DD)')
    .option('-m, --model <pat>', 'filter by model substring')
    .option('--project <pat>', 'filter by project (cwd basename match)')
    .option('-j, --json', 'output JSON instead of formatted text')
    .option('--no-color', 'disable ANSI colors')
    .option('--no-trend', 'skip the trend chart')
    .option('--no-breakdown', 'skip the breakdown table')
    .option('-d, --dashboard', 'rich one-screen TUI layout (KPI tiles, stacked trend, double-column breakdown, heatmap)')
    .option('--width <n>', 'force output width (chars); default reads process.stdout.columns')
    .option('--no-banner', 'dashboard: skip the top banner row')
    .option('--compact', 'dashboard: skip the trend chart to save vertical space');
}

addReportOptions(program.command('report').description('print a formatted usage report to stdout'))
  .action(async (opts) => {
    await report(opts);
  });

await program.parseAsync(normalizeArgv(process.argv));

function normalizeArgv(argv) {
  const args = argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.includes('-V') || args.includes('--version')) {
    return argv;
  }

  if (args.length > 0 && COMMAND_NAMES.has(args[0])) return argv;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--') break;
    if (!arg.startsWith('-')) {

      return argv;
    }

    const eqIdx = arg.indexOf('=');
    const flag = eqIdx >= 0 ? arg.slice(0, eqIdx) : arg;
    if (!START_OPTIONS.has(flag)) return argv;

    if (START_OPTIONS.get(flag) === true && eqIdx < 0) i += 1;
  }
  return [argv[0], argv[1], 'start', ...args];
}

async function start(opts) {
  const standaloneEntry = assertStandaloneEntry();
  const background = Boolean(opts.background);
  if (background) {
    await startBackground(standaloneEntry, opts);
    return;
  }
  await startForeground(standaloneEntry, opts);
}

async function startForeground(standaloneEntry, opts) {
  const port = await resolvePort(opts);
  const env = makeServerEnv(opts, port);
  const dev = Boolean(opts.dev);

  const stdio = opts.quiet
    ? ['ignore', 'ignore', 'ignore']
    : 'inherit';
  const child = spawn(process.execPath, serverArgs(standaloneEntry, opts, port), {
    cwd: dev ? packageRoot : dirname(standaloneEntry),
    env,
    stdio,
  });

  const url = buildUrl(opts.host, port);
  if (opts.waitForReady === false) {
    printReady(url, { background: false });
  } else {
    waitForUrl(url, 15_000)
      .then(async () => {
        if (shouldOpenBrowser(opts)) await tryOpen(url);
        printReady(url, { background: false });
      })
      .catch((err) => {
        console.error(`\n[akaashi-pulse] error: failed to start: ${err.message}\n`);
        safeKill(child.pid, 'SIGTERM');
        process.exit(1);
      });
  }

  function forward(signal) {
    return () => {
      if (!child.killed) child.kill(signal);

    };
  }
  process.on('SIGINT', forward('SIGINT'));
  process.on('SIGTERM', forward('SIGTERM'));
  process.on('exit', () => {
    if (!child.killed) child.kill('SIGTERM');
  });

  child.on('exit', (code, signal) => {

    if (typeof code === 'number') process.exit(code);
    else process.exit(signal ? 128 : 0);
  });
}

async function startBackground(standaloneEntry, opts) {
  const existing = await readState();
  if (existing && isProcessRunning(existing.pid, existing)) {
    printAlreadyRunning(existing);
    return;
  }
  if (existing) await removeState();

  await ensureStateDir();
  const port = await resolvePort(opts);
  const env = makeServerEnv(opts, port);
  const logFile = resolve(String(opts.log || DEFAULT_LOG_FILE));
  await mkdir(dirname(logFile), { recursive: true });
  const out = openSync(logFile, 'a');
  const err = openSync(logFile, 'a');
  const child = spawn(process.execPath, serverArgs(standaloneEntry, opts, port), {
    cwd: opts.dev ? packageRoot : dirname(standaloneEntry),
    env,
    detached: true,
    stdio: ['ignore', out, err],

    windowsHide: true,
  });
  child.unref();

  try { closeSync(out); } catch {  }
  try { closeSync(err); } catch {  }

  const url = buildUrl(opts.host, port);
  try {
    await waitForUrl(url, 15_000);
  } catch (startErr) {
    if (isProcessRunning(child.pid)) {
      safeKill(child.pid, 'SIGTERM');
      const exited = await waitForProcessExit(child.pid, 2_000);
      if (!exited) safeKill(child.pid, 'SIGKILL');
    }

    const tail = await tailLog(logFile, 5);
    const tailNote = tail ? `\nLast log lines (${logFile}):\n${tail}\n` : '';
    throw new Error(`failed to start background service: ${startErr.message}${tailNote}`);
  }

  await writeState({
    pid: child.pid,
    port,
    host: opts.host,
    url,
    logFile,
    startedAt: new Date().toISOString(),
    bootId: bootId(),

    cmdMarker: 'next-server',
    packageRoot,
    dataDir: opts.dir ? String(opts.dir) : null,
  });
  printReady(url, { background: true, logFile, pid: child.pid });
}

async function stop({ force = false, verbose = true } = {}) {
  const state = await readState();
  if (!state) {
    if (verbose) console.log('[akaashi-pulse] no background service state found');
    return false;
  }
  if (!isProcessRunning(state.pid, state)) {
    await removeState();
    if (verbose) console.log('[akaashi-pulse] background service is not running; cleaned stale state');
    return false;
  }

  safeKill(state.pid, force ? 'SIGKILL' : 'SIGTERM');
  const stopped = await waitForProcessExit(state.pid, force ? 2_000 : 6_000);
  if (!stopped && !force) {
    safeKill(state.pid, 'SIGKILL');
    await waitForProcessExit(state.pid, 2_000);
  }
  await removeState();
  if (verbose) console.log(`[akaashi-pulse] stopped background service (pid ${state.pid})`);
  return true;
}

async function status(opts) {
  const state = await readState();
  const running = !!state && isProcessRunning(state.pid, state);
  if (state && !running) await removeState();

  const payload = state
    ? { running, ...state }
    : { running: false };

  if (opts.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  if (!running) {
    console.log('akaashi-pulse is not running');
    process.exit(3);
  }
  console.log([
    'akaashi-pulse is running',
    `URL: ${state.url}`,
    `PID: ${state.pid}`,
    `Started: ${state.startedAt}`,
    `Log: ${state.logFile}`,
  ].join('\n'));
}

async function openRunningDashboard() {
  const state = await readState();
  if (!state || !isProcessRunning(state.pid, state)) {
    if (state) await removeState();
    console.error('[akaashi-pulse] error: background service is not running');
    process.exit(1);
  }
  await tryOpen(state.url);
  console.log(`[akaashi-pulse] opened ${state.url}`);
}

async function logs(opts) {
  const state = await readState();
  const logFile = state?.logFile || DEFAULT_LOG_FILE;
  if (!existsSync(logFile)) {
    console.error(`[akaashi-pulse] error: log file not found: ${logFile}`);
    process.exit(1);
  }
  const lines = Math.max(1, parseInt(String(opts.lines), 10) || 80);
  const content = await readFile(logFile, 'utf8');
  const tail = content.split(/\r?\n/).slice(-lines).join('\n');
  if (tail.trim()) process.stdout.write(tail.endsWith('\n') ? tail : tail + '\n');
  if (!opts.follow) return;
  await followLog(logFile, content.length);
}

function missingArtifactError({ artifactName, expectedPath, buildCmd, devCmd }) {
  const lines = [
    '',
    `[akaashi-pulse] error: ${artifactName} not found:`,
    `  ${expectedPath}`,
    '',
    'If you installed akaashi-pulse from npm: please reinstall — the published',
    'package should include this artifact. Include the following in any',
    'bug report so we can spot a packaging regression:',
    `  node:    ${process.version}`,
    `  akaashi-pulse: v${pkg.version ?? '?'}`,
    `  platform: ${process.platform}/${process.arch}`,
    '',
    `If you are running from source: build first with`,
    `  $ ${buildCmd}`,
  ];
  if (devCmd) lines.push(`or run the dev server with`, `  $ ${devCmd}`);
  lines.push('');
  console.error(lines.join('\n'));
  process.exit(1);
}

function assertStandaloneEntry() {
  const standaloneEntry = join(packageRoot, '.next', 'standalone', 'server.js');
  if (existsSync(standaloneEntry)) return standaloneEntry;
  missingArtifactError({
    artifactName: 'Build artifact',
    expectedPath: standaloneEntry,
    buildCmd: 'pnpm build',
    devCmd: 'pnpm dev',
  });
}

function nextDevEntry() {
  return join(packageRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
}

function assertNextDevEntry() {
  const entry = nextDevEntry();
  if (existsSync(entry) && existsSync(join(packageRoot, 'app'))) return entry;
  missingArtifactError({
    artifactName: 'Next.js development entry',
    expectedPath: entry,
    buildCmd: 'pnpm install',
    devCmd: 'pnpm dev',
  });
}

async function report(opts) {
  const bundle = join(packageRoot, 'dist', 'report', 'index.mjs');
  if (!existsSync(bundle)) {
    missingArtifactError({
      artifactName: 'Report bundle',
      expectedPath: bundle,
      buildCmd: 'pnpm build:report',
    });
  }
  const limit = parseInt(String(opts.limit ?? '10'), 10);
  const width = opts.width ? parseInt(String(opts.width), 10) : undefined;
  const reportOpts = {
    range: String(opts.range ?? '7d'),
    source: String(opts.source ?? 'all'),
    by: String(opts.by ?? 'model'),
    gran: String(opts.gran ?? 'day'),
    limit: Number.isFinite(limit) && limit > 0 ? limit : 10,
    since: opts.since ? String(opts.since) : undefined,
    until: opts.until ? String(opts.until) : undefined,
    json: Boolean(opts.json),
    color: shouldUseColor({ forceOff: opts.color === false }),
    showTrend: opts.trend !== false,
    showBreakdown: opts.breakdown !== false,
    model: opts.model ? String(opts.model) : undefined,
    project: opts.project ? String(opts.project) : undefined,
    dashboard: Boolean(opts.dashboard),
    width: Number.isFinite(width) && width > 0 ? width : undefined,
    banner: opts.banner !== false,
    compact: Boolean(opts.compact),
  };
  let payload;
  try {
    const mod = await import(pathToFileURL(bundle).href);
    const out = await mod.runReport(reportOpts);
    payload = out.endsWith('\n') ? out : out + '\n';
  } catch (err) {
    console.error(`[akaashi-pulse] error: report failed: ${(err && err.message) || err}`);
    process.exit(1);
  }

  const flushed = process.stdout.write(payload);
  if (flushed) {
    process.exit(0);
  } else {
    process.stdout.once('drain', () => process.exit(0));
  }
}

async function startMcp(opts = {}) {
  const bundle = join(packageRoot, 'dist', 'mcp', 'server.mjs');
  if (!existsSync(bundle)) {
    missingArtifactError({
      artifactName: 'MCP server bundle',
      expectedPath: bundle,
      buildCmd: 'pnpm build:mcp',
    });
  }

  if (opts.check) {
    const mod = await import(pathToFileURL(bundle).href);
    if (typeof mod.printCheck !== 'function') {
      console.error('[akaashi-pulse-mcp] error: this bundle was built without --check support');
      process.exit(1);
    }
    const code = await mod.printCheck();
    process.exit(typeof code === 'number' ? code : 0);
  }

  try {
    const mod = await import(pathToFileURL(bundle).href);
    if (typeof mod.runStdioServer !== 'function') {
      console.error('[akaashi-pulse-mcp] error: bundle missing runStdioServer export');
      process.exit(1);
    }
    await mod.runStdioServer();

  } catch (err) {
    console.error('[akaashi-pulse-mcp] error: failed to start:', err?.message ?? err);
    process.exit(1);
  }
}

async function doctor() {
  const lines = [];
  lines.push(`akaashi-pulse:  v${pkg.version ?? '?'}`);
  lines.push(`node:     ${process.version}  ${process.platform}/${process.arch}`);
  lines.push(`cwd:      ${process.cwd()}`);
  lines.push(`stateDir: ${STATE_DIR}`);
  lines.push('');

  const envKeys = [
    'AKAASHI_PULSE_CONFIG_DIR',
    'AKAASHI_PULSE_CODEX_DIR',
    'AKAASHI_PULSE_STATE_DIR',
    'AKAASHI_PULSE_MCP_PRETTY',
    'AKAASHI_PULSE_POLL_FALLBACK',
    'AKAASHI_PULSE_OFFLINE',
    'AKAASHI_PULSE_DEBUG',
    'CLAUDE_CONFIG_DIR',
    'CODEX_HOME',
    'NO_COLOR',
    'FORCE_COLOR',
  ];
  const setEnvs = envKeys.filter((k) => process.env[k] !== undefined);
  if (setEnvs.length > 0) {
    lines.push('environment:');
    for (const k of setEnvs) lines.push(`  ${k}=${process.env[k]}`);
    lines.push('');
  } else {
    lines.push('environment: (no akaashi-pulse / NO_COLOR vars set)');
    lines.push('');
  }

  const artifacts = [
    ['Dashboard',     join(packageRoot, '.next', 'standalone', 'server.js'), 'pnpm build'],
    ['MCP bundle',    join(packageRoot, 'dist', 'mcp', 'server.mjs'),         'pnpm build:mcp'],
    ['Report bundle', join(packageRoot, 'dist', 'report', 'index.mjs'),       'pnpm build:report'],
  ];
  lines.push('artifacts:');
  for (const [label, p, cmd] of artifacts) {
    const ok = existsSync(p);
    const status = ok ? 'OK     ' : 'MISSING';
    const hint = ok ? '' : `  (build with \`${cmd}\`)`;
    lines.push(`  ${status}  ${label.padEnd(14)} ${p}${hint}`);
  }
  lines.push('');

  const st = await readState();
  if (st) {
    const running = isProcessRunning(st.pid, st);
    lines.push(`background: pid=${st.pid} ${running ? '(running)' : '(stale)'} port=${st.port} url=${st.url}`);
    lines.push(`            log=${st.logFile}`);
  } else {
    lines.push(`background: (none)`);
  }
  lines.push('');

  for (const l of lines) console.log(l);

  const mcpBundle = join(packageRoot, 'dist', 'mcp', 'server.mjs');
  if (!existsSync(mcpBundle)) {
    console.log('indexer:  (MCP bundle missing; rebuild to run the indexer probe)');
    process.exit(0);
  }
  try {
    const mod = await import(pathToFileURL(mcpBundle).href);
    if (typeof mod.printCheck === 'function') {
      const code = await mod.printCheck();

      process.exit(typeof code === 'number' ? code : 0);
    }
    process.exit(0);
  } catch (err) {
    console.error(`[akaashi-pulse] error: indexer probe failed: ${err?.message ?? err}`);
    process.exit(1);
  }
}

function assertLocalHost(host) {
  const value = String(host || DEFAULT_HOST);
  const allowed = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
  if (!allowed.has(value)) {
    throw new Error(`service host must be local (127.0.0.1, localhost, or ::1), got: ${value}`);
  }
  return value;
}

function parsePort(value) {
  const port = Number.parseInt(String(value), 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`invalid port: ${value}`);
  }
  return port;
}

function servicePaths() {
  if (process.platform === 'darwin') {
    const uid = typeof process.getuid === 'function' ? process.getuid() : 501;
    return {
      platform: 'launchd',
      file: join(os.homedir(), 'Library', 'LaunchAgents', `${SERVICE_LABEL}.plist`),
      target: `gui/${uid}/${SERVICE_LABEL}`,
      domain: `gui/${uid}`,
    };
  }
  if (process.platform === 'linux') {
    const configHome = process.env.XDG_CONFIG_HOME || join(os.homedir(), '.config');
    return {
      platform: 'systemd',
      file: join(configHome, 'systemd', 'user', `${SERVICE_LABEL}.service`),
      target: SERVICE_LABEL,
    };
  }
  throw new Error('automatic local services are currently supported on macOS and Linux');
}

function runSystemCommand(command, args, { allowFailure = false } = {}) {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    if (allowFailure) return '';
    const detail = err?.stderr?.toString?.().trim() || err?.message || 'unknown error';
    throw new Error(`${command} ${args.join(' ')} failed: ${detail}`);
  }
}

async function runSystemCommandWithRetry(command, args, attempts = 5) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return runSystemCommand(command, args);
    } catch (err) {
      lastError = err;
      if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  throw lastError;
}

async function installService(opts) {
  if (opts.dev === true && opts.production === true) {
    throw new Error('choose either --dev or --production, not both');
  }
  const dev = opts.dev === true;
  const serverEntry = dev ? assertNextDevEntry() : assertStandaloneEntry();
  const host = assertLocalHost(opts.host);
  const port = parsePort(opts.port);
  const logFile = resolve(String(opts.log || DEFAULT_LOG_FILE));
  const paths = servicePaths();
  const cliEntry = join(packageRoot, 'bin', 'cli.mjs');

  await mkdir(dirname(paths.file), { recursive: true });
  await mkdir(dirname(logFile), { recursive: true });

  const serviceConfig = {
    version: 2,
    platform: paths.platform,
    label: SERVICE_LABEL,
    host,
    port,
    url: buildUrl(host, port),
    logFile,
    entry: serverEntry,
    mode: dev ? 'development' : 'production',
    installedAt: new Date().toISOString(),
  };

  if (paths.platform === 'launchd') {
    runSystemCommand('launchctl', ['bootout', paths.target], { allowFailure: true });
    await writeFile(paths.file, buildLaunchAgentPlist({
      label: SERVICE_LABEL,
      node: process.execPath,
      cli: cliEntry,
      host,
      port,
      logFile,
      dev,
    }), { encoding: 'utf8', mode: 0o600 });
    await runSystemCommandWithRetry('launchctl', ['bootstrap', paths.domain, paths.file]);
    runSystemCommand('launchctl', ['enable', paths.target], { allowFailure: true });
    runSystemCommand('launchctl', ['kickstart', '-k', paths.target], { allowFailure: true });
  } else {
    await writeFile(paths.file, buildSystemdUnit({
      node: process.execPath,
      cli: cliEntry,
      host,
      port,
      logFile,
      dev,
    }), { encoding: 'utf8', mode: 0o600 });
    runSystemCommand('systemctl', ['--user', 'daemon-reload']);
    runSystemCommand('systemctl', ['--user', 'enable', '--now', SERVICE_LABEL]);
  }

  await writeFile(SERVICE_STATE_FILE, JSON.stringify(serviceConfig, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });
  console.log([
    'AKAASHI Pulse local service installed',
    `URL: ${serviceConfig.url}`,
    `Mode: ${serviceConfig.mode} (${dev ? 'source changes reload automatically' : 'prebuilt and fast'})`,
    `Starts: automatically at login (${paths.platform})`,
    `Restarts: automatically if the server exits`,
    `Logs: ${logFile}`,
  ].join('\n'));
}

async function uninstallService() {
  const paths = servicePaths();
  const installed = existsSync(paths.file) || existsSync(SERVICE_STATE_FILE);
  if (!installed) {
    console.log('AKAASHI Pulse local service is not installed');
    return;
  }

  if (paths.platform === 'launchd') {
    runSystemCommand('launchctl', ['bootout', paths.target], { allowFailure: true });
  } else {
    runSystemCommand('systemctl', ['--user', 'disable', '--now', SERVICE_LABEL], { allowFailure: true });
    runSystemCommand('systemctl', ['--user', 'daemon-reload'], { allowFailure: true });
  }
  await rm(paths.file, { force: true });
  await rm(SERVICE_STATE_FILE, { force: true });
  console.log('AKAASHI Pulse local service removed');
}

async function serviceStatus() {
  const paths = servicePaths();
  const config = await readServiceConfig();
  const installed = existsSync(paths.file) && Boolean(config);
  let running = false;

  if (installed) {
    if (paths.platform === 'launchd') {
      running = Boolean(runSystemCommand('launchctl', ['print', paths.target], { allowFailure: true }));
    } else {
      running = runSystemCommand('systemctl', ['--user', 'is-active', SERVICE_LABEL], { allowFailure: true }).trim() === 'active';
    }
  }

  if (!installed) {
    console.log('AKAASHI Pulse local service is not installed');
    process.exitCode = 3;
    return;
  }
  console.log([
    `AKAASHI Pulse local service: ${running ? 'running' : 'installed but stopped'}`,
    `URL: ${config.url}`,
    `Port: ${config.port}`,
    `Mode: ${config.mode ?? 'production'}`,
    `Log: ${config.logFile}`,
  ].join('\n'));
  if (!running) process.exitCode = 3;
}

async function restartService() {
  const paths = servicePaths();
  const config = await readServiceConfig();
  if (!existsSync(paths.file) || !config) {
    console.error('AKAASHI Pulse local service is not installed');
    process.exitCode = 3;
    return;
  }

  if (paths.platform === 'launchd') {
    runSystemCommand('launchctl', ['kickstart', '-k', paths.target]);
  } else {
    runSystemCommand('systemctl', ['--user', 'restart', SERVICE_LABEL]);
  }
  console.log(`AKAASHI Pulse local service restarted (${config.mode ?? 'production'})`);
}

async function readServiceConfig() {
  try {
    const raw = await readFile(SERVICE_STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.url !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function plistValue(value, level = 2) {
  const pad = '  '.repeat(level);
  if (Array.isArray(value)) {
    return [`${pad}<array>`, ...value.map((item) => `${'  '.repeat(level + 1)}<string>${escapeXml(item)}</string>`), `${pad}</array>`].join('\n');
  }
  if (value === true) return `${pad}<true/>`;
  if (value === false) return `${pad}<false/>`;
  return `${pad}<string>${escapeXml(value)}</string>`;
}

function buildLaunchAgentPlist({ label, node, cli, host, port, logFile, dev = false }) {
  const args = [node, cli, 'service', 'run', '--port', String(port), '--host', host, '--no-open'];
  if (dev) args.push('--dev');
  const entries = [
    ['Label', label],
    ['ProgramArguments', args],
    ['RunAtLoad', true],
    ['KeepAlive', true],
    ['ProcessType', 'Background'],
    ['LowPriorityIO', true],
    ['StandardOutPath', logFile],
    ['StandardErrorPath', logFile],
  ];
  const body = entries.flatMap(([key, value]) => [
    `  <key>${key}</key>`,
    plistValue(value),
  ]);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    ...body,
    '</dict>',
    '</plist>',
    '',
  ].join('\n');
}

function systemdQuote(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function buildSystemdUnit({ node, cli, host, port, logFile, dev = false }) {
  const args = [node, cli, 'service', 'run', '--port', String(port), '--host', host, '--no-open'];
  if (dev) args.push('--dev');
  const command = args
    .map(systemdQuote)
    .join(' ');
  return [
    '[Unit]',
    'Description=AKAASHI Pulse local analytics',
    'After=default.target',
    '',
    '[Service]',
    `ExecStart=${command}`,
    'Restart=always',
    'RestartSec=2',
    `Environment=NODE_ENV=${dev ? 'development' : 'production'}`,
    `StandardOutput=append:${systemdQuote(logFile)}`,
    `StandardError=append:${systemdQuote(logFile)}`,
    '',
    '[Install]',
    'WantedBy=default.target',
    '',
  ].join('\n');
}

async function resolvePort(opts) {
  const preferred = parsePort(opts.port);

  const candidates = opts.strictPort
    ? preferred
    : [preferred, ...Array.from({ length: 19 }, (_, i) => preferred + i + 1).filter((p) => p <= 65535), 0];
  const getPort = await loadGetPort();
  const port = await getPort({ port: candidates });
  if (opts.strictPort && port !== preferred) {
    throw new Error(`port ${preferred} is already in use`);
  }
  return port;
}

function makeServerEnv(opts, port) {
  const env = {
    ...process.env,
    PORT: String(port),
    HOSTNAME: opts.host,
    NODE_ENV: opts.dev ? 'development' : 'production',
  };
  if (opts.dir) {
    env.AKAASHI_PULSE_CONFIG_DIR = String(opts.dir);
  }
  return env;
}

function serverArgs(entry, opts, port) {
  if (!opts.dev) return [entry];
  return [entry, 'dev', '--port', String(port), '--hostname', String(opts.host)];
}

async function tailLog(logFile, lines = 5) {
  try {
    const content = await readFile(logFile, 'utf8');
    const all = content.split(/\r?\n/);
    return all.filter((l) => l.length > 0).slice(-lines).join('\n');
  } catch {
    return '';
  }
}

async function waitForUrl(target, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(target, {
        method: 'GET',
        signal: AbortSignal.timeout(500),
      });
      if (res.status < 500) {
        await res.body?.cancel();
        return;
      }
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw lastErr ?? new Error('server did not start in time');
}

async function tryOpen(url) {
  try {
    const openBrowser = await loadOpenBrowser();
    await openBrowser(url);
  } catch {

  }
}

function ansiPalette(useColor) {
  const seq = (...codes) => (useColor ? `\x1b[${codes.join(';')}m` : '');
  return {
    bold: seq(1),
    cyan: seq(36),
    dim: seq(2),
    brand: seq(38, 2, 201, 100, 66),
    reset: useColor ? '\x1b[0m' : '',
  };
}

function printReady(url, opts = {}) {
  const c = ansiPalette(shouldUseColor());
  const banner = [
    '',
    `  ${c.bold}${c.brand}akaashi-pulse${c.reset}  Local Usage Dashboard`,
    '',
    `   ➜  Local:   ${c.cyan}${url}${c.reset}`,
    opts.background
      ? `   ➜  PID:     ${c.dim}${opts.pid}${c.reset}`
      : `   ➜  Press ${c.dim}Ctrl+C${c.reset} to stop`,
    opts.background
      ? `   ➜  Log:     ${c.dim}${opts.logFile}${c.reset}`
      : '',
    opts.background
      ? `   ➜  Stop:    ${c.dim}akaashi-pulse stop${c.reset}`
      : '',
    '',
  ].filter(Boolean).join('\n');
  process.stdout.write(banner + '\n');
}

function printAlreadyRunning(state) {
  console.log([
    'akaashi-pulse is already running',
    `URL: ${state.url}`,
    `PID: ${state.pid}`,
    `Stop: akaashi-pulse stop`,
  ].join('\n'));
}

async function ensureStateDir() {
  await mkdir(STATE_DIR, { recursive: true });
}

async function readState() {
  try {
    const raw = await readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    if (parsed.version !== STATE_VERSION) return null;

    if (typeof parsed.pid !== 'number' || !Number.isInteger(parsed.pid) || parsed.pid <= 0) {
      return null;
    }
    if (typeof parsed.url !== 'string' || !parsed.url) return null;
    if (typeof parsed.logFile !== 'string' || !parsed.logFile) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeState(state) {
  await ensureStateDir();
  const payload = { version: STATE_VERSION, ...state };
  await writeFile(STATE_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

async function removeState() {
  await rm(STATE_FILE, { force: true });
}

function bootId() {
  return Math.floor(Date.now() - os.uptime() * 1000);
}

function isProcessRunning(pid, state) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  if (!state) return true;

  if (typeof state.bootId === 'number') {
    if (Math.abs(bootId() - state.bootId) > 60_000) return false;
  }
  if (process.platform !== 'win32' && typeof state.cmdMarker === 'string' && state.cmdMarker) {
    try {
      const out = execFileSync('ps', ['-p', String(pid), '-o', 'command='], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 1_000,
      });
      if (!out.includes(state.cmdMarker)) return false;
    } catch {

    }
  }
  return true;
}

async function waitForProcessExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessRunning(pid)) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return !isProcessRunning(pid);
}

async function followLog(logFile, offset) {
  let cursor = offset;
  let busy = false;
  console.log('[akaashi-pulse] following logs; press Ctrl+C to stop');
  await new Promise((resolveFollow) => {
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      clearInterval(id);
      resolveFollow();
    };
    const id = setInterval(async () => {
      if (busy || done) return;
      busy = true;
      try {
        const s = await stat(logFile);
        if (s.size < cursor) cursor = 0;
        if (s.size === cursor) return;

        const endAt = s.size - 1;
        await new Promise((res, rej) => {
          const stream = createReadStream(logFile, {
            start: cursor,
            end: endAt,
            encoding: 'utf8',
          });
          stream.on('data', (chunk) => process.stdout.write(chunk));
          stream.on('end', () => {
            cursor = s.size;
            res();
          });
          stream.on('error', rej);
        });
      } catch {

      } finally {
        busy = false;
      }
    }, 1000);
    process.on('SIGINT', cleanup);
  });
}
