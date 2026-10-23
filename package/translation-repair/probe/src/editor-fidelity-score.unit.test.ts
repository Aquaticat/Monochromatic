/**
 Tests for the deterministic reading of one edited text against a trial: whether the defect is fixed, exactly or up to
 the whitespace between sentences, and whether anything else was touched. No model judges.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  EDITOR_DAMAGE_KINDS,
  type EditorFidelityTrial,
  editorFidelityTrials,
  scoreEditedText,
} from '../dist/final/node/index.mjs';
import { REVIEW_REFERENCE, } from './fidelity-reference.test-fixture.ts';
import {
  inventedReference,
  regionOf,
} from './editor-fidelity.test-fixture.ts';

/**
 The invented reference's trials.
 */
const TRIALS = editorFidelityTrials({
  references: [inventedReference(),],
  damageKinds: EDITOR_DAMAGE_KINDS,
},);

/**
 The insertion trial.
 */
const INSERTION: EditorFidelityTrial = nonNullishOrThrow(TRIALS.find(function isInsertion(trial,): boolean {
  return trial.damageKind === 'insertion';
},),);

/**
 The alteration trial.
 */
const ALTERATION: EditorFidelityTrial = nonNullishOrThrow(TRIALS.find(function isAlteration(trial,): boolean {
  return trial.damageKind === 'alteration';
},),);

/**
 The damaged text with its region replaced, which is what the apply gate makes of one edit.

 @param trial - trial whose region is replaced

 @param replacement - text the region becomes

 @returns The patched text

 @example
 ```ts
 const patched = patchedWith({ trial: INSERTION, replacement: '', },);
 ```
 */
function patchedWith(
  {
    trial,
    replacement,
  }: {
    readonly trial: EditorFidelityTrial;
    readonly replacement: string;
  },
): string {
  return trial.damagedText.slice(
    0,
    trial.region.startOffset,
  )
    + replacement
    + trial.damagedText.slice(trial.region.endOffset,);
}

