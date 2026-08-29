/**
 * Tests for the judged-contest ledger.
 *
 * WHAT THIS GUARDS is the reason the module exists: a roster question asked
 * after a run should be answerable from what the run already paid for. The
 * cases therefore check that the TEXT survives, not merely that a file appears.
 *
 * THE UNSET CASE IS NOT AN EDGE CASE. Every unit run and every probe sets no
 * run directory, so writing nothing there is the ordinary path, and a module
 * that threw or wrote into the working tree instead would break both.
 *
 * THE FAILURE CASE MATTERS MORE THAN THE SUCCESS ONE. Telemetry that can fail a
 * slice is worse than no telemetry, so a write into an impossible location must
 * leave the caller undisturbed.
 *
 * Model identifiers come from the catalog. Candidate text here is cat-themed
 * invention, never corpus wording.
 *
 * @module
 */

import {
  mkdtemp,
  readdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type Candidate,
  recordContest,
  type SelectionBallot,
} from '../dist/final/node/index.mjs';

/**
 * Variable naming the run directory, matching the module under test.
 */
const RUNS_DIR_VARIABLE = 'TRANSLATION_REPAIR_RUNS_DIR';

/**
 * Directory the recorder writes under, matching the module under test.
 */
const LEDGER_SUBDIR = 'ledger';

/**
 * Logger the recorder writes its own warnings through.
 */
const l = tagged({ tag: 'candidate-ledger-test', },);

/**
 * Two candidates, one written alone and one by several models together.
 */
const CANDIDATES: readonly Candidate<{ readonly text: string; }>[] = [
  {
    producer: {
      kind: 'model',
      modelId: 'deepseek-v4-flash-0731',
    },
    value: { text: 'The cat slept on the warm flagstones.', },
    rendered: 'The cat slept on the warm flagstones.',
  },
  {
    producer: {
      kind: 'composite',
      contributors: [
        'deepseek-v4-pro-0813',
        'minimax-m3',
      ],
    },
    value: { text: 'A cat lay sleeping on sun-warmed stone.', },
    rendered: 'A cat lay sleeping on sun-warmed stone.',
  },
];

/**
 * Ballots as the judges cast them, reasons included.
 */
const BALLOTS: readonly SelectionBallot[] = [
  {
    modelId: 'gemma-4-26b-a4b-it',
    best: 2,
    reason: 'Candidate 2 reads more naturally in English.',
    weight: 1,
    selfVote: false,
  },
  {
    modelId: 'deepseek-v4-pro-0813',
    best: 2,
    reason: 'Candidate 2 is mine and I still think it is better.',
    weight: 0.5,
    selfVote: true,
  },
];

/**
 * Points the run directory at a throwaway for as long as the binding lives.
 *
 * A `Disposable` RATHER THAN `try...finally`, which this codebase bans: the
 * restore has to happen even when a case fails, and `using` guarantees it.
 *
 * `Reflect.deleteProperty` RATHER THAN `delete`, because the key is held in a
 * named constant and deleting a computed key is banned.
 *
 * @param dir - directory the recorder should write under
 *
 * @returns Directory, plus the handle restoring the previous value
 *
 * @example
 * ```ts
 * using pointed = runsDirPointedAt({ dir, },);
 * ```
 */
function runsDirPointedAt(
  { dir, }: { readonly dir: string; },
): Disposable & { readonly dir: string; } {
  /**
   * Whatever the variable held before this case.
   */
  const before = process.env[RUNS_DIR_VARIABLE];
  process.env[RUNS_DIR_VARIABLE] = dir;

  return {
    dir,
    [Symbol.dispose](): void {
      if (before === undefined)
        Reflect.deleteProperty(
          process.env,
          RUNS_DIR_VARIABLE,
        );
      else
        process.env[RUNS_DIR_VARIABLE] = before;
    },
  };
}

/**
 * Clears the run directory for as long as the binding lives.
 *
 * @returns Whether the variable was cleared, plus the restoring handle
 *
 * @example
 * ```ts
 * using cleared = runsDirCleared();
 * ```
 */
function runsDirCleared(): Disposable & { readonly cleared: boolean; } {
  /**
   * Whatever the variable held before this case.
   */
  const before = process.env[RUNS_DIR_VARIABLE];
  Reflect.deleteProperty(
    process.env,
    RUNS_DIR_VARIABLE,
  );

  return {
    cleared: true,
    [Symbol.dispose](): void {
      if (before !== undefined)
        process.env[RUNS_DIR_VARIABLE] = before;
    },
  };
}

/**
 * Makes a throwaway directory for one case.
 *
 * @param mark - names the case, so a leftover directory says who left it
 *
 * @returns Path nothing else writes to
 *
 * @example
 * ```ts
 * const dir = await throwawayDir({ mark: 'kept', },);
 * ```
 */
async function throwawayDir(
  { mark, }: { readonly mark: string; },
): Promise<string> {
  return await mkdtemp(join(
    tmpdir(),
    `ledger-${mark}-`,
  ),);
}

/**
 * Lists the ledger directory, reporting an absent one as empty.
 *
 * @param dir - run directory written into
 *
 * @returns File names, empty where nothing was written
 *
 * @example
 * ```ts
 * const names = await namesUnder({ dir, },);
 * ```
 */
async function namesUnder(
  { dir, }: { readonly dir: string; },
): Promise<readonly string[]> {
  try {
    return await readdir(join(
      dir,
      LEDGER_SUBDIR,
    ),);
  } catch (error) {
    // AN ABSENT DIRECTORY IS THE EXPECTED ANSWER in the cases that assert
    // nothing was written, so the class is named at debug rather than raised.
    l.debug(`no ledger directory: ${String(error,)}`,);
    return [];
  }
}

