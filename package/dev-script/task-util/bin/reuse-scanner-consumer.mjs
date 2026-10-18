#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, openSync, closeSync, fsyncSync, renameSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';
import { root, prefix, evidence, env, sha, run } from './reuse-context.mjs';

//region Admit one independent successful scanner workload, never the red native Git-policy aggregate
const phase = process.env.REUSE_SCAN_PHASE;
assert(['seed', 'target'].includes(phase));
const project = join(root, 'package/cli/forbidden-strings');
const paths = ['package/cli/forbidden-strings', 'package/rust-module/forbidden-regex'];
run({ name: 'scanner-frozen-source-admission', command: 'git', args: ['diff', '--exit-code', 'e02be6c8b8fe9efb41a7f8f1a0b311c17796588a', '--', ...paths] });
const disk = '/mnt/aquaticats-monochromatic-reuse-20261018-scanner-target-trusted-r1';
const mount = readFileSync('/proc/self/mountinfo', 'utf8').split('\n').filter(line => line.split(' ')[4] === disk);
assert.equal(mount.length, 1);
assert(mount[0].includes(' - fuse.archil '));
writeFileSync(join(evidence, 'scanner-target-mount.json'), JSON.stringify({ disk, mount }, null, 2) + '\n');
const target = join(root, '.research-reuse/scanner-target');
const binary = join(prefix, 'sccache/sccache');
assert.equal(sha(readFileSync(binary)), '973cb15f6a986d84ca334bbed3bbe2eb8f1ee8fd81bf9e115b8539a293bf8d59');
const buildEnv = { ...env, CARGO_TARGET_DIR: target, CARGO_INCREMENTAL: '0', CARGO_PROFILE_DEV_DEBUG: '0', RUSTC_WRAPPER: binary, SCCACHE_WEBDAV_ENDPOINT: 'https://cache.depot.dev', SCCACHE_WEBDAV_KEY_PREFIX: 'aquaticats-monochromatic-reuse-20261018-scanner-release-r1/', SCCACHE_WEBDAV_TOKEN: process.env.DEPOT_CACHE_TOKEN, SCCACHE_WEBDAV_RW_MODE: phase === 'seed' ? 'READ_WRITE' : 'READ_ONLY', SCCACHE_DIR: join(root, '.research-reuse/scanner-sccache-local'), SCCACHE_CACHE_SIZE: '0', SCCACHE_SERVER_PORT: '42263' };
delete buildEnv.CARGO_BUILD_JOBS;
assert(buildEnv.SCCACHE_WEBDAV_TOKEN);
const rustcPath = run({ name: 'scanner-rustc-path', command: 'mise', args: ['which', 'rustc'], childEnv: buildEnv }).log.trim();
const rustcHash = sha(readFileSync(rustcPath));
run({ name: 'scanner-rustc-version', command: 'mise', args: ['exec', 'rust', '--', 'rustc', '--version', '--verbose'], childEnv: buildEnv });
run({ name: 'scanner-sccache-start', command: binary, args: ['--start-server'], childEnv: buildEnv });

/** Retain counters even when frozen-source tests or deliberate controls fail. */
function stats(label) {
  const result = run({ name: label, command: binary, args: ['--show-stats', '--stats-format', 'json'], childEnv: buildEnv });
  const parsed = JSON.parse(result.log);
  writeFileSync(join(evidence, label + '.json'), JSON.stringify(parsed, null, 2) + '\n');
  return parsed;
}

/** Run the package's real release Nextest owner, with explicit lock/offline and complete failure reporting. */
function tests({ label, extra = [], expected = 'success' }) {
  const result = run({ name: label, command: 'mise', args: ['run', '//package/cli/forbidden-strings:test', '--', '--locked', '--offline', '--no-fail-fast', ...extra], childEnv: buildEnv, expected: 'observe', limit: 480_000 });
  stats(label + '-stats');
  if (expected === 'success') assert.equal(result.record.exitStatus, 0, label + ' must pass before target publication');
  if (expected === 'failure') assert.notEqual(result.record.exitStatus, 0, label + ' must detect the deliberately changed warning');
  return result;
}

/** Bind every tracked subject/dependency file and producer timestamps needed by Cargo fingerprints. */
function sourceFiles() {
  return execFileSync('git', ['ls-files', '--cached', '-z', '--', ...paths], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).split('\0').filter(Boolean).map(path => ({ path, sha256: sha(readFileSync(join(root, path))), mtimeMilliseconds: statSync(join(root, path)).mtimeMs }));
}

