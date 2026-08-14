/**
 * Tests for the resume guard that keeps one accumulation at one pipeline commit.
 *
 * The failure these exist for was measured, not imagined. One accumulation
 * directory held 22 settled entries across FOUR recorded tips. None of the four
 * was a decision: the pass stops at its soft budget, a fresh invocation resumes
 * it, and that invocation reads HEAD again. Four resumes across an evening of
 * ordinary commits produced four generations, and every reader that computes a
 * rate then refuses the whole pool.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import { mkdtemp, writeFile, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { assertResumableGeneration, } from '../../dist/final/node/index.mjs';

/**
 * Environment variable the guard reads for an explicit drift opt-in.
 */
const ALLOW_DRIFT_VAR = 'TRANSLATION_REPAIR_ALLOW_TIP_DRIFT';

/**
 * Sets the drift opt-in for the life of a scope and restores it on exit.
 *
 * Restored rather than left set, since a leaked opt-in would silently disarm
 * the guard for every later case in this process.
 *
 * @param value - value to set, exact opt-in or otherwise
 *
 * @returns Disposable restoring the previous value, including its absence
 *
 * @example
 * ```ts
 * using _override = withDriftVar({ value: 'yes', },);
 * ```
 */
function withDriftVar({ value, }: { readonly value: string; },): Disposable {
  /**
   * Value before this scope; absent means the variable was unset.
   */
  const original = process.env[ALLOW_DRIFT_VAR];
  process.env[ALLOW_DRIFT_VAR] = value;
  return {
    [Symbol.dispose](): void {
      if (original === undefined)
        Reflect.deleteProperty(process.env, ALLOW_DRIFT_VAR,);
      else
        process.env[ALLOW_DRIFT_VAR] = original;
    },
  };
}

/**
 * Writes a throwaway artifacts directory.
 *
 * Written to a fresh temporary directory every time rather than to any real runs
 * directory, which holds hours of ungraded work.
 *
 * @param tips - one artifact per entry, each recording the given commit
 *
 * @returns Path of the artifacts directory
 *
 * @example
 * ```ts
 * const dir = await writeArtifacts({ tips: { Mittens: 'aaaaaaaaa', }, },);
 * ```
 */
async function writeArtifacts(
  { tips, }: { readonly tips: Readonly<Record<string, string>>; },
): Promise<string> {
  /**
   * Disposable root for this case.
   */
  const dir = await mkdtemp(join(
    tmpdir(),
    'pass-generation-guard-',
  ),);

  await Promise.all(
    Object.entries(tips,)
      .map(async function writeOne([entryId, tip,],) {
        await writeFile(
          join(
            dir,
            `${entryId}.json`,
          ),
          JSON.stringify({
            tip,
            status: 'repaired',
          },),
          'utf8',
        );
      },),
  );

  return dir;
}

await describe({
  name: assertResumableGeneration.name,
  children: [
    it({
      name: 'passes a FRESH directory, since a first invocation has nothing to '
        + 'disagree with and must not be made to look like a fault',
      fn: async () => {
        const dir = await writeArtifacts({ tips: {}, },);

        await assertResumableGeneration({
          artifactsDir: dir,
          tip: 'aaaaaaaaa',
        },);
      },
    },),

    it({
      name: 'passes a resume under the SAME commit, which is the ordinary case '
        + 'this guard must not make expensive: a pass stopped at its soft '
        + 'budget and is being continued with nothing landed in between',
      fn: async () => {
        const dir = await writeArtifacts({
          tips: {
            Mittens: 'aaaaaaaaa',
            Pepper: 'aaaaaaaaa',
          },
        },);

        await assertResumableGeneration({
          artifactsDir: dir,
          tip: 'aaaaaaaaa',
        },);
      },
    },),

    it({
      name: 'REFUSES a resume that would stamp a second commit into one pool. '
        + 'This is the whole guard: by the time a reader refuses the mixed '
        + 'pool the budget is already spent, so the refusal has to happen '
        + 'before any entry is settled rather than after',
      fn: async () => {
        const dir = await writeArtifacts({
          tips: {
            Mittens: 'aaaaaaaaa',
            Pepper: 'aaaaaaaaa',
          },
        },);

        await expect(
          assertResumableGeneration({
            artifactsDir: dir,
            tip: 'bbbbbbbbb',
          },),
        )
          .rejects
          .toThrow('built by a different pipeline commit',);
      },
    },),

    it({
      name: 'names EVERY commit already present, not just one, so an operator '
        + 'reading the refusal can see a directory that is already mixed '
        + 'rather than believing it holds a single clean generation',
      fn: async () => {
        const dir = await writeArtifacts({
          tips: {
            Mittens: 'aaaaaaaaa',
            Pepper: 'bbbbbbbbb',
          },
        },);

        await expect(
          assertResumableGeneration({
            artifactsDir: dir,
            tip: 'ccccccccc',
          },),
        )
          .rejects
          .toThrow('bbbbbbbbb',);
      },
    },),

    it({
      name: 'permits drift when asked EXPLICITLY, so an operator who wants a '
        + 'deliberately mixed directory is not blocked, while a stray value '
        + 'cannot switch the guard off by accident',
      fn: async () => {
        const dir = await writeArtifacts({ tips: { Mittens: 'aaaaaaaaa', }, },);

        using _override = withDriftVar({ value: 'yes', },);

        await assertResumableGeneration({
          artifactsDir: dir,
          tip: 'bbbbbbbbb',
        },);
      },
    },),

    it({
      name: 'ignores a value that is not the exact opt-in, because a guard a '
        + 'stray `0` or empty string can disable is not a guard',
      fn: async () => {
        const dir = await writeArtifacts({ tips: { Mittens: 'aaaaaaaaa', }, },);

        using _override = withDriftVar({ value: '0', },);

        await expect(
          assertResumableGeneration({
            artifactsDir: dir,
            tip: 'bbbbbbbbb',
          },),
        )
          .rejects
          .toThrow('different pipeline commit',);
      },
    },),

    it({
      name: 'REFUSES to resume a directory holding an UNTAGGED artifact, which '
        + 'reading only the tip groups missed entirely: a directory of nothing '
        + 'but unplaceable artifacts produced no groups and sailed through. Such '
        + 'an entry is counted as settled by the scheduler so it never retries, '
        + 'and excluded by the pool filter so it never appears in a rate; it '
        + 'ceases to exist and no count says so',
      fn: async () => {
        const dir = await writeArtifacts({ tips: { Pepper: 'aaaaaaaaa', }, },);
        await writeFile(
          join(
            dir,
            'Mittens.json',
          ),
          JSON.stringify({ status: 'repaired', },),
          'utf8',
        );

        await expect(
          assertResumableGeneration({
            artifactsDir: dir,
            tip: 'aaaaaaaaa',
          },),
        )
          .rejects
          .toThrow('Mittens',);
      },
    },),

    it({
      name: 'REFUSES a MALFORMED artifact for the same reason, and names it, '
        + 'since deleting the file is the whole remedy and an operator cannot '
        + 'delete what the refusal does not name',
      fn: async () => {
        const dir = await writeArtifacts({ tips: { Pepper: 'aaaaaaaaa', }, },);
        await writeFile(
          join(
            dir,
            'Biscuit.json',
          ),
          '{ "tip": "aaaaaaaaa", "status": "rep',
          'utf8',
        );

        await expect(
          assertResumableGeneration({
            artifactsDir: dir,
            tip: 'aaaaaaaaa',
          },),
        )
          .rejects
          .toThrow('Biscuit',);
      },
    },),
  ],
},);
