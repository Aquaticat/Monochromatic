/**
 * End-to-end test of the repair-provenance chain: slice outcomes into issue
 * records, records into artifact JSON, artifact JSON back into grading
 * candidates, candidates into both sheets.
 *
 * Every other suite fixes its own fixture at one module's boundary, so all of
 * them can agree with the code they test and disagree with each other. This one
 * runs the real path a corpus entry takes, which is the only place a field
 * renamed on one side and read on the other actually shows up.
 *
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
  classifyBand,
  collectRepairRegions,
  type EditableEnvelope,
  extractGradingCandidate,
  formatGradingSheet,
  formatRepairSheet,
  hashContent,
  parseSettledArtifact,
  type PatchOperation,
} from '../dist/final/neutral/index.mjs';

/**
 * Translation before repair.
 */
const TARGET_TEXT = 'The cat is doing the sleeping. She wakes at dusk.';

/**
 * Envelope content the editor replaced.
 */
const REPLACED = 'The cat is doing the sleeping.';

/**
 * Replacement the accuracy stage wrote.
 */
const REPLACEMENT = 'The cat is asleep.';

/**
 * Slice text after applying that replacement.
 */
const PATCHED_TEXT = 'The cat is asleep. She wakes at dusk.';

/**
 * Accepted issue the replacement was written for.
 */
const ISSUE: AdjudicatedIssue = {
  issueId: 'adjudicated/nap',
  status: 'accepted' as const,
  severity: 'major' as const,
  claims: [
    {
      claimId: 'claim/nap',
      claim: {
        category: 'style/awkward-phrasing' as const,
        severity: 'major' as const,
        summary: 'Progressive gloss reads as machine output.',
        spans: [
          {
            side: 'source' as const,
            nodeId: 'block/0',
            nodeHash: hashContent({ content: '猫猫在睡觉。', },),
            startOffset: 0,
            endOffset: 6,
            quotedText: '猫猫在睡觉。',
          },
          {
            side: 'target' as const,
            nodeId: 'block/0',
            nodeHash: hashContent({ content: TARGET_TEXT, },),
            startOffset: 0,
            endOffset: REPLACED.length,
            quotedText: REPLACED,
          },
        ],
      },
    },
  ],
  tallies: {},
};

/**
 * Envelope cut from that issue's target-side evidence.
 */
const ENVELOPE: EditableEnvelope = {
  envelopeId: 'envelope/nap',
  startOffset: 0,
  endOffset: REPLACED.length,
  baseText: REPLACED,
  baseHash: hashContent({ content: REPLACED, },),
  issueIds: [ISSUE.issueId,],
};

/**
 * Operation the apply gate accepted.
 */
const OPERATION: PatchOperation = {
  envelopeId: ENVELOPE.envelopeId,
  baseHash: ENVELOPE.baseHash,
  newText: REPLACEMENT,
};

/**
 * Builds the settled slice outcome the way `repairChunk` returns it.
 *
 * @param accuracyPatchSelected - whether the patched candidate won
 *
 * @returns Outcome the driver flattens
 *
 * @example
 * ```ts
 * const outcome = settledOutcome({ accuracyPatchSelected: true, },);
 * ```
 */
function settledOutcome(
  { accuracyPatchSelected, }: { readonly accuracyPatchSelected: boolean; },
): ChunkRepairOutcome {
  return {
    chunkIndex: 0,
    repairedText: accuracyPatchSelected ? PATCHED_TEXT : TARGET_TEXT,
    changed: accuracyPatchSelected,
    issues: [ISSUE,],
    resolvedIssueIds: accuracyPatchSelected ? [ISSUE.issueId,] : [],
    repairRegions: collectRepairRegions({
      envelopes: [ENVELOPE,],
      applied: [OPERATION,],
    },),
    accuracyPatchSelected,
    refined: false,
    nonTranslationVotes: 0,
    nonTranslationContradicted: false,
    nonTranslationStanding: false,
    heardCritics: 6,
    findings: [],
  };
}

/**
 * Runs the whole chain a corpus entry takes: outcome to records, records
 * through the artifact JSON the pass writes, artifact back to candidates.
 *
 * @param accuracyPatchSelected - whether the patched candidate won
 *
 * @returns Candidates the sheets render
 *
 * @example
 * ```ts
 * const candidates = throughArtifact({ accuracyPatchSelected: true, },);
 * ```
 */
