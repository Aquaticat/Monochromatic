/**
 * Tests for aggregating shadow-mode probe readings across a run, where the two
 * joins that are easy to get silently wrong live.
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
  corroboratedCount,
  type IssueProbeReading,
  judgeRegionProbe,
  type RegionDefectTally,
  summarizeProbeTelemetry,
} from '../dist/final/node/index.mjs';

/**
 * Builds one region tally with the counts under test and zeros elsewhere.
 *
 * @param envelopeId - envelope the region replaced
 *
 * @param corroborated - upheld claims of added damage
 *
 * @param removalCorroborated - upheld claims of dropped content
 *
 * @param contradicted - claims the screen refuted
 *
 * @returns Tally the summary reads
 *
 * @example
 * ```ts
 * const tally = catTally({ envelopeId: 'envelope/nap', corroborated: 2, },);
 * ```
 */
function catTally(
  {
    envelopeId,
    corroborated = 0,
    removalCorroborated = 0,
    contradicted = 0,
  }: {
    readonly envelopeId: string;
    readonly corroborated?: number;
    readonly removalCorroborated?: number;
    readonly contradicted?: number;
  },
): RegionDefectTally {
  return {
    envelopeId,
    issueIds: ['adjudicated/nap',],
    corroborated,
    removalCorroborated,
    contradicted,
    unanchored: 0,
    noneFound: 0,
    uncertain: 0,
    claims: [],
  };
}

await describe({
  name: judgeRegionProbe.name,
  children: [
    it({
      name: 'measures the majority against the CONFIGURED roster, never the '
        + 'heard one, so two probers can never speak for six',
      fn: async () => {
        /** Two upheld claims where six probers were asked. */
        const tally = catTally({
          envelopeId: 'envelope/nap',
          corroborated: 2,
        },);
        expect(
          judgeRegionProbe({
            tally,
            configuredProbers: 6,
          },),
        ).toBe('minority-introduced',);
        expect(
          judgeRegionProbe({
            tally,
            configuredProbers: 3,
          },),
        ).toBe('majority-introduced',);
      },
    },),

    it({
      name: 'counts dropped-content claims toward the same majority as added '
        + 'damage, since both are damage the edit caused',
      fn: async () => {
        expect(
          judgeRegionProbe({
            tally: catTally({
              envelopeId: 'envelope/nap',
              corroborated: 1,
              removalCorroborated: 1,
            },),
            configuredProbers: 3,
          },),
        ).toBe('majority-introduced',);
      },
    },),

    it({
      name: 'ignores contradicted claims entirely, because a claim the '
        + 'differential refuted is not weak evidence of damage but none',
      fn: async () => {
        expect(
          judgeRegionProbe({
            tally: catTally({
              envelopeId: 'envelope/nap',
              contradicted: 3,
            },),
            configuredProbers: 3,
          },),
        ).toBe('none-introduced',);
      },
    },),
  ],
},);

await describe({
  name: summarizeProbeTelemetry.name,
  children: [
    it({
      name: 'counts one region once however many issues its merged envelope '
        + 'served, since every issue of that envelope carries the same tally '
        + 'and summing over issues would overweight the widest edits',
      fn: async () => {
        /** Tally two issue records both carry, being one shared envelope. */
        const shared = catTally({
          envelopeId: 'envelope/shared',
          corroborated: 3,
        },);

        /** Two records of the same envelope, as buildIssueRecords emits them. */
        const readings: readonly IssueProbeReading[] = [
          {
            heardProbers: 3,
            configuredProbers: 3,
            regions: [shared,],
          },
          {
            heardProbers: 3,
            configuredProbers: 3,
            regions: [shared,],
          },
        ];

        const summary = summarizeProbeTelemetry({ readings, },);
        expect(summary.regions,).toBe(1,);
        expect(summary.majorityIntroduced,).toBe(1,);
        // Summed over DISTINCT regions, so the shared envelope's three claims
        // are counted once rather than once per issue it served.
        expect(summary.corroborated,).toBe(3,);
      },
    },),

    it({
      name: 'separates majority from minority findings, which is the split '
        + 'between what a gate would have blocked and what it would not',
      fn: async () => {
        const summary = summarizeProbeTelemetry({
          readings: [
            {
              heardProbers: 3,
              configuredProbers: 3,
              regions: [
                catTally({
                  envelopeId: 'envelope/one',
                  corroborated: 3,
                },),
                catTally({
                  envelopeId: 'envelope/two',
                  corroborated: 1,
                },),
                catTally({ envelopeId: 'envelope/three', },),
              ],
            },
          ],
        },);
        expect(summary.regions,).toBe(3,);
        expect(summary.majorityIntroduced,).toBe(1,);
        expect(summary.minorityIntroduced,).toBe(1,);
        expect(summary.noneIntroduced,).toBe(1,);
      },
    },),

    it({
      name: 'flags regions whose roster came up short, where an absent verdict '
        + 'is silence rather than a clean bill',
      fn: async () => {
        const summary = summarizeProbeTelemetry({
          readings: [
            {
              heardProbers: 2,
              configuredProbers: 3,
              regions: [catTally({ envelopeId: 'envelope/short', },),],
            },
            {
              heardProbers: 3,
              configuredProbers: 3,
              regions: [catTally({ envelopeId: 'envelope/whole', },),],
            },
          ],
        },);
        expect(summary.degradedRosterRegions,).toBe(1,);
      },
    },),

    it({
      name: 'summarizes an empty run without inventing a region, so a pass '
        + 'that repaired nothing reads as no evidence rather than clean',
      fn: async () => {
        const summary = summarizeProbeTelemetry({ readings: [], },);
        expect(summary.regions,).toBe(0,);
        expect(summary.majorityIntroduced,).toBe(0,);
        expect(summary.noneIntroduced,).toBe(0,);
      },
    },),
  ],
},);

await describe({
  name: corroboratedCount.name,
  children: [
    it({
      name: 'sums BOTH directions, because the differential upholds a claim '
        + 'either by finding wording the edit added or by finding wording it '
        + 'dropped, and counting only the added direction was the original '
        + 'defect: an omission claim could never corroborate at all',
      fn: async () => {
        expect(
          corroboratedCount({
            tally: catTally({
              envelopeId: 'envelope/nap',
              corroborated: 2,
              removalCorroborated: 3,
            },),
          },),
        ).toBe(5,);
      },
    },),

    it({
      name: 'counts a purely dropped-wording region, the case a forward-only '
        + 'screen would have reported as finding nothing',
      fn: async () => {
        expect(
          corroboratedCount({
            tally: catTally({
              envelopeId: 'envelope/nap',
              removalCorroborated: 2,
            },),
          },),
        ).toBe(2,);
      },
    },),

    it({
      name: 'IGNORES contradicted claims, so a region whose probers were all '
        + 'refuted by the differential reads as nothing upheld rather than as '
        + 'damage found',
      fn: async () => {
        expect(
          corroboratedCount({
            tally: catTally({
              envelopeId: 'envelope/nap',
              contradicted: 4,
            },),
          },),
        ).toBe(0,);
      },
    },),

    it({
      name: 'counts zero for a clean region, which is the reading a whole '
        + 'quiet round produces and must not be confused with a broken probe',
      fn: async () => {
        expect(
          corroboratedCount({ tally: catTally({ envelopeId: 'envelope/nap', },), },),
        ).toBe(0,);
      },
    },),
  ],
},);
