/**
 * Tests for screening one auditor's answer against the two texts.
 *
 * WHAT THESE PIN is that a claim proves itself from the side it CAN. An
 * omission has nothing in the candidate to quote, its absence being the whole
 * claim, so a symmetric rule would make the likeliest defect of a from-scratch
 * rendering permanently unprovable. An unsupported addition is the mirror.
 * Everything else changes something both sides state and must quote both.
 *
 * AND that the archive is irrelevant BY CONSTRUCTION rather than by
 * instruction: a source quote is searched in the original and nowhere else, so
 * a claim resting on some other translation's wording anchors nowhere.
 *
 * Fixtures are cat-themed invention, written here rather than adapted from
 * anywhere. Checked against the corpus at the pinned commit: none of these
 * spans occurs in it. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  anchorQuote,
  screenRenderingAudit,
} from '../dist/final/node/index.mjs';

/**
 * Original passage, carrying a negation and a count so one fixture serves both
 * the polarity cases and the anchoring floors.
 */
const SOURCE_TEXT = '三只猫住在书店的阁楼里。她们不吃罐头，每天傍晚只喝一碗温牛奶。';

/**
 * A rendering that says what the original says, with one phrase repeated so an
 * ambiguous quote has something to be ambiguous about.
 */
const FAITHFUL_TEXT = 'Three cats live in the attic of the bookshop. They do not eat canned food, '
  + 'and every evening they drink one bowl of warm milk in the attic of the bookshop.';

/**
 * The same rendering with the negation dropped, which is the defect shape the
 * live arms of this instrument are built around.
 */
const FLIPPED_TEXT = 'Three cats live in the attic of the bookshop. They eat canned food, '
  + 'and every evening they drink one bowl of warm milk in the attic of the bookshop.';

/**
 * Wording no version of this passage carries, standing in for another
 * translation an auditor might quote instead of the original.
 */
const FOREIGN_WORDING = 'The cats abandoned the attic before winter.';

/**
 * Builds one auditor reply around a single finding.
 *
 * @param category - category the finding claims
 *
 * @param sourceQuote - span of the original it rests on
 *
 * @param candidateQuote - span of the candidate it rests on
 *
 * @returns Reply as the wire guard would accept it
 *
 * @example
 * ```ts
 * const report = reportOf({ category: 'omission', sourceQuote: '她们不吃罐头', candidateQuote: '', },);
 * ```
 */
function reportOf(
  {
    category,
    sourceQuote,
    candidateQuote,
  }: {
    readonly category: string;
    readonly sourceQuote: string;
    readonly candidateQuote: string;
  },
): {
  readonly verdict: string;
  readonly findings: readonly {
    readonly category: string;
    readonly sourceQuote: string;
    readonly candidateQuote: string;
    readonly reason: string;
  }[];
} {
  return {
    verdict: 'defects-found',
    findings: [
      {
        category,
        sourceQuote,
        candidateQuote,
        reason: 'the candidate does not say what the original says here',
      },
    ],
  };
}

/**
 * Screens one reply against the rendering that dropped the negation.
 *
 * @param report - reply to screen
 *
 * @returns What survived
 *
 * @example
 * ```ts
 * const screened = screenAgainstFlipped({ report, },);
 * ```
 */
function screenAgainstFlipped(
  { report, }: { readonly report: ReturnType<typeof reportOf>; },
): ReturnType<typeof screenRenderingAudit> {
  return screenRenderingAudit({
    report,
    sourceText: SOURCE_TEXT,
    candidateText: FLIPPED_TEXT,
  },);
}

