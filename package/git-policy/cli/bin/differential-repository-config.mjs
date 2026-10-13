#!/usr/bin/env node
/**
 Differential check of the repository's translated cli-git configuration.

 For each representative candidate set, a disposable repository carries the repository's real `cli-git.config.ts`
 (read by the incumbent TypeScript wrapper) and real `cli-git.config.jsonc` (read by the native wrapper).
 Both wrappers run the same non-commit commands there, and their policy decisions must be equal:
 exit code, standard output and standard error, plus the files and index a command leaves behind.
 A row where the native wrapper refuses because a policy it does not implement yet is enabled is reported as pending,
 never as equal, and `--require-all-equal` turns every pending row into a failure.

 Usage: node bin/differential-repository-config.mjs [--native <path>] [--scanner <path>] [--scenario <name>]
 [--require-all-equal]
 */
// The bin scripts sit outside the package tsconfig's include list, so type-aware lint checks them in an inferred
// program that loads no ambient Node types; this reference loads them, so `process` and `node:` imports stay typed
// in this file on its own instead of depending on a sibling module that carries the same reference.
/// <reference types="node" />
import {
  mkdtempDisposable,
  realpath,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  dirname,
  join,
  resolve,
} from 'node:path';
import { parseArgs } from 'node:util';

import { compareProbe } from './differential-config-compare.mjs';
import {
  createFixture,
  packageDirectory,
  repositoryRoot,
  SCANNER_PATH,
} from './differential-config-fixture.mjs';
import {
  DifferentialError,
  observe,
  REAL_GIT,
} from './differential-config-process.mjs';
import {
  probesFor,
  scenarios,
} from './differential-config-scenarios.mjs';

/**
 What one probe showed, by comparison.

 @typedef {import('./differential-config-compare.mjs').Row} Row
 */

/**
 Run every probe of one scenario, one after another.
 The scenario builds two fixtures (one per wrapper) so a mutating probe in one never changes what the other sees.
 Yielding a promise from an async generator waits for it, so the probes run in order without a loop of awaits.

 @param {{
   context: string,
   scenario: import('./differential-config-scenarios.mjs').Scenario,
   tools: import('./differential-config-fixture.mjs').Tools,
 }} request - parent directory, candidates and tools
 @returns {AsyncGenerator<Row>} one row per probe
 */
async function* scenarioRows({
  context,
  scenario,
  tools,
}) {
  const [
    forIncumbent,
    forNative,
  ] = await Promise.all([
    createFixture({
      context: join(
        context,
        'incumbent',
      ),
      scenario,
      tools,
    }),
    createFixture({
      context: join(
        context,
        'native',
      ),
      scenario,
      tools,
    }),
  ]);
  for (const probe of probesFor(scenario)) {
    yield compareProbe({
      scenario,
      probe,
      forIncumbent,
      forNative,
    });
  }
}

/**
 Run every probe of every selected scenario.
 Scenarios run one after another because each starts two Node processes and a scanner, and the host is shared.

 @param {{
   context: string,
   selected: readonly import('./differential-config-scenarios.mjs').Scenario[],
   tools: import('./differential-config-fixture.mjs').Tools,
 }} request - parent directory, candidate sets and tools
 @returns {AsyncGenerator<Row>} one row per probe
 */
async function* allRows({
  context,
  selected,
  tools,
}) {
  for (const scenario of selected) {
    yield* scenarioRows({
      context,
      scenario,
      tools,
    });
  }
}

/**
 Find the scanner binary the incumbent configuration runs: the requested path, the one in this checkout, or the one
 in the main checkout of the same repository (linked worktrees do not build their own).

 @param {string | undefined} requested - explicit path
 @returns {Promise<string>} resolved path
 */
async function findScanner(requested) {
  const common = await observe({
    command: REAL_GIT,
    args: [
      '-C',
      repositoryRoot,
      'rev-parse',
      '--git-common-dir',
    ],
    cwd: repositoryRoot,
    env: process.env,
  });
  const { stdout: commonDirectory } = common;
  const topLevel = commonDirectory.trim();
  const candidates = [
    requested,
    join(
      repositoryRoot,
      SCANNER_PATH,
    ),
    join(
      resolve(
        repositoryRoot,
        topLevel,
        '..',
      ),
      SCANNER_PATH,
    ),
  ].filter(function present(path) {
    return path !== undefined;
  });
  const settled = await Promise.allSettled(candidates.map(function resolveOne(candidate) {
    return realpath(candidate);
  }));
  const [found] = settled.flatMap(function fulfilledValue(outcome) {
    return outcome.status === 'fulfilled'
      ? [outcome.value]
      : [];
  });
  if (found === undefined)
    throw new DifferentialError(
      `No forbidden-strings scanner found. Tried: ${candidates.join(', ')}. `
        + 'Build one with `mise run //package/cli/forbidden-strings:build:release` or pass --scanner <path>.',
    );
  return found;
}

/**
 Find the directory holding the real `monochromatic-lint` executable, which the incumbent's Markdown policy starts.

 @returns {Promise<string | undefined>} its directory, undefined when mise cannot say
 */
async function findLintDirectory() {
  const located = await observe({
    command: 'mise',
    args: [
      'which',
      'monochromatic-lint',
    ],
    cwd: repositoryRoot,
    env: process.env,
  });
  if (located.code !== 0) {
    console.error(
      `mise could not locate monochromatic-lint, so the incumbent's Markdown policy cannot run: ${located.stderr}`,
    );
    return undefined;
  }
  const { stdout: lintPath } = located;
  return dirname(lintPath.trim());
}

/** Parse the command line, run every selected scenario and report. */
async function main() {
  const { values } = parseArgs({
    options: {
      native: { type: 'string' },
      scanner: { type: 'string' },
      scenario: { type: 'string' },
      'require-all-equal': { type: 'boolean' },
    },
  });
  const native = resolve(
    values.native ?? join(
      packageDirectory,
      'target/debug/cli-git-native',
    ),
  );
  const [
    resolvedNative,
    scanner,
    lintDirectory,
  ] = await Promise.all([
    realpath(native),
    findScanner(values.scanner),
    findLintDirectory(),
  ]);
  const tools = {
    native: resolvedNative,
    scanner,
    lintDirectory,
    nodeDirectory: dirname(process.execPath),
  };
  const selected = scenarios.filter(function isSelected(scenario) {
    return (values.scenario === undefined) || (scenario.name === values.scenario);
  });
  if (selected.length === 0)
    throw new DifferentialError(`No scenario is named ${String(values.scenario)}.`);
  await using context = await mkdtempDisposable(join(
    tmpdir(),
    'cli-git-config-differential-',
  ));
  const requireAllEqual = values['require-all-equal'] === true;
  /** @type {Row[]} */
  const rows = [];
  for await (const row of allRows({
    context: context.path,
    selected,
    tools,
  })) {
    rows.push(row);
    const { status } = row;
    console.log(`${status.toUpperCase()} ${row.label}`);
    if (status !== 'equal')
      console.log(`  ${row.detail}`);
  }
  const failing = rows.filter(function fails(row) {
    return (row.status === 'different') || (requireAllEqual && (row.status === 'pending'));
  });
  console.log(`${rows.length} rows, ${failing.length} failing`);
  if (failing.length > 0)
    process.exitCode = 1;
}

await main();
