#!/usr/bin/env node --experimental-strip-types --no-warnings

import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const temp = await mkdtemp(path.join(os.tmpdir(), 'akaashi-pulse-project-scope-'));
const originalStateDir = process.env.AKAASHI_PULSE_STATE_DIR;
const originalRoots = process.env.AKAASHI_PULSE_PROJECT_ROOTS;
const originalRoot = process.env.AKAASHI_PULSE_PROJECT_ROOT;

process.env.AKAASHI_PULSE_STATE_DIR = path.join(temp, 'state');

const { setConfiguredProjectRoots } = await import(path.join(root, 'lib/data-sources/config.ts'));
const {
  getProjectRoots,
  isTrackedProjectPath,
  resetProjectScopeCache,
} = await import(path.join(root, 'lib/project-scope.ts'));
const { resolveProjectRootCwd } = await import(path.join(root, 'lib/project-label.ts'));

try {
  const workspaces = path.join(temp, 'Workspaces');
  const other = path.join(temp, 'Workspace');
  await mkdir(path.join(workspaces, 'akaashi'), { recursive: true });
  await mkdir(other, { recursive: true });

  process.env.AKAASHI_PULSE_PROJECT_ROOTS = workspaces;
  delete process.env.AKAASHI_PULSE_PROJECT_ROOT;
  resetProjectScopeCache();
  assert.deepEqual(getProjectRoots(), [workspaces]);
  assert.equal(isTrackedProjectPath(path.join(workspaces, 'akaashi')), true);
  assert.equal(isTrackedProjectPath(path.join(workspaces, 'other')), true);
  assert.equal(isTrackedProjectPath(path.join(temp, 'Workspaces-old', 'app')), false);
  assert.equal(isTrackedProjectPath(path.join(other, 'app')), false);
  assert.equal(isTrackedProjectPath('cursor:workspace/app'), false);
  assert.equal(isTrackedProjectPath('cursor:workspace/app', 'cursor'), true);
  assert.equal(isTrackedProjectPath('Antigravity', 'antigravity'), true);
  assert.equal(
    resolveProjectRootCwd(path.join(workspaces, 'pauloreal', 'packages', 'web')),
    path.join(workspaces, 'pauloreal'),
  );
  assert.equal(
    resolveProjectRootCwd(path.join(workspaces, 'vercel', 'examples', 'next')),
    path.join(workspaces, 'vercel'),
  );
  assert.equal(resolveProjectRootCwd(path.join(temp, 'outside', 'app')), path.join(temp, 'outside', 'app'));
  console.log('✓ project roots are path-boundary safe and exclude synthetic/outside paths');

  delete process.env.AKAASHI_PULSE_PROJECT_ROOTS;
  resetProjectScopeCache();
  await setConfiguredProjectRoots([other]);
  resetProjectScopeCache();
  assert.deepEqual(getProjectRoots(), [other]);
  assert.equal(isTrackedProjectPath(path.join(other, 'app')), true);
  assert.equal(isTrackedProjectPath(path.join(workspaces, 'akaashi')), false);
  console.log('✓ custom project roots persist independently from automatic detection');

  await setConfiguredProjectRoots([]);
  resetProjectScopeCache();
  assert.deepEqual(getProjectRoots(), []);
  assert.equal(isTrackedProjectPath('cursor:workspace/app'), true, 'empty roots explicitly means unrestricted');
  console.log('✓ an explicit empty root list disables the filter');
} finally {
  if (originalStateDir === undefined) delete process.env.AKAASHI_PULSE_STATE_DIR;
  else process.env.AKAASHI_PULSE_STATE_DIR = originalStateDir;
  if (originalRoots === undefined) delete process.env.AKAASHI_PULSE_PROJECT_ROOTS;
  else process.env.AKAASHI_PULSE_PROJECT_ROOTS = originalRoots;
  if (originalRoot === undefined) delete process.env.AKAASHI_PULSE_PROJECT_ROOT;
  else process.env.AKAASHI_PULSE_PROJECT_ROOT = originalRoot;
  await rm(temp, { recursive: true, force: true });
}

console.log('\nAll project-scope assertions passed.');
