/**
 * Tests for how an editor-width comparison is read.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  caught,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  classifyWidths,
  type HeadToHeadVerdict,
  readHeadToHead,
  summarizeWidths,
  type WidthComparison,
  type WidthRow,
} from '../../dist/final/node/index.mjs';

/**
 * Repair the narrow roster shipped.
 */
const NARROW_TEXT = 'The cat sunbathes on the windowsill every afternoon.';

/**
 * A different repair, standing in for what extra editors bought.
 */
const WIDE_TEXT = 'The cat suns herself on the windowsill each afternoon.';

/**
 * Row with everything a summary reads, so a case states only its own field.
 *
 * @param comparison - how the two arms compared, defaulting to unmoved
 *
 * @param verdict - head-to-head reading, defaulting to none run
 *
 * @param narrowRepeatAgreed - whether the repeat judging agreed, defaulting
 * to agreement so a case that says nothing contributes no churn
 *
 * @returns Row carrying those over a settled baseline
 *
 * @example
 * ```ts
 * const row = rowWith({ comparison: 'differs', verdict: 'wide-wins', },);
 * ```
 */
function rowWith(
  {
    comparison = 'same-text',
    verdict = 'not-run',
    narrowRepeatAgreed = true,
  }: {
    readonly comparison?: WidthComparison;
    readonly verdict?: HeadToHeadVerdict | 'not-run';
    readonly narrowRepeatAgreed?: boolean;
  },
): WidthRow {
  return {
    entryId: 'Mittens',
    chunkIndex: 0,
    acceptedIssues: 2,
    comparison,
    heardNarrow: 3,
    heardWide: 6,
    narrowRepeatAgreed,
    verdict,
    usableBallots: 0,
    narrowProducers: ['hf:zai-org/GLM-5.2',],
    wideProducers: ['hf:zai-org/GLM-5.2',],
  };
}

await describe({
  name: classifyWidths.name,
  children: [
    it({
      name: 'CALLS TWO SLATES THAT BOTH DECLINED "nothing-shipped" rather than "same-text", because '
        + 'two blanks are equal and reporting them as agreement would count every slice the lane '
        + 'never touched as evidence that width changes nothing',
      fn: async function twoBlanksAreNotAgreement() {
        expect(classifyWidths({ narrowText: '', wideText: '', },),).toBe('nothing-shipped',);
      },
    },),

    it({
      name: 'CALLS ONE ARM SHIPPING AND THE OTHER DECLINING A DIFFERENCE, which is the case the '
        + 'whole question is about: the extra seats either found a repair the narrow roster missed '
        + 'or spread the ballots thin enough to decline one it would have made',
      fn: async function shippingAgainstDecliningDiffers() {
        expect(classifyWidths({ narrowText: '', wideText: WIDE_TEXT, },),).toBe('differs',);
        expect(classifyWidths({ narrowText: NARROW_TEXT, wideText: '', },),).toBe('differs',);
      },
    },),

    it({
      name: 'CALLS IDENTICAL TEXT "same-text", which answers that slice on its own: widening '
        + 'changed nothing here, and judging it against itself would spend calls to learn that '
        + 'twice',
      fn: async function identicalTextNeedsNoContest() {
        expect(classifyWidths({ narrowText: NARROW_TEXT, wideText: NARROW_TEXT, },),)
          .toBe('same-text',);
      },
    },),

    it({
      name: 'CALLS DIFFERENT TEXT "differs", the only classification that earns a head-to-head',
      fn: async function differentTextEarnsAContest() {
        expect(classifyWidths({ narrowText: NARROW_TEXT, wideText: WIDE_TEXT, },),).toBe('differs',);
      },
    },),
  ],
},);

