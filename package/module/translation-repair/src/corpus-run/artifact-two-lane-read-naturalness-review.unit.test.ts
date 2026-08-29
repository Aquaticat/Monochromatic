/**
 * Tests schema-eight absolute naturalness review recomputation and text binding.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ArtifactNaturalnessReviewSeat,
  hashContent,
  parseNaturalnessReview,
} from '../../dist/final/node/index.mjs';

/**
 * Exact final text review binds to.
 */
const FINAL_TEXT = 'The cat slept peacefully on the windowsill.';

/**
 * Initial wording rejected before bounded corrections.
 */
const INITIAL_TEXT = 'The cat conducted peaceful sleeping on the windowsill.';

/**
 * First correction whose exact review exposes another defect.
 */
const FIRST_CORRECTION_TEXT = 'The cat was sleeping peacefully upon the windowsill.';

/**
 * One acceptable reviewer seat.
 *
 * @param modelId - invented distinct reviewer id
 *
 * @returns Schema-eight acceptable seat
 */
function acceptableSeat(
  { modelId, }: { readonly modelId: string; },
): ArtifactNaturalnessReviewSeat {
  return {
    modelId,
    status: 'acceptable',
    findings: [],
    reason: 'whole passage is publication-ready',
  };
}

/**
 * Valid no-correction review fixture.
 */
const REVIEW = {
  correctionCount: 0,
  rounds: [{
    candidateDigest: hashContent({ content: FINAL_TEXT, },),
    paragraphCount: 1,
    seats: [
      acceptableSeat({ modelId: 'hf:cat/Cat-A', },),
      acceptableSeat({ modelId: 'hf:cat/Cat-B', },),
    ],
    usable: 2,
    verdict: 'acceptable',
    findings: [],
  },],
} as const;

/**
 * Builds one rejecting seat for located fixture finding.
 *
 * @param modelId - invented distinct reviewer id
 *
 * @param problem - actionable defect
 *
 * @returns Unacceptable seat with one paragraph finding
 */
function unacceptableSeat(
  {
    modelId,
    problem,
  }: {
    readonly modelId: string;
    readonly problem: string;
  },
): ArtifactNaturalnessReviewSeat {
  return {
    modelId,
    status: 'unacceptable',
    findings: [{ paragraph: 1, problem, },],
    reason: 'material defect remains',
  };
}

/**
 * First exact review finding.
 */
const INITIAL_FINDINGS = [{ paragraph: 1, problem: 'Replace nominalized verb phrase.', },] as const;

/**
 * Finding exposed by first correction.
 */
const SECOND_FINDINGS = [{ paragraph: 1, problem: 'Use ordinary location preposition.', },] as const;

/**
 * Valid schema-nine two-correction digest chain.
 */
const CHAINED_REVIEW = {
  correctionCount: 2,
  corrections: [
    {
      inputDigest: hashContent({ content: INITIAL_TEXT, },),
      findingsDigest: hashContent({ content: JSON.stringify(INITIAL_FINDINGS,), },),
      gatedTextDigest: hashContent({ content: FIRST_CORRECTION_TEXT, },),
    },
    {
      inputDigest: hashContent({ content: FIRST_CORRECTION_TEXT, },),
      findingsDigest: hashContent({ content: JSON.stringify(SECOND_FINDINGS,), },),
      gatedTextDigest: hashContent({ content: FINAL_TEXT, },),
    },
  ],
  rounds: [
    {
      candidateDigest: hashContent({ content: INITIAL_TEXT, },),
      candidateText: INITIAL_TEXT,
      paragraphCount: 1,
      paragraphDigests: [hashContent({ content: INITIAL_TEXT, },),],
      seats: [
        unacceptableSeat({ modelId: 'hf:cat/Cat-A', problem: INITIAL_FINDINGS[0].problem, },),
        acceptableSeat({ modelId: 'hf:cat/Cat-B', },),
      ],
      usable: 2,
      verdict: 'unacceptable',
      findings: INITIAL_FINDINGS,
    },
    {
      candidateDigest: hashContent({ content: FIRST_CORRECTION_TEXT, },),
      candidateText: FIRST_CORRECTION_TEXT,
      paragraphCount: 1,
      paragraphDigests: [hashContent({ content: FIRST_CORRECTION_TEXT, },),],
      seats: [
        unacceptableSeat({ modelId: 'hf:cat/Cat-A', problem: SECOND_FINDINGS[0].problem, },),
        acceptableSeat({ modelId: 'hf:cat/Cat-B', },),
      ],
      usable: 2,
      verdict: 'unacceptable',
      findings: SECOND_FINDINGS,
    },
    {
      candidateDigest: hashContent({ content: FINAL_TEXT, },),
      candidateText: FINAL_TEXT,
      paragraphCount: 1,
      paragraphDigests: [hashContent({ content: FINAL_TEXT, },),],
      seats: [
        acceptableSeat({ modelId: 'hf:cat/Cat-A', },),
        acceptableSeat({ modelId: 'hf:cat/Cat-B', },),
      ],
      usable: 2,
      verdict: 'acceptable',
      findings: [],
    },
  ],
} as const;

