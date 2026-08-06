/**
 * Tests for flattening slice outcomes into the whole-document issue report,
 * and for the disposition that says what became of each issue's repair.
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
  type AdjudicatedIssue,
  buildIssueRecords,
  type ChunkRepairOutcome,
  type RepairRegion,
} from '../dist/final/neutral/index.mjs';

/**
 * Repaired slice text, used as the final wording when refinement fired.
 */
const REFINED_TEXT = 'The cat naps in the sun and chases butterflies.';

/**
 * Builds one accepted issue with no claims, since nothing under test reads
 * them.
 *
 * @param issueId - adjudicated identity
 *
 * @returns Issue the report carries
 *
 * @example
 * ```ts
 * const issue = catIssue({ issueId: 'adjudicated/nap', },);
 * ```
 */
function catIssue({ issueId, }: { readonly issueId: string; },): AdjudicatedIssue {
  return {
    issueId,
    status: 'accepted' as const,
    severity: 'major' as const,
    claims: [],
    tallies: {},
  };
}

/**
 * Builds one region serving the given issues.
 *
 * @param issueIds - accepted issues the envelope was cut for
 *
 * @returns Region the report filters by issue
 *
 * @example
 * ```ts
 * const region = catRegion({ issueIds: ['adjudicated/nap',], },);
 * ```
 */
function catRegion(
  { issueIds, }: { readonly issueIds: readonly string[]; },
): RepairRegion {
  return {
    envelopeId: `envelope/${issueIds.join('-',)}`,
    issueIds,
    before: 'The cat is doing the sleeping.',
    editorAfter: 'The cat is asleep.',
  };
}

/**
 * Builds one settled slice outcome.
 *
 * @param issues - adjudicated issues of this slice
 *
 * @param repairRegions - regions the accuracy stage replaced
 *
 * @param accuracyPatchSelected - whether the patched candidate won its slice
 *
 * @param resolvedIssueIds - issues the checkers confirmed fixed
 *
 * @param refined - whether the naturalness lane rewrote this slice
 *
 * @returns Outcome the builder flattens
 *
 * @example
 * ```ts
 * const outcome = catOutcome({ issues: [], repairRegions: [], },);
 * ```
 */
function catOutcome(
  {
    issues,
    repairRegions,
    accuracyPatchSelected = true,
    resolvedIssueIds = [],
    refined = false,
  }: {
    readonly issues: readonly AdjudicatedIssue[];
    readonly repairRegions: readonly RepairRegion[];
    readonly accuracyPatchSelected?: boolean;
    readonly resolvedIssueIds?: readonly string[];
    readonly refined?: boolean;
  },
): ChunkRepairOutcome {
  return {
    chunkIndex: 3,
    repairedText: REFINED_TEXT,
    changed: accuracyPatchSelected || refined,
    issues,
    resolvedIssueIds,
    repairRegions,
    accuracyPatchSelected,
    refined,
    nonTranslationVotes: 0,
    nonTranslationContradicted: false,
    nonTranslationStanding: false,
    heardCritics: 7,
    findings: [],
  };
}