/**
 * Reads every ledger file a run directory holds, in judging order.
 *
 * @param dir - run directory written into
 *
 * @returns Parsed rounds, empty where nothing was written
 *
 * @example
 * ```ts
 * const rounds = await ledgerIn({ dir, },);
 * ```
 */
async function ledgerIn(
  { dir, }: { readonly dir: string; },
): Promise<readonly unknown[]> {
  /**
   * Files the recorder wrote, empty where it wrote none.
   */
  const names = await namesUnder({ dir, },);

  return await Promise.all(names
    .toSorted(function byName(
      left,
      right,
    ): number {
      return (left < right) ? -1 : 1;
    },)
    .map(async function one(name,): Promise<unknown> {
      return JSON.parse(await readFile(
        join(
          dir,
          LEDGER_SUBDIR,
          name,
        ),
        'utf8',
      ),) as unknown;
    },),);
}

/**
 * Records the shared fixture contest into a directory.
 *
 * @param selectedIndex - outcome to record for this round
 *
 * @param mark - names the case, for the throwaway directory
 *
 * @returns Rounds the recorder left behind
 *
 * @example
 * ```ts
 * const rounds = await recordedRounds({ selectedIndex: 2, mark: 'kept', },);
 * ```
 */
async function recordedRounds(
  {
    selectedIndex,
    mark,
  }: {
    readonly selectedIndex: number | 'declined';
    readonly mark: string;
  },
): Promise<readonly unknown[]> {
  /**
   * Throwaway this case writes into.
   */
  const dir = await throwawayDir({ mark, },);

  using pointed = runsDirPointedAt({ dir, },);

  await recordContest({
    task: 'render this passage',
    candidates: CANDIDATES,
    ballots: BALLOTS,
    selectedIndex,
    l,
  },);

  return await ledgerIn({ dir: pointed.dir, },);
}

await describe({
  name: recordContest.name,
  children: [
    it({
      name: 'KEEPS the text each model wrote, which is the whole reason this '
        + 'exists: a standing says a seat was rarely preferred and cannot say '
        + 'whether what it wrote was wrong',
      fn: async () => {
        expect((await recordedRounds({
          selectedIndex: 2,
          mark: 'text',
        },)).map(function texts(round,): unknown {
          return (round as { candidates: readonly { rendered: string; }[]; })
            .candidates
            .map(function rendered(candidate,): string {
              return candidate.rendered;
            },);
        },),)
          .toEqual([[
            'The cat slept on the warm flagstones.',
            'A cat lay sleeping on sun-warmed stone.',
          ],],);
      },
    },),

    it({
      name: 'NAMES every model behind a joint candidate, so a seat that only '
        + 'ever agrees with its peers is still findable in the record',
      fn: async () => {
        expect((await recordedRounds({
          selectedIndex: 2,
          mark: 'producers',
        },)).map(function producers(round,): unknown {
          return (round as { candidates: readonly { producers: readonly string[]; }[]; })
            .candidates
            .map(function names(candidate,): readonly string[] {
              return candidate.producers;
            },);
        },),)
          .toEqual([[
            ['deepseek-v4-flash-0731',],
            [
              'deepseek-v4-pro-0813',
              'minimax-m3',
            ],
          ],],);
      },
    },),

    it({
      name: 'KEEPS each judge reason verbatim, since the reason is what says '
        + 'whether a candidate lost on a defect or on taste',
      fn: async () => {
        expect((await recordedRounds({
          selectedIndex: 2,
          mark: 'reasons',
        },)).map(function reasons(round,): unknown {
          return (round as { ballots: readonly { reason: string; }[]; })
            .ballots
            .map(function reason(ballot,): string {
              return ballot.reason;
            },);
        },),)
          .toEqual([[
            'Candidate 2 reads more naturally in English.',
            'Candidate 2 is mine and I still think it is better.',
          ],],);
      },
    },),

    it({
      name: 'RECORDS a declined round as declined, rather than inventing a '
        + 'winner from the leading candidate',
      fn: async () => {
        expect((await recordedRounds({
          selectedIndex: 'declined',
          mark: 'declined',
        },)).map(function chosen(round,): unknown {
          return (round as { selectedIndex: number | string; }).selectedIndex;
        },),)
          .toEqual(['declined',],);
      },
    },),

    it({
      name: 'WRITES nothing at all with no run directory named, which is what '
        + 'every unit run and every probe does',
      fn: async () => {
        /**
         * Throwaway that must stay empty.
         */
        const dir = await throwawayDir({ mark: 'unset', },);

        using cleared = runsDirCleared();

        await recordContest({
          task: 'render this passage',
          candidates: CANDIDATES,
          ballots: BALLOTS,
          selectedIndex: 2,
          l,
        },);

        expect({
          cleared: cleared.cleared,
          rounds: (await ledgerIn({ dir, },)).length,
        },)
          .toEqual({
            cleared: true,
            rounds: 0,
          },);
      },
    },),

    it({
      name: 'REFUSES to raise when the write cannot happen, because telemetry '
        + 'that can fail a slice is worse than telemetry that is missing',
      fn: async () => {
        /**
         * Throwaway with a FILE where the recorder expects a directory, so the
         * write cannot succeed.
         */
        const dir = await throwawayDir({ mark: 'blocked', },);
        await writeFile(
          join(
            dir,
            LEDGER_SUBDIR,
          ),
          'not a directory',
          'utf8',
        );

        using pointed = runsDirPointedAt({ dir, },);

        await recordContest({
          task: 'render this passage',
          candidates: CANDIDATES,
          ballots: BALLOTS,
          selectedIndex: 2,
          l,
        },);

        expect((await ledgerIn({ dir: pointed.dir, },)).length,)
          .toBe(0,);
      },
    },),
  ],
},);
