/**
 * Tests for when two auditors are talking about the same defect.
 *
 * THE CASES THAT DECIDE THIS INSTRUMENT are here, and both were live defects in
 * the version this replaces:
 *
 * -   The FALSE SPLIT: two voices locating one dropped negation at different
 *     widths were counted as two lone opinions, because the key was the text
 *     they typed.
 * -   The FALSE MERGE, which is worse: two voices finding DIFFERENT changed
 *     numbers in one sentence were counted as one twice-confirmed defect,
 *     because a character floor had forced both to quote the whole sentence.
 *
 * A matcher that fixes only the first by loosening the key re-creates the
 * second, so the tests for both sit in one file where neither can be relaxed
 * without the other failing.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  anchorLocatedSpan,
  type AuditMemberClaim,
  corroborate,
  nearMisses,
  type RenderingAuditCategory,
  type SyntheticModelId,
} from '../dist/final/node/index.mjs';

/**
 * Original carrying two counts in one sentence, plus a negation.
 */
const SOURCE_TEXT = '三只猫住在书店的阁楼里。她们不吃罐头。晚上两只猫睡在窗台上，一只猫睡在书架上。';

/**
 * Rendering that flips the negation and changes BOTH counts.
 */
const CANDIDATE_TEXT = 'Three cats live in the bookshop attic. They eat canned food. '
  + 'At night three cats sleep on the windowsill, two cats sleep on the bookshelf.';

/**
 * Sentence both number claims fall inside, which is what a padded quote would
 * have collapsed them onto.
 */
const COUNT_SENTENCE_SOURCE = '晚上两只猫睡在窗台上，一只猫睡在书架上';

/**
 * Same sentence in the rendering.
 */
const COUNT_SENTENCE_CANDIDATE = 'At night three cats sleep on the windowsill, two cats sleep on the bookshelf';

/**
 * Builds one screened claim by anchoring it the way the screen would.
 *
 * @param modelId - voice making the claim
 *
 * @param category - what it calls the defect
 *
 * @param sourceLocator - original span identifying the occurrence
 *
 * @param sourceFocus - original span carrying the change
 *
 * @param candidateLocator - candidate span identifying the occurrence
 *
 * @param candidateFocus - candidate span carrying the change
 *
 * @returns Claim in the shape the matcher reads
 *
 * @example
 * ```ts
 * const claim = claimOf({ modelId: 'a', category: 'altered-number', ... },);
 * ```
 */
function claimOf(
  {
    modelId,
    category,
    sourceLocator,
    sourceFocus,
    candidateLocator,
    candidateFocus,
  }: {
    readonly modelId: SyntheticModelId;
    readonly category: RenderingAuditCategory;
    readonly sourceLocator: string;
    readonly sourceFocus: string;
    readonly candidateLocator: string;
    readonly candidateFocus: string;
  },
): AuditMemberClaim {
  /**
   * Where the claim sits in the original.
   */
  const source = anchorLocatedSpan({
    text: SOURCE_TEXT,
    locator: sourceLocator,
    focus: sourceFocus,
    side: 'source',
  },);

  /**
   * Where it sits in the rendering.
   */
  const candidate = anchorLocatedSpan({
    text: CANDIDATE_TEXT,
    locator: candidateLocator,
    focus: candidateFocus,
    side: 'candidate',
  },);

  if ((!source.anchored) || (!candidate.anchored))
    throw new Error(`fixture claim did not anchor, so the case would prove nothing: ${JSON.stringify([source, candidate,],)}`,);

  return {
    modelId,
    finding: {
      category,
      source: {
        kind: 'anchored',
        locator: source.locator,
        focus: source.focus,
      },
      candidate: {
        kind: 'anchored',
        locator: candidate.locator,
        focus: candidate.focus,
      },
      reason: `${modelId} on ${category}`,
    },
  };
}

/**
 * First voice's claim about the two cats becoming three.
 */
