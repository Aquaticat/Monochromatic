#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, writeFileSync, statSync, existsSync, openSync, closeSync, fsyncSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict as assert } from 'node:assert';
import { root, prefix, evidence, env, sha, run } from './reuse-context.mjs';

//region Install only the checksum-audited research compiler wrapper, using the image's locked toolchain
assert(process.env.DEPOT_CACHE_TOKEN);
const phase = process.env.REUSE_PHASE;
assert(['seed', 'warm', 'inputs', 'target'].includes(phase));
const project = join(root, 'package/git-policy/cli');
run({ name: 'frozen-rust-source-admission', command: 'git', args: ['diff', '--exit-code', 'e02be6c8b8fe9efb41a7f8f1a0b311c17796588a', '--', 'package/git-policy/cli', 'package/cli/forbidden-strings', 'package/rust-module/forbidden-regex', 'package/rust-module/jsonc-edit'] });
const disk = '/mnt/aquaticats-monochromatic-reuse-20261018-native-target-trusted-r1';
const mountLines = readFileSync('/proc/self/mountinfo', 'utf8').split('\n').filter(line => line.split(' ')[4] === disk);
assert.equal(mountLines.length, 1, 'Require the actual dedicated persistent mount');
assert(mountLines[0].includes(' - fuse.archil '));
writeFileSync(join(evidence, 'target-cache-mount.json'), JSON.stringify({ disk, mountLines }, null, 2) + '\n');
const tracked = execFileSync('git', ['ls-files', '--cached', '-z', '--', 'package/git-policy/cli', 'package/cli/forbidden-strings', 'package/rust-module/forbidden-regex', 'package/rust-module/jsonc-edit'], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }).split('\0').filter(Boolean);
const sourceFiles = tracked.map(path => ({ path, sha256: sha(readFileSync(join(root, path))), mtimeMilliseconds: statSync(join(root, path)).mtimeMs }));
const privateRoot = join(root, '.research-reuse');
const preparedBinary = join(prefix, 'sccache/sccache');
const installedInPreparedImage = existsSync(preparedBinary);
const toolRoot = installedInPreparedImage ? dirname(preparedBinary) : join(privateRoot, 'sccache');
const startedAt = new Date().toISOString();
const start = performance.now();
let archive;
if (!installedInPreparedImage) {
mkdirSync(toolRoot, { recursive: true });
const response = await fetch('https://github.com/mozilla/sccache/releases/download/v0.18.0/sccache-v0.18.0-x86_64-unknown-linux-musl.tar.gz', { signal: AbortSignal.timeout(60_000) });
assert.equal(response.status, 200);
archive = Buffer.from(await response.arrayBuffer());
assert.equal(sha(archive), '45f1447fbe231e3037bde351ef70677dd212216c8d62ae7ca409fecc4d6acc89');
writeFileSync(join(toolRoot, 'sccache.tar.gz'), archive);
run({ name: 'sccache-extract', command: 'tar', args: ['--extract', '--gzip', '--file', join(toolRoot, 'sccache.tar.gz'), '--directory', toolRoot, '--strip-components=1'], limit: 30_000 });
}
const binary = join(toolRoot, 'sccache');
assert.equal(sha(readFileSync(binary)), '973cb15f6a986d84ca334bbed3bbe2eb8f1ee8fd81bf9e115b8539a293bf8d59');
writeFileSync(join(evidence, 'sccache-installation.json'), JSON.stringify({ startedAt, elapsedSeconds: (performance.now() - start) / 1000, downloadedBytes: archive?.length ?? 0, archiveSha256: archive ? sha(archive) : null, binarySha256: sha(readFileSync(binary)), version: '0.18.0', sourceCommit: '01c35e69b97f516c2ebfbdb418b5cd6277bde280', installedInPreparedImage }, null, 2) + '\n');
const selectedGit = join(prefix, 'git-2.56.0/bin/git');
assert.equal(sha(readFileSync(selectedGit)), 'd42496dde88b0e5bfbdeb8a32f339601635d7007915ce9a9925ba7f7423bc99e');
// The frozen authoritative fixtures deliberately call this absolute path and compare /proc executable identities.
run({ name: 'disposable-sandbox-required-git-install', command: 'sudo', args: ['install', '--mode=0755', '--', selectedGit, '/usr/bin/git'] });
assert.equal(sha(readFileSync('/usr/bin/git')), sha(readFileSync(selectedGit)));
const linterInstallEnv = { ...env, MISE_CARGO_BINSTALL_ONLY: 'true', MISE_CARGO_BINSTALL_QUICKINSTALL: 'false' };
run({ name: 'lock-bound-published-linter-install', command: 'mise', args: ['install', 'cargo:monochromatic-lint'], childEnv: linterInstallEnv, limit: 180_000 });
const linterPath = run({ name: 'lock-bound-published-linter-path', command: 'mise', args: ['which', 'monochromatic-lint'], childEnv: linterInstallEnv }).log.trim();
assert.equal(sha(readFileSync(linterPath)), '6f82c73dadadd11506624a085d38e7e5ab98a26014416bfedd03c1928a85cc69');
const linterHelp = run({ name: 'lock-bound-published-linter-help', command: linterPath, args: ['--help'] });
assert(linterHelp.log.includes('--version'));
run({ name: 'lock-bound-published-linter-version', command: linterPath, args: ['--version'] });
writeFileSync(join(evidence, 'published-linter-prerequisite.json'), JSON.stringify({ kind: 'locked-published-tool-not-current-source-workload', version: '0.1.3', releaseTag: 'monochromatic-lint-v0.1.3', releaseSource: 'c954f74798ee47c027ee3d9a31811de6345ca328', archiveSha256: '9d9021526d5377d268d4c75ed9d42d9df53d9ed76969031edb6a7809863ec665', binarySha256: sha(readFileSync(linterPath)), bytes: statSync(linterPath).size, path: linterPath }, null, 2) + '\n');
const wrapper = join(dirname(fileURLToPath(import.meta.url)), 'reuse-rustc-wrapper.mjs');
chmodSync(wrapper, 0o755);
const journal = join(evidence, 'rustc-requests.jsonl');
writeFileSync(journal, '');
const target = join(privateRoot, 'cargo-target');
const buildEnv = { ...env, PATH: dirname(selectedGit) + ':' + env.PATH, CARGO_TARGET_DIR: target, CARGO_INCREMENTAL: '0', CARGO_PROFILE_DEV_DEBUG: '0', RUSTC_WRAPPER: wrapper, REUSE_SCCACHE_BINARY: binary, REUSE_RUSTC_JOURNAL: journal, SCCACHE_WEBDAV_ENDPOINT: 'https://cache.depot.dev', SCCACHE_WEBDAV_KEY_PREFIX: 'aquaticats-monochromatic-reuse-20261018-native-r3-absolute-git/', SCCACHE_WEBDAV_TOKEN: process.env.DEPOT_CACHE_TOKEN, SCCACHE_WEBDAV_RW_MODE: phase === 'seed' ? 'READ_WRITE' : 'READ_ONLY', SCCACHE_DIR: join(privateRoot, 'sccache-local'), SCCACHE_CACHE_SIZE: '0', SCCACHE_IDLE_TIMEOUT: '300', SCCACHE_SERVER_PORT: '42262', CLI_GIT_LOCK_WAIT_SECONDS: '20', CLI_GIT_PUSH_LOCK_WAIT_SECONDS: '20', GIT_POLICY_NATIVE_TEST_LINTER: linterPath };
delete buildEnv.CARGO_BUILD_JOBS;
run({ name: 'sccache-help', command: binary, args: ['--help'], childEnv: buildEnv });
run({ name: 'sccache-version', command: binary, args: ['--version'], childEnv: buildEnv });
run({ name: 'nextest-owned-version', command: 'mise', args: ['exec', 'rust', 'cargo:cargo-nextest', '--', 'cargo', 'nextest', '--version'], childEnv: buildEnv });
const nextestHelp = run({ name: 'nextest-command-help', command: 'mise', args: ['exec', 'rust', 'cargo:cargo-nextest', '--', 'cargo', 'nextest', 'run', '--help'], childEnv: buildEnv });
assert(nextestHelp.log.includes('--no-fail-fast'));
run({ name: 'host-git-version', command: '/usr/bin/git', args: ['--version'], childEnv: buildEnv });
assert(/(?:^|\n)git version 2\.56\.0(?:\n|$)/u.test(run({ name: 'required-git-version', command: 'mise', args: ['exec', 'rust', 'cargo:cargo-nextest', '--', 'git', '--version'], childEnv: buildEnv }).log));
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
  run({ name: label + '-build-cli', command: 'mise', args: ['exec', 'rust', '--', 'cargo', 'build', '--locked', '--offline', '--bin', 'cli-git-native', ...features], cwd: project, childEnv: buildEnv, limit: 480_000 });
  stats(label + '-after-cli-build');
  const tested = run({ name: label + '-nextest', command: 'mise', args: ['exec', 'rust', 'cargo:cargo-nextest', '--', 'cargo', 'nextest', 'run', '--locked', '--offline', '--no-fail-fast', '--lib', '--test', 'native_binary', '--test', 'native_candidates', ...features], cwd: project, childEnv: buildEnv, limit: 600_000, expected: 'observe' });
  stats(label + '-after-nextest');
  if (expected === 'success') assert.equal(tested.record.exitStatus, 0, label + ' existing Nextest consumers failed');
  if (expected === 'failure') assert.notEqual(tested.record.exitStatus, 0, label + ' did not expose its intentionally changed input');
  return tested;
}
//endregion

