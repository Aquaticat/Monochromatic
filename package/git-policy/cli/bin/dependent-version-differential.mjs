#!/usr/bin/env node
/**
 Differential harness: the incumbent TypeScript dependent-version planner against the native Rust planner.

 Usage (from `package/git-policy/cli`):
 - `record`: evaluate every incumbent unit-test scenario with the incumbent, apply the unit test's assertion, and write
   `src/native/dependent_version_fixtures/unit_cases.json`, which the native gate reads.
 - `check`: the same, then require the committed fixture to equal what the incumbent produces now.
 - `corpus [--seed <n>] [--count <n>] [--probes <n>] [--plant <name>]`: build a corpus of the committed unit cases,
   the real repository with raised versions, seeded generated workspaces and one-feature probes; evaluate it with the
   incumbent and with the native planner (`cargo test` of the ignored corpus test); compare every result;
   write evidence under `target/verification/dependent-version-*`.
   `--plant` builds a disposable copy of the native crate with one planted defect, as a positive control.
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { evaluateIncumbent, HarnessError } from './dependent-version-incumbent.mjs';
import { generatedCases, probeCases } from './dependent-version-generator.mjs';
import { explainProbe, plants } from './dependent-version-probes.mjs';
import { repositoryCases, repositorySamples, repositorySnapshot, sharedWorkspace } from './dependent-version-repository.mjs';
import { unitScenarios } from './dependent-version-unit-scenarios.mjs';

/** The native crate. */
const cratePath = resolve(import.meta.dirname, '..');
/** The repository worktree root. */
const repositoryRoot = resolve(cratePath, '../../..');
/** The committed shared fixture. */
const fixturePath = join(cratePath, 'src/native/dependent_version_fixtures/unit_cases.json');

/**
 Evaluate every unit scenario with the incumbent and apply its assertion.

 @returns {Promise<string>} fixture text
 */
async function unitFixture() {
  const cases = [];
  for (const scenario of unitScenarios()) {
    const expected = await evaluateIncumbent(scenario, () => {
      throw new HarnessError('unit scenarios name no shared workspace');
    });
    try {
      scenario.check(expected);
    } catch (error) {
      throw new HarnessError(`incumbent result breaks the unit test's assertion for "${scenario.name}"`, { cause: error });
    }
    cases.push({ name: scenario.name, kind: scenario.kind, input: scenario.input, expected });
  }
  return `${JSON.stringify(cases, undefined, 2)}\n`;
}

/**
 Parse `--name value` options.

 @param {string[]} argv - arguments after the subcommand
 @returns {Map<string, string>} options
 */
function options(argv) {
  const parsed = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    if (!argv[index].startsWith('--') || argv[index + 1] === undefined)
      throw new HarnessError(`expected --name value pairs, got ${argv.slice(index).join(' ')}`);
    parsed.set(argv[index].slice(2), argv[index + 1]);
  }
  return parsed;
}

/**
 Run the native corpus test over a corpus directory, optionally in a planted copy of the crate.

 @param {{ corpus: string, plant: string | undefined }} request - corpus directory and planted defect
 @returns {Promise<string[]>} native results, one per case
 */
async function nativeResults({ corpus, plant }) {
  let crate = cratePath;
  /** @type {string | undefined} */
  let disposable;
  if (plant !== undefined) {
    const found = plants.find(candidate => candidate.name === plant);
    if (found === undefined)
      throw new HarnessError(`unknown plant ${plant}; known: ${plants.map(candidate => candidate.name).join(', ')}`);
    disposable = await mkdtemp(join(tmpdir(), 'dependent-version-plant-'));
    for (const entry of ['package/git-policy/cli/Cargo.toml', 'package/git-policy/cli/Cargo.lock', 'package/git-policy/cli/README.md', 'package/git-policy/cli/src/native', 'package/rust-module/jsonc-edit'])
      await cp(join(repositoryRoot, entry), join(disposable, entry), { recursive: true, filter: source => !source.includes('/target') });
    crate = join(disposable, 'package/git-policy/cli');
    const file = join(crate, found.file);
    const original = await readFile(file, 'utf8');
    if (original.split(found.from).length !== 2)
      throw new HarnessError(`plant ${plant} must match exactly once in ${found.file}`);
    await writeFile(file, original.replace(found.from, found.to));
  }
  try {
    const run = spawnSync('cargo', ['test', '--locked', '--offline', '--lib', 'dependent_version_differential_tests::corpus_from_environment', '--', '--include-ignored', '--exact'], {
      cwd: crate,
      encoding: 'utf8',
      env: { ...process.env, DEPENDENT_VERSION_CORPUS: corpus, ...(disposable === undefined ? {} : { CARGO_TARGET_DIR: join(disposable, 'target') }) },
      maxBuffer: 64 * 1024 * 1024,
    });
    await writeFile(join(corpus, plant === undefined ? 'native-test.log' : `native-test-${plant}.log`), `${run.stdout}\n${run.stderr}`);
    if (run.status !== 0)
      throw new HarnessError(`native corpus test exited ${run.status}; see ${corpus}`);
    return (await readFile(join(corpus, 'rust-results.jsonl'), 'utf8')).trimEnd().split('\n');
  } finally {
    if (disposable !== undefined)
      await rm(disposable, { recursive: true, force: true });
  }
}

