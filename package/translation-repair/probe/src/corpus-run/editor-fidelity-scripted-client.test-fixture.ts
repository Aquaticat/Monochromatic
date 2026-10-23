import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type {
  ChatJsonOutcome,
  ChatJsonRequest,
  ModelClient,
} from '@monochromatic-dev/translation-repair-provider';
import { HANG_STOP_MS, } from '@monochromatic-dev/translation-repair-test-fixture/ts/hang-stop.test-fixture.ts';
import { SCRIPTED_STAGE_SETTINGS, } from '@monochromatic-dev/translation-repair-stage/ts/stage-settings.test-fixture.ts';
import {
  type EditorFidelityTrial,
  runEditorTrial,
} from '../../dist/final/node/index.mjs';
import { LOW_CARD, } from '../editor-fidelity.test-fixture.ts';

//region Scripted editor client
// A client that answers every ask with one scripted report, and the one-call reader of a trial through it. No model is
// called: the apply gate and the scoring are the real ones.

/**
 Logger for the trials under test.
 */
const l = tagged({ tag: 'editor-fidelity-scripted-client', },);

/**
 What a scripted client was asked.
 */
export type Asked = {
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
export function scriptedClient(
  {
    report,
    asked,
  }: {
    readonly report: unknown;
    readonly asked: Asked;
  },
): ModelClient {
  return {
    chatText: function chatText(): never {
      throw new Error('chatText unused',);
    },
    chatJson: async function chatJson<ValueT,>(request: ChatJsonRequest<ValueT>,): Promise<ChatJsonOutcome<ValueT>> {
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
    quotas: function quotas(): never {
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
export function readingFor(
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
export function noAsks(): Asked {
  return {
    modelIds: [],
    sheets: [],
  };
}

//endregion Scripted editor client
