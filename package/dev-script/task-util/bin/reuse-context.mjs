import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, openSync, closeSync, existsSync } from 'node:fs';
import { cpus, totalmem, hostname } from 'node:os';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';

export const root = process.env.GITHUB_WORKSPACE;
assert(root && process.env.RESEARCH_REUSE_ROLE === 'consume');
export const prefix = '/opt/depot-reuse-20261018-r1';
export const evidence = join(root, '.research-reuse/receipts');
mkdirSync(evidence, { recursive: true, mode: 0o700 });
export const manifest = JSON.parse(readFileSync(join(prefix, 'image-manifest.json'), 'utf8'));
export const env = { ...process.env, MISE_DATA_DIR: join(prefix, 'mise-data'), MISE_CACHE_DIR: join(prefix, 'mise-cache'), RUSTUP_HOME: join(prefix, 'rustup'), CARGO_HOME: join(prefix, 'cargo'), GRADLE_USER_HOME: join(prefix, 'gradle'), MISE_AUTO_INSTALL: 'false', MISE_LOCKED: '1', CARGO_BUILD_JOBS: '8' };
const records = existsSync(join(evidence, 'commands.json')) ? JSON.parse(readFileSync(join(evidence, 'commands.json'), 'utf8')).records : [];

/** Fingerprint bytes admitted from the immutable preparation image. */
export function sha(value) {
  return createHash('sha256').update(value).digest('hex');
}

/** Retain each command's exit status even when a deliberate invalidation control fails. */
export function run({ name, command, args, cwd = root, limit = 600_000, expected = 'success', childEnv = env }) {
  const path = join(evidence, name + '.log');
  const fd = openSync(path, 'w', 0o600);
  const startedAt = new Date().toISOString();
  const started = performance.now();
  let result;
  try {
    result = spawnSync(command, args, { cwd, env: childEnv, stdio: ['ignore', fd, fd], timeout: limit });
  } finally {
    closeSync(fd);
  }
  const record = { name, command: [command, ...args], cwd, startedAt, finishedAt: new Date().toISOString(), elapsedSeconds: (performance.now() - started) / 1000, exitStatus: result.status, signal: result.signal, error: result.error?.message, expected };
  records.push(record);
  writeFileSync(join(evidence, 'commands.json'), JSON.stringify({ baseSourceSha: manifest.baseSourceSha, imagePreparationSha: manifest.sourceSha, harnessSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), imageManifestSha256: sha(readFileSync(join(prefix, 'image-manifest.json'))), records, allocation: { name: process.env.RUNNER_NAME, hostname: hostname(), bootId: readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim(), cpus: cpus().length, memoryBytes: totalmem(), cpuModel: cpus()[0]?.model }, phase: process.env.REUSE_PHASE, kind: process.env.REUSE_KIND }, null, 2) + '\n');
  console.log(JSON.stringify(record));
  if (result.error) throw result.error;
  if (expected === 'success') assert.equal(result.status, 0, name + ' failed; retain frozen-source failure');
  if (expected === 'failure') assert.notEqual(result.status, 0, name + ' did not expose its deliberately invalid input');
  return { record, log: readFileSync(path, 'utf8') };
}
