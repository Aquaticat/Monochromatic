#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';

//region Record exact commands and frozen inputs before bounded cloud execution
export const root = process.env.GITHUB_WORKSPACE;
assert(root);
export const frozen = 'e02be6c8b8fe9efb41a7f8f1a0b311c17796588a';
export const prefix = '/opt/depot-reuse-20261018-r1';
export const profile = process.env.RESEARCH_RUST_PROFILE;
assert(['fuzz-small', 'fuzz-git', 'fuzz-linter', 'codex-host'].includes(profile));
export const owned = join(root, '.research-rust-' + profile);
export const evidence = join(owned, 'receipts');
mkdirSync(evidence, { recursive: true, mode: 0o700 });
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const environment = { ...process.env, MISE_DATA_DIR: join(prefix, 'mise-data'), MISE_CACHE_DIR: join(prefix, 'mise-cache'), RUSTUP_HOME: join(prefix, 'rustup'), CARGO_HOME: join(prefix, 'cargo'), MISE_AUTO_INSTALL: 'false', MISE_LOCKED: '1', CARGO_BUILD_JOBS: '2', CARGO_INCREMENTAL: '0', CARGO_PROFILE_DEV_DEBUG: '0', CARGO_PROFILE_RELEASE_DEBUG: '0', CARGO_TARGET_DIR: join(owned, 'target'), TMPDIR: join(owned, 'temp') };
mkdirSync(environment.TMPDIR, { recursive: true, mode: 0o700 });
const records = [];
export function save(extra = {}) {
  writeFileSync(join(evidence, 'profile-receipt.json'), JSON.stringify({ observedAt: new Date().toISOString(), frozenSource: frozen, harnessSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), profile, image: { ref: process.env.RESEARCH_RUST_IMAGE, digest: process.env.REUSE_IMAGE_DIGEST }, miseLockSha256: hash(readFileSync(join(root, 'mise.lock'))), records, ...extra }, null, 2) + '\n');
}
export function run(name, command, args, options = {}) {
  const { cwd = root, allowFailure = false, env = environment } = options;
  const path = join(evidence, name + '.log');
  const fd = openSync(path, 'w', 0o600);
  const record = { name, command: [command, ...args], cwd, startedAt: new Date().toISOString() };
  records.push(record);
  save();
  const start = performance.now();
  let result;
  try { result = spawnSync(command, args, { cwd, env, stdio: ['ignore', fd, fd] }); }
  finally { closeSync(fd); }
  const output = readFileSync(path, 'utf8');
  Object.assign(record, { finishedAt: new Date().toISOString(), elapsedSeconds: (performance.now() - start) / 1000, status: result.status, signal: result.signal, error: result.error?.message, logSha256: hash(output) });
  save();
  console.log(JSON.stringify(record));
  if (result.error) throw result.error;
  if (!allowFailure) assert.equal(result.status, 0, name + ': ' + output.slice(-4000));
  return { status: result.status, output };
}
export function rust(name, args, options = {}) { return run(name, 'mise', ['exec', 'rust', 'cargo:cargo-nextest', 'cargo:cargo-fuzz', '--', ...args], options); }
export function sourceAdmission(paths) {
  const files = execFileSync('git', ['ls-tree', '--full-tree', '--name-only', '-r', frozen, '--', ...paths], { cwd: root, encoding: 'utf8' }).trim().split('\n');
  const sources = files.map(path => ({ path, sha256: hash(readFileSync(join(root, path))) }));
  run('initial-source-admission', 'git', ['diff', '--exit-code', frozen, '--', ...paths, 'mise.toml', 'mise.lock', '.cargo/config.toml']);
  writeFileSync(join(evidence, 'source-admission.json'), JSON.stringify({ frozenSource: frozen, paths, sources }, null, 2) + '\n');
  return () => {
    for (const file of sources) assert.equal(hash(readFileSync(join(root, file.path))), file.sha256, file.path);
    run('final-source-admission', 'git', ['diff', '--exit-code', frozen, '--', ...paths, 'mise.toml', 'mise.lock', '.cargo/config.toml']);
  };
}
export function nextestConfig(name) {
  const path = join(owned, name + '-nextest.toml');
  writeFileSync(path, '[store]\ndir = ' + JSON.stringify(join(evidence, 'nextest')) + '\n[profile.default]\nslow-timeout = { period = "90s", terminate-after = 1, grace-period = "10s" }\n[profile.default.junit]\npath = ' + JSON.stringify(name + '.xml') + '\nreport-skipped = "all"\nstore-failure-output = true\nstore-success-output = true\n');
  return path;
}
//endregion
