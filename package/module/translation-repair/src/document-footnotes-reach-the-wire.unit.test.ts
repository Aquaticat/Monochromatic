/**
 Guard that a footnote a slice cites from outside its window reaches the
 requests both lanes send about that slice (ledger L5).

 WHY THIS FILE EXISTS. `fidelity-window-footnotes.unit.test.ts` pins what the
 window reader returns when handed each side's whole document; nothing there
 can see whether the lanes hand it the right documents. Each lane reads the
 window off the prepared pair itself, so a caller passing the wrong side's
 text, or none, would leave every reader case passing while the sheets lost
 the note. The assertions here are made on the recorded requests.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  messageText,
  neighbouringIncumbent,
  neighbouringSource,
  prepareDocumentPair,
  repairTranslation,
  type RepairModels,
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_HYPER_VISION,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
  type SyntheticClient,
  translateDocument,
  type TranslateModels,
} from '../dist/final/node/index.mjs';

/**
 Logger for the drivers under test.
 */
const l = tagged({ tag: 'document-footnotes-reach-the-wire-test', },);

//region Fixture

/**
 Original's note, cited in the first section and defined after the last.
 */
const SOURCE_NOTE = '[^1]: 摘自猫咪日记。';

/**
 Archive's note, cited and defined where the original's is.
 */
const TARGET_NOTE = '[^1]: From the cat diary.';

/**
 Original of four sections, so the citing section's window of one slice each
 way cannot reach the note.
 */
const SOURCE_TEXT = `## 一

小猫在窗台上睡到中午。[^1]

## 二

她的哥哥给她带来一根羽毛。

## 三

白胡子数着外面的鸟。

## 四

晚饭是鱼。

${SOURCE_NOTE}
`;

/**
 Archive translation of the same four sections.
 */
const TARGET_TEXT = `## One

Mittens slept on the sill until noon.[^1]

## Two

Her brother brought her a feather.

## Three

Whiskers counted the birds outside.

## Four

Dinner was fish.

${TARGET_NOTE}
`;

/**
 Wording only the citing slice's archive carries.
 */
const CITING_TARGET = 'Mittens slept on the sill until noon.[^1]';

//endregion Fixture

//region Recording the wire

/**
 Every message of a request, joined.

 @param request - exchange a driver attempted

 @returns Its whole text

 @example
 ```ts
 const content = contentOf({ request, },);
 ```
 */
function contentOf({ request, }: { readonly request: ChatJsonRequest<unknown>; },): string {
  return request.messages
    .map(function toContent(message,) {
      return messageText({ message, },);
    },)
    .join('\n',);
}

/**
 Client recording every exchange and answering each stage the lanes reach
 here: critics report nothing, translators render the archive's own wording
 of the slice, and judges back the first candidate.

 @param requests - log each exchange is appended to, with its stage

 @returns Client honoring that script

 @example
 ```ts
 const client = recordingClient({ requests: [], },);
 ```
 */
function recordingClient(
  { requests, }: { readonly requests: { readonly stage: string; readonly content: string; }[]; },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused by these lanes',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       Stage the schema names.
       */
      const stage = request.responseFormat?.json_schema.name ?? '';

      /**
       Everything the exchange carried.
       */
      const content = contentOf({ request: request as ChatJsonRequest<unknown>, },);
      requests.push({ stage, content, },);

      /**
       Scripted reply per stage.
       */
      const scripted: unknown = stage === 'critic_report'
        ? { issues: [], }
        : stage === 'translation_report'
        ? { translation: content.includes('小猫在窗台上睡到中午',) ? CITING_TARGET : 'The cat.', }
        : stage === 'candidate_ballot'
        ? { best: 1, reason: 'it reads well', }
        : undefined;
      if (scripted === undefined)
        throw new Error(`recordingClient was asked a stage this fixture does not script: ${stage}`,);
      if (!request.validate(scripted,))
        throw new Error(`scripted ${stage} reply failed the wire guard`,);
      return {
        kind: 'ok',
        value: scripted,
        rawText: JSON.stringify(scripted,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused by these lanes',);
    },
  };
}

//endregion Recording the wire

//region Rosters

/**
 Repair rosters; no refiners, so a slice nobody found a defect in ends at its
 critics.
 */
