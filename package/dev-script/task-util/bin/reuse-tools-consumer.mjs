#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync, realpathSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';
import { root, prefix, evidence, manifest, env, sha, run } from './reuse-context.mjs';

//region Check the prepared image before trusting any installed dependency snapshot
assert.equal(manifest.baseSourceSha, 'e02be6c8b8fe9efb41a7f8f1a0b311c17796588a');
const exclusion = { sourceMarkerAbsent: !existsSync(join(root, '.reuse-synthetic-source-marker')), syntheticSecretFileAbsent: !existsSync(join(homedir(), '.config/depot/reuse-synthetic-secret')), maskedEnvironmentAbsent: !process.env.RESEARCH_SECRET_CONTROL, unmaskedEnvironment: process.env.RESEARCH_PERSIST_CONTROL ?? null };
writeFileSync(join(evidence, 'image-exclusion.json'), JSON.stringify(exclusion, null, 2) + '\n');
assert(exclusion.sourceMarkerAbsent && exclusion.syntheticSecretFileAbsent && exclusion.maskedEnvironmentAbsent);
for (const [path, expected] of Object.entries(manifest.identities)) assert.equal(sha(readFileSync(join(root, path))), expected, path + ' differs from the prepared source');
run({ name: 'snapshot-dependency-admission', command: 'git', args: ['diff', '--exit-code', manifest.baseSourceSha, '--', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.pnpmfile.mjs', '.pnpmfile.policies.json', ':(glob)package/*/*/package.json'] });
const tools = {};
for (const [binary, expected] of Object.entries(manifest.tools)) {
  const path = execFileSync('mise', ['which', binary], { cwd: root, env, encoding: 'utf8' }).trim();
  assert.equal(sha(readFileSync(path)), expected.sha256, binary + ' changed across image capture');
  tools[binary] = { path, realpath: realpathSync(path), sha256: expected.sha256 };
}
writeFileSync(join(evidence, 'restored-tool-hashes.json'), JSON.stringify(tools, null, 2) + '\n');
run({ name: 'unshare-help', command: 'unshare', args: ['--help'] });
const currentUser = userInfo();
const mise = execFileSync('which', ['mise'], { encoding: 'utf8' }).trim();
const assignments = ['MISE_DATA_DIR', 'MISE_CACHE_DIR', 'RUSTUP_HOME', 'CARGO_HOME', 'MISE_AUTO_INSTALL', 'MISE_LOCKED', 'MISE_TRUSTED_CONFIG_PATHS', 'PATH'].map(name => name + '=' + (env[name] ?? ''));
const isolate = ['unshare', '--net', '--setuid', String(currentUser.uid), '--setgid', String(currentUser.gid), '--', '/usr/bin/env', ...assignments, 'HOME=' + homedir(), 'USER=' + currentUser.username, 'LOGNAME=' + currentUser.username];
run({ name: 'offline-installed-tool-availability', command: 'sudo', args: [...isolate, mise, 'install', 'node', 'pnpm', 'java', 'rust', 'cargo-binstall', 'cargo:cargo-nextest'], limit: 120_000 });
const emptyTools = join(root, '.research-reuse/empty-tools');
mkdirSync(emptyTools, { recursive: true });
run({ name: 'offline-empty-tool-positive-control', command: 'sudo', args: [...isolate, 'MISE_DATA_DIR=' + emptyTools, 'MISE_CACHE_DIR=' + emptyTools + '-cache', mise, 'install', 'node'], limit: 45_000, expected: 'failure' });
run({ name: 'online-empty-tool-recovery', command: 'mise', args: ['install', 'node'], childEnv: { ...env, MISE_DATA_DIR: emptyTools, MISE_CACHE_DIR: emptyTools + '-cache' }, limit: 120_000 });
const replacement = execFileSync('mise', ['which', 'node'], { cwd: root, env: { ...env, MISE_DATA_DIR: emptyTools }, encoding: 'utf8' }).trim();
assert.equal(sha(readFileSync(replacement)), manifest.tools.node.sha256);
const policy = join(root, '.pnpmfile.policies.json');
const originalPolicy = readFileSync(policy);
try {
  writeFileSync(policy, Buffer.concat([originalPolicy, Buffer.from('\n')]));
  assert.notEqual(sha(readFileSync(policy)), manifest.identities['.pnpmfile.policies.json']);
  writeFileSync(join(evidence, 'policy-invalidation.json'), JSON.stringify({ lockfileUnchanged: sha(readFileSync(join(root, 'pnpm-lock.yaml'))) === manifest.identities['pnpm-lock.yaml'], dataOnlyHookChangeRejected: true, changedPolicySha256: sha(readFileSync(policy)) }, null, 2) + '\n');
} finally {
  writeFileSync(policy, originalPolicy);
}
//endregion

//region Compare content-store installation with an already installed virtual-store archive
const archive = join(prefix, 'installed-dependencies.tar.zst');
assert.equal(sha(readFileSync(archive)), manifest.dependencyArchive.sha256);
const strategy = process.env.REUSE_DEPENDENCIES;
if (strategy === 'store') {
  run({ name: 'offline-empty-pnpm-store-control', command: 'mise', args: ['exec', 'node', 'pnpm', '--', 'pnpm', 'install', '--offline', '--frozen-lockfile', '--store-dir', join(root, '.research-reuse/empty-pnpm-store')], limit: 90_000, expected: 'failure' });
  run({ name: 'pnpm-offline-store-restore-and-link', command: 'mise', args: ['exec', 'node', 'pnpm', '--', 'pnpm', 'install', '--offline', '--frozen-lockfile', '--store-dir', join(prefix, 'pnpm-store')], limit: 120_000 });
} else if (strategy === 'installed') {
  const corrupt = join(root, '.research-reuse/partial-installed-dependencies.tar.zst');
  const bytes = readFileSync(archive);
  writeFileSync(corrupt, bytes.subarray(0, 1024 * 1024));
  assert.notEqual(sha(readFileSync(corrupt)), manifest.dependencyArchive.sha256);
  run({ name: 'partial-installed-archive-control', command: 'tar', args: ['--list', '--zstd', '--file', corrupt], limit: 30_000, expected: 'failure' });
  rmSync(corrupt);
  run({ name: 'installed-dependency-archive-extraction', command: 'tar', args: ['--extract', '--zstd', '--file', archive, '--directory', root], limit: 120_000 });
} else {
  throw new Error('Unknown dependency preparation strategy');
}
const rootDependency = join(root, 'node_modules/@monochromatic-dev/dev-script-task-util');
assert.equal(realpathSync(rootDependency), join(root, 'package/dev-script/task-util'));
writeFileSync(join(evidence, 'dependency-layout.json'), JSON.stringify({ strategy, archiveBytes: statSync(archive).size, archiveSha256: manifest.dependencyArchive.sha256, taskUtilLinkTarget: realpathSync(rootDependency), modulesLayout: readFileSync(join(root, 'node_modules/.modules.yaml'), 'utf8') }, null, 2) + '\n');
for (const [name, task] of [['semantic-plugin-build', 'build:js:node'], ['semantic-host-consumer', 'test:semantic-bridge-host'], ['semantic-external-consumer', 'test:external-consumer-host']]) run({ name, command: 'mise', args: ['run', '//package/oxlint-plugin/prefer-readonly-parameter-type:' + task], limit: 180_000 });
//endregion
