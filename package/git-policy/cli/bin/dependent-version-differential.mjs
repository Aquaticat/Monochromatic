#!/usr/bin/env node
/**
 Differential harness: the incumbent TypeScript dependent-version planner against the native Rust planner.

 Run through `mise run //package/git-policy/cli:native:differential:dependent-version -- <subcommand>`:
 - `record`: evaluate every incumbent unit-test scenario with the incumbent, apply the unit test's assertion, and write
   `src/native/dependent_version_fixtures/unit_cases.json`, which the native gate reads.
 - `check`: the same, then require the committed fixture to equal what the incumbent produces now.
 - `corpus [--seed <n>] [--count <n>] [--probes <n>] [--plant <name>]`: evaluate the committed unit cases, the real
   repository with raised versions, seeded generated workspaces and one-feature probes with both planners; compare
   every result; write evidence under `target/verification/dependent-version-*`. `--plant` builds a disposable copy
   of the native crate with one planted defect, as a positive control.
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  join,
  resolve,
} from 'node:path';

import { evaluateIncumbent } from './dependent-version-incumbent.mjs';
import { HarnessError } from './dependent-version-incumbent-reader.mjs';
import {
  generatedCases,
  probeCases,
} from './dependent-version-generator.mjs';
import { nativeResults } from './dependent-version-native.mjs';
import { compareClasses } from './dependent-version-report.mjs';
import {
  repositoryCases,
  repositorySamples,
} from './dependent-version-repository-cases.mjs';
import {
  repositorySnapshot,
  sharedWorkspace,
} from './dependent-version-repository.mjs';
import { unitScenarios } from './dependent-version-unit-scenarios.mjs';

/** @typedef {import('./dependent-version-types.mjs').CorpusCase} CorpusCase */
/** @typedef {import('./dependent-version-types.mjs').FixtureFile} FixtureFile */

/** The native crate. */
const cratePath = resolve(
  import.meta.dirname,
  '..'
);
/** The repository worktree root. */
const repositoryRoot = resolve(
  cratePath,
  '../../..'
);
/** The committed shared fixture. */
const fixturePath = join(
  cratePath,
  'src/native/dependent_version_fixtures/unit_cases.json'
);
/** Default corpus options. */
const defaults = {
  seed: '20261006',
  count: '2000',
  probes: '25',
};

/**
 A shared workspace loader for cases that name none.

 @returns {never} never returns
 */
function noSharedWorkspace() {
  throw new HarnessError('unit scenarios name no shared workspace');
}

/**
 Evaluate every unit scenario with the incumbent and apply its assertion.

 @returns {Promise<string>} fixture text
 */
async function unitFixture() {
  const cases = await Promise.all(unitScenarios()
    .map(async function record(scenario) {
      const {
        check,
        ...testCase
      } = scenario;
      const expected = await evaluateIncumbent({
        testCase,
        shared: noSharedWorkspace
      });
      try {
        check(expected);
      } catch (error) {
        throw new HarnessError(
          `incumbent result breaks the unit test's assertion for "${testCase.name}"`,
          { cause: error }
        );
      }
      return {
        name: testCase.name,
        kind: testCase.kind,
        input: testCase.input,
        expected
      };
    }));
  return `${JSON.stringify(
    cases,
    undefined,
    2
  )}\n`;
}

/**
 Whether parsed JSON is a list of cases.

 @param {unknown} value - parsed JSON
 @returns {value is import('./dependent-version-types.mjs').DifferentialCase[]} whether it is an array
 */
function isCaseList(value) {
  return Array.isArray(value);
}

/**
 The cases of the committed fixture.

 @param {string} text - fixture text
 @returns {import('./dependent-version-types.mjs').DifferentialCase[]} cases
 */
function parsedCases(text) {
  /** @type {unknown} */
  const value = JSON.parse(text);
  if (!isCaseList(value))
    throw new HarnessError('the committed fixture is not a list of cases');
  return value;
}

/**
 Parse `--name value` options over the defaults.

 @param {readonly string[]} argv - arguments after the subcommand
 @returns {{ seed: number, count: number, perFeature: number, plant: string | undefined }} options
 */
