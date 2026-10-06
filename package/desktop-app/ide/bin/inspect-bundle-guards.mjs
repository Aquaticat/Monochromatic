#!/usr/bin/env node
// Observe every bundle check failing on a damaged copy of an assembled application directory.
// Each case damages its own copy below the private agent scratch root; the assembled directory is only read.
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdtempSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const privateRoot = join(homedir(), 'temp', 'agent');
if ((statSync(privateRoot).mode & 0o077) !== 0) throw new Error('Guard scratch root must exclude group and other permissions: ' + privateRoot);
const bundle = realpathSync(resolve(process.env.usage_directory || 'dist/monochromatic-ide'));
const artifact = realpathSync(mkdtempSync(join(privateRoot, 'ide-bundle-guard-')));
console.log('BUNDLE_GUARD_ARTIFACT=' + artifact);

const remove = relative => directory => rmSync(join(directory, relative), { recursive: true });
// `checks` are the checks run on the damaged copy; `fails` maps each check expected to fail to a phrase of its message.
// Checks named in `checks` but not in `fails` must still pass, which shows a failure is specific to its damage.
const cases = [
  { name: 'grammar-library-removed', damage: remove('runtime/grammars/sql.so'), checks: ['inventory', 'license-texts', 'grammars-load', 'starts-outside-source-tree'],
    fails: { inventory: 'lacks listed libraries: sql.so', 'grammars-load': 'syntax tests failed', 'starts-outside-source-tree': 'could not highlight from its own runtime' } },
  { name: 'unlisted-grammar-library', damage: directory => cpSync(join(directory, 'runtime/grammars/toml.so'), join(directory, 'runtime/grammars/unlisted.so')), checks: ['inventory', 'license-texts'],
    fails: { inventory: 'entries the manifest does not list: unlisted.so' } },
  { name: 'executable-bit-cleared', damage: directory => chmodSync(join(directory, 'monochromatic-ide'), 0o644), checks: ['inventory'],
    fails: { inventory: 'is not executable' } },
  { name: 'query-rules-removed', damage: remove('runtime/queries/rust/highlights.scm'), checks: ['inventory', 'grammars-load'],
    fails: { 'grammars-load': 'syntax tests failed' } },
  { name: 'grammar-notice-removed', damage: remove('runtime/licenses/rust'), checks: ['inventory', 'license-texts'],
    fails: { 'license-texts': 'runtime/licenses/rust is missing' } },
  { name: 'reuse-headers-removed', damage: remove('runtime/licenses/slint/REUSE-headers.txt'), checks: ['license-texts'],
    fails: { 'license-texts': 'without REUSE-headers.txt copyright lines' } },
  { name: 'font-notice-removed', damage: remove('LICENSES/font/Inter-LICENSE.txt'), checks: ['inventory', 'license-texts'],
    fails: { 'license-texts': 'LICENSES/font/Inter-LICENSE.txt is missing' } },
  { name: 'application-license-removed', damage: remove('LICENSES/LGPL-3.0-or-later.txt'), checks: ['license-texts'],
    fails: { 'license-texts': 'LICENSES/LGPL-3.0-or-later.txt is missing' } },
  { name: 'helix-license-removed', damage: remove('runtime/Helix-LICENSE'), checks: ['license-texts'],
    fails: { 'license-texts': 'runtime/Helix-LICENSE is missing' } },
  { name: 'runtime-removed', damage: remove('runtime'), checks: ['inventory', 'license-texts', 'starts-outside-source-tree'],
    fails: { inventory: 'runtime/manifest.json is missing', 'license-texts': 'runtime/Helix-LICENSE is missing', 'starts-outside-source-tree': 'could not highlight from its own runtime' } },
  // The executable is replaced by a link to the intact one, so the copy without a runtime still finds the intact
  // runtime beside the link's target: an application that reports nothing must fail the missing-runtime check.
  { name: 'runtime-found-elsewhere', damage: directory => { rmSync(join(directory, 'monochromatic-ide')); symlinkSync(join(bundle, 'monochromatic-ide'), join(directory, 'monochromatic-ide')); }, checks: ['missing-runtime-reported'],
    fails: { 'missing-runtime-reported': 'reported nothing' } },
];
const only = process.env.usage_only ? new Set(process.env.usage_only.split(',')) : undefined;
const selected = only ? cases.filter(item => only.has(item.name)) : cases;
if (only && selected.length !== only.size) throw new Error('Unknown guard name in: ' + process.env.usage_only);

const results = [];
const inspect = (name, directory, checks) => {
  const run = spawnSync(process.execPath, ['bin/inspect-bundle.mjs'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, usage_directory: directory, usage_only: checks.join(',') } });
  const output = (run.stdout ?? '') + (run.stderr ?? '');
  writeFileSync(join(artifact, name + '.log'), output);
  if (run.error) throw run.error;
  const records = output.split('\n').filter(line => line.startsWith('{"name":')).map(line => JSON.parse(line));
  if (records.length !== checks.length) throw new Error('Expected ' + checks.length + ' check records for ' + name + ', saw ' + records.length + '; inspect ' + artifact);
  return { status: run.status, records };
};
const note = entry => { results.push(entry); writeFileSync(join(artifact, 'results.json'), JSON.stringify(results, null, 2)); console.log(JSON.stringify(entry)); };

// The undamaged directory passes every check any case runs; this is the baseline for all of them.
const used = [...new Set(selected.flatMap(item => item.checks))];
const baseline = inspect('baseline', bundle, used);
const baselinePassed = baseline.status === 0 && baseline.records.every(record => record.passed);
note({ name: 'baseline', phase: 'intact', checks: used, accepted: baselinePassed });
if (!baselinePassed) throw new Error('The intact directory does not pass its checks; inspect ' + artifact);

for (const item of selected) {
  const directory = join(artifact, item.name);
  cpSync(bundle, directory, { recursive: true });
  item.damage(directory);
  const { status, records } = inspect(item.name, directory, item.checks);
  const verdicts = records.map(record => {
    const phrase = item.fails[record.name];
    const asExpected = phrase === undefined ? record.passed : !record.passed && String(record.detail).includes(phrase);
    return { check: record.name, expected: phrase === undefined ? 'pass' : 'fail: ' + phrase, passed: record.passed, asExpected, detail: record.passed ? undefined : String(record.detail).slice(0, 300) };
  });
  const accepted = status !== 0 && verdicts.every(verdict => verdict.asExpected);
  note({ name: item.name, phase: 'damaged', status, accepted, verdicts });
  if (!accepted) throw new Error('Unexpected result for ' + item.name + '; inspect ' + artifact);
}
console.log('Bundle guard controls passed: ' + artifact + ' (' + selected.length + ' of ' + cases.length + ' cases)');
