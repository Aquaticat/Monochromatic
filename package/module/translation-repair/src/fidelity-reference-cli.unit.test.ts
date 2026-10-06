/**
 Tests for the compiled `judge-fidelity-probe` command's zero-call preflight:
 which requests it refuses before any corpus or provider access, with which
 exit status and first stderr line, and what it prints when it accepts one.

 Each run is the built command in an owned empty directory with no provider
 key set, `--cap 0`, so no case can read a corpus or spend. The entries the
 cases filter by are read from the checked-in manifest, never named here.
 Fixtures are cat-themed invention.

 @module
 */

import { fileURLToPath, } from 'node:url';

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import spawn, { SubprocessError, } from 'nano-spawn';

import { REVIEWED_FIDELITY_REFERENCES, } from '../dist/final/node/index.mjs';

import { refusalMessage, } from './fidelity-reference.test-fixture.ts';
import { SEAT_HYPER_OPENROUTER_UNMEASURED, } from './roster-seats.test-fixture.ts';
import { scratchDir, } from './scratch-dir.test-fixture.ts';

//region Preflight runs
// The built command, run for its zero-call preflight only.

/**
 Native compiled command, never a source import.
 */
const CLI = fileURLToPath(new URL('../dist/final/node/judge-fidelity-probe.mjs', import.meta.url,),);

/**
 Exit status the command gives a fault in its own request.
 */
const REQUEST_FAULT_STATUS = 5;

/**
 What a preflight run left behind.
 */
type PreflightRun = {
  /**
   Exit status, zero for an accepted request.
   */
  readonly code: number;

  /**
   Standard output, one entry per line.
   */
  readonly stdout: readonly string[];

  /**
   Standard error, one entry per line.
   */
  readonly stderr: readonly string[];
};

/**
 Drops the second bracketed group of a log line, which holds its timestamp.

 @param line - output line read

 @returns The line without its timestamp, any other line unchanged

 @example
 ```ts
 const plain = withoutStamp({ line: '[info] [2026-01-01T00:00:00.000Z] [probe] purr', },); // '[info] [probe] purr'
 ```
 */
function withoutStamp({ line, }: { readonly line: string; },): string {
  if (!line.startsWith('[',))
    return line;
  /**
   Where the level group closes.
   */
  const levelEnd = line.indexOf(']',);
  /**
   Where the timestamp group closes.
   */
  const stampEnd = line.indexOf(
    ']',
    levelEnd + 1,
  );
  if ([levelEnd, stampEnd,].includes(-1,))
    return line;
  return `${line.slice(
    0,
    levelEnd + 1,
  )}${line.slice(stampEnd + 1,)}`;
}

/**
 Splits command output into lines, each log line's timestamp dropped so a
 case compares the line whole.

 @param text - output read

 @returns Its non-empty lines

 @example
 ```ts
 const lines = linesOf({ text: '[info] [2026-01-01T00:00:00.000Z] [probe] purr\n', },); // ['[info] [probe] purr']
 ```
 */
function linesOf({ text, }: { readonly text: string; },): readonly string[] {
  return text.split('\n',)
    .filter((line,) => line !== '',)
    .map((line,) => withoutStamp({ line, },),);
}

/**
 Runs only the zero-call preflight in an owned empty directory.

 @param extra - arguments after `--cap 0` and the one approved candidate

 @returns Exit status and both output streams

 @example
 ```ts
 const run = await preflight(['--context',],);
 ```
 */
async function preflight(extra: readonly string[],): Promise<PreflightRun> {
  await using owned = await scratchDir({ prefix: 'reviewed-fidelity-cli-', },);
  /**
   The directory every path setting points at, so nothing outside it is read or written.
   */
  const directory = owned.path;
  /**
   Environment with every provider key blank.
   */
  const options = {
    cwd: directory,
    env: {
      TRANSLATION_REPAIR_RUNS_DIR: directory,
      TRANSLATION_REPAIR_CORPUS_CLONE_DIR: directory,
      TRANSLATION_REPAIR_SYNTHETIC_API_KEY: 'fixture-only',
      TRANSLATION_REPAIR_CHARM_HYPER_API_KEY: '',
      TRANSLATION_REPAIR_OPENROUTER_API_KEY: '',
      TRANSLATION_REPAIR_AMAZON_BEDROCK_API_KEY: '',
    },
  };
  try {
    const result = await spawn(
      process.execPath,
      [
        CLI,
        '--cap',
        '0',
        '--candidates',
        SEAT_HYPER_OPENROUTER_UNMEASURED,
        '--candidates-alone',
        ...extra,
      ],
      options,
    );
    return {
      code: 0,
      stdout: linesOf({ text: result.stdout, },),
      stderr: linesOf({ text: result.stderr, },),
    };
  }
  catch (error) {
    if (!(error instanceof SubprocessError))
      throw error;
    return {
      code: nonNullishOrThrow(error.exitCode,),
      stdout: linesOf({ text: error.stdout, },),
      stderr: linesOf({ text: error.stderr, },),
    };
  }
}