/** Enforce an independently pinned manifest, all source/tool/profile inputs and compressed archive bytes. */
function admit({ metadata, archiveBytes, expectedManifestHash }) {
  assert.equal(sha(metadata), expectedManifestHash);
  const parsed = JSON.parse(metadata);
  assert.equal(parsed.baseSourceSha, 'e02be6c8b8fe9efb41a7f8f1a0b311c17796588a');
  assert.equal(parsed.subject, 'forbidden-strings-release-complete-nextest');
  assert.equal(parsed.root, root);
  assert.equal(parsed.target, target);
  assert.equal(parsed.imageDigest, process.env.REUSE_IMAGE_DIGEST);
  assert.equal(parsed.rustcSha256, rustcHash);
  assert.equal(parsed.sccacheSha256, sha(readFileSync(binary)));
  assert.equal(parsed.miseLockSha256, sha(readFileSync(join(root, 'mise.lock'))));
  assert.equal(parsed.archiveBytes, archiveBytes.length);
  assert.equal(parsed.archiveSha256, sha(archiveBytes));
  assert.deepEqual(parsed.profile, { release: true, incremental: '0', rustflags: null });
  for (const item of parsed.sourceFiles) assert.equal(sha(readFileSync(join(root, item.path))), item.sha256, item.path);
  return parsed;
}
//endregion

