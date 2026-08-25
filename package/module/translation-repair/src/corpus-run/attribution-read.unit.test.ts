/**
 * Tests for the parser that reads attribution out of settled artifacts.
 *
 * These exist because the report's own tests hand `sliceCritics` in by hand, so
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
 * Pipeline commit every fixture artifact carries unless its case sets one.
 *
 * Invented, and shared, so the fixture directory is one generation and the
 * generation guard passes without these parsing cases having to think about it.
 */
const SHARED_TIP = 'f000000000000000000000000000000000000000';

/**
 * Built pipeline every fixture artifact carries unless its case sets one.
 *
 * Shared for the same reason as {@link SHARED_TIP}, and separate from it
 * because this is the field the pool actually partitions by: a commit says
 * where code came from, this says which build ran.
 */
const SHARED_GENERATION = `sha256-tree-v1:${'f'.repeat(64,)}`;

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
    /**
     * Body as written, with a pipeline commit supplied when the case did not
     * name one.
     *
     * Every settled artifact carries `tip` and `pipelineDigest`, and the
     * readers now refuse a pool they cannot partition by the latter. These
     * cases are about PARSING rather than about generations, so they get one
     * shared pair and stay a single-generation pool; a case that wants to
     * exercise the generation guard sets its own. Deliberately not defaulted
     * inside the reader: an artifact recording no pipeline is exactly what
     * must not be quietly accepted.
     */
    const written = (((typeof body) === 'object') && (body !== null))
      ? {
        tip: SHARED_TIP,
        pipelineDigest: SHARED_GENERATION,
        ...body,
      }
      : body;

    await writeFile(
      join(
        dir,
        name,
      ),
      ((typeof written) === 'string') ? written : JSON.stringify(written,),
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
 * @param sliceCritics - calibration to record
 *
 * @returns Artifact body
 *
 * @example
 * ```ts
 * const body = artifactWith({ sliceCritics, },);
 * ```
 */
function artifactWith(
  {
    sliceCritics,
  }: {
    readonly sliceCritics: unknown;
  },
): Record<string, unknown> {
  return {
    // GENERATION 1, stated, because that is the generation that kept these
    // records at the artifact root and spelled the key `chunkCritics`. An
    // unversioned body would read the same way and say less.
    artifactSchemaVersion: 1,
    id: 'Whiskers',
    chunkCritics: sliceCritics,
    issues: [
      {
        sliceIndex: 0,
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
            'Whiskers.json': artifactWith({
              sliceCritics: [{
                sliceIndex: 3,
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
        const { entries, } = await gatherAttributionEntries({ artifactsDir: scratch.dir, },);

        /**
         * Chunk record the artifact carried.
         */
        const record = entries[0]?.sliceCritics?.[0];

        expect(record?.sliceIndex,).toBe(3,);
        expect(record?.heardCriticIds,).toStrictEqual([TABBY,],);
        expect(record?.claimAttributions[0]?.claimId,).toBe(NAP,);
        expect(record?.claimAttributions[0]?.proposers,)
          .toStrictEqual([{ modelId: TABBY, emissionCount: 2, },],);
        expect(entries[0]?.issues,)
          .toStrictEqual([{ status: 'accepted', claimIds: [NAP,], },],);
      },
    },),

    it({
      name: 'treats an ABSENT sliceCritics key as an entry that predates '
        + 'attribution, which is the decision the whole report rests on and the '
        + 'one its own tests cannot reach, since they supply sliceCritics by '
        + 'hand and so make every entry eligible by construction',
      fn: async () => {
        /**
         * Artifact written before attribution existed.
         */
        await using scratch = await writeArtifacts({
          artifacts: { 'Mittens.json': { id: 'Mittens', issues: [], }, },
        },);

        /**
         * Entries as the CLI would gather them.
         */
        const { entries, } = await gatherAttributionEntries({ artifactsDir: scratch.dir, },);

        // Undefined, NOT an empty array. An empty array would read as an entry
        // whose critics raised nothing, which is the exact conflation the
        // eligible population exists to prevent.
        expect(entries[0]?.sliceCritics,).toBeUndefined();
      },
    },),

    it({
      name: 'ISOLATES a failure to the artifact that caused it, so one corrupt '
        + 'or half-written file costs its own row and not the whole run. A pass '
        + 'killed at its hard cap can leave a truncated artifact, and a bare '
        + 'Promise.all over the directory would turn that single file into no '
        + 'calibration at all for every other entry',
      fn: async () => {
        /**
         * One sound artifact beside one truncated mid-write.
         */
        await using scratch = await writeArtifacts({
          artifacts: {
            'Whiskers.json': artifactWith({
              sliceCritics: [{
                sliceIndex: 0,
                heardCriticIds: [TABBY,],
                claimAttributions: [],
              },],
            },),
            'truncated.json': '{"id":"Mittens","chunkCri',
          },
        },);

        /**
         * What the directory yielded.
         */
        const { entries, malformed, } = await gatherAttributionEntries({
          artifactsDir: scratch.dir,
        },);

        // The sound artifact still produces its entry.
        expect(entries,).toHaveLength(1,);
        expect(entries[0]?.id,).toBe('Whiskers',);

        // The broken one is NAMED rather than silently absent, since an
        // artifact missing from both populations changes every count above it.
        expect(malformed,).toHaveLength(1,);
        expect(malformed[0]?.name,).toBe('truncated.json',);
        expect(malformed[0]?.reason.length,).toBeGreaterThan(0,);
      },
    },),

    it({
      name: 'THROWS on a critic key that is present but not an array, '
        + 'rather than reading it as an entry that predates attribution. Only '
        + 'absence means legacy; tolerating null or a string here would let '
        + 'corruption quietly shrink the eligible population instead. The '
        + 'refusal names the key AS THE FILE SPELLS IT, which on this '
        + 'generation 1 fixture is chunkCritics',
      fn: async () => {
        await Promise.all([null, {}, 'corrupt', 7,].map(async function rejectsIt(corrupt,) {
          /**
           * Artifact whose attribution key is present and unusable.
           */
          await using scratch = await writeArtifacts({
            artifacts: { 'Whiskers.json': artifactWith({ sliceCritics: corrupt, },), },
          },);

          expect(
            (await gatherAttributionEntries({ artifactsDir: scratch.dir, },)).malformed[0]
              ?.reason,
          ).toContain('chunkCritics',);
        },),);
      },
    },),

    it({
      name: 'THROWS on a chunk index that is missing, negative or fractional, '
        + 'rather than dropping the record. Dropping does not protect the chunk '
        + 'count, it silently shrinks it, and a smaller denominator raises every '
        + 'rate above it while looking entirely ordinary',
      fn: async () => {
        await Promise.all(['one', -1, 1.5, undefined,].map(async function rejectsIt(sliceIndex,) {
          /**
           * Artifact carrying one unusable chunk index.
           */
          await using scratch = await writeArtifacts({
            artifacts: {
              'Whiskers.json': artifactWith({
                sliceCritics: [{
                  sliceIndex,
                  heardCriticIds: [TABBY,],
                  claimAttributions: [],
                },],
              },),
            },
          },);

          expect(
            (await gatherAttributionEntries({ artifactsDir: scratch.dir, },)).malformed[0]
              ?.reason,
          ).toContain('sliceIndex',);
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
            'Whiskers.json': artifactWith({
              sliceCritics: [{
                sliceIndex: 0,
                heardCriticIds: [TABBY, TABBY,],
                claimAttributions: [],
              },],
            },),
          },
        },);
        expect(
            (await gatherAttributionEntries({ artifactsDir: heard.dir, },)).malformed[0]
              ?.reason,
          ).toContain('distinct',);

        /**
         * Two records claiming to describe the same chunk.
         */
        await using chunks = await writeArtifacts({
          artifacts: {
            'Whiskers.json': artifactWith({
              sliceCritics: [
                { sliceIndex: 0, heardCriticIds: [TABBY,], claimAttributions: [], },
                { sliceIndex: 0, heardCriticIds: [TABBY,], claimAttributions: [], },
              ],
            },),
          },
        },);
        expect(
            (await gatherAttributionEntries({ artifactsDir: chunks.dir, },)).malformed[0]
              ?.reason,
          ).toContain('one record per chunk',);

        /**
         * One claim crediting the same critic twice.
         */
        await using proposers = await writeArtifacts({
          artifacts: {
            'Whiskers.json': artifactWith({
              sliceCritics: [{
                sliceIndex: 0,
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
        expect(
            (await gatherAttributionEntries({ artifactsDir: proposers.dir, },)).malformed[0]
              ?.reason,
          ).toContain('one entry per critic',);
      },
    },),

    it({
      name: 'THROWS on a chunk crediting the SAME CLAIM twice, which is the '
        + 'fourth set written as an array here and the one the case beside this '
        + 'one misses: the writer keys attributions by claim id, so a repeat '
        + 'counts one claim as two and lifts every per-claim rate on its own',
      fn: async () => {
        /**
         * One chunk carrying the same claim id under two attributions.
         */
        await using claims = await writeArtifacts({
          artifacts: {
            'Whiskers.json': artifactWith({
              sliceCritics: [{
                sliceIndex: 0,
                heardCriticIds: [TABBY,],
                claimAttributions: [
                  { claimId: NAP, proposers: [{ modelId: TABBY, emissionCount: 1, },], },
                  { claimId: NAP, proposers: [{ modelId: TABBY, emissionCount: 1, },], },
                ],
              },],
            },),
          },
        },);
        expect(
            (await gatherAttributionEntries({ artifactsDir: claims.dir, },)).malformed[0]
              ?.reason,
          ).toContain('one entry per claim',);
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
            'Whiskers.json': artifactWith({
              sliceCritics: [{
                sliceIndex: 0,
                heardCriticIds: [TABBY,],
                claimAttributions: [{
                  claimId: NAP,
                  proposers: [{ modelId: TABBY, emissionCount: 0, },],
                },],
              },],
            },),
          },
        },);

        expect(
            (await gatherAttributionEntries({ artifactsDir: scratch.dir, },)).malformed[0]
              ?.reason,
          ).toContain('emissionCount',);
      },
    },),
    it({
      name: 'READS THE REPAIR LANE, where version 2 keeps these records, rather than the artifact '
        + 'root where version 1 kept them. This is the case every other fixture here could not '
        + 'reach: all of them are version-1-shaped, so all of them passed while the reader was '
        + 'blind to every artifact the current pipeline writes. Measured over the settled '
        + 'population before this held, 0 of 47 artifacts carried sliceCritics at the root and 47 '
        + 'of 47 carried it in the lane, so every one was filed as PREDATING attribution, which is '
        + 'the one wrong answer here that reads like an ordinary census of an older corpus. '
        + 'DECOYS sit at the root, deliberately different from the lane records, so a reader still '
        + 'asking the root is caught rather than agreeing by coincidence',
      fn: async () => {
        /**
         * Two-lane artifact of the generation the pass writes, with a decoy
         * planted at the root where generation 1 kept these records.
         */
        await using scratch = await writeArtifacts({
          artifacts: {
            'Whiskers.json': {
              artifactSchemaVersion: 3,
              id: 'Whiskers',
              sliceCritics: [{
                sliceIndex: 9,
                heardCriticIds: [TABBY,],
                claimAttributions: [{
                  claimId: 'decoy-must-not-be-read',
                  proposers: [{ modelId: TABBY, emissionCount: 7, },],
                },],
              },],
              issues: [],
              lanes: {
                repair: {
                  result: {
                    sliceCritics: [{
                      sliceIndex: 3,
                      heardCriticIds: [TABBY,],
                      claimAttributions: [{
                        claimId: NAP,
                        proposers: [{ modelId: TABBY, emissionCount: 2, },],
                      },],
                    },],
                    issues: [
                      {
                        sliceIndex: 0,
                        issue: {
                          status: 'accepted',
                          claims: [{ claimId: NAP, },],
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },);

        /**
         * Entries as the CLI would gather them.
         */
        const { entries, } = await gatherAttributionEntries({ artifactsDir: scratch.dir, },);

        // ELIGIBLE, which is the half that decides the population. Reading the
        // root left this undefined and moved the entry into the pre-feature
        // bucket without anything reporting that it had happened.
        expect(entries[0]?.sliceCritics,).toBeDefined();

        /**
         * Chunk record the repair lane carried.
         */
        const record = entries[0]?.sliceCritics?.[0];

        expect(record?.sliceIndex,).toBe(3,);
        expect(record?.claimAttributions[0]?.claimId,).toBe(NAP,);
        expect(entries[0]?.issues,)
          .toStrictEqual([{ status: 'accepted', claimIds: [NAP,], },],);
      },
    },),

    it({
      name: 'READS A GENERATION 2 LANE, which spells the same records chunkCritics, and lands them in '
        + 'the same place as its generation 3 twin. Without this the rename reads as a clean cut and '
        + 'is not: 48 settled artifacts carry the older spelling, and a reader that stopped '
        + 'understanding them would report every one as an entry that predates attribution',
      fn: async () => {
        /**
         * Two-lane artifact of the generation before the rename, spelled the
         * way that generation spelled it.
         */
        await using scratch = await writeArtifacts({
          artifacts: {
            'Whiskers.json': {
              artifactSchemaVersion: 2,
              id: 'Whiskers',
              issues: [],
              lanes: {
                repair: {
                  result: {
                    chunkCritics: [{
                      sliceIndex: 3,
                      heardCriticIds: [TABBY,],
                      claimAttributions: [{
                        claimId: NAP,
                        proposers: [{ modelId: TABBY, emissionCount: 2, },],
                      },],
                    },],
                    issues: [
                      {
                        sliceIndex: 0,
                        issue: {
                          status: 'accepted',
                          claims: [{ claimId: NAP, },],
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },);

        /**
         * Entries as the CLI would gather them.
         */
        const { entries, } = await gatherAttributionEntries({ artifactsDir: scratch.dir, },);

        expect(entries[0]?.sliceCritics,).toBeDefined();

        /**
         * Chunk record the repair lane carried, under the older spelling.
         */
        const record = entries[0]?.sliceCritics?.[0];

        expect(record?.sliceIndex,).toBe(3,);
        expect(record?.claimAttributions[0]?.claimId,).toBe(NAP,);
        expect(entries[0]?.issues,)
          .toStrictEqual([{ status: 'accepted', claimIds: [NAP,], },],);
      },
    },),
  ],
},);
