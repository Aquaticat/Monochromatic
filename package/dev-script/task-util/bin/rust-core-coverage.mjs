#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { cpus, hostname, totalmem } from 'node:os';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';

//region Bind immutable application inputs independently of this executable research harness
const root = process.env.GITHUB_WORKSPACE;
assert(root && process.env.RESEARCH_RUST_PROFILE === 'core');
const frozen = 'e02be6c8b8fe9efb41a7f8f1a0b311c17796588a';
const prefix = '/opt/depot-reuse-20261018-r1';
const owned = join(root, '.research-rust');
const evidence = join(owned, 'receipts');
mkdirSync(evidence, { recursive: true, mode: 0o700 });
const digest = value => createHash('sha256').update(value).digest('hex');
const environment = { ...process.env, MISE_DATA_DIR: join(prefix, 'mise-data'), MISE_CACHE_DIR: join(prefix, 'mise-cache'), RUSTUP_HOME: join(prefix, 'rustup'), CARGO_HOME: join(prefix, 'cargo'), GRADLE_USER_HOME: join(prefix, 'gradle'), MISE_AUTO_INSTALL: 'false', MISE_LOCKED: '1', CARGO_BUILD_JOBS: '2', CARGO_INCREMENTAL: '0', CARGO_PROFILE_DEV_DEBUG: '0', CARGO_TARGET_DIR: join(owned, 'core-target') };
delete environment.CARGO_BUILD_JOBS;
const paths = ['package/cli/wg-quicker-exempt', 'package/codex-plugin/bash-limit', 'package/rust-module/forbidden-regex', 'package/rust-module/jsonc-edit', 'package/module/jsonc-edit.conformance/fixtures/jsonc-conformance.json'];
const sourcePaths = execFileSync('git', ['ls-tree', '--full-tree', '--name-only', '-r', frozen, '--', ...paths], { cwd: root, encoding: 'utf8' }).trim().split('\n');
const sources = sourcePaths.map(path => ({ path, sha256: digest(readFileSync(join(root, path))) }));
const records = [];
const startedAt = new Date().toISOString();
function persist() {
  writeFileSync(join(evidence, 'core-receipt.json'), JSON.stringify({ frozenSource: frozen, harnessSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), startedAt, observedAt: new Date().toISOString(), profile: process.env.RESEARCH_RUST_PROFILE, image: { ref: process.env.RESEARCH_RUST_IMAGE, digest: process.env.RESEARCH_RUST_IMAGE_DIGEST }, sourceFiles: sources, toolLockSha256: digest(readFileSync(join(root, 'mise.lock'))), compilation: { jobs: 'default', devDebug: '0', incremental: '0', nextestConcurrency: 'default', rationale: 'Build and Nextest concurrency remain default; debug-symbol setting follows prior bounded research. Each package keeps its owning release/debug selection.' }, allocation: { hostname: hostname(), cpuCount: cpus().length, memoryBytes: totalmem(), cpuModel: cpus()[0]?.model, bootId: readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim() }, records }, null, 2) + '\n');
}
function run({ name, command, args, cwd = root }) {
  const file = join(evidence, name + '.log');
  const fd = openSync(file, 'w', 0o600);
  const record = { name, command: [command, ...args], cwd, startedAt: new Date().toISOString(), state: 'running' };
  records.push(record);
  persist();
  const start = performance.now();
  let result;
  try { result = spawnSync(command, args, { cwd, env: environment, stdio: ['ignore', fd, fd] }); }
  finally { closeSync(fd); }
  Object.assign(record, { finishedAt: new Date().toISOString(), elapsedSeconds: (performance.now() - start) / 1000, exitStatus: result.status, signal: result.signal, error: result.error?.message, state: 'finished', logSha256: digest(readFileSync(file)) });
  persist();
  console.log(JSON.stringify(record));
  if (result.error) throw result.error;
  return { status: result.status, output: readFileSync(file, 'utf8') };
}
function rust({ name, args, cwd }) { return run({ name, command: 'mise', args: ['exec', 'rust', 'cargo:cargo-nextest', '--', ...args], cwd }); }
function requireSuccess(result) { assert.equal(result.status, 0, result.output.slice(-2000)); return result; }
persist();
requireSuccess(run({ name: 'initial-frozen-source-admission', command: 'git', args: ['diff', '--exit-code', frozen, '--', ...paths, 'mise.lock', 'mise.toml', '.cargo/config.toml'] }));
for (const [name, args] of [['rustc', ['rustc', '--version', '--verbose']], ['cargo', ['cargo', '--version']], ['nextest', ['cargo', 'nextest', '--version']], ['nextest-run-help', ['cargo', 'nextest', 'run', '--help']]]) requireSuccess(rust({ name: 'tool-' + name, args }));
const rustcPath = requireSuccess(run({ name: 'rustc-path', command: 'mise', args: ['which', 'rustc'] })).output.trim();
writeFileSync(join(evidence, 'tool-binaries.json'), JSON.stringify({ rustc: { path: rustcPath, bytes: statSync(rustcPath).size, sha256: digest(readFileSync(rustcPath)) }, preparedImageManifest: { path: join(prefix, 'image-manifest.json'), sha256: digest(readFileSync(join(prefix, 'image-manifest.json'))) } }, null, 2) + '\n');
//endregion