/**
 Build and evaluate the corpus, compare, and write evidence.

 @param {Map<string, string>} parsed - options
 */
async function corpus(parsed) {
  const seed = Number(parsed.get('seed') ?? '20261006');
  const count = Number(parsed.get('count') ?? '2000');
  const perFeature = Number(parsed.get('probes') ?? '25');
  const plant = parsed.get('plant');
  const evidenceRoot = join(cratePath, 'target/verification');
  await mkdir(evidenceRoot, { recursive: true });
  const directory = await mkdtemp(join(evidenceRoot, 'dependent-version-'));
  const snapshot = repositorySnapshot(repositoryRoot);
  const samples = repositorySamples(snapshot, seed);
  await writeFile(join(directory, 'real-workspace.json'), JSON.stringify(sharedWorkspace(snapshot)));
  const committed = JSON.parse(await readFile(fixturePath, 'utf8'));
  const classes = [
    { label: 'unit', cases: committed.map((/** @type {any} */ entry) => ({ ...entry, features: [] })) },
    { label: 'repository', cases: repositoryCases(snapshot, samples, 'real-workspace.json') },
    { label: 'generated', cases: generatedCases({ seed, count }) },
    { label: 'probe', cases: probeCases({ seed, perFeature }) },
  ];
  const all = classes.flatMap(entry => entry.cases.map((/** @type {any} */ testCase) => ({ ...testCase, label: entry.label })));
  await writeFile(join(directory, 'cases.jsonl'), `${all.map(testCase => JSON.stringify(testCase)).join('\n')}\n`);
  const shared = JSON.parse(await readFile(join(directory, 'real-workspace.json'), 'utf8'));
  const incumbent = [];
  for (const testCase of all)
    incumbent.push(JSON.stringify(await evaluateIncumbent(testCase, () => shared)));
  await writeFile(join(directory, 'ts-results.jsonl'), `${incumbent.join('\n')}\n`);
  const native = await nativeResults({ corpus: directory, plant });
  const report = { seed, count, perFeature, plant: plant ?? null, revision: snapshot.revision, samples, classes: /** @type {any[]} */ ([]) };
  for (const { label } of classes) {
    const indices = all.flatMap((testCase, index) => (testCase.label === label ? [index] : []));
    const differing = indices.filter(index => incumbent[index] !== native[index]);
    const explained = differing.filter(index => all[index].features.length > 0 && explainProbe(all[index].features[0], JSON.parse(incumbent[index]), JSON.parse(native[index])));
    const unexplained = differing.filter(index => !explained.includes(index));
    report.classes.push({
      label,
      cases: indices.length,
      identical: indices.length - differing.length,
      explained: explained.map(index => all[index].name),
      unexplained: unexplained.map(index => ({ name: all[index].name, incumbent: JSON.parse(incumbent[index]), native: JSON.parse(native[index]) })),
    });
  }
  await writeFile(join(directory, 'report.json'), `${JSON.stringify(report, undefined, 2)}\n`);
  for (const entry of report.classes)
    console.log(`${entry.label}: ${entry.cases} cases, ${entry.identical} identical, ${entry.explained.length} explained differences, ${entry.unexplained.length} unexplained`);
  console.log(`Differential evidence: ${directory}`);
  const unexplainedTotal = report.classes.reduce((sum, entry) => sum + entry.unexplained.length, 0);
  if (unexplainedTotal > 0)
    process.exitCode = 1;
}

/** Dispatch the subcommand. */
async function main() {
  const [subcommand, ...rest] = process.argv.slice(2);
  if (subcommand === 'record') {
    await mkdir(join(cratePath, 'src/native/dependent_version_fixtures'), { recursive: true });
    await writeFile(fixturePath, await unitFixture());
    console.log(`Recorded ${fixturePath}`);
    return;
  }
  if (subcommand === 'check') {
    if ((await unitFixture()) !== (await readFile(fixturePath, 'utf8')))
      throw new HarnessError(`${fixturePath} differs from what the incumbent produces now; run record and review the change`);
    console.log(`The incumbent reproduces ${fixturePath}`);
    return;
  }
  if (subcommand === 'corpus')
    return corpus(options(rest));
  throw new HarnessError('usage: dependent-version-differential.mjs record | check | corpus [--seed n] [--count n] [--probes n] [--plant name]');
}

await main();
