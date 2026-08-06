/**
 * Tests for the deterministic half of the introduced-defect probe: what a
 * prober's quote actually proves about the region it names.
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
  flattenSpace,
  type IntroducedDefectCheckWire,
  type RepairRegion,
  screenEvidence,
  screenIntroducedDefects,
} from '../dist/final/neutral/index.mjs';

/**
 * Region whose replacement fixed a tense error and, for the damage fixtures,
 * dropped the second clause.
 */
const REGION: RepairRegion = {
  envelopeId: 'envelope/nap',
  issueIds: ['adjudicated/nap',],
  before: 'The cat is doing the sleeping, and she wakes at dusk.',
  editorAfter: 'The cat sleeps.',
};

/**
 * Builds one prober check with empty text fields unless overridden.
 *
 * @param verdict - closed-vocabulary verdict, or a wire fault to be dropped
 *
 * @param evidence - wording quoted from the replacement
 *
 * @param omittedText - wording quoted from the text the replacement replaced
 *
 * @param region - one-based region number on the sheet
 *
 * @returns Check the screen reads
 *
 * @example
 * ```ts
 * const check = catCheck({ verdict: 'uncertain', },);
 * ```
 */
function catCheck(
  {
    verdict,
    evidence = '',
    omittedText = '',
    region = 1,
  }: {
    readonly verdict: string;
    readonly evidence?: string;
    readonly omittedText?: string;
    readonly region?: number;
  },
): IntroducedDefectCheckWire {
  return {
    region,
    verdict,
    category: 'omission',
    severity: 'major',
    evidence,
    omittedText,
    reason: 'the second clause is gone',
  };
}

await describe({
  name: screenEvidence.name,
  children: [
    it({
      name: 'corroborates a quote that appears in the replacement and not in '
        + 'the text it replaced, which is the only differential the probe can '
        + 'establish mechanically',
      fn: async () => {
        expect(
          screenEvidence({
            evidence: 'The cat sleeps.',
            omittedText: '',
            region: REGION,
          },),
        ).toBe('corroborated',);
      },
    },),

    it({
      name: 'contradicts a quote that already occurred before the edit, '
        + 'because replacing text cannot introduce wording the text already had',
      fn: async () => {
        // "The cat" is in both sides, so no replacement could have introduced
        // it. This is the screen's whole job: it dismisses an impossible claim
        // without needing to judge translation quality.
        expect(
          screenEvidence({
            evidence: 'The cat',
            omittedText: '',
            region: REGION,
          },),
        ).toBe('contradicted',);
      },
    },),

    it({
      name: 'leaves a quote that appears in neither side unanchored rather '
        + 'than dismissing it, since a mangled quote is not evidence of '
        + 'innocence',
      fn: async () => {
        expect(
          screenEvidence({
            evidence: 'the dog barks',
            omittedText: '',
            region: REGION,
          },),
        ).toBe('unanchored',);
        expect(
          screenEvidence({
            evidence: '',
            omittedText: '',
            region: REGION,
          },),
        ).toBe('unanchored',);
      },
    },),

    it({
      name: 'corroborates dropped content quoted from the text the edit '
        + 'replaced, which is the only way an omission can ever be proved: its '
        + 'absence IS the defect, so there is nothing in the new text to quote',
      fn: async () => {
        expect(
          screenEvidence({
            evidence: '',
            omittedText: 'and she wakes at dusk',
            region: REGION,
          },),
        ).toBe('removal-corroborated',);
      },
    },),

    it({
      name: 'contradicts a dropped-content claim whose wording is still there '
        + 'after the edit, the mirror of the added-damage contradiction',
      fn: async () => {
        expect(
          screenEvidence({
            evidence: '',
            omittedText: 'The cat',
            region: REGION,
          },),
        ).toBe('contradicted',);
      },
    },),

    it({
      name: 'refuses a dropped-content claim quoting wording that was never in '
        + 'the replaced text, since nothing proves it was ever there to drop',
      fn: async () => {
        expect(
          screenEvidence({
            evidence: '',
            omittedText: 'and she hunts at dawn',
            region: REGION,
          },),
        ).toBe('unanchored',);
      },
    },),

    it({
      name: 'refuses a claim anchored in both directions at once, because '
        + 'screening each and taking the better answer would let a prober '
        + 'launder a contradicted quote by attaching a second one',
      fn: async () => {
        expect(
          screenEvidence({
            evidence: 'The cat sleeps.',
            omittedText: 'and she wakes at dusk',
            region: REGION,
          },),
        ).toBe('unanchored',);
      },
    },),

    it({
      name: 'proves a deletion that emptied its region entirely, the case a '
        + 'forward-only screen could never have anchored',
      fn: async () => {
        /** Region the editors emptied outright. */
        const deleted: RepairRegion = {
          envelopeId: 'envelope/gone',
          issueIds: [],
          before: 'She wakes at dusk.',
          editorAfter: '',
        };
        expect(
          screenEvidence({
            evidence: '',
            omittedText: 'She wakes at dusk.',
            region: deleted,
          },),
        ).toBe('removal-corroborated',);
      },
    },),

    it({
      name: 'matches across differing whitespace, so a quote rewrapped by the '
        + 'model still resolves against the region',
      fn: async () => {
        expect(
          screenEvidence({
            evidence: 'The\n  cat   sleeps.',
            omittedText: '',
            region: REGION,
          },),
        ).toBe('corroborated',);
        expect(flattenSpace({ text: '  The  cat\n\tnaps  ', },),).toBe('The cat naps',);
      },
    },),
  ],
},);