//region Execute real standalone owners and retain the native routing prerequisite
let failed = false;
const packages = [
  { key: 'wg', path: 'package/cli/wg-quicker-exempt', release: false },
  { key: 'jsonc', path: 'package/rust-module/jsonc-edit', release: true },
  { key: 'regex', path: 'package/rust-module/forbidden-regex', release: true },
  { key: 'bash-limit', path: 'package/codex-plugin/bash-limit', release: true },
];
try {
  for (const pkg of packages) {
    const project = join(root, pkg.path);
    environment.CARGO_TARGET_DIR = join(owned, 'core-target', pkg.key);
    const prepared = rust({ name: pkg.key + '-locked-dependency-preparation', args: ['cargo', 'fetch', '--locked'], cwd: project });
    failed = prepared.status !== 0 || failed;
    if (prepared.status !== 0) continue;
    const config = join(owned, pkg.key + '-nextest.toml');
    writeFileSync(config, '[store]\ndir = ' + JSON.stringify(join(evidence, 'nextest')) + '\n[profile.default.junit]\npath = ' + JSON.stringify(pkg.key + '.xml') + '\nreport-skipped = "all"\nstore-failure-output = true\n');
    const tested = rust({ name: pkg.key + '-complete-nextest', args: ['cargo', 'nextest', '--config-file', config, 'run', '--locked', '--offline', '--no-fail-fast', ...(pkg.release ? ['--release'] : [])], cwd: project });
    failed = tested.status !== 0 || failed;
    if (pkg.key === 'wg') {
      const built = rust({ name: 'wg-routing-release-producer', args: ['cargo', 'build', '--locked', '--offline', '--release', '--bin', 'wg-quicker-exempt'], cwd: project });
      failed = built.status !== 0 || failed;
      if (built.status === 0) {
        const binary = join(environment.CARGO_TARGET_DIR, 'release/wg-quicker-exempt');
        const destination = join(evidence, 'bin');
        mkdirSync(destination, { recursive: true });
        copyFileSync(binary, join(destination, 'wg-quicker-exempt'));
        const usage = run({ name: 'wg-real-usage', command: binary, args: [] });
        assert.equal(usage.status, 2);
        assert(usage.output.startsWith('usage: wg-quicker-exempt attach '));
        const rejected = run({ name: 'wg-real-zero-mark-control', command: binary, args: ['attach', '0', join(owned, 'never-created-cgroup')] });
        assert.equal(rejected.status, 2);
        assert(rejected.output.includes('mark must be positive'));
        run({ name: 'wg-produced-elf-identity', command: 'file', args: [binary] });
        run({ name: 'wg-produced-dynamic-dependencies', command: 'ldd', args: [binary] });
        writeFileSync(join(evidence, 'wg-routing-binary-manifest.json'), JSON.stringify({ subject: 'wg-quicker-exempt actual release producer and routing prerequisite', source: frozen, harnessSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), originalOwningTask: '//package/cli/wg-quicker-exempt:build', binary: { path: 'bin/wg-quicker-exempt', bytes: statSync(binary).size, sha256: digest(readFileSync(binary)) }, sourceFiles: sources.filter(item => item.path.startsWith(pkg.path + '/')), sourceUnitTestStatus: tested.status, releaseBuildStatus: built.status, usageStatus: usage.status, invalidMarkStatus: rejected.status, rustcSha256: digest(readFileSync(rustcPath)), miseLockSha256: digest(readFileSync(join(root, 'mise.lock'))), privilegedIgnoredCasesExecuted: false, consumerPlacement: 'Copy exact verified ELF to package/cli/wg-quicker-exempt/target/release/wg-quicker-exempt in an owned exact-source consumer checkout.' }, null, 2) + '\n');
      }
    }
    run({ name: pkg.key + '-built-target-bytes', command: 'du', args: ['--summarize', '--bytes', environment.CARGO_TARGET_DIR] });
  }
} finally {
  for (const source of sources) assert.equal(digest(readFileSync(join(root, source.path))), source.sha256, source.path);
  const admitted = run({ name: 'final-frozen-source-admission', command: 'git', args: ['diff', '--exit-code', frozen, '--', ...paths, 'mise.lock', 'mise.toml', '.cargo/config.toml'] });
  failed = admitted.status !== 0 || failed;
  run({ name: 'cargo-store-bytes', command: 'du', args: ['--summarize', '--bytes', environment.CARGO_HOME] });
}
if (failed) throw new Error('Frozen standalone Rust profile has real failures; inspect retained Nextest and producer receipts.');
//endregion
