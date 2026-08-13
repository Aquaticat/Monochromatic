/**
 * Tests for the parser that reads attribution out of settled artifacts.
 *
 * These exist because the report's own tests hand `chunkCritics` in by hand, so
 * they exercise the FOLD and never the WIRING. The eligible-versus-ineligible
 * decision the whole report rests on is not made there at all: it is made in
 * `toEntry`, by OMITTING the key for an artifact that carries no attribution.
 *
 * The distinction these guard is ABSENT versus MALFORMED. Only an absent key
 * means the entry predates attribution. A key that is present but corrupt must
 * fail loudly, because letting it fall through to the same omission would move
 * a broken artifact into the pre-feature population on the strength of its own
 * breakage, and the population is what every number divides by.
 *
 * Fixtures are cat-themed invention.
 *
 * @module
 */

import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { gatherAttributionEntries, } from '../../dist/final/node/index.mjs';

/**
 * Critic used throughout.
 */
const TABBY = 'hf:openai/gpt-oss-120b';

/**
 * Claim the fixtures attribute.
 */
const NAP = 'issue/nap';

/**
 * Writes artifacts into a fresh throwaway directory that removes itself.
 *
 * @param artifacts - file name to artifact body
 *
 * @returns Directory holding them, disposable
 *
 * @example
 * ```ts
 * await using scratch = await writeArtifacts({ artifacts: { 'a.json': {}, }, },);
 * ```
 */