const TWO_TO_THREE_A = claimOf({
  modelId: 'hf:Qwen/Qwen3.6-27B',
  category: 'altered-number',
  sourceLocator: COUNT_SENTENCE_SOURCE,
  sourceFocus: '两',
  candidateLocator: COUNT_SENTENCE_CANDIDATE,
  candidateFocus: 'three',
},);

/**
 * Second voice's claim about the same count, quoting a narrower locator.
 */
const TWO_TO_THREE_B = claimOf({
  modelId: 'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
  category: 'altered-number',
  sourceLocator: '晚上两只猫睡在窗台上',
  sourceFocus: '两',
  candidateLocator: 'At night three cats sleep on the windowsill',
  candidateFocus: 'three',
},);

/**
 * A DIFFERENT defect in the SAME sentence: the one cat that became two.
 */
const ONE_TO_TWO = claimOf({
  modelId: 'hf:openai/gpt-oss-120b',
  category: 'altered-number',
  sourceLocator: COUNT_SENTENCE_SOURCE,
  sourceFocus: '一',
  candidateLocator: COUNT_SENTENCE_CANDIDATE,
  candidateFocus: 'two cats sleep on the bookshelf',
},);

await describe({
  name: corroborate.name,
  children: [
    it({
      name:
        'CORROBORATES two voices who located one defect at different widths, which is the false split '
        + 'that keying on quoted text produced: what they have in common is a position, not a phrasing',
      fn: async () => {
        const defects = corroborate({
          claims: [
            TWO_TO_THREE_A,
            TWO_TO_THREE_B,
          ],
        },);
        expect(defects,).toHaveLength(1,);
        expect(defects[0]
          ?.voices,).toBe(2,);
        expect(defects[0]
          ?.members,).toHaveLength(2,);
      },
    },),
    it({
      name:
        'does NOT merge two DIFFERENT defects in one sentence, which is the false merge the character '
        + 'floors caused: both claims quote the same sentence and neither voice agreed with the other '
        + 'about anything, so reporting one twice-confirmed defect would invent the agreement',
      fn: async () => {
        const defects = corroborate({
          claims: [
            TWO_TO_THREE_A,
            ONE_TO_TWO,
          ],
        },);
        expect(defects,).toEqual([],);
      },
    },),
    it({
      name:
        'does not call those two a near miss either, because their FOCUS spans do not touch: a near miss '
        + 'says two claims might be one defect, and two claims about different words of one sentence '
        + 'demonstrably are not. Sharing a locator is not sharing a defect',
      fn: async () => {
        expect(
          nearMisses({
            claims: [
              TWO_TO_THREE_A,
              ONE_TO_TWO,
            ],
          },),
        ).toEqual([],);
      },
    },),
    it({
      name:
        'DOES report a near miss when the focus spans genuinely overlap without matching, which is the '
        + 'case a human has to settle: one voice quoting a word and another quoting the phrase it sits in '
        + 'may be one defect or two, and this instrument does not decide it',
      fn: async () => {
        /**
         * Claim whose focus contains the other's, on both sides.
         */
        const containing = claimOf({
          modelId: 'hf:zai-org/GLM-4.7-Flash',
          category: 'altered-number',
          sourceLocator: COUNT_SENTENCE_SOURCE,
          sourceFocus: '两只猫',
          candidateLocator: COUNT_SENTENCE_CANDIDATE,
          candidateFocus: 'three cats',
        },);

        const near = nearMisses({
          claims: [
            TWO_TO_THREE_A,
            containing,
          ],
        },);
        expect(near,).toHaveLength(1,);
        expect(near[0]
          ?.kind,).toBe('overlapping-focus',);
        // AND IT IS NOT CORROBORATION: the spans differ, so the agreement is
        // reported as a question rather than counted as a fact.
        expect(
          corroborate({
            claims: [
              TWO_TO_THREE_A,
              containing,
            ],
          },),
        ).toEqual([],);
      },
    },),
    it({
      name:
        'does NOT let one voice corroborate itself by filing the same defect twice, which is what a '
        + 'count over claims rather than over voices would report as agreement nobody reached',
      fn: async () => {
        const defects = corroborate({
          claims: [
            TWO_TO_THREE_A,
            {
              ...TWO_TO_THREE_A,
              finding: {
                ...TWO_TO_THREE_A.finding,
                reason: 'said again by the same voice',
              },
            },
          ],
        },);
        expect(defects,).toEqual([],);
      },
    },),
    it({
      name:
        'treats the SAME span under two category names as a near miss rather than as corroboration, '
        + 'since a dropped negator is nameable two ways and merging them would decide a question about '
        + 'the taxonomy that neither voice was asked',
      fn: async () => {
        /**
         * Two voices pointing at the identical span and disagreeing on the word
         * for it.
         */
        const claims = [
          claimOf({
            modelId: 'hf:Qwen/Qwen3.6-27B',
            category: 'altered-polarity',
            sourceLocator: '她们不吃罐头',
            sourceFocus: '不吃',
            candidateLocator: 'They eat canned food',
            candidateFocus: 'eat',
          },),
          claimOf({
            modelId: 'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
            category: 'omission',
            sourceLocator: '她们不吃罐头',
            sourceFocus: '不吃',
            candidateLocator: 'They eat canned food',
            candidateFocus: 'eat',
          },),
        ];
        expect(corroborate({ claims, },),).toEqual([],);

        const near = nearMisses({ claims, },);
        expect(near,).toHaveLength(1,);
        expect(near[0]
          ?.kind,).toBe('same-focus-different-category',);
      },
    },),
    it({
      name:
        'does NOT cluster transitively: one wide claim touching two narrow ones does not put those two '
        + 'in a defect together, when they share no text at all',
      fn: async () => {
        /**
         * Claim spanning the whole count sentence, which touches both counts.
         */
        const wide = claimOf({
          modelId: 'hf:moonshotai/Kimi-K3',
          category: 'altered-number',
          sourceLocator: COUNT_SENTENCE_SOURCE,
          sourceFocus: '两只猫睡在窗台上，一只猫',
          candidateLocator: COUNT_SENTENCE_CANDIDATE,
          candidateFocus: 'three cats sleep on the windowsill, two cats',
        },);

        /**
         * All three claims together.
         */
        const claims = [
          TWO_TO_THREE_A,
          wide,
          ONE_TO_TWO,
        ];
        expect(corroborate({ claims, },),).toEqual([],);

        /**
         * Pairs the near-miss pass found.
         */
        const near = nearMisses({ claims, },);

        // TWO PAIRS, NOT THREE: the wide claim touches each narrow one, and the
        // two narrow ones still touch nothing. A transitive rule would have
        // joined them through it.
        expect(near,).toHaveLength(2,);
        expect(
          near.filter(function joinsTheNarrowPair(one,): boolean {
            return [
              one.left
                .modelId,
              one.right
                .modelId,
            ].every(function isNarrow(modelId,): boolean {
              return modelId !== 'hf:moonshotai/Kimi-K3';
            },);
          },),
        ).toEqual([],);
      },
    },),
    it({
      name:
        'KEEPS every member claim on a corroborated defect, so a later calibration can re-read what each '
        + 'voice actually said rather than re-running the roster to find out',
      fn: async () => {
        const defects = corroborate({
          claims: [
            TWO_TO_THREE_A,
            TWO_TO_THREE_B,
          ],
        },);
        expect(
          defects[0]
            ?.members
            .map(function toVoice(member,): string {
              return member.modelId;
            },),
        ).toEqual([
          'hf:Qwen/Qwen3.6-27B',
          'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
        ],);
      },
    },),
    it({
      name: 'reports nothing as a near miss when two claims are about different sentences entirely',
      fn: async () => {
        /**
         * Claim about the negation, far from either count.
         */
        const polarity = claimOf({
          modelId: 'hf:zai-org/GLM-5.2',
          category: 'altered-polarity',
          sourceLocator: '她们不吃罐头',
          sourceFocus: '不吃',
          candidateLocator: 'They eat canned food',
          candidateFocus: 'eat',
        },);
        expect(
          nearMisses({
            claims: [
              polarity,
              ONE_TO_TWO,
            ],
          },),
        ).toEqual([],);
      },
    },),
  ],
},);