function corpusOptions(argv) {
  /** @type {Map<string, string>} */
  const parsed = new Map();
  for (const [index, flag] of argv.entries()) {
    const value = argv[index + 1];
    if (((index % 2) === 0) && ((!flag.startsWith('--')) || (value === undefined)))
      throw new HarnessError(`expected --name value pairs, got ${argv.slice(index)
        .join(' ')}`);
    if ((index % 2) === 0)
      parsed.set(
        flag.slice('--'.length),
        value ?? ''
      );
  }
  return {
    seed: Number(parsed.get('seed') ?? defaults.seed),
    count: Number(parsed.get('count') ?? defaults.count),
    perFeature: Number(parsed.get('probes') ?? defaults.probes),
    plant: parsed.get('plant'),
  };
}

/**
 Build and evaluate the corpus, compare, and write evidence.

 @param {readonly string[]} argv - corpus options
 @returns {Promise<void>} resolves when the evidence is written
 */
async function corpus(argv) {
  const {
    seed,
    count,
    perFeature,
    plant
  } = corpusOptions(argv);
  const evidenceRoot = join(
    cratePath,
    'target/verification'
  );
  await mkdir(
    evidenceRoot,
    { recursive: true }
  );
  const directory = await mkdtemp(join(
    evidenceRoot,
    'dependent-version-'
  ));
  const snapshot = await repositorySnapshot(repositoryRoot);
  const samples = repositorySamples({
    snapshot,
    seed
  });
  const shared = sharedWorkspace(snapshot);
  await writeFile(
    join(
      directory,
      'real-workspace.json'
    ),
    JSON.stringify(shared)
  );
  const committed = parsedCases(await readFile(
    fixturePath,
    'utf8'
  ));
  /** @type {CorpusCase[]} */
  const all = [
    ...committed.map(function asUnit(entry) {
      return {
        ...entry,
        label: 'unit',
        features: [],
      };
    }),
    ...repositoryCases({
      snapshot,
      samples,
      workspaceFile: 'real-workspace.json'
    }),
    ...generatedCases({
      seed,
      count
    }),
    ...probeCases({
      seed,
      perFeature
    }),
  ];
  await writeFile(
    join(
      directory,
      'cases.jsonl'
    ),
    `${all.map(function line(testCase) {
    return JSON.stringify(testCase);
  })
      .join('\n')}\n`
  );
  /**
   The shared workspace of the repository cases.

   @returns {FixtureFile[]} files
   */
  function sharedFiles() {
    return shared;
  }
  const incumbent = await Promise.all(all.map(async function evaluate(testCase) {
    return JSON.stringify(await evaluateIncumbent({
      testCase,
      shared: sharedFiles,
    }));
  }));
  await writeFile(
    join(
      directory,
      'ts-results.jsonl'
    ),
    `${incumbent.join('\n')}\n`
  );
  const native = await nativeResults({
    repositoryRoot,
    corpus: directory,
    plant
  });
  const classes = compareClasses({
    all,
    incumbent,
    native
  });
  const report = {
    seed,
    count,
    perFeature,
    plant: plant ?? null,
    revision: snapshot.revision,
    samples,
    classes
  };
  await writeFile(
    join(
      directory,
      'report.json'
    ),
    `${JSON.stringify(
      report,
      undefined,
      2
    )}\n`
  );
  for (const entry of classes)
    console.log(`${entry.label}: ${String(entry.cases)} cases, ${String(entry.identical)} identical, ${String(entry.explained
      .length)} explained differences, ${String(entry.unexplained
        .length)} unexplained; ${JSON.stringify(entry.outcomes)}`);
  console.log(`Differential evidence: ${directory}`);
  if (classes.some(function hasUnexplained(entry) {
    return entry.unexplained
      .length
      > 0;
  }))
    process.exitCode = 1;
}

/**
 Dispatch the subcommand.

 @returns {Promise<void>} resolves when the subcommand finished
 */
async function main() {
  const [subcommand, ...rest] = process.argv
    .slice(2);
  if (subcommand === 'record') {
    await mkdir(
      join(
        cratePath,
        'src/native/dependent_version_fixtures'
      ),
      { recursive: true }
    );
    await writeFile(
      fixturePath,
      await unitFixture()
    );
    console.log(`Recorded ${fixturePath}`);
    return;
  }
  if (subcommand === 'check') {
    if ((await unitFixture()) !== (await readFile(
      fixturePath,
      'utf8'
    )))
      throw new HarnessError(`${fixturePath} differs from what the incumbent produces now; run record and review the change`);
    console.log(`The incumbent reproduces ${fixturePath}`);
    return;
  }
  if (subcommand === 'corpus') {
    await corpus(rest);
    return;
  }
  throw new HarnessError('usage: dependent-version-differential.mjs record | check | corpus [--seed n] [--count n] [--probes n] [--plant name]');
}

await main();
