/* A guard for the deploy workflow file.
   A workflow with a YAML mistake does not fail a step — GitHub refuses to run the file at all,
   so no job starts, the deploy is skipped, and the published app silently stays on the old
   version. That happened once: a step name containing ": " was read as a nested mapping.
   This is deliberately a narrow lint for that class of mistake, not a YAML parser.
   Run:  node --test tests/workflow.test.mjs      (do this before pushing a workflow change)  */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const FILE = join(here, '..', '.github', 'workflows', 'pages.yml');
const text = readFileSync(FILE, 'utf8');
const lines = text.split('\n');

test('the deploy workflow is free of the YAML mistakes that stop it running at all', () => {
  lines.forEach((line, i) => {
    const n = i + 1;
    assert.ok(!/^\s*\t/.test(line) && !/\t/.test(line), `line ${n}: a tab cannot indent YAML`);
    // "name: Every report form: fill, …" — the second ": " turns the value into a nested mapping
    const m = line.match(/^(\s*(?:-\s+)?name):\s+(.*)$/);
    if (!m) return;
    const value = m[2].replace(/\s+#.*$/, '').trimEnd();
    const quoted = /^(['"]).*\1$/.test(value);
    if (!quoted) assert.ok(!value.includes(': '), `line ${n}: "${m[1]}" value contains ": " — wrap it in quotes`);
    if (!quoted) assert.ok(!/:\s*$/.test(value), `line ${n}: "${m[1]}" value ends with ":" — wrap it in quotes`);
  });
});

test('the workflow still tests before it publishes', () => {
  assert.match(text, /^on:\s*$/m, 'no "on:" trigger block');
  const jobBlock = name => {
    const start = text.search(new RegExp(`^  ${name}:\\s*$`, 'm'));
    if (start < 0) return '';
    const rest = text.slice(start + 1);
    const next = rest.search(/^  \S/m);
    return next < 0 ? rest : rest.slice(0, next);
  };
  const deploy = jobBlock('deploy');
  assert.ok(deploy, 'no "deploy" job');
  assert.ok(/^    needs:\s*test\s*$/m.test(deploy), 'deploy must depend on the test job');
  assert.ok(/^          path:\s*static\s*$/m.test(deploy), 'the deploy must publish the static/ folder');
  const browser = jobBlock('browser-tests');
  assert.ok(/npx playwright install/.test(browser), 'the browser test job must install its browsers');
  for (const step of ['journey.mjs', 'outage.mjs', 'forms.mjs']) {
    assert.ok(new RegExp(`run:\\s*node ${step.replace('.', '\\.')}`).test(browser), `the browser job no longer runs ${step}`);
  }
});
