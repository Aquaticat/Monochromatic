/**
 Tests for one trial of one card: the editor is asked the sheet the pipeline's editor stage asks, and what comes back
 is read as fixed, collateral, refused or unusable, each its own reading.

 No model is called: a scripted client answers each ask. Fixtures are cat-themed invention.

 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import type {
  ChatJsonOutcome,
  ChatJsonRequest,
  ModelClient,
} from '@monochromatic-dev/translation-repair-provider';
import { buildEditorMessages, } from '@monochromatic-dev/translation-repair-repair';
import {
  EDITOR_DAMAGE_KINDS,
  type EditorFidelityTrial,
  editorFidelityTrials,
  runEditorTrial,
} from '../../dist/final/node/index.mjs';
import { HANG_STOP_MS, } from '@monochromatic-dev/translation-repair-test-fixture/ts/hang-stop.test-fixture.ts';
import { SCRIPTED_STAGE_SETTINGS, } from '@monochromatic-dev/translation-repair-stage/ts/stage-settings.test-fixture.ts';
import {
  inventedReference,
  LOW_CARD,
} from '../editor-fidelity.test-fixture.ts';

/**
 Logger for the trials under test.
 */
const l = tagged({ tag: 'editor-fidelity-trial-test', },);

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
 What a scripted client was asked.
 */
type Asked = {
  /**
   Model ids asked, in order.
   */
  readonly modelIds: string[];

  /**
   Message lists sent, in order.
   */
  readonly sheets: (ChatJsonRequest<unknown>['messages'])[];
};

/**
 Client answering every ask with one scripted report.

 @param report - what each ask returns

 @param asked - record the asks are appended to

 @returns The client the trial asks through

 @example
 ```ts
 const client = scriptedClient({ report: { edits: [], }, asked, },);
 ```
 */
function scriptedClient(
  {
    report,
    asked,
  }: {
    readonly report: unknown;
    readonly asked: Asked;
  },
): ModelClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused',);
    },
    chatJson: async <ValueT,>(request: ChatJsonRequest<ValueT>,): Promise<ChatJsonOutcome<ValueT>> => {
      asked.modelIds.push(request.modelId,);
      asked.sheets.push(request.messages,);
      if (!request.validate(report,)) {
        return {
          kind: 'schema-mismatch',
          rawText: JSON.stringify(report,),
          detail: 'scripted report failed the editor guard',
        };
      }
      return {
        kind: 'ok',
        value: report,
        rawText: JSON.stringify(report,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused',);
    },
  };
}

/**
 Runs one trial against a client answering with the report.

 @param trial - trial under test

 @param report - what the editor says

 @param asked - record of the asks

 @returns The reading

 @example
 ```ts
 const reading = await readingFor({ trial: INSERTION, report: { edits: [], }, asked, },);
 ```
 */
function readingFor(
  {
    trial,
    report,
    asked,
  }: {
    readonly trial: EditorFidelityTrial;
    readonly report: unknown;
    readonly asked: Asked;
  },
): ReturnType<typeof runEditorTrial> {
  return runEditorTrial({
    client: scriptedClient({
      report,
      asked,
    },),
    cardId: LOW_CARD,
    trial,
    signal: new AbortController().signal,
    perCallTimeoutMs: HANG_STOP_MS,
    l,
    stageSettings: SCRIPTED_STAGE_SETTINGS,
  },);
}

/**
 A fresh record of asks.

 @returns Empty record

 @example
 ```ts
 const asked = noAsks();
 ```
 */
function noAsks(): Asked {
  return {
    modelIds: [],
    sheets: [],
  };
}

/**
 The region of a trial's damaged text.

 @param trial - trial whose region is read

 @returns The envelope's text

 @example
 ```ts
 const region = regionOf({ trial: ALTERATION, },);
 ```
 */
function regionOf({ trial, }: { readonly trial: EditorFidelityTrial; },): string {
  return trial.damagedText.slice(
    trial.region.startOffset,
    trial.region.endOffset,
  );
}

await describe({
  name: runEditorTrial.name,
  children: [
    it({
      name: 'READS THE SENTENCE REMOVED as fixed up to whitespace, which is the case the preservation gate could '
        + 'wrongly refuse: removing an addition is licensed only by the quote the accepted issue carries, and the '
        + 'trial\'s issue quotes the sentence byte for byte',
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
        expect(reading.kind,).toBe('answered',);
        if (reading.kind === 'answered') {
          expect(reading.score,).toStrictEqual({
            fixed: 'equivalent',
            collateral: false,
          },);
          expect(reading.applied,).toBe(1,);
          expect(reading.rejected,).toBe(0,);
        }
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
        expect(reworded.kind === 'answered' && reworded.score,).toStrictEqual({
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
        expect(wrong.kind === 'answered' && wrong.score,).toStrictEqual({
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
      name: 'READS AN EDIT THE APPLY GATE REFUSED as unusable, naming the gate, with how many it refused',
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
          expect(reading.cause,).toBe('gate-rejected',);
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
