/**
 * Tests for the map that joins a graded sheet position to a probe verdict.
 *
 * This is the join the gate's probe comparison rests on: sheet position to
 * issue id through the manifest, then issue id to reading here. A wrong answer
 * does not fail, it mislabels, and every count downstream still looks ordinary.
 *
 * The defect this pins was live. The map used to be built from each reading's
 * `regions[].issueIds`, which names every issue a region serves, and one
 * replacement can serve several accepted issues. A shared envelope therefore
 * appeared in the readings of every record it served, and the last one indexed
 * won. Ownership now comes from the record itself.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { indexReadingsByIssue, } from '../../dist/final/node/index.mjs';

/**
 * Builds a region tally naming the issues it serves.
 *
 * @param envelopeId - envelope the region replaced
 *
 * @param issueIds - every issue this one region serves
 *
 * @returns Tally shaped as a reading carries it
 *
 * @example
 * ```ts
 * const tally = catTally({ envelopeId: 'envelope/nap', issueIds: [], },);
 * ```
 */
function catTally(
  {
    envelopeId,
    issueIds,
  }: {
    readonly envelopeId: string;
    readonly issueIds: readonly string[];
  },
) {
  return {
    envelopeId,
    issueIds,
    corroborated: 0,
    removalCorroborated: 0,
    contradicted: 0,
    unanchored: 0,
    noneFound: 3,
    uncertain: 0,
    claims: [],
  };
}

/**
 * Builds a probe reading over the given regions.
 *
 * @param regions - screened tallies for the regions serving this issue
 *
 * @returns Reading shaped as a record carries it
 *
 * @example
 * ```ts
 * const reading = catReading({ regions: [], },);
 * ```
 */
function catReading(
  { regions, }: { readonly regions: readonly ReturnType<typeof catTally>[]; },
) {
  return {
    heardProbers: 3,
    configuredProbers: 3,
    regions,
  };
}

await describe({
  name: indexReadingsByIssue.name,
  children: [
    it({
      name: 'maps each issue to the reading its OWN record carried, even when '
        + 'one shared envelope serves both issues and names both. This is the '
        + 'ordinary case rather than a rare collision, because envelopes merge '
        + 'overlapping evidence, and reading ownership off the region lists '
        + 'would hand one issue the other record\'s verdict',
      fn: async () => {
        /**
         * Envelope serving both issues, as a merged replacement does.
         */
        const shared = catTally({
          envelopeId: 'envelope/shared',
          issueIds: [
            'adjudicated/nap',
            'adjudicated/chase',
          ],
        },);
        /**
         * Reading of the record about the napping issue.
         */
        const napReading = catReading({ regions: [shared,], },);
        /**
         * Reading of the record about the chasing issue, distinguishable by an
         * extra region so the two are not interchangeable.
         */
        const chaseReading = catReading({
          regions: [
            shared,
            catTally({
              envelopeId: 'envelope/chase',
              issueIds: ['adjudicated/chase',],
            },),
          ],
        },);

        /**
         * Join built from records rather than from region lists.
         */
        const byIssueId = indexReadingsByIssue({
          owned: [
            {
              issueId: 'adjudicated/nap',
              reading: napReading,
            },
            {
              issueId: 'adjudicated/chase',
              reading: chaseReading,
            },
          ],
        },);

        expect(byIssueId.get('adjudicated/nap',),).toBe(napReading,);
        expect(byIssueId.get('adjudicated/chase',),).toBe(chaseReading,);
        expect(byIssueId.size,).toBe(2,);
      },
    },),

    it({
      name: 'THROWS when two records claim one issue id, rather than keeping '
        + 'the last. The id is the identity the whole join rests on, so a '
        + 'duplicate means a sheet position could carry another record\'s '
        + 'verdict, and silently overwriting is exactly the failure that '
        + 'produces confident wrong numbers',
      fn: async () => {
        expect(function indexesDuplicate() {
          indexReadingsByIssue({
            owned: [
              {
                issueId: 'adjudicated/nap',
                reading: catReading({ regions: [], },),
              },
              {
                issueId: 'adjudicated/nap',
                reading: catReading({
                  regions: [
                    catTally({
                      envelopeId: 'envelope/other',
                      issueIds: ['adjudicated/nap',],
                    },),
                  ],
                },),
              },
            ],
          },);
        },).toThrow('adjudicated/nap',);
      },
    },),

    it({
      name: 'accepts the SAME reading offered twice for one issue without '
        + 'throwing, since that is repetition rather than conflict and '
        + 'refusing it would turn a harmless duplicate into a failed run',
      fn: async () => {
        /**
         * One reading offered under the same id twice.
         */
        const reading = catReading({ regions: [], },);

        /**
         * Join over the repeated pair.
         */
        const byIssueId = indexReadingsByIssue({
          owned: [
            {
              issueId: 'adjudicated/nap',
              reading,
            },
            {
              issueId: 'adjudicated/nap',
              reading,
            },
          ],
        },);

        expect(byIssueId.size,).toBe(1,);
        expect(byIssueId.get('adjudicated/nap',),).toBe(reading,);
      },
    },),

    it({
      name: 'returns an empty map for no readings, which is what a run whose '
        + 'probe never fired looks like and is not a fault',
      fn: async () => {
        expect(indexReadingsByIssue({ owned: [], },).size,).toBe(0,);
      },
    },),
  ],
},);