try {
  run({ name: 'scanner-locked-registry-preparation', command: 'mise', args: ['exec', 'rust', '--', 'cargo', 'fetch', '--locked'], cwd: project, childEnv: buildEnv, limit: 120_000 });
  run({ name: 'scanner-lockfile-admission-after-fetch', command: 'git', args: ['diff', '--exit-code', 'e02be6c8b8fe9efb41a7f8f1a0b311c17796588a', '--', ...paths] });
  if (phase === 'target') {
    const metadata = readFileSync(join(disk, 'scanner-target.json'));
    const archiveBytes = readFileSync(join(disk, 'scanner-target.tar.zst'));
    const expectedHash = process.env.REUSE_SCAN_MANIFEST_SHA256;
    assert(expectedHash && /^[a-f0-9]{64}$/u.test(expectedHash));
    const admitted = admit({ metadata, archiveBytes, expectedManifestHash: expectedHash });
    assert.equal(admitted.archiveSha256, process.env.REUSE_SCAN_ARCHIVE_SHA256);
    assert.throws(() => admit({ metadata, archiveBytes: archiveBytes.subarray(0, Math.min(1024 * 1024, archiveBytes.length - 1)), expectedManifestHash: expectedHash }));
    const changed = join(project, 'src/runtime_cache/warning.rs');
    const original = readFileSync(changed);
    try {
      writeFileSync(changed, original.toString().replace('"missing"', '"research-missing"'));
      assert.notDeepEqual(readFileSync(changed), original);
      assert.throws(() => admit({ metadata, archiveBytes, expectedManifestHash: expectedHash }));
    } finally { writeFileSync(changed, original); }
    assert.throws(() => readFileSync(join(root, '.research-reuse/never-created-scanner-manifest.json')), { code: 'ENOENT' });
    for (const item of admitted.sourceFiles) utimesSync(join(root, item.path), new Date(item.mtimeMilliseconds), new Date(item.mtimeMilliseconds));
    assert(!existsSync(target));
    mkdirSync(target, { recursive: true });
    run({ name: 'scanner-target-disk-restore', command: 'tar', args: ['--extract', '--zstd', '--file', join(disk, 'scanner-target.tar.zst'), '--directory', target], childEnv: buildEnv, limit: 120_000 });
    writeFileSync(join(evidence, 'scanner-target-admission.json'), JSON.stringify({ independentlyPinnedManifestSha256: expectedHash, independentlyPinnedArchiveSha256: process.env.REUSE_SCAN_ARCHIVE_SHA256, partialArchiveRejected: true, actualChangedSourceRejected: true, missingManifestRejected: true, producer: admitted }, null, 2) + '\n');
  }
  run({ name: 'scanner-release-cli-build', command: 'mise', args: ['exec', 'rust', '--', 'cargo', 'build', '--release', '--locked', '--offline', '--bin', 'forbidden-strings', '--verbose'], cwd: project, childEnv: buildEnv, limit: 480_000 });
  const cli = join(target, 'release/forbidden-strings');
  const help = run({ name: 'scanner-real-cli-help', command: cli, args: ['--help'], childEnv: buildEnv });
  assert(help.log.includes('--version'));
  run({ name: 'scanner-real-cli-version', command: cli, args: ['--version'], childEnv: buildEnv });
  tests({ label: 'scanner-' + phase + '-complete-nextest' });
  if (phase === 'seed') {
    const source = join(project, 'src/runtime_cache/warning.rs');
    const original = readFileSync(source, 'utf8');
    assert(original.includes('return "missing";'));
    try {
      writeFileSync(source, original.replace('return "missing";', 'return "research-missing";'));
      const rejected = tests({ label: 'scanner-source-stale-output-control', extra: ['--filterset', 'test(runtime_cache::warning::tests::load_failure_reasons_render_exact_json)'], expected: 'failure' });
      assert(rejected.log.includes('FAIL') && rejected.log.includes('research-missing'));
    } finally { writeFileSync(source, original); }
    tests({ label: 'scanner-dependency-feature-control', extra: ['--features', 'gix-index/serde'] });
    const before = stats('scanner-before-compiler-change');
    buildEnv.RUSTFLAGS = '-C debuginfo=1';
    try {
      tests({ label: 'scanner-compiler-flag-control', extra: ['--filterset', 'test(runtime_cache::warning::tests::load_failure_reasons_render_exact_json)'] });
      const after = stats('scanner-after-compiler-change');
      assert((after.stats.cache_misses.counts.Rust ?? 0) > (before.stats.cache_misses.counts.Rust ?? 0));
    } finally { delete buildEnv.RUSTFLAGS; }
    tests({ label: 'scanner-original-final-complete-nextest' });
    run({ name: 'scanner-final-frozen-source-admission', command: 'git', args: ['diff', '--exit-code', 'e02be6c8b8fe9efb41a7f8f1a0b311c17796588a', '--', ...paths] });
    const path = join(disk, 'scanner-target.tar.zst');
    assert(!existsSync(path) && !existsSync(join(disk, 'scanner-target.json')));
    const pending = path + '.pending';
    const limitHelp = run({ name: 'scanner-archive-limit-help', command: 'prlimit', args: ['--help'] });
    assert(limitHelp.log.includes('--fsize'));
    run({ name: 'scanner-target-disk-save', command: 'prlimit', args: ['--fsize=1073741824:1073741824', '--', 'tar', '--create', '--zstd', '--file', pending, '--directory', target, '.'], limit: 120_000 });
    const fd = openSync(pending, 'r+');
    fsyncSync(fd);
    closeSync(fd);
    const bytes = readFileSync(pending);
    const receipt = { subject: 'forbidden-strings-release-complete-nextest', baseSourceSha: 'e02be6c8b8fe9efb41a7f8f1a0b311c17796588a', root, target, sourceFiles: sourceFiles(), imageDigest: process.env.REUSE_IMAGE_DIGEST, rustcSha256: rustcHash, sccacheSha256: sha(readFileSync(binary)), miseLockSha256: sha(readFileSync(join(root, 'mise.lock'))), profile: { release: true, incremental: '0', rustflags: null }, archiveBytes: bytes.length, archiveSha256: sha(bytes), cliSha256: sha(readFileSync(cli)) };
    renameSync(pending, path);
    const metadataPath = join(disk, 'scanner-target.json');
    const metadata = Buffer.from(JSON.stringify(receipt, null, 2) + '\n');
    const manifestFd = openSync(metadataPath + '.pending', 'wx', 0o600);
    writeFileSync(manifestFd, metadata);
    fsyncSync(manifestFd);
    closeSync(manifestFd);
    renameSync(metadataPath + '.pending', metadataPath);
    writeFileSync(join(evidence, 'scanner-success-only-target-manifest.json'), metadata);
    writeFileSync(join(evidence, 'scanner-success-only-target-publication.json'), JSON.stringify({ manifestSha256: sha(metadata), archiveSha256: sha(bytes), archiveBytes: bytes.length }, null, 2) + '\n');
  }
} finally {
  stats('scanner-final-stats');
  run({ name: 'scanner-sccache-stop', command: binary, args: ['--stop-server'], childEnv: buildEnv, expected: 'observe' });
}
