#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';
import { root, privateRoot, evidence, input, tools, provider, childEnv, hash, run, save, bindArchiveManifest } from './reuse-lock-context.mjs';
import { filesystem, replacementAndClockProbe, residualFixtureFields } from './reuse-lock-fields.mjs';

const manifest = bindArchiveManifest();
const project = join(root, 'package/git-policy/cli');
const nextest = join(tools, 'cargo-nextest');
const filter = 'test(real_index_lock::tests::) | test(index_lock_evidence::tests::)';
const archive = join(input, 'diagnostic-native-nextest.tar.zst');
const baseArgs = ['nextest', 'run', '--archive-file', archive, '--workspace-remap', project, '--no-fail-fast', '--filterset', filter];
const fixtureRoot = join(homedir(), 'temp/agent/monochromatic-lock-portability-' + provider);
assert(!existsSync(fixtureRoot));
mkdirSync(fixtureRoot, { recursive: true, mode: 0o700 });
const ordinary = join(fixtureRoot, 'ordinary');
const tmpfs = join(fixtureRoot, 'tmpfs');
mkdirSync(ordinary);
mkdirSync(tmpfs);
const results = [];
let mounted = false;
let cleanupFailed = false;

function cohort({ name, directory }) {
  save(name + '-filesystem-fields.json', replacementAndClockProbe(join(directory, 'field-control')));
  for (let repeat = 1; repeat <= 3; repeat += 1) {
    const label = name + '-' + repeat;
    const temporary = join(directory, 'cohort-' + repeat);
    const extract = join(privateRoot, 'extract-' + label);
    mkdirSync(temporary);
    mkdirSync(extract);
    const config = join(privateRoot, label + '.nextest.toml');
    writeFileSync(config, '[store]\ndir = ' + JSON.stringify(join(evidence, 'nextest')) + '\n[profile.default.junit]\npath = ' + JSON.stringify(label + '.xml') + '\nreport-skipped = "none"\nstore-failure-output = true\n');
    const args = [...baseArgs, '--extract-to', extract, '--config-file', config];
    if (repeat === 1) {
      const listArgs = args.filter(arg => arg !== '--no-fail-fast');
      listArgs[1] = 'list';
      listArgs.push('--message-format', 'json');
      const listed = run({ name: label + '-selected-list', command: nextest, args: listArgs, cwd: project });
      const inventory = JSON.parse(listed.stdout);
      const selected = Object.values(inventory['rust-suites']).flatMap(suite => Object.entries(suite.testcases).filter(([, item]) => item['filter-match'].status === 'matches').map(([test]) => ({ binary: suite['binary-id'], test })));
      assert.equal(inventory['test-count'], 1956);
      assert.equal(selected.length, 34);
      save(label + '-selection.json', { enumeratedTotal: inventory['test-count'], selected, filter });
      args.push('--extract-overwrite');
    }
    const tested = run({ name: label + '-actual-nextest', command: nextest, args, cwd: project, env: { ...childEnv, TMPDIR: temporary }, observe: true });
    const summary = /Summary.*?34 tests run: (\d+) passed(?:, (\d+) failed)?, 1922 skipped/u.exec(tested.log);
    assert(summary, label + ' must reach the exact archived cohort denominator');
    const junitPath = join(evidence, 'nextest/default', label + '.xml');
    const xml = readFileSync(junitPath, 'utf8');
    const cases = [...xml.matchAll(/<testcase\b([^>]*)>/gu)].map(match => /\bname="([A-Za-z_0-9:]+)"/u.exec(match[1])?.[1]);
    assert.equal(cases.length, 34);
    assert(cases.every(Boolean));
    const result = { filesystem: name, repeat, command: tested.record, passed: Number(summary[1]), failed: Number(summary[2] ?? 0), testsRun: 34, enumeratedTotal: 1956, skipped: 1922, junit: { path: junitPath, sha256: hash(xml), cases, failureElements: [...xml.matchAll(/<failure\b/gu)].length }, temporaryFilesystem: filesystem(temporary), residual: residualFixtureFields(temporary) };
    assert.equal(result.passed + result.failed, 34);
    results.push(result);
    save('matched-lock-results.json', { provider, sourceSha: manifest.baseSourceSha, archiveSha256: manifest.bundles[0].sha256, nextestSha256: manifest.nextestBinarySha256, gitSha256: manifest.gitBinarySha256, results });
  }
}

try {
  cohort({ name: 'ordinary', directory: ordinary });
  const help = run({ name: 'mount-help', command: 'mount', args: ['--help'] });
  assert(help.log.includes('--types') && help.log.includes('--options'));
  const mount = run({ name: 'mount-owned-256m-tmpfs', command: 'sudo', args: ['--non-interactive', 'mount', '--types', 'tmpfs', '--options', 'size=256m,mode=1777,nodev,nosuid', 'tmpfs', tmpfs], observe: true });
  if (mount.record.status === 0) {
    mounted = true;
    assert.equal(filesystem(tmpfs).type, '16914836');
    save('tmpfs-mounted.json', filesystem(tmpfs));
    cohort({ name: 'tmpfs', directory: tmpfs });
  } else save('tmpfs-not-supported.json', { mount: mount.record, boundary: 'Ordinary cohort remains measured. No tmpfs test credit is assigned.' });
} finally {
  if (mounted) {
    const unmount = run({ name: 'unmount-owned-tmpfs', command: 'sudo', args: ['--non-interactive', 'umount', tmpfs], observe: true });
    cleanupFailed = unmount.record.status !== 0;
    save('tmpfs-unmounted.json', { command: unmount.record, filesystemAfter: filesystem(tmpfs) });
  }
}
assert(!cleanupFailed, 'Owned tmpfs unmount failed; retain lifecycle evidence');
assert(results.every(item => item.command.status === 0), 'Archived application assertions failed; every repeat was retained');