await describe({
  name: screenIntroducedDefects.name,
  children: [
    it({
      name: 'counts each prober under the admissibility its own quote earned, '
        + 'keeping the claims for later calibration',
      fn: async () => {
        const [tally,] = screenIntroducedDefects({
          regions: [REGION,],
          ballots: {
            'hf:cat/one': [catCheck({
              verdict: 'introduced-defect',
              evidence: 'The cat sleeps.',
            },),],
            'hf:cat/two': [catCheck({
              verdict: 'introduced-defect',
              evidence: 'The cat',
            },),],
            'hf:cat/three': [catCheck({ verdict: 'no-introduced-defect-found', },),],
            'hf:cat/four': [catCheck({ verdict: 'uncertain', },),],
            'hf:cat/five': [catCheck({
              verdict: 'introduced-defect',
              omittedText: 'and she wakes at dusk',
            },),],
          },
        },);
        expect(tally?.corroborated,).toBe(1,);
        expect(tally?.removalCorroborated,).toBe(1,);
        expect(tally?.contradicted,).toBe(1,);
        expect(tally?.unanchored,).toBe(0,);
        expect(tally?.noneFound,).toBe(1,);
        expect(tally?.uncertain,).toBe(1,);
        expect(tally?.claims,).toHaveLength(3,);
        expect(tally?.claims[0]?.modelId,).toBe('hf:cat/one',);
        expect(tally?.envelopeId,).toBe('envelope/nap',);
      },
    },),

    it({
      name: 'drops a check whose verdict is outside the vocabulary instead of '
        + 'folding it into uncertain, so schema noise never reads as doubt',
      fn: async () => {
        const [tally,] = screenIntroducedDefects({
          regions: [REGION,],
          ballots: {
            'hf:cat/one': [catCheck({ verdict: 'looks-fine-to-me', },),],
          },
        },);
        expect(tally?.noneFound,).toBe(0,);
        expect(tally?.uncertain,).toBe(0,);
        expect(tally?.claims,).toHaveLength(0,);
      },
    },),

    it({
      name: 'routes each check to the region its number names, so a prober '
        + 'answering out of order cannot move a claim onto another edit',
      fn: async () => {
        /** Second region, whose replacement shares no wording with the first. */
        const other: RepairRegion = {
          envelopeId: 'envelope/chase',
          issueIds: ['adjudicated/chase',],
          before: 'She chase butterflies.',
          editorAfter: 'She chases butterflies.',
        };

        const tallies = screenIntroducedDefects({
          regions: [
            REGION,
            other,
          ],
          ballots: {
            'hf:cat/one': [
              catCheck({
                verdict: 'introduced-defect',
                evidence: 'She chases butterflies.',
                region: 2,
              },),
              catCheck({
                verdict: 'no-introduced-defect-found',
                region: 1,
              },),
            ],
          },
        },);
        expect(tallies[0]?.noneFound,).toBe(1,);
        expect(tallies[0]?.claims,).toHaveLength(0,);
        expect(tallies[1]?.corroborated,).toBe(1,);
        expect(tallies[1]?.envelopeId,).toBe('envelope/chase',);
      },
    },),

    it({
      name: 'ignores a check naming a region that is not on the sheet, rather '
        + 'than letting it land on the last region by accident',
      fn: async () => {
        const [tally,] = screenIntroducedDefects({
          regions: [REGION,],
          ballots: {
            'hf:cat/one': [catCheck({
              verdict: 'introduced-defect',
              evidence: 'The cat sleeps.',
              region: 7,
            },),],
          },
        },);
        expect(tally?.corroborated,).toBe(0,);
        expect(tally?.claims,).toHaveLength(0,);
      },
    },),
  ],
},);
