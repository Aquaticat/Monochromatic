/**
 * Tests for the draw manifest, the only record of which issue sat at which
 * sheet position.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  ArtifactParseError,
  buildSampleManifest,
  type GradingCandidate,
  parseSampleManifest,
} from '../dist/final/node/index.mjs';

/**
 * Builds one drawn candidate carrying only what the manifest reads.
 *
 * @param issueId - adjudicated identity
 *
 * @param entryId - corpus entry it came from
 *
 * @returns Candidate the manifest records
 *
 * @example
 * ```ts
 * const candidate = catCandidate({ issueId: 'adjudicated/nap', },);
 * ```
 */
function catCandidate(
  {
    issueId,
    entryId = 'Kitten',
  }: {
    readonly issueId: string;
    readonly entryId?: string;
  },
): GradingCandidate {
  return {
    entryId,
    band: 'small',
    issueId,
    category: 'fluency/grammar',
    severity: 'major',
    summary: 'the tense is wrong',
    sourceAnchor: 'quoted',
    sourceQuotes: [],
    targetQuotes: [],
  };
}

await describe({
  name: buildSampleManifest.name,
  children: [
    it({
      name: 'numbers items from one in draw order, matching how both sheets '
        + 'render them, since the position IS the join key a grader returns',
      fn: async () => {
        const manifest = buildSampleManifest({
          sample: [
            catCandidate({ issueId: 'adjudicated/nap', },),
            catCandidate({
              issueId: 'adjudicated/chase',
              entryId: 'Mittens',
            },),
          ],
          seed: 'cat-seed',
          corpusSha: 'sha/1',
        },);
        expect(manifest.items,).toHaveLength(2,);
        expect(manifest.items[0]?.position,).toBe(1,);
        expect(manifest.items[0]?.issueId,).toBe('adjudicated/nap',);
        expect(manifest.items[1]?.position,).toBe(2,);
        expect(manifest.items[1]?.entryId,).toBe('Mittens',);
      },
    },),

    it({
      name: 'records the seed and corpus commit, so a manifest cannot be '
        + 'silently paired with another draw\'s sheets',
      fn: async () => {
        const manifest = buildSampleManifest({
          sample: [],
          seed: 'cat-seed',
          corpusSha: 'sha/1',
        },);
        expect(manifest.seed,).toBe('cat-seed',);
        expect(manifest.corpusSha,).toBe('sha/1',);
      },
    },),
  ],
},);

await describe({
  name: parseSampleManifest.name,
  children: [
    it({
      name: 'round-trips what the draw wrote, which is the only property the '
        + 'join depends on',
      fn: async () => {
        /** Manifest as the draw builds it. */
        const built = buildSampleManifest({
          sample: [catCandidate({ issueId: 'adjudicated/nap', },),],
          seed: 'cat-seed',
          corpusSha: 'sha/1',
        },);

        /**
         * Manifest text exactly as the draw writes it beside the sheets.
         *
         * Serialized and re-read rather than cloned, for the same reason the
         * provenance suite is: the file is the boundary under test, and a deep
         * clone would keep what a file drops.
         */
        const onDisk = JSON.stringify(built,);

        expect(
          parseSampleManifest({ value: JSON.parse(onDisk,), },),
        ).toEqual(built,);
      },
    },),

    it({
      name: 'throws rather than skipping a malformed item, because dropping '
        + 'one shifts every later position and turns the join into a '
        + 'mislabelling instead of a gap anyone would notice',
      fn: async () => {
        expect(function readsMalformed() {
          parseSampleManifest({
            value: {
              seed: 'cat-seed',
              corpusSha: 'sha/1',
              items: [
                {
                  position: 1,
                  entryId: 'Kitten',
                  issueId: 'adjudicated/nap',
                },
                {
                  position: 2,
                  entryId: 'Kitten',
                },
              ],
            },
          },);
        },).toThrow(ArtifactParseError,);
      },
    },),

    it({
      name: 'RECOMPUTES the digest from the items rather than trusting the one '
        + 'written beside them. A stored digest that is never checked against '
        + 'its own contents proves only that two files carry the same string, '
        + 'so editing the items and leaving the digest alone would still match '
        + 'a sheet carrying the stale value',
      fn: async () => {
        /** Manifest as the draw builds it. */
        const built = buildSampleManifest({
          sample: [catCandidate({ issueId: 'adjudicated/nap', },),],
          seed: 'cat-seed',
          corpusSha: 'sha/1',
        },);

        expect(function readsTamperedItems() {
          parseSampleManifest({
            value: {
              ...built,
              items: [
                {
                  position: 1,
                  entryId: 'Kitten',
                  issueId: 'adjudicated/chase',
                },
              ],
            },
          },);
        },).toThrow(ArtifactParseError,);
      },
    },),

    it({
      name: 'reads a manifest carrying NO digest, since every draw taken '
        + 'before the binding existed reads that way and a final sheet cannot '
        + 'be redrawn to acquire one',
      fn: async () => {
        expect(
          parseSampleManifest({
            value: {
              seed: 'cat-seed',
              corpusSha: 'sha/1',
              items: [
                {
                  position: 1,
                  entryId: 'Kitten',
                  issueId: 'adjudicated/nap',
                },
              ],
            },
          },).drawDigest,
        ).toBe(undefined,);
      },
    },),

    it({
      name: 'THROWS on a position that disagrees with where its item sits. '
        + 'Both scorers read grades by array order and take the issue id from '
        + 'the same index, so a manifest recording another order describes one '
        + 'join while the code performs a different one',
      fn: async () => {
        expect(function readsShuffledPositions() {
          parseSampleManifest({
            value: {
              seed: 'cat-seed',
              corpusSha: 'sha/1',
              items: [
                {
                  position: 2,
                  entryId: 'Kitten',
                  issueId: 'adjudicated/nap',
                },
                {
                  position: 1,
                  entryId: 'Kitten',
                  issueId: 'adjudicated/chase',
                },
              ],
            },
          },);
        },).toThrow(ArtifactParseError,);
      },
    },),
  ],
},);
