/**
 * Tests that the pool CENSUSES THE CALLER'S OWN LISTING when it was given one.
 *
 * WHY THE LISTING IS PASSED AT ALL. A reader that lists the artifacts directory
 * and then lets the census list it again is looking at two views of a directory
 * an accumulation may still be writing into, so an entry can be in the reader's
 * listing and absent from the census, or the other way round. The caller's
 * listing is forwarded precisely so both halves classify the same files.
 *
 * WHAT WAS MEASURED. On 2026-08-25, inverting the condition that forwards that
 * listing, so the names are dropped exactly when a caller supplied them, failed
 * no test in this package. Nothing throws: the census silently widens to
 * whatever is on disk, and a rate is then reported over a population its own
 * reader never saw.
 *
 * READ OFF THE POOL, not off a call count, because the pooled ids are what
 * every downstream rate divides by.
 *
 * NO NETWORK AND NO REAL ARTIFACTS. Two throwaway files are written to a
 * temporary directory, both tagged with the same commit and the same pipeline
 * digest so they form ONE generation and no ambiguity refusal can fire. The
 * pool is then asked for one of them by name.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { resolvePool, } from '../../dist/final/node/index.mjs';

//region Fixtures

/**
 * Environment variable naming the commit an eligible pipeline must contain.
 */
const REQUIRED_COMMIT_VAR = 'TRANSLATION_REPAIR_REQUIRED_COMMIT';

/**
 * Environment variable opting into a deliberately mixed pool.
 */
const POOL_ALL_VAR = 'TRANSLATION_REPAIR_POOL_ALL';

/**
 * Commit both fixtures record, shaped as a full object id because anything
 * shorter is refused as unplaceable.
 */
const TIP = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

/**
 * Built pipeline both fixtures record, so the two of them are ONE generation
 * and the pool has nothing ambiguous to refuse.
 */
const DIGEST = `sha256-tree-v1:${'0123456789abcdef'.repeat(4,)}`;

/**
 * Entry the caller asks for.
 */
const ASKED = 'mittens';

/**
 * Entry sitting beside it that the caller did not ask for.
 */
const UNASKED = 'whiskers';

/**
 * Writes one settled-looking artifact carrying the provenance the pool reads.
 *
 * @param artifactsDir - directory to write into
 *
 * @param entryId - id the file is named for and claims inside
 *
 * @returns Nothing; the file is the effect
 *
 * @example
 * ```ts
 * await placeArtifact({ artifactsDir, entryId: 'mittens', },);
 * ```
 */
async function placeArtifact(
  {
    artifactsDir,
    entryId,
  }: {
    readonly artifactsDir: string;
    readonly entryId: string;
  },
): Promise<void> {
  await writeFile(
    `${artifactsDir}/${entryId}.json`,
    JSON.stringify({
      id: entryId,
      tip: TIP,
      pipelineDigest: DIGEST,
    },),
    'utf8',
  );
}

/**
 * Clears both generation-policy variables for the duration of one case, so a
 * shell that exported either cannot decide what this test measures.
 *
 * @returns Disposable restoring whatever was there before
 *
 * @example
 * ```ts
 * using quiet = withoutPoolPolicy();
 * ```
 */
function withoutPoolPolicy(): Disposable {
  // NAMED ONE BY ONE rather than looped over. A loop reaches these through a
  // computed key, and a computed key on `process.env` is exactly what
  // `typescript(no-dynamic-delete)` refuses; spelling both out also puts the
  // two variable names in front of a reader of this helper.
  /**
   * Required commit as the invoking shell left it.
   */
  const commitBefore = process.env.TRANSLATION_REPAIR_REQUIRED_COMMIT;

  /**
   * Mixed-pool opt-in as the invoking shell left it.
   */
  const poolAllBefore = process.env.TRANSLATION_REPAIR_POOL_ALL;

  delete process.env.TRANSLATION_REPAIR_REQUIRED_COMMIT;
  delete process.env.TRANSLATION_REPAIR_POOL_ALL;

  return {
    [Symbol.dispose]: () => {
      if (commitBefore === undefined)
        delete process.env.TRANSLATION_REPAIR_REQUIRED_COMMIT;
      else
        process.env.TRANSLATION_REPAIR_REQUIRED_COMMIT = commitBefore;

      if (poolAllBefore === undefined)
        delete process.env.TRANSLATION_REPAIR_POOL_ALL;
      else
        process.env.TRANSLATION_REPAIR_POOL_ALL = poolAllBefore;
    },
  };
}

//endregion Fixtures

await describe({
  name: resolvePool.name,
  children: [
    it({
      name: 'POOLS ONLY THE NAMES IT WAS HANDED, so a reader that listed the directory itself and '
        + 'the census that classifies those files are looking at one view of it rather than two, '
        + 'which is the whole reason the listing travels with the call',
      fn: async () => {
        using quiet = withoutPoolPolicy();

        /**
         * Throwaway artifacts directory, so nothing real is read or written.
         */
        const artifactsDir = await mkdtemp(`${tmpdir()}/pool-names-`,);

        await placeArtifact({ artifactsDir, entryId: ASKED, },);
        await placeArtifact({ artifactsDir, entryId: UNASKED, },);

        /**
         * Pool resolved against a listing naming ONE of the two files present.
         */
        const eligible = await resolvePool({
          artifactsDir,
          names: [`${ASKED}.json`,],
        },);

        await rm(
          artifactsDir,
          {
            recursive: true,
            force: true,
          },
        );

        // The unasked entry is on disk and would be pooled by a census that
        // listed the directory for itself. Its absence here is the forwarding.
        expect(eligible.entryIds,).toStrictEqual([ASKED,],);
        expect(eligible.malformedIds,).toStrictEqual([],);
        // Both policy variables were absent for the whole call, so nothing an
        // invoking shell exported chose the pool that was just measured.
        expect(process.env[REQUIRED_COMMIT_VAR],).toBe(undefined,);
        expect(process.env[POOL_ALL_VAR],).toBe(undefined,);
        expect(quiet,).not.toBe(undefined,);
      },
    },),
  ],
},);