await describe({
  name: buildIssueRecords.name,
  children: [
    it({
      name: 'reports a shipped repair, keeping only the regions serving this '
        + 'issue and carrying the chunk it came from',
      fn: async () => {
        const records = buildIssueRecords({
          outcomes: [
            catOutcome({
              issues: [
                catIssue({ issueId: 'adjudicated/nap', },),
                catIssue({ issueId: 'adjudicated/chase', },),
              ],
              repairRegions: [catRegion({ issueIds: ['adjudicated/nap',], },),],
              resolvedIssueIds: ['adjudicated/nap',],
            },),
          ],
          blocked: false,
        },);
        expect(records,).toHaveLength(2,);
        expect(records[0]?.repairDisposition,).toBe('shipped',);
        expect(records[0]?.repairRegions,).toHaveLength(1,);
        expect(records[0]?.resolved,).toBe(true,);
        expect(records[0]?.chunkIndex,).toBe(3,);
        // The second issue shares the slice but not the envelope, so it has no
        // repair of its own even though the slice was repaired.
        expect(records[1]?.repairDisposition,).toBe('no-region',);
        expect(records[1]?.repairRegions,).toHaveLength(0,);
      },
    },),

    it({
      name: 'separates a repair that lost its slice selection from one that '
        + 'was never written, since only the first indicts the stage',
      fn: async () => {
        const records = buildIssueRecords({
          outcomes: [
            catOutcome({
              issues: [catIssue({ issueId: 'adjudicated/nap', },),],
              repairRegions: [catRegion({ issueIds: ['adjudicated/nap',], },),],
              accuracyPatchSelected: false,
            },),
          ],
          blocked: false,
        },);
        expect(records[0]?.repairDisposition,).toBe('not-selected',);
        // The attempt survives even though it never shipped, which is the
        // whole reason regions are recorded regardless of selection.
        expect(records[0]?.repairRegions[0]?.editorAfter,)
          .toBe('The cat is asleep.',);
      },
    },),

    it({
      name: 'withdraws every slice repair when the document was blocked, '
        + 'because a blocked run returns its input whatever each slice decided',
      fn: async () => {
        const records = buildIssueRecords({
          outcomes: [
            catOutcome({
              issues: [catIssue({ issueId: 'adjudicated/nap', },),],
              repairRegions: [catRegion({ issueIds: ['adjudicated/nap',], },),],
              resolvedIssueIds: ['adjudicated/nap',],
            },),
          ],
          blocked: true,
        },);
        expect(records[0]?.repairDisposition,).toBe('withdrawn',);
        // Checkers confirmed it against a candidate nobody ever read.
        expect(records[0]?.resolved,).toBe(false,);
      },
    },),

    it({
      name: 'carries the final slice text exactly when refinement made the '
        + 'recorded replacement stale, and never otherwise',
      fn: async () => {
        const refined = buildIssueRecords({
          outcomes: [
            catOutcome({
              issues: [catIssue({ issueId: 'adjudicated/nap', },),],
              repairRegions: [catRegion({ issueIds: ['adjudicated/nap',], },),],
              refined: true,
            },),
          ],
          blocked: false,
        },);
        expect(refined[0]?.refined,).toBe(true,);
        expect(refined[0]?.finalSliceText,).toBe(REFINED_TEXT,);

        /** Same slice with the naturalness lane leaving it alone. */
        const untouched = buildIssueRecords({
          outcomes: [
            catOutcome({
              issues: [catIssue({ issueId: 'adjudicated/nap', },),],
              repairRegions: [catRegion({ issueIds: ['adjudicated/nap',], },),],
            },),
          ],
          blocked: false,
        },);
        expect(untouched[0]?.refined,).toBe(false,);
        expect(untouched[0]?.finalSliceText,).toBeUndefined();
      },
    },),

    it({
      name: 'gives every issue of a shared envelope the same region, each '
        + 'still naming the others',
      fn: async () => {
        const records = buildIssueRecords({
          outcomes: [
            catOutcome({
              issues: [
                catIssue({ issueId: 'adjudicated/nap', },),
                catIssue({ issueId: 'adjudicated/chase', },),
              ],
              repairRegions: [
                catRegion({
                  issueIds: [
                    'adjudicated/nap',
                    'adjudicated/chase',
                  ],
                },),
              ],
            },),
          ],
          blocked: false,
        },);
        expect(records[0]?.repairRegions,).toHaveLength(1,);
        expect(records[1]?.repairRegions,).toHaveLength(1,);
        expect(records[1]?.repairRegions[0]?.issueIds,).toEqual([
          'adjudicated/nap',
          'adjudicated/chase',
        ],);
      },
    },),
  ],
},);
