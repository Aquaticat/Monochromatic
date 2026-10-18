#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, statSync, openSync, closeSync, fsyncSync, renameSync, utimesSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict as assert } from 'node:assert';
import { root, evidence, env, manifest, sha, run } from './reuse-context.mjs';

//region Install only the checksum-audited research compiler wrapper, using the image's locked toolchain
assert(process.env.DEPOT_CACHE_TOKEN);
const phase = process.env.REUSE_PHASE;
assert(['seed', 'warm', 'inputs', 'target'].includes(phase));
const project = join(root, 'package/git-policy/cli');
const privateRoot = join(root, '.research-reuse');
const toolRoot = join(privateRoot, 'sccache');
mkdirSync(toolRoot, { recursive: true });
const startedAt = new Date().toISOString();
const start = performance.now();
const response = await fetch('https://github.com/mozilla/sccache/releases/download/v0.18.0/sccache-v0.18.0-x86_64-unknown-linux-musl.tar.gz', { signal: AbortSignal.timeout(60_000) });
assert.equal(response.status, 200);
const archive = Buffer.from(await response.arrayBuffer());
assert.equal(sha(archive), '45f1447fbe231e3037bde351ef70677dd212216c8d62ae7ca409fecc4d6acc89');
writeFileSync(join(toolRoot, 'sccache.tar.gz'), archive);
run({ name: 'sccache-extract', command: 'tar', args: ['--extract', '--gzip', '--file', join(toolRoot, 'sccache.tar.gz'), '--directory', toolRoot, '--strip-components=1'], limit: 30_000 });
const binary = join(toolRoot, 'sccache');
assert.equal(sha(readFileSync(binary)), '973cb15f6a986d84ca334bbed3bbe2eb8f1ee8fd81bf9e115b8539a293bf8d59');
writeFileSync(join(evidence, 'sccache-installation.json'), JSON.stringify({ startedAt, elapsedSeconds: (performance.now() - start) / 1000, archiveBytes: archive.length, archiveSha256: sha(archive), binarySha256: sha(readFileSync(binary)), version: '0.18.0', sourceCommit: '01c35e69b97f516c2ebfbdb418b5cd6277bde280', installedInPreparedImage: false }, null, 2) + '\n');
const wrapper = join(dirname(fileURLToPath(import.meta.url)), 'reuse-rustc-wrapper.mjs');
chmodSync(wrapper, 0o755);
const journal = join(evidence, 'rustc-requests.jsonl');
writeFileSync(journal, '');
const target = join(privateRoot, 'cargo-target');
const buildEnv = { ...env, CARGO_TARGET_DIR: target, CARGO_INCREMENTAL: '0', CARGO_PROFILE_DEV_DEBUG: '0', RUSTC_WRAPPER: wrapper, REUSE_SCCACHE_BINARY: binary, REUSE_RUSTC_JOURNAL: journal, SCCACHE_WEBDAV_ENDPOINT: 'https://cache.depot.dev', SCCACHE_WEBDAV_KEY_PREFIX: 'aquaticats-monochromatic-reuse-20261018-native-r1/', SCCACHE_WEBDAV_TOKEN: process.env.DEPOT_CACHE_TOKEN, SCCACHE_WEBDAV_RW_MODE: phase === 'seed' ? 'READ_WRITE' : 'READ_ONLY', SCCACHE_DIR: join(privateRoot, 'sccache-local'), SCCACHE_CACHE_SIZE: '0', SCCACHE_IDLE_TIMEOUT: '300', SCCACHE_SERVER_PORT: '42262', CLI_GIT_LOCK_WAIT_SECONDS: '20', CLI_GIT_PUSH_LOCK_WAIT_SECONDS: '20' };
delete buildEnv.CARGO_BUILD_JOBS;
run({ name: 'sccache-help', command: binary, args: ['--help'], childEnv: buildEnv });
run({ name: 'sccache-version', command: binary, args: ['--version'], childEnv: buildEnv });
run({ name: 'nextest-owned-version', command: 'mise', args: ['exec', 'rust', 'cargo:cargo-nextest', '--', 'cargo', 'nextest', '--version'], childEnv: buildEnv });
run({ name: 'nextest-command-help', command: 'mise', args: ['exec', 'rust', 'cargo:cargo-nextest', '--', 'cargo', 'nextest', 'run', '--help'], childEnv: buildEnv });
run({ name: 'host-git-version', command: '/usr/bin/git', args: ['--version'], childEnv: buildEnv });
run({ name: 'locked-rust-toolchain', command: 'mise', args: ['exec', 'rust', '--', 'rustc', '--version', '--verbose'], childEnv: buildEnv });
run({ name: 'sccache-start', command: binary, args: ['--start-server'], childEnv: buildEnv });

/** Record cumulative compiler-cache counters after each actual build/test boundary. */
function stats(label) {
  const result = run({ name: label, command: binary, args: ['--show-stats', '--stats-format', 'json'], childEnv: buildEnv });
  const parsed = JSON.parse(result.log);
  writeFileSync(join(evidence, label + '.json'), JSON.stringify(parsed, null, 2) + '\n');
}

/** Run all existing native library, binary and public candidate integration tests through Nextest. */
function consume({ label, expected = 'success', features = [] }) {
  run({ name: label + '-build-cli', command: 'mise', args: ['exec', 'rust', '--', 'cargo', 'build', '--locked', '--offline', '--bin', 'cli-git-native', ...features], cwd: project, childEnv: buildEnv, limit: 480_000, expected });
  stats(label + '-after-cli-build');
  const tested = run({ name: label + '-nextest', command: 'mise', args: ['exec', 'rust', 'cargo:cargo-nextest', '--', 'cargo', 'nextest', 'run', '--locked', '--offline', '--lib', '--test', 'native_binary', '--test', 'native_candidates', ...features], cwd: project, childEnv: buildEnv, limit: 480_000, expected });
  stats(label + '-after-nextest');
  return tested;
}
//endregion

try {
  consume({ label: 'native-' + phase });
  if (phase === 'inputs') {
    const source = join(root, 'package/cli/forbidden-strings/src/runtime_cache/warning.rs');
    const original = readFileSync(source, 'utf8');
    assert(original.includes('"missing"'));
    try {
      writeFileSync(source, original.replace('"missing"', '"research-missing"'));
      const changed = consume({ label: 'native-source-positive-control', expected: 'failure' });
      assert(changed.log.includes('FAIL') || changed.log.includes('failures'));
    } finally { writeFileSync(source, original); }
    consume({ label: 'native-source-original-recovery' });
    consume({ label: 'native-dependency-feature-positive-control', features: ['--features', 'serde_json/raw_value'] });
    buildEnv.RUSTFLAGS = '-C opt-level=1';
    consume({ label: 'native-compiler-flag-positive-control' });
    delete buildEnv.RUSTFLAGS;
  }
  const requests = readFileSync(journal, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  writeFileSync(join(evidence, 'failed-rustc-requests.json'), JSON.stringify(requests.filter(record => record.exitStatus !== 0), null, 2) + '\n');
  run({ name: 'cargo-store-and-target-bytes', command: 'du', args: ['--summarize', '--bytes', env.CARGO_HOME, target], childEnv: buildEnv });
} finally {
  run({ name: 'sccache-stop', command: binary, args: ['--stop-server'], childEnv: buildEnv, expected: 'observe' });
}