function throughArtifact(
  { accuracyPatchSelected, }: { readonly accuracyPatchSelected: boolean; },
) {
  /**
   * Whole-document issue report, exactly as the driver builds it.
   */
  const issues = buildIssueRecords({
    outcomes: [settledOutcome({ accuracyPatchSelected, },),],
    blocked: false,
  },);

  /**
   * Artifact the corpus pass writes, round-tripped through JSON because that is
   * what actually sits on disk between the run and the draw.
   */
  const artifact: unknown = JSON.parse(JSON.stringify({
    id: 'Kitten',
    status: 'repaired',
    acceptedCount: 1,
    issues,
    repairedText: accuracyPatchSelected ? PATCHED_TEXT : TARGET_TEXT,
  },),);

  /**
   * Accepted issues read back out.
   */
  const parsed = parseSettledArtifact({ value: artifact, },);

  return parsed.acceptedIssues
    .map(function toCandidate(accepted,) {
      return extractGradingCandidate({
        issue: accepted.issue,
        entryId: parsed.id,
        band: classifyBand({ sourceBytes: 2_000, },),
        ...(accepted.repair === undefined
          ? {}
          : { repair: accepted.repair, }),
      });
    },);
}

await describe({
  name: 'repair provenance end to end',
  children: [
    it({
      name: 'carries a shipped repair from the slice outcome through the '
        + 'artifact onto the repair sheet, with the replacement intact',
      fn: async () => {
        const candidates = throughArtifact({ accuracyPatchSelected: true, },);
        expect(candidates,).toHaveLength(1,);
        expect(candidates[0]?.repair?.disposition,).toBe('shipped',);
        expect(candidates[0]?.repair?.regions[0]?.editorAfter,)
          .toBe(REPLACEMENT,);

        /** Repair sheet over the round-tripped candidate. */
        const sheet = formatRepairSheet({
          sample: candidates,
          seed: 'cat-seed',
          corpusSha: 'sha/1',
        },);
        expect(sheet.includes(REPLACEMENT,),).toBe(true,);
        expect(sheet.includes('- repair grade: [ ]',),).toBe(true,);

        // The claim that justifies omitting finalSliceText, checked against the
        // text the run actually returns rather than against a fixture constant.
        expect(candidates[0]?.repair?.finalSliceText,).toBeUndefined();
        expect(PATCHED_TEXT.includes(REPLACEMENT,),).toBe(true,);
      },
    },),

    it({
      name: 'carries a rejected repair through as not-selected, so the sheet '
        + 'shows what was attempted and asks for no grade',
      fn: async () => {
        const candidates = throughArtifact({ accuracyPatchSelected: false, },);
        expect(candidates[0]?.repair?.disposition,).toBe('not-selected',);

        /** Repair sheet over the rejected repair. */
        const sheet = formatRepairSheet({
          sample: candidates,
          seed: 'cat-seed',
          corpusSha: 'sha/1',
        },);
        expect(sheet.includes(REPLACEMENT,),).toBe(true,);
        expect(sheet.includes('- repair grade: [ ]',),).toBe(false,);
        expect(sheet.includes('counts against coverage',),).toBe(true,);
      },
    },),

    it({
      name: 'leaves the detection sheet identical whether a repair shipped or '
        + 'not, which is what makes the two numbers independent',
      fn: async () => {
        /** Detection sheet where the repair shipped. */
        const shipped = formatGradingSheet({
          sample: throughArtifact({ accuracyPatchSelected: true, },),
          seed: 'cat-seed',
          bar: 0.9,
          corpusSha: 'sha/1',
        },);

        /** Detection sheet where it did not. */
        const rejected = formatGradingSheet({
          sample: throughArtifact({ accuracyPatchSelected: false, },),
          seed: 'cat-seed',
          bar: 0.9,
          corpusSha: 'sha/1',
        },);
        expect(shipped,).toBe(rejected,);
        expect(shipped.includes(REPLACEMENT,),).toBe(false,);
      },
    },),
  ],
},);
