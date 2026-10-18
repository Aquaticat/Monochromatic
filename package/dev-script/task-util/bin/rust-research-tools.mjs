#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';

//region Prepare additional reviewed tools once, independently of application test success
const root = process.env.GITHUB_WORKSPACE;
assert(root && ['prepare', 'seal'].includes(process.env.RESEARCH_RUST_TOOL_PHASE));
const prefix = '/opt/depot-reuse-20261018-r1';
const receipts = join(prefix, 'receipts-r3');
mkdirSync(receipts, { recursive: true, mode: 0o700 });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const env = { ...process.env, MISE_DATA_DIR: join(prefix, 'mise-data'), MISE_CACHE_DIR: join(prefix, 'mise-cache'), CARGO_HOME: join(prefix, 'cargo'), RUSTUP_HOME: join(prefix, 'rustup'), MISE_AUTO_INSTALL: 'false', MISE_LOCKED: '1' };
const sourceMarker = join(root, 'RESEARCH-RUST-SOURCE-EXCLUSION-CONTROL.txt');
const secretMarker = join(homedir(), 'temp/agent/depot-rust-synthetic-secret-20261018.txt');
const records = [];
function save() { writeFileSync(join(receipts, 'additional-tools.json'), JSON.stringify({ recordedAt: new Date().toISOString(), sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), miseLockSha256: hash(readFileSync(join(root, 'mise.lock'))), baseImageDigest: process.env.REUSE_IMAGE_DIGEST, sourceMarker, secretMarker, secretControlOnly: true, records }, null, 2) + '\n'); }
function run(name, command, args, optional = false) {
  const fd = openSync(join(receipts, name + '.log'), 'w', 0o600);
  const startedAt = new Date().toISOString();
  const start = performance.now();
  let result;
  try { result = spawnSync(command, args, { cwd: root, env, stdio: ['ignore', fd, fd] }); }
  finally { closeSync(fd); }
  const record = { name, command: [command, ...args], startedAt, finishedAt: new Date().toISOString(), elapsedSeconds: (performance.now() - start) / 1000, status: result.status, signal: result.signal, error: result.error?.message };
  records.push(record);
  save();
  console.log(JSON.stringify(record));
  if (result.error) throw result.error;
  if (!optional) assert.equal(result.status, 0, name + ' failed; inspect retained log');
  return { status: result.status, output: readFileSync(join(receipts, name + '.log'), 'utf8') };
}
if (process.env.RESEARCH_RUST_TOOL_PHASE === 'prepare') {
  assert(process.env.DEPOT_SNAPSHOT_TOKEN);
  run('selective-locked-cargo-fuzz-installation', 'mise', ['install', 'cargo:cargo-fuzz']);
  const fuzzPath = run('installed-cargo-fuzz-path', 'mise', ['which', 'cargo-fuzz']).output.trim();
  const fuzzHash = hash(readFileSync(fuzzPath));
  assert.equal(fuzzHash, 'f87d63fc80e4f897a32ead5df85bd67665afb6a63ed92bb0d2b0473e15295eba', 'Installed tool must match the independently SHA-verified official Linux release asset');
  run('installed-cargo-fuzz-version', fuzzPath, ['--version']);
  run('installed-cargo-fuzz-build-help', 'mise', ['exec', 'rust', 'cargo:cargo-fuzz', '--', 'cargo', 'fuzz', 'build', '--help']);
  const codexDirectory = join(prefix, 'codex-0.163.0');
  mkdirSync(codexDirectory, { recursive: true });
  const archivePath = join(codexDirectory, 'codex.zst');
  const url = 'https://github.com/openai/codex/releases/download/rust-v0.163.0/codex-x86_64-unknown-linux-musl.zst';
  const start = performance.now();
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  assert.equal(response.status, 200);
  const archive = Buffer.from(await response.arrayBuffer());
  assert.equal(archive.length, 80560968);
  assert.equal(hash(archive), '41a820f0accf20890300812e096b81396809d8bc045a9ecdee159efc4ce25963');
  writeFileSync(archivePath, archive, { mode: 0o600 });
  records.push({ name: 'official-codex-download', url, elapsedSeconds: (performance.now() - start) / 1000, bytes: archive.length, sha256: hash(archive) });
  save();
  const binary = join(codexDirectory, 'codex');
  const output = openSync(binary, 'w', 0o700);
  try { execFileSync('zstd', ['--decompress', '--stdout', archivePath], { cwd: root, stdio: ['ignore', output, 'pipe'] }); }
  finally { closeSync(output); }
  assert.equal(statSync(binary).size, 296865480);
  assert.equal(hash(readFileSync(binary)), '399ff69c431c066e40de318fba45c2b07f45a76b19939d247ee4828fc70c4215');
  const inspectionHome = join(codexDirectory, 'metadata-only-home');
  mkdirSync(inspectionHome, { mode: 0o700 });
  env.CODEX_HOME = inspectionHome;
  run('official-codex-version-only', binary, ['--version']);
  run('official-codex-host-command-help-only', binary, ['--no-daemon', 'app-server', '--help']);
  delete env.CODEX_HOME;
  const podman = run('existing-podman-version', 'sh', ['-c', 'command -v podman && podman --version'], true);
  if (podman.status !== 0) {
    run('official-apt-metadata', 'sudo', ['--non-interactive', 'apt-get', 'update']);
    const policy = run('official-podman-package-policy', 'apt-cache', ['policy', 'podman']);
    const candidate = /^\s*Candidate: (\S+)$/mu.exec(policy.output)?.[1];
    assert(candidate && candidate !== '(none)');
    run('install-observed-podman-package', 'sudo', ['--non-interactive', 'apt-get', 'install', '--yes', 'podman=' + candidate]);
  }
  run('prepared-podman-version', 'sudo', ['--non-interactive', 'podman', '--version']);
  run('prepared-podman-run-help', 'sudo', ['--non-interactive', 'podman', 'run', '--help']);
  run('prepared-podman-build-help', 'sudo', ['--non-interactive', 'podman', 'build', '--help']);
  mkdirSync(join(homedir(), 'temp/agent'), { recursive: true, mode: 0o700 });
  writeFileSync(sourceMarker, 'Synthetic public source exclusion control.\n', { flag: 'wx' });
  writeFileSync(secretMarker, 'Synthetic public secret exclusion control.\n', { mode: 0o600, flag: 'wx' });
  writeFileSync(join(prefix, 'additional-tool-manifest.json'), JSON.stringify({ preparedAt: new Date().toISOString(), tools: { cargoFuzz: { path: fuzzPath, sha256: fuzzHash, release: '0.13.2', sourceCommit: '984c861c8dfea28055254c5f1d2659ab2cd63f76' }, codex: { path: binary, version: '0.163.0', sha256: hash(readFileSync(binary)), archiveSha256: hash(archive), modelTurnExecuted: false, sourceAndSignatureProvenance: 'Separate public release-signature verification receipt, not inferred from version output.' } }, syntheticFixtures: { sourceMarker, secretMarker } }, null, 2) + '\n');
  run('additional-prepared-filesystem-bytes', 'du', ['--summarize', '--bytes', codexDirectory, fuzzPath]);
} else {
  assert(process.env.DEPOT_SNAPSHOT_TOKEN);
  const ignored = execFileSync('git', ['clean', '--dry-run', '-d', '-X'], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const inspected = ['HEAD', 'config', 'hooks', 'objects', 'refs'].map(name => ({ name, exists: existsSync(join(root, name)), ignore: spawnSync('git', ['check-ignore', '--verbose', '--', name], { cwd: root, encoding: 'utf8' }).stdout }));
  assert(inspected.every(item => !item.exists));
  assert(existsSync(sourceMarker) && existsSync(secretMarker));
  save();
  rmSync(secretMarker);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  const result = { recordedAt: new Date().toISOString(), ignoredBeforeCleanup: ignored, inspected, sourceDirectoryCleared: true, sourceMarkerAbsent: !existsSync(sourceMarker), syntheticSecretMarkerAbsent: !existsSync(secretMarker), generalCredentialExclusionProven: false };
  assert(result.sourceMarkerAbsent && result.syntheticSecretMarkerAbsent);
  writeFileSync(join(receipts, 'seal.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}
//endregion
