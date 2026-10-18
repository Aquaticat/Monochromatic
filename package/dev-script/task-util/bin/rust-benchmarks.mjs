#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';
import { root, frozen, owned, evidence, environment, hash, run, rust, sourceAdmission, nextestConfig } from './rust-bounded-profile.mjs';
import { prepareRuntime, runRuntime } from './rust-fuzz-runtime.mjs';

//region Keep complete owning benchmark loops, baked public inputs and repeated unchanged execution distinct
assert.equal(process.env.RESEARCH_RUST_PROFILE, 'benchmarks');
const finish = sourceAdmission(['package/rust-module/forbidden-regex.bench', 'package/rust-module/forbidden-regex', 'package/cli/forbidden-strings', 'package/music-player/truepeak-core.bench', 'package/music-player/truepeak-core', 'forbidden-strings.append.txt']);
const results = [];
try {
  const help = run('podman-create-help', 'sudo', ['--non-interactive', 'podman', 'create', '--help']).stdout;
  assert(help.includes('--timeout'), 'A native per-container runtime bound is a prerequisite');
  const context = join(owned, 'runtime');
  const rootfs = join(context, 'rootfs');
  const repository = join(rootfs, 'input/repository');
  mkdirSync(repository, { recursive: true });
  const archive = join(owned, 'frozen-source.tar');
  run('archive-baked-frozen-public-source', 'git', ['archive', '--format=tar', '--output', archive, frozen]);
  const archiveHasher = createHash('sha256');
  for await (const chunk of createReadStream(archive)) archiveHasher.update(chunk);
  const archiveBytes = statSync(archive).size;
  const archiveSha256 = archiveHasher.digest('hex');
  run('extract-baked-frozen-public-source', 'tar', ['--extract', '--file', archive, '--directory', repository]);
  mkdirSync(join(repository, '.git'));
  writeFileSync(join(evidence, 'repository-corpus-admission.json'), JSON.stringify({ source: frozen, archiveBytes, archiveSha256, hashing: 'Streamed; no fixed-size exec stdout buffer', rootMarker: 'An empty .git directory lets the unchanged corpus walker identify its repository root', excludes: 'Runtime caches, harness revisions and untracked files are absent from git archive', command: 'git archive --format=tar --output <owned-archive> ' + frozen }, null, 2) + '\n');
  const tracks = Array.from({ length: 24 }, (_, index) => ({ path: 'synthetic-track-' + index, duration_secs: 30 + index * 11, rate: 48000, decoded_frames: (30 + index * 11) * 48000, full_peak: 0.6 + (index % 5) * 0.2, bin_seconds: 1, bin_peaks: Array.from({ length:30 + index * 11 }, (_, bin) => bin % (index + 3) === 0 ? 0.6 + (index % 5) * 0.2 : 0.25) }));
  const fixture = Buffer.from(tracks.map(track => JSON.stringify(track)).join('\n') + '\n');
  writeFileSync(join(rootfs, 'input/tracks.jsonl'), fixture);
  writeFileSync(join(evidence, 'synthetic-tracks.jsonl'), fixture);
  mkdirSync(join(rootfs, 'work/out'), { recursive: true });
  const binaries = [];
  for (const [path, name] of [['package/music-player/truepeak-core.bench', 'truepeak-core-bench'], ['package/rust-module/forbidden-regex.bench', 'forbidden-regex-bench']]) {
    const project = join(root, path);
    rust(name + '-locked-dependency-preparation', ['cargo', 'fetch', '--locked'], { cwd: project });
    const built = rust(name + '-owning-release-build', ['cargo', 'build', '--release', '--offline', '--locked'], { cwd: project, allowFailure:true });
    if (built.status !== 0) { results.push({ path, boundary: 'owning-release-build', status:built.status }); continue; }
    binaries.push({ name, path:join(environment.CARGO_TARGET_DIR, 'release', name) });
    if (name === 'truepeak-core-bench') {
      const testEnvironment = { ...environment };
      delete testEnvironment.CARGO_BUILD_JOBS;
      const tested = rust('truepeak-bench-owning-debug-nextest', ['cargo', 'nextest', '--config-file', nextestConfig('truepeak-bench'), 'run', '--locked', '--offline', '--no-fail-fast'], { cwd:project, env:testEnvironment, allowFailure:true });
      results.push({ path, boundary:'owning-debug-nextest', status:tested.status });
      const selection = rust('truepeak-owning-run-bin-selection', ['cargo', 'run', '--release', '--offline', '--locked', '--', '--help'], { cwd:project, allowFailure:true });
      writeFileSync(join(evidence, 'truepeak-owning-run-selection.json'), JSON.stringify({ owningTask:'//package/music-player/truepeak-core.bench:run', suppliedArgument:'--help', status:selection.status, result:selection.output }, null,2) + '\n');
    }
  }
  if (binaries.length) {
    const runtime = prepareRuntime({ binaries, corpora:{}, directory:context, image:'localhost/rust-research-benchmarks:bounded', run });
    writeFileSync(join(evidence, 'benchmark-runtime-admission.json'), JSON.stringify({ ...runtime, binaries:binaries.map(binary => ({ ...binary, sha256:hash(readFileSync(binary.path)) })), syntheticTracks:{ bytes:fixture.length, sha256:hash(fixture), count:tracks.length }, repetitions:2, inputIdentity:'Unchanged per executable across both repetitions', maximumSecondsPerInvocation:600 }, null,2) + '\n');
    for (const binary of binaries) for (const repetition of [1,2]) {
      const name = binary.name + '-repetition-' + repetition;
      const result = runRuntime({ name, image:runtime.image, executable:binary.name, args:binary.name === 'truepeak-core-bench' ? ['/input/tracks.jsonl'] : [], workingDirectory:binary.name === 'forbidden-regex-bench' ? '/input/repository' : '/work', maximumSeconds:600, directory:join(evidence,'runtime'), run });
      results.push({ executable:binary.name, repetition, input:binary.name === 'forbidden-regex-bench' ? 'Complete frozen repository source and owning ignore policy' : 'Deterministic synthetic tracks JSONL; no real audio-performance claim', ...result });
      writeFileSync(join(evidence, 'benchmark-results.json'), JSON.stringify(results,null,2) + '\n');
    }
  }
} finally { finish(); }
assert.equal(results.filter(result => result.status !== 0).length, 0, 'Retained bounded benchmark prerequisites or executions failed');
assert.equal(results.filter(result => result.repetition).length, 4);
//endregion
