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
