/**
 Tests for one trial of one card: the editor is asked the sheet the pipeline's editor stage asks, and what comes back
 is read as fixed, collateral, refused or unusable, each its own reading.

 No model is called: a scripted client answers each ask. Fixtures are cat-themed invention.

 @module
 */


import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { buildEditorMessages, } from '@monochromatic-dev/translation-repair-repair';
import {
  EDITOR_DAMAGE_KINDS,
  type EditorFidelityTrial,
  editorFidelityTrials,
  runEditorTrial,
} from '../../dist/final/node/index.mjs';
import {
  inventedReference,
  LOW_CARD,
  regionOf,
} from '../editor-fidelity.test-fixture.ts';
import {
  noAsks,
  readingFor,
} from './editor-fidelity-scripted-client.test-fixture.ts';

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

await describe({
  name: runEditorTrial.name,
  children: [
    it({
      name: 'READS THE SENTENCE REMOVED, its neighbours kept, as an exact fix, which is the case the preservation gate '
        + 'could wrongly refuse: removing an addition is licensed only by the quote the accepted issue carries, and '
        + 'the trial\'s issue quotes the region byte for byte',
      fn: async () => {
        const reading = await readingFor({
          trial: INSERTION,
          report: {
            edits: [
              {
                region: 1,
                newText: regionOf({ trial: INSERTION, },)
                  .replace(
                  INSERTION.damagedDefect,
                  '',
                  ),
              },
            ],
          },
          asked: noAsks(),
        },);
        expect(reading.kind,).toBe('answered',);
        if (reading.kind === 'answered') {
          expect(reading.score,).toStrictEqual({
            fixed: 'exact',
            collateral: false,
          },);
          expect(reading.applied,).toBe(1,);
          expect(reading.rejected,).toBe(0,);
        }
      },
    },),

    it({
      name: 'READS THE QUOTED REGION DELETED as a fix of the defect that also took its neighbours: not a clean fix, '
        + 'because the sentence either side of the inserted one went with it',
      fn: async () => {
        const reading = await readingFor({
          trial: INSERTION,
          report: {
            edits: [
              {
                region: 1,
                newText: '',
              },
            ],
          },
          asked: noAsks(),
        },);
        expect((reading.kind === 'answered') && reading.score,).toStrictEqual({
          fixed: 'defect-only',
          collateral: true,
        },);
      },
    },),

    it({
      name: 'READS THE NUMBER RESTORED as an exact fix with nothing else touched',
      fn: async () => {
        const reading = await readingFor({
          trial: ALTERATION,
          report: {
            edits: [
              {
                region: 1,
                newText: regionOf({ trial: ALTERATION, },)
                  .replace(
                  ALTERATION.damagedDefect,
                  ALTERATION.cleanDefect,
                  ),
              },
            ],
          },
          asked: noAsks(),
        },);
        expect(reading.kind,).toBe('answered',);
        if (reading.kind === 'answered') {
          expect(reading.score,).toStrictEqual({
            fixed: 'exact',
            collateral: false,
          },);
        }
      },
    },),

    it({
      name: 'READS A FIX THAT REWORDS THE SENTENCE as fixed with collateral, and a wrong number as not fixed',
      fn: async () => {
        const reworded = await readingFor({
          trial: ALTERATION,
          report: {
            edits: [
              {
                region: 1,
                newText: regionOf({ trial: ALTERATION, },)
                  .replace(
                  ALTERATION.damagedDefect,
                  ALTERATION.cleanDefect,
                  )
                  .replace(
                  'arrived',
                  'came',
                  ),
              },
            ],
          },
          asked: noAsks(),
        },);
        expect((reworded.kind === 'answered') && reworded.score,).toStrictEqual({
          fixed: 'defect-only',
          collateral: true,
        },);
        const wrong = await readingFor({
          trial: ALTERATION,
          report: {
            edits: [
              {
                region: 1,
                newText: regionOf({ trial: ALTERATION, },)
                  .replace(
                  ALTERATION.damagedDefect,
                  '1999',
                  ),
              },
            ],
          },
          asked: noAsks(),
        },);
        expect((wrong.kind === 'answered') && wrong.score,).toStrictEqual({
          fixed: 'none',
          collateral: false,
        },);
      },
    },),

    it({
      name: 'READS NO EDIT as a refusal, counted apart from a reply nobody could read: the editor was heard and chose '
        + 'to leave the region as it was',
      fn: async () => {
        const reading = await readingFor({
          trial: INSERTION,
          report: { edits: [], },
          asked: noAsks(),
        },);
        expect(reading.kind,).toBe('refused',);
      },
    },),

    it({
      name: 'READS A REPLY NOBODY COULD READ as unusable, naming that no reply was heard, after the gather has asked '
        + 'again in its retry rounds',
      fn: async () => {
        /**
         Asks the scripted client saw.
         */
        const asked = noAsks();
        const reading = await readingFor({
          trial: INSERTION,
          report: { unrelated: true, },
          asked,
        },);
        expect(reading.kind,).toBe('unusable',);
        if (reading.kind === 'unusable')
          expect(reading.cause,).toBe('no-reply',);
        expect(asked.modelIds.length,).toBeGreaterThan(1,);
        expect(asked.modelIds.length,).toBeLessThanOrEqual(5,);
      },
    },),

    it({
      name: 'READS AN EDIT THAT NEVER LANDED as unusable, naming that the edits were refused, with how many: here the '
        + 'card names a region that is not on the sheet, which the stage drops before the gate',
      fn: async () => {
        const reading = await readingFor({
          trial: INSERTION,
          report: {
            edits: [
              {
                region: 9,
                newText: 'The cat naps.',
              },
            ],
          },
          asked: noAsks(),
        },);
        expect(reading.kind,).toBe('unusable',);
        if (reading.kind === 'unusable') {
          expect(reading.cause,).toBe('edits-refused',);
          expect(reading.rejected,).toBeGreaterThan(0,);
        }
      },
    },),

    it({
      name: 'ASKS ONLY THE CARD IT IS GIVEN, with the sheet `buildEditorMessages` builds for the trial\'s slice and '
        + 'accepted issue, so the seat is read as production uses it',
      fn: async () => {
        /**
         Asks the scripted client saw.
         */
        const asked = noAsks();
        await readingFor({
          trial: ALTERATION,
          report: { edits: [], },
          asked,
        },);
        expect(asked.modelIds,).toStrictEqual([LOW_CARD,],);
        expect(asked.sheets,).toStrictEqual([
          buildEditorMessages({
            sourceText: ALTERATION.sourceText,
            targetText: ALTERATION.damagedText,
            envelopes: ALTERATION.envelopes,
            issues: ALTERATION.issues,
          },).messages,
        ],);
      },
    },),
  ],
},);