await describe({
  name: parseNaturalnessReview.name,
  children: [
    it({
      name: 'ACCEPTS REVIEW whose recomputed final verdict and digest approve final text',
      fn: async () => {
        const parsed = parseNaturalnessReview({
          value: REVIEW,
          path: 'consolidation.slices[0].polish.review',
          finalText: FINAL_TEXT,
        },);
        expect(parsed,).toEqual(REVIEW,);
      },
    },),

    it({
      name: 'ACCEPTS TWO CORRECTIONS only when every rejected-text, finding, paragraph, and gated-text digest links',
      fn: async () => {
        const parsed = parseNaturalnessReview({
          value: CHAINED_REVIEW,
          path: 'consolidation.slices[0].polish.review',
          finalText: FINAL_TEXT,
          correctionChainRequired: true,
        },);
        expect(parsed,).toEqual(CHAINED_REVIEW,);
      },
    },),

    it({
      name: 'REFUSES MUTATED CORRECTION OR FINAL PARAGRAPH DIGEST in generation-nine chain',
      fn: async () => {
        const cases: readonly unknown[] = [
          {
            ...CHAINED_REVIEW,
            rounds: [
              {
                ...CHAINED_REVIEW.rounds[0],
                candidateText: `${INITIAL_TEXT} Extra sentence.`,
              },
              CHAINED_REVIEW.rounds[1],
              CHAINED_REVIEW.rounds[2],
            ],
          },
          {
            ...CHAINED_REVIEW,
            corrections: [
              { ...CHAINED_REVIEW.corrections[0], findingsDigest: '0'.repeat(64,), },
              CHAINED_REVIEW.corrections[1],
            ],
          },
          {
            ...CHAINED_REVIEW,
            rounds: [
              CHAINED_REVIEW.rounds[0],
              CHAINED_REVIEW.rounds[1],
              {
                ...CHAINED_REVIEW.rounds[2],
                paragraphDigests: ['0'.repeat(64,),],
              },
            ],
          },
        ];
        for (const value of cases) {
          expect(() => parseNaturalnessReview({
            value,
            path: 'consolidation.slices[0].polish.review',
            finalText: FINAL_TEXT,
            correctionChainRequired: true,
          },),).toThrow();
        }
      },
    },),

    it({
      name: 'REFUSES MUTATED USABLE COUNT, VERDICT, DIGEST, MODEL IDS, PARAGRAPH COUNT, AND CORRECTION COUNT',
      fn: async () => {
        const cases: readonly unknown[] = [
          {
            ...REVIEW,
            rounds: [{ ...REVIEW.rounds[0], usable: 1, },],
          },
          {
            ...REVIEW,
            rounds: [{ ...REVIEW.rounds[0], verdict: 'unacceptable', },],
          },
          {
            ...REVIEW,
            rounds: [{ ...REVIEW.rounds[0], candidateDigest: '0'.repeat(64,), },],
          },
          {
            ...REVIEW,
            rounds: [{
              ...REVIEW.rounds[0],
              seats: [
                acceptableSeat({ modelId: 'hf:cat/Cat-A', },),
                acceptableSeat({ modelId: 'hf:cat/Cat-A', },),
              ],
            },],
          },
          {
            ...REVIEW,
            rounds: [{ ...REVIEW.rounds[0], paragraphCount: 2, },],
          },
          {
            ...REVIEW,
            correctionCount: 1,
          },
        ];
        for (const value of cases) {
          expect(() => parseNaturalnessReview({
            value,
            path: 'consolidation.slices[0].polish.review',
            finalText: FINAL_TEXT,
          },),).toThrow();
        }
      },
    },),
  ],
},);