await describe({
  name: screenRenderingAudit.name,
  children: [
    it({
      name:
        'KEEPS an omission proved from the ORIGINAL alone, which a symmetric rule would refuse: content '
        + 'the candidate never rendered has nothing in the candidate to quote, its absence being the '
        + 'claim, so demanding a candidate span would make the likeliest defect of a from-scratch '
        + 'rendering permanently unprovable',
      fn: async () => {
        /**
         * A claim that the negation is gone, quoting only the original.
         */
        const screened = screenAgainstFlipped({
          report: reportOf({
            category: 'omission',
            sourceQuote: '她们不吃罐头',
            candidateQuote: '',
          },),
        },);
        expect(screened.findings,).toHaveLength(1,);
        expect(screened.findings[0]
          ?.sourceEvidence,).toBe('她们不吃罐头',);
        expect(screened.findings[0]
          ?.candidateEvidence,).toBe('',);
        expect(screened.dropped,).toEqual([],);
      },
    },),
    it({
      name:
        'KEEPS an unsupported addition proved from the CANDIDATE alone, the mirror case: wording nothing '
        + 'supports has nothing in the original to quote for the same reason',
      fn: async () => {
        expect(
          screenAgainstFlipped({
            report: reportOf({
              category: 'unsupported-addition',
              sourceQuote: '',
              candidateQuote: 'They eat canned food',
            },),
          },).findings,
        ).toHaveLength(1,);
      },
    },),
    it({
      name:
        'REQUIRES BOTH SIDES of a category that changes something both sides state, and drops the claim '
        + 'when either span fails: a changed polarity is a disagreement between two wordings, and one '
        + 'of them alone names no disagreement',
      fn: async () => {
        /**
         * The same defect claimed properly, from both sides.
         */
        const both = screenAgainstFlipped({
          report: reportOf({
            category: 'altered-polarity',
            sourceQuote: '她们不吃罐头',
            candidateQuote: 'They eat canned food',
          },),
        },);
        expect(both.findings,).toHaveLength(1,);
        expect(both.findings[0]
          ?.candidateEvidence,).toBe('They eat canned food',);

        /**
         * The same claim with the candidate span left out.
         */
        const halfProved = screenAgainstFlipped({
          report: reportOf({
            category: 'altered-polarity',
            sourceQuote: '她们不吃罐头',
            candidateQuote: '',
          },),
        },);
        expect(halfProved.findings,).toEqual([],);
        expect(halfProved.dropped,).toEqual(['empty-quote (candidate)',],);
      },
    },),
    it({
      name:
        'DROPS a claim resting on wording that is in neither text, which is what makes the archive '
        + 'irrelevant by construction rather than by instruction: the prompt says not to treat another '
        + 'translation as the standard, and this is what enforces it, since a quote from one anchors '
        + 'nowhere',
      fn: async () => {
        /**
         * A claim quoting a rendering nobody here was shown.
         */
        const screened = screenAgainstFlipped({
          report: reportOf({
            category: 'unsupported-addition',
            sourceQuote: '',
            candidateQuote: FOREIGN_WORDING,
          },),
        },);
        expect(screened.findings,).toEqual([],);
        expect(screened.dropped,).toEqual(['unanchored-quote (candidate)',],);
      },
    },),
    it({
      name:
        'DROPS a quote that occurs TWICE, since a repeated span does not say which occurrence was read, '
        + 'and one that is too short to identify anything, which is the hole the coverage probe left '
        + 'open when it accepted a single word as evidence',
      fn: async () => {
        /**
         * A span the candidate carries twice.
         */
        const repeated = screenAgainstFlipped({
          report: reportOf({
            category: 'unsupported-addition',
            sourceQuote: '',
            candidateQuote: 'the attic of the bookshop',
          },),
        },);
        expect(repeated.dropped,).toEqual(['ambiguous-quote (candidate)',],);

        /**
         * A span too short to identify anything, though it does occur.
         */
        const tiny = screenAgainstFlipped({
          report: reportOf({
            category: 'unsupported-addition',
            sourceQuote: '',
            candidateQuote: 'They',
          },),
        },);
        expect(tiny.dropped,).toEqual(['unidentifying-quote (candidate)',],);
      },
    },),
    it({
      name:
        'holds CJK quotes to a lower floor than Latin ones, deliberately: a Chinese clause carries far '
        + 'more per character, so one floor for both would either admit an English word that identifies '
        + 'nothing or refuse most honest source spans',
      fn: async () => {
        // Four characters of Chinese, which is above the CJK floor and far
        // below the Latin one.
        expect(
          anchorQuote({
            text: SOURCE_TEXT,
            quote: '不吃罐头',
            side: 'source',
          },).anchored,
        ).toBe(true,);
        expect(
          anchorQuote({
            text: SOURCE_TEXT,
            quote: '罐头',
            side: 'source',
          },).anchored,
        ).toBe(false,);
      },
    },),
    it({
      name:
        'returns the TEXT`S OWN wording as evidence rather than the quote it was sent, so a report never '
        + 'quotes a document back with punctuation or line breaks the document does not carry',
      fn: async () => {
        /**
         * A candidate whose sentence is wrapped, as a real document is.
         */
        const wrapped = 'They drink one bowl of warm milk,\nand then they sleep in the attic.';

        /**
         * The same span quoted as one line, which is how a model returns it.
         */
        const anchored = anchorQuote({
          text: wrapped,
          quote: 'one bowl of warm milk, and then they',
          side: 'candidate',
        },);
        expect(anchored.anchored,).toBe(true,);
        if (!anchored.anchored)
          throw new Error('expected the wrapped quote to anchor',);

        expect(anchored.evidence,).toBe('one bowl of warm milk,\nand then they',);
      },
    },),
    it({
      name:
        'DROPS a category this version does not name, and reads an unknown VERDICT as uncertain while '
        + 'still screening the findings under it: a mis-cast verdict is not a reason to discard evidence '
        + 'that anchors',
      fn: async () => {
        expect(
          screenAgainstFlipped({
            report: reportOf({
              category: 'vibes-off',
              sourceQuote: '她们不吃罐头',
              candidateQuote: 'They eat canned food',
            },),
          },).dropped,
        ).toEqual(['unknown-category (vibes-off)',],);

        /**
         * A reply whose verdict is not one this version knows, carrying a
         * finding that proves itself.
         */
        const screened = screenRenderingAudit({
          report: {
            verdict: 'looks-bad',
            findings: reportOf({
              category: 'altered-polarity',
              sourceQuote: '她们不吃罐头',
              candidateQuote: 'They eat canned food',
            },).findings,
          },
          sourceText: SOURCE_TEXT,
          candidateText: FLIPPED_TEXT,
        },);
        expect(screened.verdict,).toBe('uncertain',);
        expect(screened.findings,).toHaveLength(1,);
      },
    },),
    it({
      name:
        'reports NOTHING FOUND and EVERYTHING DROPPED differently, which the tally over voices rests on: '
        + 'a dropped claim is not evidence that a rendering is sound, so a run of unanchored answers '
        + 'must not read as agreement that it is',
      fn: async () => {
        /**
         * A voice that claimed nothing, against the rendering that says what
         * the original says.
         */
        const quiet = screenRenderingAudit({
          report: {
            verdict: 'no-defect-found',
            findings: [],
          },
          sourceText: SOURCE_TEXT,
          candidateText: FAITHFUL_TEXT,
        },);
        expect(quiet.findings,).toEqual([],);
        expect(quiet.dropped,).toEqual([],);

        /**
         * A voice whose every claim fell.
         */
        const unfounded = screenAgainstFlipped({
          report: reportOf({
            category: 'unsupported-addition',
            sourceQuote: '',
            candidateQuote: FOREIGN_WORDING,
          },),
        },);
        expect(unfounded.findings,).toEqual([],);
        expect(unfounded.dropped,).toHaveLength(1,);
      },
    },),
  ],
},);
