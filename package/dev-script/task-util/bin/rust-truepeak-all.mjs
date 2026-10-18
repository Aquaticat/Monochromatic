#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';
import { root, owned, evidence, environment, run, rust, sourceAdmission, nextestConfig } from './rust-bounded-profile.mjs';

//region Exercise the owning service and fingerprint feature graph using disposable local databases and fake samples
assert.equal(process.env.RESEARCH_RUST_PROFILE, 'truepeak-all');
const finish = sourceAdmission(['package/music-player/truepeak-core']);
environment.HOME = join(owned, 'home');
mkdirSync(environment.HOME, { recursive: true, mode: 0o700 });
delete environment.CARGO_BUILD_JOBS;
try {
  const project = join(root, 'package/music-player/truepeak-core');
  rust('compiler-version', ['rustc', '--version', '--verbose']);
  rust('locked-all-features-dependency-preparation', ['cargo', 'fetch', '--locked'], { cwd: project });
  const result = rust('owning-release-all-features-nextest', ['cargo', 'nextest', '--config-file', nextestConfig('truepeak-all'), 'run', '--locked', '--offline', '--release', '--all-features', '--no-fail-fast'], { cwd: project, allowFailure: true });
  writeFileSync(join(evidence, 'truepeak-all-boundary.json'), JSON.stringify({ owningTask: '//package/music-player/truepeak-core:test', profile: 'release', features: 'all', nextestConcurrency: 'default', databases: 'In-memory and uniquely named disposable TMPDIR files from cache_tests.rs', sampleSource: 'Existing Fake source in service_tests.rs', ignoredHelpersAndBenchmarks: 'Retained in JUnit and not directly selected', sourceUnchanged: true, status: result.status }, null, 2) + '\n');
  assert.equal(result.status, 0, result.output.slice(-5000));
} finally { finish(); run('owned-output-size', 'du', ['--summarize', '--bytes', owned]); }
//endregion
