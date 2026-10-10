#!/usr/bin/env node --experimental-strip-types --no-warnings

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const __filename = fileURLToPath(import.meta.url);
const root = dirname(dirname(__filename));

const { cleanSessionTitle, promptPreview } = await import(join(root, 'lib/session-title.ts'));

{
  assert.equal(cleanSessionTitle('Fix the flaky date picker test'), 'Fix the flaky date picker test');
  assert.equal(cleanSessionTitle(undefined), undefined);
  assert.equal(cleanSessionTitle('   '), undefined);
  console.log('✓ plain prompts pass through, empty input yields undefined');
}

{
  assert.equal(cleanSessionTitle('<ide_selection>const a = 1;</ide_selection>  rename this variable'), 'rename this variable');
  assert.equal(cleanSessionTitle('<browser_instruction># Browser automation guidance that was cut off by the pre'), undefined);
  assert.equal(cleanSessionTitle('compare a < b and c > d'), 'compare a < b and c > d');
  assert.equal(cleanSessionTitle('why does <div>hi</div> collapse?'), 'why does <div>hi</div> collapse?');
  console.log('✓ injected tag blocks are stripped, including truncated ones');
}

{
  assert.equal(
    cleanSessionTitle('# Context from my IDE setup:\n## Open tabs:\n- app.ts\n## My request for Codex:\nadd a retry'),
    'add a retry',
  );
  assert.equal(cleanSessionTitle('# Context from my IDE setup:\n## Open tabs:\n- app.ts'), undefined);
  console.log('✓ IDE context headers keep only the actual request');
}

{
  const title = cleanSessionTitle('x'.repeat(200));
  assert.equal(title.length, 80);
  assert.ok(title.endsWith('…'));
  console.log('✓ long titles are truncated with an ellipsis');
}

{
  const injected = `<browser_instruction>${'guidance '.repeat(60)}</browser_instruction>\nreview the nav UX`;
  assert.equal(promptPreview(injected, 200), 'review the nav UX');
  const onlyInjected = '<system-reminder>context only</system-reminder>';
  assert.equal(promptPreview(onlyInjected, 200), onlyInjected, 'falls back to raw text so turns keep a preview');
  console.log('✓ prompt previews skip injected context before truncating');
}