try {
  consume({ label: 'native-' + phase });
  if (phase === 'seed') {
    const finalArchive = join(disk, 'immutable-target.tar.zst');
    const finalManifest = join(disk, 'immutable-target.json');
    assert(!existsSync(finalArchive) && !existsSync(finalManifest), 'Never overwrite an existing producer namespace');
    const pending = finalArchive + '.pending';
    const limitHelp = run({ name: 'target-archive-limit-help', command: 'prlimit', args: ['--help'] });
    assert(limitHelp.log.includes('--fsize'));
    run({ name: 'target-archive-save-to-persistent-disk', command: 'prlimit', args: ['--fsize=1073741824:1073741824', '--', 'tar', '--create', '--zstd', '--file', pending, '--directory', target, '.'], limit: 120_000 });
    const publicationStartedAt = new Date().toISOString();
    const publicationStart = performance.now();
    const fd = openSync(pending, 'r+');
    fsyncSync(fd);
    closeSync(fd);
    const bytes = readFileSync(pending);
    assert(bytes.length <= 1024 * 1024 * 1024, 'Bound the compressed research target artifact to1GiB');
    const targetManifest = { baseSourceSha: 'e02be6c8b8fe9efb41a7f8f1a0b311c17796588a', producerHarnessSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), root, sourceFiles, imageDigest: process.env.REUSE_IMAGE_DIGEST, gitSha256: sha(readFileSync(selectedGit)), rustcSha256: sha(readFileSync(execFileSync('mise', ['which', 'rustc'], { cwd: root, env, encoding: 'utf8' }).trim())), wrapperSha256: sha(readFileSync(wrapper)), archiveBytes: bytes.length, archiveSha256: sha(bytes), profile: { incremental: '0', devDebug: '0', rustflags: null }, publicationStartedAt };
    renameSync(pending, finalArchive);
    const manifestPending = finalManifest + '.pending';
    const manifestFd = openSync(manifestPending, 'wx', 0o600);
    writeFileSync(manifestFd, JSON.stringify(targetManifest, null, 2) + '\n');
    fsyncSync(manifestFd);
    closeSync(manifestFd);
    renameSync(manifestPending, finalManifest);
    writeFileSync(join(evidence, 'immutable-target-cache-manifest.json'), readFileSync(finalManifest));
    const published = { ...targetManifest, publicationCompletedAt: new Date().toISOString(), fsyncAndPublicationSeconds: (performance.now() - publicationStart) / 1000 };
    writeFileSync(join(evidence, 'immutable-target-manifest.json'), JSON.stringify(published, null, 2) + '\n');
  }
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
    buildEnv.RUSTFLAGS = '-C debuginfo=1';
    consume({ label: 'native-compiler-flag-positive-control' });
    delete buildEnv.RUSTFLAGS;
  }
  run({ name: 'cargo-store-and-target-bytes', command: 'du', args: ['--summarize', '--bytes', env.CARGO_HOME, target], childEnv: buildEnv });
} finally {
  const requests = readFileSync(journal, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  writeFileSync(join(evidence, 'failed-rustc-requests.json'), JSON.stringify(requests.filter(record => record.exitStatus !== 0), null, 2) + '\n');
  stats('native-final-stats');
  run({ name: 'sccache-stop', command: binary, args: ['--stop-server'], childEnv: buildEnv, expected: 'observe' });
}
