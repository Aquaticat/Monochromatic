#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { cpus, hostname, totalmem } from 'node:os';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';

//region Bind immutable application inputs independently of this executable research harness
const root = process.env.GITHUB_WORKSPACE;
assert(root && process.env.RESEARCH_RUST_PROFILE === 'linter');
const frozen = 'e02be6c8b8fe9efb41a7f8f1a0b311c17796588a';
const prefix = '/opt/depot-reuse-20261018-r1';
const owned = join(root, '.research-rust');
const evidence = join(owned, 'receipts');
mkdirSync(evidence, { recursive: true, mode: 0o700 });
const digest = value => createHash('sha256').update(value).digest('hex');
const environment = { ...process.env, MISE_DATA_DIR: join(prefix, 'mise-data'), MISE_CACHE_DIR: join(prefix, 'mise-cache'), RUSTUP_HOME: join(prefix, 'rustup'), CARGO_HOME: join(prefix, 'cargo'), GRADLE_USER_HOME: join(prefix, 'gradle'), MISE_AUTO_INSTALL: 'false', MISE_LOCKED: '1', CARGO_BUILD_JOBS: '2', CARGO_INCREMENTAL: '0', CARGO_PROFILE_DEV_DEBUG: '0', CARGO_TARGET_DIR: join(owned, 'linter-target') };
const paths = ['package/linter/monochromatic-lint', 'package/rust-module/jsonc-edit'];
const sourcePaths = execFileSync('git', ['ls-tree', '--full-tree', '--name-only', '-r', frozen, '--', ...paths], { cwd: root, encoding: 'utf8' }).trim().split('\n');
const sources = sourcePaths.map(path => ({ path, sha256: digest(readFileSync(join(root, path))) }));
const records = [];
const startedAt = new Date().toISOString();
function persist() {
  writeFileSync(join(evidence, 'linter-receipt.json'), JSON.stringify({ frozenSource: frozen, harnessSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), startedAt, observedAt: new Date().toISOString(), profile: process.env.RESEARCH_RUST_PROFILE, image: { ref: process.env.RESEARCH_RUST_IMAGE, digest: process.env.RESEARCH_RUST_IMAGE_DIGEST }, sourceFiles: sources, toolLockSha256: digest(readFileSync(join(root, 'mise.lock'))), compilation: { jobs: 2, devDebug: '0', incremental: '0', nextestConcurrency: 'default', rationale: 'Owning task sets compiler fan-out two; debug-symbol setting follows the existing tested container profile. Nextest keeps its owning task default.' }, allocation: { hostname: hostname(), cpuCount: cpus().length, memoryBytes: totalmem(), cpuModel: cpus()[0]?.model, bootId: readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim() }, records }, null, 2) + '\n');
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

//region Run the actual RA-backed implementation, executable tests and existing public library consumer
const project = join(root, 'package/linter/monochromatic-lint');
let failed = false;
try {
  requireSuccess(rust({ name: 'linter-locked-dependency-preparation', args: ['cargo', 'fetch', '--locked'], cwd: project }));
  const config = join(owned, 'nextest.toml');
  writeFileSync(config, '[store]\ndir = ' + JSON.stringify(join(evidence, 'nextest')) + '\n[profile.default.junit]\npath = "linter.xml"\nreport-skipped = "all"\nstore-failure-output = true\n');
  const tested = rust({ name: 'current-source-linter-complete-nextest', args: ['cargo', 'nextest', '--config-file', config, 'run', '--locked', '--offline', '--all-targets', '--no-fail-fast'], cwd: project });
  failed ||= tested.status !== 0;
  if (tested.status === 0 || existsSync(join(environment.CARGO_TARGET_DIR, 'debug/monochromatic-lint'))) {
    const binary = join(environment.CARGO_TARGET_DIR, 'debug/monochromatic-lint');
    assert(existsSync(binary));
    writeFileSync(join(evidence, 'produced-current-linter.json'), JSON.stringify({ path: binary, bytes: statSync(binary).size, sha256: digest(readFileSync(binary)), source: frozen, publishedPrerequisite: false }, null, 2) + '\n');
    failed = run({ name: 'current-source-linter-real-help', command: binary, args: ['--help'] }).status !== 0 || failed;
    const rules = run({ name: 'current-source-linter-real-rules', command: binary, args: ['--rules'] });
    failed ||= rules.status !== 0;
    const parsed = rules.output.trim().split('\n').map(line => JSON.parse(line));
    assert.equal(parsed.length, 18);
    assert(parsed.some(rule => rule.id === 'rust/require-explicit-types'));
    const library = rust({ name: 'current-source-linter-library-artifact', args: ['cargo', 'build', '--locked', '--offline', '--lib'], cwd: project });
    failed ||= library.status !== 0;
    if (library.status === 0) {
      const consumer = join(owned, 'processors_consumer');
      const compiled = rust({ name: 'existing-processor-consumer-build', args: ['rustc', '--edition=2024', '--extern', 'monochromatic_lint=' + join(environment.CARGO_TARGET_DIR, 'debug/libmonochromatic_lint.rlib'), '-L', 'dependency=' + join(environment.CARGO_TARGET_DIR, 'debug/deps'), 'src/processors_consumer.rs', '--out-dir', owned], cwd: project });
      failed ||= compiled.status !== 0;
      if (compiled.status === 0) failed = run({ name: 'existing-processor-consumer-execution', command: consumer, args: [] }).status !== 0 || failed;
    }
  }
} finally {
  for (const source of sources) assert.equal(digest(readFileSync(join(root, source.path))), source.sha256, source.path);
  const admitted = run({ name: 'final-frozen-source-admission', command: 'git', args: ['diff', '--exit-code', frozen, '--', ...paths, 'mise.lock', 'mise.toml', '.cargo/config.toml'] });
  failed ||= admitted.status !== 0;
  run({ name: 'cargo-store-and-built-target-bytes', command: 'du', args: ['--summarize', '--bytes', environment.CARGO_HOME, environment.CARGO_TARGET_DIR] });
}
if (failed) throw new Error('Frozen current-source linter profile has real failures; inspect retained Nextest and consumer receipts.');
//endregion