await describe({
  name: readHeadToHead.name,
  children: [
    it({
      name: 'REPORTS DISAGREEING ORDERS AS "position-decided" rather than picking the first, '
        + 'because the two rounds are the same pair judged by the same panel and differ only in '
        + 'which text sat first. Reading the first order alone launders a seating bias into a '
        + 'quality result',
      fn: async function disagreementIsPositionNotQuality() {
        expect(
          readHeadToHead({ firstOrderWinner: 'wide', secondOrderWinner: 'narrow', },),
        ).toBe('position-decided',);
      },
    },),

    it({
      name: 'NAMES THE WIDE ARM ONLY WHEN BOTH ORDERS DID, which is the evidence the decision '
        + 'actually needs',
      fn: async function agreementNamesTheWinner() {
        expect(readHeadToHead({ firstOrderWinner: 'wide', secondOrderWinner: 'wide', },),)
          .toBe('wide-wins',);
        expect(readHeadToHead({ firstOrderWinner: 'narrow', secondOrderWinner: 'narrow', },),)
          .toBe('narrow-wins',);
      },
    },),

    it({
      name: 'READS A PANEL THAT RANKED NEITHER IN EITHER ORDER AS A TIE, since preferring neither '
        + 'is an answer about the pair rather than a measurement that failed to happen',
      fn: async function decliningBothWaysIsATie() {
        expect(readHeadToHead({ firstOrderWinner: 'none', secondOrderWinner: 'none', },),)
          .toBe('tied',);
      },
    },),

    it({
      name: 'REFUSES AN ARM IT HAS NO READING FOR instead of answering "tied", so a third arm '
        + 'added later cannot report its own omission as a measurement',
      fn: async function anUnknownArmRefuses() {
        /**
         * What an arm outside the union raised, read for class as well as wording.
         */
        const refusal = caught(function judgesAnUnknownArm() {
          readHeadToHead({
            // The refusal exists for exactly this: a value the union does not
            // cover, which only a later edit can produce.
            firstOrderWinner: 'sideways' as 'wide',
            secondOrderWinner: 'sideways' as 'wide',
          },);
        },);

        expect(refusal,).toBeInstanceOf(Error,);
        expect((refusal as Error).message,).toContain('unreachable',);
      },
    },),
  ],
},);

await describe({
  name: summarizeWidths.name,
  children: [
    it({
      name: 'COUNTS EVERY ROW, breaking out the slices where neither arm shipped rather than '
        + 'dropping them, so the band and the move count are read over one denominator and may '
        + 'therefore be compared against each other at all',
      fn: async function everyRowSharesTheDenominator() {
        const summary = summarizeWidths({
          rows: [
            rowWith({ comparison: 'nothing-shipped', },),
            rowWith({ comparison: 'nothing-shipped', },),
            rowWith({ comparison: 'same-text', },),
          ],
        },);

        expect(summary.slices,).toBe(3,);
        expect(summary.nothingShipped,).toBe(2,);
        expect(summary.moved,).toBe(0,);
      },
    },),

    it({
      name: 'KEEPS CHURN ON A SLICE NEITHER ARM SHIPPED ON, which is the reading the old '
        + 'comparison-only filter silently dropped: such a slice can carry churn but can never '
        + 'carry a move, so dropping it shrank the band alone and tilted the draw toward width',
      fn: async function trivialSlicesStillCarryChurn() {
        const summary = summarizeWidths({
          rows: [
            rowWith({ comparison: 'nothing-shipped', narrowRepeatAgreed: false, },),
            rowWith({ comparison: 'nothing-shipped', narrowRepeatAgreed: true, },),
            rowWith({ comparison: 'differs', narrowRepeatAgreed: false, },),
          ],
        },);

        // The band sees both flips, not just the one on the slice that differed.
        expect(summary.churned,).toBe(2,);
        expect(summary.moved,).toBe(1,);
      },
    },),

    it({
      name: 'COUNTS THE NULL BAND BESIDE THE EFFECT, so a reader sees how often the same slate '
        + 'judged twice shipped different text. Without it, "widening moved four of ten" cannot '
        + 'be told apart from judges disagreeing with themselves',
      fn: async function theBandIsCountedBesideTheEffect() {
        const summary = summarizeWidths({
          rows: [
            rowWith({ comparison: 'differs', narrowRepeatAgreed: false, },),
            rowWith({ comparison: 'differs', narrowRepeatAgreed: true, },),
            rowWith({ comparison: 'same-text', narrowRepeatAgreed: false, },),
          ],
        },);

        expect(summary.moved,).toBe(2,);
        expect(summary.churned,).toBe(2,);
        expect(summary.slices,).toBe(3,);
      },
    },),

    it({
      name: 'KEEPS THE FOUR HEAD-TO-HEAD READINGS APART, so a position-decided pair is never '
        + 'banked as a win for either arm and a tie is never banked as an absent measurement',
      fn: async function everyVerdictLandsInItsOwnCount() {
        const summary = summarizeWidths({
          rows: [
            rowWith({ comparison: 'differs', verdict: 'wide-wins', },),
            rowWith({ comparison: 'differs', verdict: 'wide-wins', },),
            rowWith({ comparison: 'differs', verdict: 'narrow-wins', },),
            rowWith({ comparison: 'differs', verdict: 'position-decided', },),
            rowWith({ comparison: 'differs', verdict: 'tied', },),
          ],
        },);

        expect(summary.wideWins,).toBe(2,);
        expect(summary.narrowWins,).toBe(1,);
        expect(summary.positionDecided,).toBe(1,);
        expect(summary.tied,).toBe(1,);
      },
    },),
  ],
},);
