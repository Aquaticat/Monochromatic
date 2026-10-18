#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';
import { root, owned, evidence, environment, hash, run, rust, sourceAdmission } from './rust-bounded-profile.mjs';
import { prepareRuntime, runRuntime } from './rust-fuzz-runtime.mjs';

//region Exercise the unchanged benchmark search with an independently feasible synthetic input
assert.equal(process.env.RESEARCH_RUST_PROFILE, 'truepeak-bench-positive');
const finish = sourceAdmission(['package/music-player/truepeak-core.bench', 'package/music-player/truepeak-core']);
try {
  const context = join(owned, 'runtime');
  mkdirSync(join(context, 'rootfs/input'), { recursive: true });
  mkdirSync(join(context, 'rootfs/work/out'), { recursive: true });
  const tracks = Array.from({ length: 24 }, (_, index) => {
    const duration = 600 + index * 11;
    const peak = 0.6 + (index % 5) * 0.2;
    return { path: 'synthetic-positive-track-' + index, duration_secs: duration, rate: 48000, decoded_frames: duration * 48000, full_peak: peak, bin_seconds: 1, bin_peaks: Array.from({ length: duration }, () => peak) };
  });
  const fixture = Buffer.from(tracks.map(track => JSON.stringify(track)).join('\n') + '\n');
  writeFileSync(join(context, 'rootfs/input/tracks.jsonl'), fixture);
  writeFileSync(join(evidence, 'synthetic-positive-tracks.jsonl'), fixture);
  const cwd = join(root, 'package/music-player/truepeak-core.bench');
  rust('locked-dependency-preparation', ['cargo', 'fetch', '--locked'], { cwd });
  rust('owning-release-build', ['cargo', 'build', '--release', '--offline', '--locked'], { cwd });
  const binary = { name: 'truepeak-core-bench', path: join(environment.CARGO_TARGET_DIR, 'release/truepeak-core-bench') };
  const runtime = prepareRuntime({ binaries: [binary], corpora: {}, directory: context, image: 'localhost/rust-research-truepeak-positive:bounded', run });
  const outcomes = [];
  for (const repetition of [1, 2]) {
    const name = 'positive-repetition-' + repetition;
    const outcome = runRuntime({ name, image: runtime.image, executable: binary.name, args: ['/input/tracks.jsonl'], directory: join(evidence, 'runtime'), maximumSeconds: 120, run });
    outcomes.push({ repetition, ...outcome });
    writeFileSync(join(evidence, 'positive-results.json'), JSON.stringify({ fixtureSha256: hash(fixture), tracks: tracks.length, executableSha256: hash(readFileSync(binary.path)), outcomes }, null, 2) + '\n');
    assert.equal(outcome.status, 0);
    assert.equal(outcome.state.OOMKilled, false);
    const output = readFileSync(join(evidence, name + '-run.log'), 'utf8');
    assert(output.includes('best candidate (count='), 'The winning search branch must run');
    const features = outcome.files.find(file => file.path === 'out/long_features.jsonl');
    assert(features && features.bytes > 0, 'Retain actual generated benchmark output');
    const rows = readFileSync(join(outcome.corpusCopiedTo, features.path), 'utf8').trim().split('\n').map(row => JSON.parse(row));
    assert.equal(rows.length, tracks.length);
  }
} finally { finish(); }
//endregion