await describe({
  name: scoreEditedText.name,
  children: [
    describe({
      name: 'the inserted sentence',
      children: [
        it({
          name: 'READS THE CLEAN TEXT as an exact fix with nothing else touched',
          fn: async () => {
            expect(scoreEditedText({
              trial: INSERTION,
              patchedText: REVIEW_REFERENCE,
            },),).toStrictEqual({
              fixed: 'exact',
              collateral: false,
            },);
          },
        },),
        it({
          name: 'READS THE SENTENCE REMOVED as a fix equivalent up to whitespace, because the apply gate leaves the '
            + 'separator on both sides of the removed sentence and so the patched text carries one space more than '
            + 'the clean text, and nothing else differs',
          fn: async () => {
            /**
             The patch an editor that blanks the region produces.
             */
            const patchedText = patchedWith({
              trial: INSERTION,
              replacement: '',
            },);
            expect(patchedText,).not.toBe(REVIEW_REFERENCE,);
            expect(scoreEditedText({
              trial: INSERTION,
              patchedText,
            },),).toStrictEqual({
              fixed: 'equivalent',
              collateral: false,
            },);
            expect(scoreEditedText({
              trial: INSERTION,
              patchedText: patchedWith({
                trial: INSERTION,
                replacement: '  ',
              },),
            },).fixed,).toBe('equivalent',);
          },
        },),
        it({
          name: 'READS A SOFTENED SENTENCE as not fixed, with nothing else touched: the rule is that an addition is '
            + 'removed, and a shorter sentence in its place is still an addition',
          fn: async () => {
            expect(scoreEditedText({
              trial: INSERTION,
              patchedText: patchedWith({
                trial: INSERTION,
                replacement: 'She travelled to a village.',
              },),
            },),).toStrictEqual({
              fixed: 'none',
              collateral: false,
            },);
          },
        },),
        it({
          name: 'READS THE UNCHANGED TEXT as not fixed and nothing touched',
          fn: async () => {
            expect(scoreEditedText({
              trial: INSERTION,
              patchedText: INSERTION.damagedText,
            },),).toStrictEqual({
              fixed: 'none',
              collateral: false,
            },);
          },
        },),
      ],
    },),

    describe({
      name: 'the altered number',
      children: [
        it({
          name: 'READS THE CLEAN TEXT as an exact fix with nothing else touched',
          fn: async () => {
            expect(scoreEditedText({
              trial: ALTERATION,
              patchedText: REVIEW_REFERENCE,
            },),).toStrictEqual({
              fixed: 'exact',
              collateral: false,
            },);
          },
        },),
        it({
          name: 'READS A FIX THAT ONLY DIFFERS IN THE SPACE BETWEEN WORDS as equivalent: the number is back and the '
            + 'sentence is the clean sentence once runs of whitespace count as one',
          fn: async () => {
            expect(scoreEditedText({
              trial: ALTERATION,
              patchedText: patchedWith({
                trial: ALTERATION,
                replacement: regionOf({ trial: ALTERATION, },)
                  .replace(
                  ALTERATION.damagedDefect,
                  ALTERATION.cleanDefect,
                  )
                  .replace(
                  'arrived in',
                  'arrived  in',
                  ),
              },),
            },),).toStrictEqual({
              fixed: 'equivalent',
              collateral: false,
            },);
          },
        },),
        it({
          name: 'READS A FIX THAT ALSO REWORDS THE SENTENCE as fixed at the number and collateral: the editor mended '
            + 'the defect and changed words nobody flagged',
          fn: async () => {
            expect(scoreEditedText({
              trial: ALTERATION,
              patchedText: patchedWith({
                trial: ALTERATION,
                replacement: regionOf({ trial: ALTERATION, },)
                  .replace(
                  ALTERATION.damagedDefect,
                  ALTERATION.cleanDefect,
                  )
                  .replace(
                  'arrived',
                  'came',
                  ),
              },),
            },),).toStrictEqual({
              fixed: 'defect-only',
              collateral: true,
            },);
          },
        },),
        it({
          name: 'READS ANOTHER WRONG NUMBER as not fixed with nothing else touched, and the same wrong number with '
            + 'the sentence reworded as not fixed and collateral',
          fn: async () => {
            /**
             A number neither side states.
             */
            const wrong = '1999';
            expect(scoreEditedText({
              trial: ALTERATION,
              patchedText: patchedWith({
                trial: ALTERATION,
                replacement: regionOf({ trial: ALTERATION, },)
                  .replace(
                  ALTERATION.damagedDefect,
                  wrong,
                  ),
              },),
            },),).toStrictEqual({
              fixed: 'none',
              collateral: false,
            },);
            expect(scoreEditedText({
              trial: ALTERATION,
              patchedText: patchedWith({
                trial: ALTERATION,
                replacement: regionOf({ trial: ALTERATION, },)
                  .replace(
                  ALTERATION.damagedDefect,
                  wrong,
                  )
                  .replace(
                  'arrived',
                  'came',
                  ),
              },),
            },),).toStrictEqual({
              fixed: 'none',
              collateral: true,
            },);
          },
        },),
        it({
          name: 'READS THE UNCHANGED TEXT as not fixed and nothing touched',
          fn: async () => {
            expect(scoreEditedText({
              trial: ALTERATION,
              patchedText: ALTERATION.damagedText,
            },),).toStrictEqual({
              fixed: 'none',
              collateral: false,
            },);
          },
        },),
        it({
          name: 'READS A CHANGE OUTSIDE THE REGION as collateral, which the apply gate does not let through and so a '
            + 'nonzero reading is a finding about the gate: the defect cannot be isolated, so only an equal text '
            + 'counts as fixed',
          fn: async () => {
            /**
             The region mended, and a later sentence rewritten.
             */
            const patchedText = patchedWith({
              trial: ALTERATION,
              replacement: regionOf({ trial: ALTERATION, },)
                .replace(
                ALTERATION.damagedDefect,
                ALTERATION.cleanDefect,
                ),
            },)
              .replace(
              'Every morning',
              'Each morning',
              );
            expect(scoreEditedText({
              trial: ALTERATION,
              patchedText,
            },),).toStrictEqual({
              fixed: 'none',
              collateral: true,
            },);
          },
        },),
        it({
          name: 'READS A CHANGE OF WHITESPACE ALONE OUTSIDE THE REGION as collateral beside an equivalent fix',
          fn: async () => {
            /**
             The region mended and a space doubled elsewhere.
             */
            const patchedText = patchedWith({
              trial: ALTERATION,
              replacement: regionOf({ trial: ALTERATION, },)
                .replace(
                ALTERATION.damagedDefect,
                ALTERATION.cleanDefect,
                ),
            },)
              .replace(
              'Every morning',
              'Every  morning',
              );
            expect(scoreEditedText({
              trial: ALTERATION,
              patchedText,
            },),).toStrictEqual({
              fixed: 'equivalent',
              collateral: true,
            },);
          },
        },),
      ],
    },),
  ],
},);
