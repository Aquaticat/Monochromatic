#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';
import { root, prefix, evidence, manifest, env, sha, run } from './reuse-context.mjs';

//region Extend the existing prepared tools with the repository-owned native Git verification prerequisite
assert(process.env.DEPOT_SNAPSHOT_TOKEN);
assert.equal(manifest.baseSourceSha, 'e02be6c8b8fe9efb41a7f8f1a0b311c17796588a');
const source = join(root, '.research-reuse/git-source');
assert(!existsSync(source));
run({ name: 'git-source-clone-help', command: 'gh', args: ['repo', 'clone', '--help'] });
run({ name: 'git256-source-clone', command: 'gh', args: ['repo', 'clone', 'git/git', source, '--', '--depth', '1', '--branch', 'v2.56.0'], limit: 90_000 });
run({ name: 'git256-disable-third-party-push', command: 'git', args: ['remote', 'set-url', '--push', 'origin', 'DISABLED'], cwd: source });
// Git2.56 is the frozen CLI's canonical consumer, selected by build-git-test-image.mjs rather than a new version choice.
const revision = 'a018953688f1b10bddf91bff8747068f5f4746a4';
assert.equal(run({ name: 'git256-source-revision', command: 'git', args: ['rev-parse', 'HEAD'], cwd: source }).log.trim(), revision);
const tree = run({ name: 'git256-source-tree', command: 'git', args: ['rev-parse', 'HEAD^{tree}'], cwd: source }).log.trim();
assert.equal(readFileSync(join(source, 'Cargo.toml'), 'utf8').trim().split('[dependencies]')[1], '');
const installPrefix = join(prefix, 'git-2.56.0');
assert(!existsSync(installPrefix));
run({ name: 'git256-build-prerequisites', command: 'dpkg-query', args: ['--show', '--showformat=${Package} ${Version}\n', 'gcc', 'make', 'libcurl4-openssl-dev', 'libssl-dev', 'zlib1g-dev', 'libexpat1-dev'] });
run({ name: 'git256-make-help', command: 'make', args: ['--help'] });
run({ name: 'git256-source-build-install', command: 'mise', args: ['exec', 'rust', '--', 'make', '--jobs=8', '--directory=' + source, 'prefix=' + installPrefix, 'NO_GETTEXT=YesPlease', 'NO_TCLTK=YesPlease', 'PYTHON_PATH=/usr/bin/python3', 'CARGO_ARGS=--offline --release', 'install'], limit: 480_000 });
const git = join(installPrefix, 'bin/git');
assert.equal(run({ name: 'git256-installed-version', command: git, args: ['--version'] }).log.trim(), 'git version 2.56.0');
//endregion

//region Capture the inspected compiler-cache executable once instead of downloading it in each consumer
const toolRoot = join(prefix, 'sccache');
assert(!existsSync(toolRoot));
mkdirSync(toolRoot, { recursive: true });
const distributionStarted = performance.now();
const response = await fetch('https://github.com/mozilla/sccache/releases/download/v0.18.0/sccache-v0.18.0-x86_64-unknown-linux-musl.tar.gz', { signal: AbortSignal.timeout(60_000) });
assert.equal(response.status, 200);
const archive = Buffer.from(await response.arrayBuffer());
assert.equal(archive.length, 9_730_540);
assert.equal(sha(archive), '45f1447fbe231e3037bde351ef70677dd212216c8d62ae7ca409fecc4d6acc89');
writeFileSync(join(toolRoot, 'sccache.tar.gz'), archive);
run({ name: 'prepared-sccache-extract', command: 'tar', args: ['--extract', '--gzip', '--file', join(toolRoot, 'sccache.tar.gz'), '--directory', toolRoot, '--strip-components=1'], limit: 30_000 });
const sccache = join(toolRoot, 'sccache');
assert.equal(sha(readFileSync(sccache)), '973cb15f6a986d84ca334bbed3bbe2eb8f1ee8fd81bf9e115b8539a293bf8d59');
run({ name: 'prepared-sccache-version', command: sccache, args: ['--version'] });
run({ name: 'extra-installed-tool-bytes', command: 'du', args: ['--summarize', '--bytes', installPrefix, toolRoot] });
const record = { recordedAt: new Date().toISOString(), baseSourceSha: manifest.baseSourceSha, parentImage: 'l4zncjjbj5.registry.depot.dev/research-reuse-20261018:tools-r1', parentManifest: 'sha256:9fb974fd32185c8afd5711370869d03e0f28e5b560c928eae324c20151ddeee8', destination: 'l4zncjjbj5.registry.depot.dev/research-reuse-20261018:tools-r2-git256', git: { path: git, sha256: sha(readFileSync(git)), bytes: statSync(git).size, version: '2.56.0', sourceRevision: revision, sourceTree: tree, owner: 'package/git-policy/cli/bin/build-git-test-image.mjs', flags: ['NO_GETTEXT=YesPlease', 'NO_TCLTK=YesPlease', 'PYTHON_PATH=/usr/bin/python3', 'CARGO_ARGS=--offline --release'] }, sccache: { path: sccache, sha256: sha(readFileSync(sccache)), version: '0.18.0', sourceCommit: '01c35e69b97f516c2ebfbdb418b5cd6277bde280', distributionSha256: sha(archive), distributionBytes: archive.length, distributionAndExtractionSeconds: (performance.now() - distributionStarted) / 1000 } };
writeFileSync(join(prefix, 'image-tool-update.json'), JSON.stringify(record, null, 2) + '\n');
writeFileSync(join(evidence, 'image-tool-update.json'), JSON.stringify(record, null, 2) + '\n');
assert(!existsSync(manifest.syntheticFixtures.sourcePath) && !existsSync(manifest.syntheticFixtures.secretPath));
writeFileSync(manifest.syntheticFixtures.sourcePath, 'synthetic-source-marker-20261018-r2\n');
writeFileSync(manifest.syntheticFixtures.secretPath, 'synthetic-secret-file-20261018-r2\n', { mode: 0o600 });
//endregion
