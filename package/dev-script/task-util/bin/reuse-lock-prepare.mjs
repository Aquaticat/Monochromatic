#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, createReadStream, existsSync, openSync, readFileSync, writeFileSync, writeSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';
import { root, input, tools, gitPrefix, provider, hash, run, save, bindArchiveManifest, LockProbeError } from './reuse-lock-context.mjs';

const zip = join(input, 'archive.zip');
const expectedZipHash = '019694511127b9d0a3af6b79f62d1560e34d6c76d9e00ee1c8e4d60f04a723cb';
const expectedZipBytes = 98192385;
const url = process.env.MONO_RESEARCH_LOCK_ARCHIVE_URL_20261018;
delete process.env.MONO_RESEARCH_LOCK_ARCHIVE_URL_20261018;
if (!existsSync(zip)) {
  assert(url && new URL(url).protocol === 'https:');
  let response;
  try { response = await fetch(url, { redirect: 'error' }); }
  catch (error) {
    save('archive-download-error.json', { errorName: error.name, urlPrinted: false });
    throw new LockProbeError('The one-object diagnostic download failed before an HTTP response; no credential was logged.');
  }
  assert.equal(response.status, 200, 'Signed diagnostic object GET HTTP status ' + response.status);
  const fd = openSync(zip, 'wx', 0o600);
  let bytes = 0;
  try {
    for await (const chunk of response.body) {
      bytes += chunk.length;
      assert(bytes <= expectedZipBytes);
      writeSync(fd, chunk);
    }
  } finally { closeSync(fd); }
  assert.equal(bytes, expectedZipBytes);
}
const digest = createHash('sha256');
let bytes = 0;
for await (const chunk of createReadStream(zip)) { bytes += chunk.length; digest.update(chunk); }
assert.equal(bytes, expectedZipBytes);
assert.equal(digest.digest('hex'), expectedZipHash);
save('archive-download.json', { provider, bytes, sha256: expectedZipHash, source: url ? 'signed-one-object-GET' : 'same-workflow-GitHub-artifact-mirror', urlPrinted: false });
for (const name of ['diagnostic-archive-manifest.json', 'diagnostic-native-nextest.tar.zst', 'diagnostic-git-2.56.0.tar.zst', 'diagnostic-host-tools.tar.zst']) {
  const fd = openSync(join(input, name), 'wx', 0o600);
  try { execFileSync('unzip', ['-p', zip, name], { stdio: ['ignore', fd, 'pipe'] }); }
  finally { closeSync(fd); }
}
const manifestBytes = readFileSync(join(input, 'diagnostic-archive-manifest.json'));
assert.equal(hash(manifestBytes), '971b898f01f5edf054b02d5d97f9babfc36525982b674859af1fca93520dc70c');
const manifest = JSON.parse(manifestBytes);
for (const bundle of manifest.bundles) assert.equal(hash(readFileSync(join(input, bundle.name))), bundle.sha256);
run({ name: 'unpack-bundled-host-tools', command: 'tar', args: ['--extract', '--zstd', '--no-same-owner', '--file', join(input, 'diagnostic-host-tools.tar.zst'), '--directory', tools] });
run({ name: 'create-disposable-git-prefix', command: 'sudo', args: ['--non-interactive', 'mkdir', '--parents', '/opt/depot-reuse-20261018-r1'] });
run({ name: 'restore-exact-bundled-git-prefix', command: 'sudo', args: ['--non-interactive', 'tar', '--extract', '--zstd', '--no-same-owner', '--file', join(input, 'diagnostic-git-2.56.0.tar.zst'), '--directory', '/opt/depot-reuse-20261018-r1'] });
assert.equal(hash(readFileSync(join(gitPrefix, 'bin/git'))), manifest.gitBinarySha256);
save('provider-original-git.json', { sha256: hash(readFileSync('/usr/bin/git')) });
run({ name: 'bind-absolute-git-fixture', command: 'sudo', args: ['--non-interactive', 'install', '--mode=0755', join(gitPrefix, 'bin/git'), '/usr/bin/git'] });
bindArchiveManifest();
run({ name: 'required-git-version', command: '/usr/bin/git', args: ['--version'] });
run({ name: 'bundled-nextest-version', command: join(tools, 'cargo-nextest'), args: ['nextest', '--version'] });
run({ name: 'bundled-published-linter-version', command: join(tools, 'monochromatic-lint'), args: ['--version'] });
save('archive-input-admission.json', { sourceSha: manifest.baseSourceSha, sourceFiles: manifest.sourceFiles.length, zipSha256: expectedZipHash, nextestSha256: manifest.nextestBinarySha256, gitSha256: manifest.gitBinarySha256, linterSha256: manifest.linterBinarySha256, rootPolicySha256: manifest.rootPolicySha256 });
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'archive_ready=true\n');
