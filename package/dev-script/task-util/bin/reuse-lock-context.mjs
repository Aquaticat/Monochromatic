#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus, homedir, hostname, release, totalmem } from 'node:os';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';

export class LockProbeError extends Error {}
export const root = process.env.GITHUB_WORKSPACE ?? process.cwd();
export const privateRoot = join(root, '.research-lock');
export const evidence = join(privateRoot, 'receipts');
export const input = join(privateRoot, 'input');
export const tools = join(privateRoot, 'host-tools');
export const gitPrefix = '/opt/depot-reuse-20261018-r1/git-2.56.0';
export const provider = process.env.REUSE_LOCK_PROVIDER;
assert(['native-depot', 'github-hosted', 'depot-github'].includes(provider));
for (const path of [privateRoot, evidence, input, tools]) mkdirSync(path, { recursive: true, mode: 0o700 });
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const records = [];
export const childEnv = { ...process.env, PATH: tools + ':' + gitPrefix + '/bin:' + process.env.PATH, GIT_EXEC_PATH: gitPrefix + '/libexec/git-core' };
delete childEnv.MONO_RESEARCH_LOCK_ARCHIVE_URL_20261018;

export function save(name, value) {
  writeFileSync(join(evidence, name), JSON.stringify(value, null, 2) + '\n');
}

export function run({ name, command, args, cwd = root, env = childEnv, observe = false }) {
  const startedAt = new Date().toISOString();
  const start = performance.now();
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const log = (result.stdout ?? '') + (result.stderr ?? '') + (result.error?.message ?? '');
  writeFileSync(join(evidence, name + '.log'), log);
  const record = { name, command: [command, ...args], cwd, startedAt, elapsedSeconds: (performance.now() - start) / 1000, status: result.status, signal: result.signal, logSha256: hash(log) };
  records.push(record);
  save('lock-commands-' + process.env.REUSE_LOCK_STAGE + '.json', { provider, node: process.version, hostname: hostname(), kernel: release(), cpus: cpus(), memoryBytes: totalmem(), bootId: readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim(), records });
  console.log(JSON.stringify(record));
  if (result.error && !observe) throw result.error;
  if (!observe) assert.equal(result.status, 0, name + ' failed; see retained command output');
  return { record, log, stdout: result.stdout };
}

export function bindArchiveManifest() {
  const bytes = readFileSync(join(input, 'diagnostic-archive-manifest.json'));
  assert.equal(hash(bytes), '971b898f01f5edf054b02d5d97f9babfc36525982b674859af1fca93520dc70c');
  const manifest = JSON.parse(bytes);
  assert.equal(manifest.baseSourceSha, 'e02be6c8b8fe9efb41a7f8f1a0b311c17796588a');
  for (const item of manifest.sourceFiles) assert.equal(hash(readFileSync(join(root, item.path))), item.sha256, item.path);
  assert.equal(hash(readFileSync(join(root, 'cli-git.config.jsonc'))), manifest.rootPolicySha256);
  assert.equal(hash(readFileSync(join(tools, 'cargo-nextest'))), manifest.nextestBinarySha256);
  assert.equal(hash(readFileSync(join(tools, 'monochromatic-lint'))), manifest.linterBinarySha256);
  assert.equal(hash(readFileSync('/usr/bin/git')), manifest.gitBinarySha256);
  return manifest;
}
