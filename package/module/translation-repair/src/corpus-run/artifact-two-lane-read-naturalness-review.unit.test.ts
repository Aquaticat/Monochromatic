/**
 * Tests absolute naturalness review recomputation, correction binding, and acceptance confirmation.
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
 * One unavailable requested reviewer seat.
 *
 * @param modelId - invented distinct reviewer id
 *
 * @returns Accounted seat without usable verdict
 */
function unusableSeat(
  { modelId, }: { readonly modelId: string; },
): ArtifactNaturalnessReviewSeat {
  return {
    modelId,
    status: 'unusable',
    findings: [],
    reason: '',
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
 * Second correction whose review exposes one final defect.
 */
const SECOND_CORRECTION_TEXT = 'The cat slept peacefully upon the windowsill.';

/**
 * Finding exposed by second correction.
 */
const THIRD_FINDINGS = [{ paragraph: 1, problem: 'Replace marked location preposition.', },] as const;

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

/**
 * Valid schema-nine three-correction digest chain.
 */
const THREE_CORRECTION_REVIEW = {
  correctionCount: 3,
  corrections: [
    CHAINED_REVIEW.corrections[0],
    {
      inputDigest: hashContent({ content: FIRST_CORRECTION_TEXT, },),
      findingsDigest: hashContent({ content: JSON.stringify(SECOND_FINDINGS,), },),
      gatedTextDigest: hashContent({ content: SECOND_CORRECTION_TEXT, },),
    },
    {
      inputDigest: hashContent({ content: SECOND_CORRECTION_TEXT, },),
      findingsDigest: hashContent({ content: JSON.stringify(THIRD_FINDINGS,), },),
      gatedTextDigest: hashContent({ content: FINAL_TEXT, },),
    },
  ],
  rounds: [
    CHAINED_REVIEW.rounds[0],
    CHAINED_REVIEW.rounds[1],
    {
      candidateDigest: hashContent({ content: SECOND_CORRECTION_TEXT, },),
      candidateText: SECOND_CORRECTION_TEXT,
      paragraphCount: 1,
      paragraphDigests: [hashContent({ content: SECOND_CORRECTION_TEXT, },),],
      seats: [
        unacceptableSeat({ modelId: 'hf:cat/Cat-A', problem: THIRD_FINDINGS[0].problem, },),
        acceptableSeat({ modelId: 'hf:cat/Cat-B', },),
      ],
      usable: 2,
      verdict: 'unacceptable',
      findings: THIRD_FINDINGS,
    },
    CHAINED_REVIEW.rounds[2],
  ],
} as const;

/**
 * Builds acceptable schema-nine reading of exact candidate.
 *
 * @param text - exact candidate independently reviewed
 *
 * @returns Candidate and paragraph-bound acceptable round
 */
function acceptableRound({ text, }: { readonly text: string; },) {
  return {
    candidateDigest: hashContent({ content: text, },),
    candidateText: text,
    paragraphCount: 1,
    paragraphDigests: [hashContent({ content: text, },),],
    seats: [
      acceptableSeat({ modelId: 'hf:cat/Cat-A', },),
      acceptableSeat({ modelId: 'hf:cat/Cat-B', },),
    ],
    usable: 2,
    verdict: 'acceptable' as const,
    findings: [],
  };
}

/**
 * Schema-nine chain retaining earlier acceptances before decisive reviews.
 */
const CONFIRMED_CHAINED_REVIEW = {
  ...CHAINED_REVIEW,
  confirmations: [
    acceptableRound({ text: INITIAL_TEXT, },),
    acceptableRound({ text: FINAL_TEXT, },),
  ],
};

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
      name: 'ACCEPTS THIRD CORRECTION when complete digest chain reaches final acceptance',
      fn: async () => {
        const parsed = parseNaturalnessReview({
          value: THREE_CORRECTION_REVIEW,
          path: 'consolidation.slices[0].polish.review',
          finalText: FINAL_TEXT,
          correctionChainRequired: true,
        },);
        expect(parsed,).toEqual(THREE_CORRECTION_REVIEW,);
      },
    },),

    it({
      name: 'ACCEPTS CONFIRMATIONS bound to decisive candidates including acceptance later rejected',
      fn: async () => {
        const parsed = parseNaturalnessReview({
          value: CONFIRMED_CHAINED_REVIEW,
          path: 'consolidation.slices[0].polish.review',
          finalText: FINAL_TEXT,
          correctionChainRequired: true,
        },);
        expect(parsed,).toEqual(CONFIRMED_CHAINED_REVIEW,);
      },
    },),

    it({
      name: 'REFUSES MISSING FINAL, REJECTED, DUPLICATE, UNBOUND, REORDERED, OR DIFFERENT-ROSTER CONFIRMATION',
      fn: async () => {
        const cases: readonly unknown[] = [
          {
            ...CONFIRMED_CHAINED_REVIEW,
            confirmations: [CONFIRMED_CHAINED_REVIEW.confirmations[0],],
          },
          {
            ...CONFIRMED_CHAINED_REVIEW,
            confirmations: [{
              ...CONFIRMED_CHAINED_REVIEW.confirmations[1],
              verdict: 'unacceptable',
              seats: [
                unacceptableSeat({
                  modelId: 'hf:cat/Cat-A',
                  problem: 'Still awkward.',
                },),
                acceptableSeat({ modelId: 'hf:cat/Cat-B', },),
              ],
              findings: [{ paragraph: 1, problem: 'Still awkward.', },],
            },],
          },
          {
            ...CONFIRMED_CHAINED_REVIEW,
            confirmations: [
              CONFIRMED_CHAINED_REVIEW.confirmations[1],
              CONFIRMED_CHAINED_REVIEW.confirmations[1],
            ],
          },
          {
            ...CONFIRMED_CHAINED_REVIEW,
            confirmations: [acceptableRound({ text: 'The cat sat elsewhere.', },),],
          },
          {
            ...CONFIRMED_CHAINED_REVIEW,
            confirmations: CONFIRMED_CHAINED_REVIEW.confirmations.toReversed(),
          },
          {
            ...CONFIRMED_CHAINED_REVIEW,
            confirmations: [
              CONFIRMED_CHAINED_REVIEW.confirmations[0],
              {
                ...CONFIRMED_CHAINED_REVIEW.confirmations[1],
                seats: [
                  acceptableSeat({ modelId: 'hf:cat/Cat-A', },),
                  acceptableSeat({ modelId: 'hf:cat/Cat-C', },),
                ],
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
      name: 'REFUSES MUTATED COUNTS, VERDICT, DIGEST, MODEL IDS, PARAGRAPHS, CORRECTIONS, OR BELOW-HALF APPROVAL',
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
          {
            ...REVIEW,
            rounds: [{
              ...REVIEW.rounds[0],
              seats: [
                acceptableSeat({ modelId: 'hf:cat/Cat-A', },),
                acceptableSeat({ modelId: 'hf:cat/Cat-B', },),
                unusableSeat({ modelId: 'hf:cat/Cat-C', },),
                unusableSeat({ modelId: 'hf:cat/Cat-D', },),
                unusableSeat({ modelId: 'hf:cat/Cat-E', },),
                unusableSeat({ modelId: 'hf:cat/Cat-F', },),
              ],
            },],
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
