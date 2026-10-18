#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { strict as assert } from 'node:assert';

//region Discover compiler outputs through Cargo rather than assuming its artifact directory layout
const root = process.env.GITHUB_WORKSPACE;
assert(root);
const frozen = 'e02be6c8b8fe9efb41a7f8f1a0b311c17796588a';
const prefix = '/opt/depot-reuse-20261018-r1';
const owned = join(root, '.research-rust-consumer');
const evidence = join(owned, 'receipts');
mkdirSync(evidence, { recursive: true, mode: 0o700 });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const environment = { ...process.env, MISE_DATA_DIR: join(prefix, 'mise-data'), MISE_CACHE_DIR: join(prefix, 'mise-cache'), RUSTUP_HOME: join(prefix, 'rustup'), CARGO_HOME: join(prefix, 'cargo'), MISE_AUTO_INSTALL: 'false', MISE_LOCKED: '1', CARGO_BUILD_JOBS: '2', CARGO_INCREMENTAL: '0', CARGO_PROFILE_DEV_DEBUG: '0', CARGO_TARGET_DIR: join(owned, 'target') };
const paths = ['package/linter/monochromatic-lint', 'package/rust-module/jsonc-edit'];
const sourcePaths = execFileSync('git', ['ls-tree', '--full-tree', '--name-only', '-r', frozen, '--', ...paths], { cwd: root, encoding: 'utf8' }).trim().split('\n');
const sourceFiles = sourcePaths.map(path => ({ path, sha256: hash(readFileSync(join(root, path))) }));
const records = [];
function save() { writeFileSync(join(evidence, 'consumer-receipt.json'), JSON.stringify({ observedAt: new Date().toISOString(), frozenSource: frozen, harnessSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), image: { ref: process.env.RESEARCH_RUST_IMAGE, digest: process.env.REUSE_IMAGE_DIGEST }, sourceFiles, miseLockSha256: hash(readFileSync(join(root, 'mise.lock'))), bootId: readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim(), records }, null, 2) + '\n'); }
function run(name, command, args, cwd = root) {
  const fd = openSync(join(evidence, name + '.log'), 'w', 0o600);
  const startedAt = new Date().toISOString();
  const start = performance.now();
  let result;
  try { result = spawnSync(command, args, { cwd, env: environment, stdio: ['ignore', fd, fd] }); }
  finally { closeSync(fd); }
  const output = readFileSync(join(evidence, name + '.log'), 'utf8');
  records.push({ name, command: [command, ...args], cwd, startedAt, finishedAt: new Date().toISOString(), elapsedSeconds: (performance.now() - start) / 1000, status: result.status, signal: result.signal, error: result.error?.message, logSha256: hash(output) });
  save();
  console.log(JSON.stringify(records.at(-1)));
  if (result.error) throw result.error;
  assert.equal(result.status, 0, name + ': ' + output.slice(-3000));
  return output;
}
function rust(name, args, cwd = root) { return run(name, 'mise', ['exec', 'rust', 'cargo:cargo-nextest', '--', ...args], cwd); }
function file(path) { return { path, realPath: realpathSync(path), bytes: statSync(path).size, sha256: hash(readFileSync(path)) }; }
save();
try {
  run('initial-source-admission', 'git', ['diff', '--exit-code', frozen, '--', ...paths, 'mise.toml', 'mise.lock', '.cargo/config.toml']);
  const manifest = JSON.parse(readFileSync(join(prefix, 'additional-tool-manifest.json')));
  for (const [name, tool] of Object.entries(manifest.tools)) {
    const observed = file(tool.path);
    assert.equal(observed.sha256, tool.sha256);
    writeFileSync(join(evidence, name + '-fresh-tool.json'), JSON.stringify({ ...tool, observed }, null, 2) + '\n');
    run(name + '-fresh-version', tool.path, ['--version']);
  }
  assert(!existsSync(manifest.syntheticFixtures.sourceMarker));
  assert(!existsSync(manifest.syntheticFixtures.secretMarker));
  rust('compiler-version', ['rustc', '--version', '--verbose']);
  rust('cargo-version', ['cargo', '--version', '--verbose']);
  run('podman-fresh-version', 'sudo', ['--non-interactive', 'podman', '--version']);
  const project = join(root, 'package/linter/monochromatic-lint');
  rust('locked-dependency-preparation', ['cargo', 'fetch', '--locked'], project);
  const output = rust('library-artifact-json', ['cargo', 'build', '--locked', '--offline', '--lib', '--message-format=json-render-diagnostics'], project);
  const messages = output.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
  const artifacts = messages.filter(message => message.reason === 'compiler-artifact');
  const libraries = artifacts.filter(artifact => artifact.target.name === 'monochromatic_lint' && artifact.target.kind.includes('lib') && !artifact.profile.test);
  assert.equal(libraries.length, 1, 'Exactly one normal library artifact must be returned by this isolated Cargo build');
  const library = libraries[0];
  const archives = library.filenames.filter(path => path.endsWith('.rlib'));
  assert.equal(archives.length, 1);
  const archive = archives[0];
  const metadataCandidates = [...new Set(library.filenames.filter(path => path.endsWith('.rmeta')).concat(archive.replace(/\.rlib$/u, '.rmeta'), realpathSync(archive).replace(/\.rlib$/u, '.rmeta')))];
  const metadataFiles = metadataCandidates.filter(path => existsSync(path)).map(file);
  writeFileSync(join(evidence, 'cargo-artifact-discovery.json'), JSON.stringify({ library, artifactCount: artifacts.length, dependencyArtifacts: artifacts.map(artifact => ({ packageId: artifact.package_id, target: artifact.target, filenames: artifact.filenames })), archive: file(archive), metadataCandidates, metadataFiles }, null, 2) + '\n');
  assert.equal(new Set(metadataFiles.map(item => item.sha256)).size, 1, 'One co-produced full-metadata content must accompany the archive');
  const metadata = metadataFiles[0].path;
  const directories = [...new Set(artifacts.flatMap(artifact => artifact.filenames.map(dirname)))];
  const rustcArguments = ['rustc', '--edition=2024', '--extern', 'monochromatic_lint=' + archive, '--extern', 'monochromatic_lint=' + metadata, ...directories.flatMap(path => ['-L', 'dependency=' + path]), 'src/processors_consumer.rs', '--out-dir', owned];
  rust('existing-processor-consumer-build', rustcArguments, project);
  const binary = join(owned, 'processors_consumer');
  const consumed = run('existing-processor-consumer-execution', binary, []);
  assert.equal(consumed.trim(), 'processor artifact consumer passed');
  writeFileSync(join(evidence, 'successful-consumer-artifacts.json'), JSON.stringify({ archive: file(archive), fullMetadata: file(metadata), consumer: file(binary), consumerSource: file(join(project, 'src/processors_consumer.rs')), dependencySearchDirectories: directories, assertion: consumed.trim(), decidingRustSource: '5d8fec0669a64607db9ccbf663e7c23125bf4748:tests/run-make/embed-metadata/rmake.rs:64', nextestCasesInThisJob: 0, metadataOnlyCodexInspection: true, modelTurnExecuted: false }, null, 2) + '\n');
} finally {
  for (const source of sourceFiles) assert.equal(hash(readFileSync(join(root, source.path))), source.sha256, source.path);
  run('final-source-admission', 'git', ['diff', '--exit-code', frozen, '--', ...paths, 'mise.toml', 'mise.lock', '.cargo/config.toml']);
  run('installed-and-compiled-bytes', 'du', ['--summarize', '--bytes', owned, prefix]);
}
//endregion