/**
 The first stderr line of a refused request: the command's name and the refusal's whole message.

 @param referenceId - identifier the refusal names

 @returns The line

 @example
 ```ts
 expect(run.stderr[0],).toBe(refusedLine({ referenceId: 'unreviewed context', },),);
 ```
 */
function refusedLine({ referenceId, }: { readonly referenceId: string; },): string {
  return `judge-fidelity-probe: ${refusalMessage({
    referenceId,
    operation: 'request',
  },)}`;
}

/**
 The two lines an accepted preflight prints.

 @param selected - reviewed references the request selects

 @returns The judges line and the preflight line

 @example
 ```ts
 expect(run.stdout,).toEqual(acceptedLines({ selected: 3, },),);
 ```
 */
function acceptedLines({ selected, }: { readonly selected: number; },): readonly string[] {
  return [
    `[info] [judge-fidelity-probe] judges: ${SEAT_HYPER_OPENROUTER_UNMEASURED}`,
    `[info] [judge-fidelity-probe] preflight only: ${
      String(selected,)
    } reviewed reference specifications selected; no corpus or model calls`,
  ];
}

/**
 The checked-in entry that has no reviewed alteration, which a request for the default families cannot select alone.

 @returns Its entry identifier and the number of references the manifest holds for it

 @throws {@link Error} when every reviewed entry has an alteration, since the case would then pin nothing

 @example
 ```ts
 const { entryId, } = entryWithoutAlteration();
 ```
 */
function entryWithoutAlteration(): { readonly entryId: string; readonly references: number; } {
  /**
   First reference with no alteration variant.
   */
  const found = nonNullishOrThrow(REVIEWED_FIDELITY_REFERENCES.find(
    (spec,) => !spec.damages.some((damage,) => damage.kind === 'alteration',),
  ),);
  return {
    entryId: found.entryId,
    references: REVIEWED_FIDELITY_REFERENCES.filter((spec,) => spec.entryId === found.entryId,).length,
  };
}

//endregion Preflight runs

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: 'judge-fidelity-probe preflight',
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'REFUSES an entry with no reviewed reference, naming it on the first stderr line, with exit status '
            + 'five and nothing on stdout',
          fn: async () => {
            const run = await preflight([
              '--only',
              'not-reviewed-fixture',
            ],);
            expect(run.code,).toBe(REQUEST_FAULT_STATUS,);
            expect(run.stdout,).toEqual([],);
            expect(run.stderr[0],).toBe(refusedLine({ referenceId: 'not-reviewed-fixture', },),);
          },
        },),
        it({
          name: 'REFUSES unreviewed context, naming it, rather than changing what a gold comparison means',
          fn: async () => {
            const run = await preflight(['--context',],);
            expect(run.code,).toBe(REQUEST_FAULT_STATUS,);
            expect(run.stdout,).toEqual([],);
            expect(run.stderr[0],).toBe(refusedLine({ referenceId: 'unreviewed context', },),);
          },
        },),
        it({
          name: 'REFUSES the default families for an entry with no reviewed alteration, naming the missing family, '
            + 'rather than silently dropping it',
          fn: async () => {
            const { entryId, } = entryWithoutAlteration();
            const run = await preflight([
              '--only',
              entryId,
            ],);
            expect(run.code,).toBe(REQUEST_FAULT_STATUS,);
            expect(run.stdout,).toEqual([],);
            expect(run.stderr[0],).toBe(refusedLine({ referenceId: 'damage selection (alteration)', },),);
          },
        },),
        it({
          name: 'ACCEPTS an explicitly narrower family for that entry, printing the judge and its reviewed '
            + 'references selected, with no spend line',
          fn: async () => {
            const { entryId, references, } = entryWithoutAlteration();
            const run = await preflight([
              '--only',
              entryId,
              '--damage',
              'deletion',
            ],);
            expect(run.code,).toBe(0,);
            expect(run.stderr,).toEqual([],);
            expect(run.stdout,).toEqual(acceptedLines({ selected: references, },),);
          },
        },),
        it({
          name: 'ACCEPTS the whole checked-in manifest for the default families, which some reference reviews each of, '
            + 'printing the judge and every reference selected, with no spend line',
          fn: async () => {
            const run = await preflight([],);
            expect(run.code,).toBe(0,);
            expect(run.stderr,).toEqual([],);
            expect(run.stdout,).toEqual(acceptedLines({ selected: REVIEWED_FIDELITY_REFERENCES.length, },),);
          },
        },),
      ],
    },),
  ],
},);