async function writeArtifacts(
  {
    artifacts,
  }: {
    readonly artifacts: Record<string, unknown>;
  },
): Promise<{ readonly dir: string; } & AsyncDisposable> {
  /**
   * Throwaway directory, never a real runs directory.
   */
  const dir = await mkdtemp(join(
    tmpdir(),
    'attribution-read-',
  ),);

  await Promise.all(Object
    .entries(artifacts,)
    .map(async function writeOne([name, body,],) {
    await writeFile(
      join(
        dir,
        name,
      ),
      JSON.stringify(body,),
      'utf8',
    );
  },),);

  return {
    dir,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(
        dir,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 * Builds an artifact carrying attribution and one accepted issue.
 *
 * Deliberately NOT empty. Fixtures whose `claimAttributions` and `issues` are
 * both empty are satisfied by parsers that always return nothing, so they
 * constrain neither the proposer path nor the issue path.
 *
 * @param chunkCritics - calibration to record
 *
 * @returns Artifact body
 *
 * @example
 * ```ts
 * const body = artifactWith({ chunkCritics, },);
 * ```
 */
function artifactWith(
  {
    chunkCritics,
  }: {
    readonly chunkCritics: unknown;
  },
): Record<string, unknown> {
  return {
    id: 'Whiskers',
    chunkCritics,
    issues: [
      {
        chunkIndex: 0,
        issue: {
          status: 'accepted',
          claims: [{ claimId: NAP, },],
        },
      },
    ],
  };
}

await describe({
  name: gatherAttributionEntries.name,
  children: [
    it({
      name: 'parses attribution and issues DOWN TO their contents, so a parser '
        + 'that returned empty proposers or empty claim ids would fail here '
        + 'rather than passing on fixtures that carry neither',
      fn: async () => {
        /**
         * Artifact with one attributed claim and one accepted issue naming it.
         */
        await using scratch = await writeArtifacts({
          artifacts: {
            'whiskers.json': artifactWith({
              chunkCritics: [{
                chunkIndex: 3,
                heardCriticIds: [TABBY,],
                claimAttributions: [{
                  claimId: NAP,
                  proposers: [{ modelId: TABBY, emissionCount: 2, },],
                },],
              },],
            },),
          },
        },);

        /**
         * Entries as the CLI would gather them.
         */
        const entries = await gatherAttributionEntries({ artifactsDir: scratch.dir, },);

        /**
         * Chunk record the artifact carried.
         */
        const record = entries[0]?.chunkCritics?.[0];

        expect(record?.chunkIndex,).toBe(3,);
        expect(record?.heardCriticIds,).toStrictEqual([TABBY,],);
        expect(record?.claimAttributions[0]?.claimId,).toBe(NAP,);
        expect(record?.claimAttributions[0]?.proposers,)
          .toStrictEqual([{ modelId: TABBY, emissionCount: 2, },],);
        expect(entries[0]?.issues,)
          .toStrictEqual([{ status: 'accepted', claimIds: [NAP,], },],);
      },
    },),

    it({
      name: 'treats an ABSENT chunkCritics key as an entry that predates '
        + 'attribution, which is the decision the whole report rests on and the '
        + 'one its own tests cannot reach, since they supply chunkCritics by '
        + 'hand and so make every entry eligible by construction',
      fn: async () => {
        /**
         * Artifact written before attribution existed.
         */
        await using scratch = await writeArtifacts({
          artifacts: { 'mittens.json': { id: 'Mittens', issues: [], }, },
        },);

        /**
         * Entries as the CLI would gather them.
         */
        const entries = await gatherAttributionEntries({ artifactsDir: scratch.dir, },);

        // Undefined, NOT an empty array. An empty array would read as an entry
        // whose critics raised nothing, which is the exact conflation the
        // eligible population exists to prevent.
        expect(entries[0]?.chunkCritics,).toBeUndefined();
      },
    },),

    it({
      name: 'THROWS on a chunkCritics key that is present but not an array, '
        + 'rather than reading it as an entry that predates attribution. Only '
        + 'absence means legacy; tolerating null or a string here would let '
        + 'corruption quietly shrink the eligible population instead',
      fn: async () => {
        await Promise.all([null, {}, 'corrupt', 7,].map(async function rejectsIt(corrupt,) {
          /**
           * Artifact whose attribution key is present and unusable.
           */
          await using scratch = await writeArtifacts({
            artifacts: { 'whiskers.json': artifactWith({ chunkCritics: corrupt, },), },
          },);

          await expect(gatherAttributionEntries({ artifactsDir: scratch.dir, },),)
            .rejects
            .toThrow('chunkCritics',);
        },),);
      },
    },),

    it({
      name: 'THROWS on a chunk index that is missing, negative or fractional, '
        + 'rather than dropping the record. Dropping does not protect the chunk '
        + 'count, it silently shrinks it, and a smaller denominator raises every '
        + 'rate above it while looking entirely ordinary',
      fn: async () => {
        await Promise.all(['one', -1, 1.5, undefined,].map(async function rejectsIt(chunkIndex,) {
          /**
           * Artifact carrying one unusable chunk index.
           */
          await using scratch = await writeArtifacts({
            artifacts: {
              'whiskers.json': artifactWith({
                chunkCritics: [{
                  chunkIndex,
                  heardCriticIds: [TABBY,],
                  claimAttributions: [],
                },],
              },),
            },
          },);

          await expect(gatherAttributionEntries({ artifactsDir: scratch.dir, },),)
            .rejects
            .toThrow('chunkIndex',);
        },),);
      },
    },),

    it({
      name: 'THROWS on repeated heard critics, repeated chunk indices and '
        + 'repeated proposers, each of which is a SET written as an array and '
        + 'each of which would inflate a count silently: a critic heard twice '
        + 'on one chunk doubles its own denominator',
      fn: async () => {
        /**
         * One chunk naming the same critic twice as having answered.
         */
        await using heard = await writeArtifacts({
          artifacts: {
            'a.json': artifactWith({
              chunkCritics: [{
                chunkIndex: 0,
                heardCriticIds: [TABBY, TABBY,],
                claimAttributions: [],
              },],
            },),
          },
        },);
        await expect(gatherAttributionEntries({ artifactsDir: heard.dir, },),)
          .rejects
          .toThrow('distinct',);

        /**
         * Two records claiming to describe the same chunk.
         */
        await using chunks = await writeArtifacts({
          artifacts: {
            'b.json': artifactWith({
              chunkCritics: [
                { chunkIndex: 0, heardCriticIds: [TABBY,], claimAttributions: [], },
                { chunkIndex: 0, heardCriticIds: [TABBY,], claimAttributions: [], },
              ],
            },),
          },
        },);
        await expect(gatherAttributionEntries({ artifactsDir: chunks.dir, },),)
          .rejects
          .toThrow('one record per chunk',);

        /**
         * One claim crediting the same critic twice.
         */
        await using proposers = await writeArtifacts({
          artifacts: {
            'c.json': artifactWith({
              chunkCritics: [{
                chunkIndex: 0,
                heardCriticIds: [TABBY,],
                claimAttributions: [{
                  claimId: NAP,
                  proposers: [
                    { modelId: TABBY, emissionCount: 1, },
                    { modelId: TABBY, emissionCount: 1, },
                  ],
                },],
              },],
            },),
          },
        },);
        await expect(gatherAttributionEntries({ artifactsDir: proposers.dir, },),)
          .rejects
          .toThrow('one entry per critic',);
      },
    },),

    it({
      name: 'THROWS on an emission count below one, since a proposer that '
        + 'emitted a claim zero times did not propose it and crediting one '
        + 'would manufacture support from a critic that stayed silent',
      fn: async () => {
        /**
         * Proposer credited with no emissions at all.
         */
        await using scratch = await writeArtifacts({
          artifacts: {
            'whiskers.json': artifactWith({
              chunkCritics: [{
                chunkIndex: 0,
                heardCriticIds: [TABBY,],
                claimAttributions: [{
                  claimId: NAP,
                  proposers: [{ modelId: TABBY, emissionCount: 0, },],
                },],
              },],
            },),
          },
        },);

        await expect(gatherAttributionEntries({ artifactsDir: scratch.dir, },),)
          .rejects
          .toThrow('emissionCount',);
      },
    },),
  ],
},);