const REPAIR_MODELS: RepairModels = {
  criticModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR, SEAT_SYNTHETIC_VISION_NO_OPENROUTER, SEAT_SYNTHETIC_VISION_WITHHELD,],
  panelModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR, SEAT_SYNTHETIC_VISION_NO_OPENROUTER, SEAT_SYNTHETIC_VISION_WITHHELD,],
  editorModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR,],
  judgeModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR, SEAT_SYNTHETIC_VISION_NO_OPENROUTER, SEAT_SYNTHETIC_VISION_WITHHELD,],
  checkerModelIds: [SEAT_SYNTHETIC_VISION_NO_OPENROUTER, SEAT_SYNTHETIC_VISION_WITHHELD, SEAT_SYNTHETIC_TEXT_EVERYWHERE,],
};

/**
 Translate rosters.
 */
const TRANSLATE_MODELS: TranslateModels = {
  translatorModelIds: [SEAT_SYNTHETIC_VISION_WITHHELD, SEAT_HYPER_OPENROUTER_VISION_EDITOR, SEAT_HYPER_VISION,],
  judgeModelIds: [
    SEAT_SYNTHETIC_VISION_WITHHELD,
    SEAT_HYPER_OPENROUTER_VISION_EDITOR,
    SEAT_HYPER_VISION,
    SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
    SEAT_SYNTHETIC_TEXT_EVERYWHERE,
  ],
};

//endregion Rosters

await describe({
  name: 'footnotes reach the wire',
  children: [
    it({
      name: 'PUTS THE NOTE OUTSIDE THE CITING SLICE\'S WINDOW, which every case below rests on: a note the window already held would reach the sheets with or without the fix',
      fn: async () => {
        /** Slices as the lanes see them. */
        const { slices, } = prepareDocumentPair({ sourceText: SOURCE_TEXT, targetText: TARGET_TEXT, },);
        /** Position of the slice whose archive cites the note. */
        const citing = slices.findIndex(function cites(slice,): boolean {
          return slice.target.text.includes(CITING_TARGET,);
        },);

        expect(citing,).toBeGreaterThan(-1,);
        expect(slices[citing]?.target.text.includes(TARGET_NOTE,),).toBe(false,);
        expect(neighbouringSource({ slices, slicePosition: citing, documentText: '', },).includes(SOURCE_NOTE,),).toBe(false,);
        expect(neighbouringIncumbent({ slices, slicePosition: citing, documentText: '', },).includes(TARGET_NOTE,),)
          .toBe(false,);
      },
    },),

    it({
      name: 'SHOWS THE REPAIR LANE\'S CRITICS BOTH NOTES beside the slice citing them',
      fn: async () => {
        /** Exchanges the lane attempted. */
        const requests: { readonly stage: string; readonly content: string; }[] = [];
        await repairTranslation({
          client: recordingClient({ requests, },),
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          models: REPAIR_MODELS,
          signal: new AbortController().signal,
        },);
        /** Critic sheets about the citing slice. */
        const sheets = requests.filter(function isCitingCritic(request,): boolean {
          return (request.stage === 'critic_report') && request.content.includes(CITING_TARGET,);
        },);

        expect(sheets.length,).toBeGreaterThan(0,);
        for (const sheet of sheets) {
          expect(sheet.content,).toContain(SOURCE_NOTE,);
          expect(sheet.content,).toContain(TARGET_NOTE,);
        }
      },
    },),

    it({
      name: 'SHOWS THE TRANSLATE LANE\'S SHEETS BOTH NOTES beside the slice citing them',
      fn: async () => {
        /** Exchanges the lane attempted. */
        const requests: { readonly stage: string; readonly content: string; }[] = [];
        await translateDocument({
          client: recordingClient({ requests, },),
          prepared: prepareDocumentPair({ sourceText: SOURCE_TEXT, targetText: TARGET_TEXT, },),
          models: TRANSLATE_MODELS,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);
        /** Translator sheets about the citing slice. */
        const sheets = requests.filter(function isCitingTranslator(request,): boolean {
          return (request.stage === 'translation_report') && request.content.includes('小猫在窗台上睡到中午',);
        },);

        expect(sheets.length,).toBeGreaterThan(0,);
        for (const sheet of sheets) {
          expect(sheet.content,).toContain(SOURCE_NOTE,);
          expect(sheet.content,).toContain(TARGET_NOTE,);
        }
      },
    },),
  ],
},);
