#!/usr/bin/env node
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { strict as assert } from 'node:assert';
import { root, owned, evidence, environment, profile, run, rust, sourceAdmission } from './rust-bounded-profile.mjs';

//region Run the existing planted controls against disposable copies with an auditable Nextest transport
const projectPath = { 'planted-git': 'package/git-policy/cli.fuzz', 'planted-linter': 'package/linter/monochromatic-lint.fuzz' }[profile];
assert(projectPath);
const paths = ['package/git-policy/cli', 'package/git-policy/cli.fuzz', 'package/cli/forbidden-strings', 'package/rust-module/forbidden-regex', 'package/rust-module/jsonc-edit', 'package/rust-module/jsonc-edit.fuzz', 'package/linter/monochromatic-lint', 'package/linter/monochromatic-lint.fuzz'];
const finish = sourceAdmission(paths);
delete environment.CARGO_BUILD_JOBS;
try {
  const project = join(root, projectPath);
  rust('locked-dependency-preparation', ['cargo', 'fetch', '--locked'], { cwd: project });
  const cargoPath = run('actual-cargo-path', 'mise', ['which', 'cargo']).stdout.trim();
  const nextestPath = run('actual-nextest-path', 'mise', ['which', 'cargo-nextest']).stdout.trim();
  assert(existsSync(cargoPath) && existsSync(nextestPath));
  const bridge = join(owned, 'bridge');
  mkdirSync(bridge, { recursive: true, mode: 0o700 });
  copyFileSync(join(root, 'package/dev-script/task-util/bin/rust-planted-cargo.mjs'), join(bridge, 'cargo'));
  chmodSync(join(bridge, 'cargo'), 0o700);
  environment.RESEARCH_REAL_CARGO = cargoPath;
  environment.RESEARCH_PLANT_RECEIPTS = join(evidence, 'actual-nextest');
  environment.PATH = [bridge, dirname(cargoPath), dirname(nextestPath), environment.PATH].join(':');
  environment.CARGO_NET_OFFLINE = 'true';
  const result = run('existing-planted-controls', process.execPath, ['bin/planted-controls.mjs'], { cwd: project, allowFailure: true });
  const generated = join(project, 'target/verification');
  if (existsSync(generated)) cpSync(generated, join(evidence, 'owner-verification'), { recursive: true });
  writeFileSync(join(evidence, 'planted-boundary.json'), JSON.stringify({ sourceOwner: projectPath + '/bin/planted-controls.mjs', sourceOwnerModified: false, plantEditsApplyToDisposableCopies: true, originalInnerCommand: 'cargo test --lib --offline --locked -- --test-threads=2', actualInnerCommand: 'cargo nextest run --lib --offline --locked --no-fail-fast', nextestConcurrency: 'default', ownerParserAdapter: 'Actual JUnit testcase names/statuses become the exact Rust libtest lines consumed by the unchanged owner; raw Nextest and JUnit remain retained', status: result.status }, null, 2) + '\n');
  assert.equal(result.status, 0, result.output.slice(-4000));
} finally { finish(); }
//endregion
