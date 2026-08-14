/**
 * Tests for the resume guard that keeps one accumulation at one built pipeline.
 *
 * The failure these exist for was measured, not imagined. One accumulation
 * directory held 22 settled entries across FOUR generations. None of the four
 * was a decision: the pass stops at its soft budget, a fresh invocation resumes
 * it, and that invocation builds again. Four resumes across an evening of
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
 * One built pipeline, as a digest-shaped invention.
 */
const DIGEST_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

/**
 * A second built pipeline, differing from {@link DIGEST_A} everywhere.
 */
const DIGEST_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

/**
 * A third, for the case where a directory is already mixed before this run.
 */
const DIGEST_C = 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';

/**
 * Commit every fixture artifact records, since these cases turn on the build
 * rather than on provenance.
 */
const FIXED_TIP = '1111111111111111111111111111111111111111';

/**
 * Environment variable the guard reads for an explicit drift opt-in.
 */
const ALLOW_DRIFT_VAR = 'TRANSLATION_REPAIR_ALLOW_GENERATION_DRIFT';

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
 * @param generations - one artifact per entry, each recording the given built
 * pipeline alongside a fixed commit
 *
 * @returns Path of the artifacts directory
 *
 * @example
 * ```ts
 * const dir = await writeArtifacts({ generations: { Mittens: DIGEST_A, }, },);
 * ```
 */
async function writeArtifacts(
  { generations, }: {
    readonly generations: Readonly<Record<string, string>>;
  },
): Promise<string> {
  /**
   * Disposable root for this case.
   */
  const dir = await mkdtemp(join(
    tmpdir(),
    'pass-generation-guard-',
  ),);

  await Promise.all(
    Object.entries(generations,)
      .map(async function writeOne([entryId, digest,],) {
        await writeFile(
          join(
            dir,
            `${entryId}.json`,
          ),
          JSON.stringify({
            tip: FIXED_TIP,
            pipelineDigest: digest,
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
        const dir = await writeArtifacts({ generations: {}, },);

        await assertResumableGeneration({
          artifactsDir: dir,
          digest: DIGEST_A,
        },);
      },
    },),

    it({
      name: 'passes a resume under the SAME build, which is the ordinary case '
        + 'this guard must not make expensive: a pass stopped at its soft '
        + 'budget and is being continued with nothing landed in between',
      fn: async () => {
        const dir = await writeArtifacts({
          generations: {
            Mittens: DIGEST_A,
            Pepper: DIGEST_A,
          },
        },);

        await assertResumableGeneration({
          artifactsDir: dir,
          digest: DIGEST_A,
        },);
      },
    },),

    it({
      name: 'REFUSES a resume that would stamp a second pipeline into one pool. '
        + 'This is the whole guard: by the time a reader refuses the mixed '
        + 'pool the budget is already spent, so the refusal has to happen '
        + 'before any entry is settled rather than after',
      fn: async () => {
        const dir = await writeArtifacts({
          generations: {
            Mittens: DIGEST_A,
            Pepper: DIGEST_A,
          },
        },);

        await expect(
          assertResumableGeneration({
            artifactsDir: dir,
            digest: DIGEST_B,
          },),
        )
          .rejects
          .toThrow('built by a different pipeline',);
      },
    },),

    it({
      name: 'names EVERY pipeline already present, not just one, so an operator '
        + 'reading the refusal can see a directory that is already mixed '
        + 'rather than believing it holds a single clean generation',
      fn: async () => {
        const dir = await writeArtifacts({
          generations: {
            Mittens: DIGEST_A,
            Pepper: DIGEST_B,
          },
        },);

        await expect(
          assertResumableGeneration({
            artifactsDir: dir,
            digest: DIGEST_C,
          },),
        )
          .rejects
          // Nine characters: the refusal abbreviates, so asserting the full id would
          // pass only if the message stopped abbreviating.
          .toThrow('bbbbbbbbb',);
      },
    },),

    it({
      name: 'permits drift when asked EXPLICITLY, so an operator who wants a '
        + 'deliberately mixed directory is not blocked, while a stray value '
        + 'cannot switch the guard off by accident',
      fn: async () => {
        const dir = await writeArtifacts({ generations: { Mittens: DIGEST_A, }, },);

        using _override = withDriftVar({ value: 'yes', },);

        await assertResumableGeneration({
          artifactsDir: dir,
          digest: DIGEST_B,
        },);
      },
    },),

    it({
      name: 'ignores a value that is not the exact opt-in, because a guard a '
        + 'stray `0` or empty string can disable is not a guard',
      fn: async () => {
        const dir = await writeArtifacts({ generations: { Mittens: DIGEST_A, }, },);

        using _override = withDriftVar({ value: '0', },);

        await expect(
          assertResumableGeneration({
            artifactsDir: dir,
            digest: DIGEST_B,
          },),
        )
          .rejects
          .toThrow('different pipeline',);
      },
    },),

    it({
      name: 'REFUSES to resume a directory whose artifacts predate generation '
        + 'identity, and does NOT tell the operator to delete them. They are '
        + 'sound results recorded under a commit, which covers any number of '
        + 'builds, so nothing can say whether this run is the pipeline that '
        + 'wrote them; the remedy is a fresh directory, not a smaller one',
      fn: async () => {
        const dir = await writeArtifacts({ generations: {}, },);
        await writeFile(
          join(
            dir,
            'Mittens.json',
          ),
          JSON.stringify({
            tip: FIXED_TIP,
            status: 'repaired',
          },),
          'utf8',
        );

        await expect(
          assertResumableGeneration({
            artifactsDir: dir,
            digest: DIGEST_A,
          },),
        )
          .rejects
          .toThrow('Deleting them is NOT the remedy',);
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
        const dir = await writeArtifacts({ generations: { Pepper: DIGEST_A, }, },);
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
            digest: DIGEST_A,
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
        const dir = await writeArtifacts({ generations: { Pepper: DIGEST_A, }, },);
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
            digest: DIGEST_A,
          },),
        )
          .rejects
          .toThrow('Biscuit',);
      },
    },),
  ],
},);
