/**
 Guards class one hundred fourteen (yingying9, 2026-09-24): a linked title
 that names the person the front matter declares shipped the archive's other
 form of the name although the page-name glossary (class eighty-six) said the
 title takes the declared form. Two of three translate judges chose the
 archive's own rendering as "the archive's established rendering for this
 link text", and the repair lane's rewrite was reverted by a probe calling
 the declared form an introduced change. A rendering whose link text, under
 the href of a source link naming a declared person, lacks the declared form
 is refused before any judge reads it, wherever the rule runs: the validator
 itself, the translate slate's floor, the lane contest's winner, the
 consolidation's standing and the lane texts offered to its slate.
 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  floorTranslateVoices,
  laneContestChoiceVerdict,
  laneTextsForSlate,
  readStandingVerdict,
  type RosterModelId,
  validateTranslatedSlice,
} from '../dist/final/node/index.mjs';

/**
 Original definition linking a farewell post whose title names the cat.
 */
const SOURCE = '[^2]: [再见了。我想你了，咪咪。](https://example.invalid/farewell-mimi.html)';

/**
 Archive's rendering, naming the cat by another form.
 */
const ARCHIVE = '[^2]: [Goodbye. I miss you, Whiskers.](https://example.invalid/farewell-mimi.html)';

/**
 Rendering carrying the declared form inside the title.
 */
const DECLARED = '[^2]: [Goodbye. I miss you, Mittens.](https://example.invalid/farewell-mimi.html)';

/**
 Name pairs the front matter declares on this page.
 */
const PAIRS = [
  {
    source: '咪咪',
    rendering: 'Mittens',
  },
] as const;

/**
 Logger that forwards every line.
 */
const l: Logger = tagged({ tag: 'declared-link-name-test', },);

await describe({
  name: 'a declared name inside a linked title (class one hundred fourteen)',
  children: [
    it({
      name: 'REFUSES a rendering whose link text lacks the declared form, and names both forms',
      fn: async () => {
        /**
         Verdict on the archive's own rendering.
         */
        const verdict = validateTranslatedSlice({
          sourceText: SOURCE,
          candidateText: ARCHIVE,
          pageText: ARCHIVE,
          declared: PAIRS,
        },);
        expect(verdict.kind,).toBe('invalid',);
        if (verdict.kind !== 'invalid')
          throw new Error('unreachable',);
        /**
         Findings read as one text.
         */
        const findings = verdict.findings.join('\n',);
        expect(findings,).toContain('咪咪',);
        expect(findings,).toContain('Mittens',);
      },
    },),
    it({
      name: 'ACCEPTS the declared form in the title, and stays silent where nothing is declared or the link is elsewhere',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: SOURCE,
          candidateText: DECLARED,
          pageText: ARCHIVE,
          declared: PAIRS,
        },).kind,).toBe('valid',);
        expect(validateTranslatedSlice({
          sourceText: SOURCE,
          candidateText: ARCHIVE,
          pageText: ARCHIVE,
        },).kind,).toBe('valid',);
        expect(validateTranslatedSlice({
          sourceText: '咪咪在窗台上打盹。',
          candidateText: 'The kitten dozed on the windowsill.',
          declared: PAIRS,
        },).kind,).toBe('valid',);
      },
    },),
    it({
      name: 'WITHHOLDS the archive-worded candidate from the translate slate',
      fn: async () => {
        /**
         Slate after the floor.
         */
        const floored = floorTranslateVoices({
          voices: [
            {
              modelId: 'hf:cat/Cat-A' as unknown as RosterModelId,
              value: { translation: ARCHIVE, },
            },
            {
              modelId: 'hf:cat/Cat-B' as unknown as RosterModelId,
              value: { translation: DECLARED, },
            },
          ],
          sourceText: SOURCE,
          incumbentText: ARCHIVE,
          lineStructured: false,
          declared: PAIRS,
        },);
        expect(floored.voices.map(function text(voice,): string {
          return voice.value.translation;
        },),).toEqual([DECLARED,],);
      },
    },),
    it({
      name: 'REFUSES the archive-worded lane as the contest winner and as the standing, and offers only the declared lane',
      fn: async () => {
        expect(laneContestChoiceVerdict({
          outcome: {
            choice: 'repair',
            ballots: [],
            usable: 2,
            findings: [],
          },
          sourceText: SOURCE,
          incumbentText: ARCHIVE,
          repairText: ARCHIVE,
          translateText: DECLARED,
          declared: PAIRS,
        },).mayShip,).toBe(false,);
        expect(readStandingVerdict({
          sourceText: SOURCE,
          standingText: ARCHIVE,
          incumbentText: ARCHIVE,
          lineStructured: false,
          choice: 'repair',
          contestVerdict: {
            kind: 'lane-won',
            lane: 'repair',
          },
          sliceIndex: 3,
          l,
          declared: PAIRS,
        },).standingValid,).toBe(false,);
        expect(laneTextsForSlate({
          sourceText: SOURCE,
          incumbentText: ARCHIVE,
          repairText: ARCHIVE,
          translateText: DECLARED,
          standingText: '',
          standingMayShip: false,
          standingEligible: false,
          declared: PAIRS,
        },).map(function lane(offer,): string {
          return offer.lane;
        },),).toEqual(['translate',],);
      },
    },),
  ],
},);
