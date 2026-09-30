/**
 Tests for what {@link settleTranslateSlice} does with the winner the judges
 chose: the quote guard, the transcript the archive carries past its
 original, a disputed slice whose repair text may not stand in, and a slice
 the floor can compare nothing on, where nobody is asked (ledger B43).

 WHY A DRIVEN SLICE RATHER THAN THE HELPERS ALONE. Each helper has its own
 file, and none of them shows what the slice settles on: the quote guard
 compares the judged part of the archive rather than the whole, the held-out
 transcript is spliced back onto the winner here and nowhere else, and the
 dispute decides here whether the repair text goes to the translators at
 all.

 Every exchange is recorded, and a sheet this script does not know is kept
 rather than answered, so a case that fell into an unplanned round fails on
 that rather than passing on whatever the round left behind.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ArchiveDispute,
  assertUnheardKeptIncumbent,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  describeArchiveDispute,
  messageText,
  prepareDocumentPair,
  quoteLossRefusalFinding,
  type RosterModelId,
  settleTranslateSlice,
  type SyntheticClient,
  type TranslateSliceRecord,
} from '../dist/final/node/index.mjs';
import { capturingLogger, } from './capturing-logger.test-fixture.ts';
import {
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_HYPER_VISION,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
} from './roster-seats.test-fixture.ts';
import { candidateCarrying, } from './translate-ballot.test-fixture.ts';

//region Fixtures

/**
 Models that render the slice.
 */
const TRANSLATORS: readonly RosterModelId[] = [
  SEAT_SYNTHETIC_VISION_WITHHELD,
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_HYPER_VISION,
];

/**
 Whole roster the judges are drawn from, translators included.
 */
const JUDGES: readonly RosterModelId[] = [
  ...TRANSLATORS,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
];

/**
 Component the original ends with and the archive repeats, built from parts so
 no template placeholder sits in this file's source.
 */
const PHOTO_MARKER = `<PhotoScroll photos={['${['$', '{path}',].join('',)}/photos/letter.webp']} />`;

/**
 Transcript of the photographed letter, which the archive carries past the
 end of its original.
 */
const TRANSCRIPT = '> Dear cat, rest well.';

/**
 What one settlement sent and said.
 */
type Settlement = {
  /**
   Settled record.
   */
  readonly record: TranslateSliceRecord;

  /**
   Every sheet sent, translators' and judges' alike.
   */
  readonly sheets: readonly string[];

  /**
   Schemas no reply was scripted for, which a planned case never sends.
   */
  readonly unplanned: readonly string[];

  /**
   Every line the driver logged.
   */
  readonly said: readonly string[];
};

/**
 Builds a client whose translators all return one rendering and whose judges
 all back it.

 @param rendering - what every translator returns

 @param sheets - log every sheet is appended to

 @param unplanned - log every schema without a scripted reply is appended to

 @returns Client over both halves of a round

 @example
 ```ts
 const client = scriptedClient({ rendering: 'The cat dozes.', sheets: [], unplanned: [], },);
 ```
 */
function scriptedClient(
  {
    rendering,
    sheets,
    unplanned,
  }: {
    readonly rendering: string;
    readonly sheets: string[];
    readonly unplanned: string[];
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused by the translate lane',);
    },
    quotas: async () => {
      throw new Error('quotas unused by the translate lane',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       Which sheet this is.
       */
      const schema = request.responseFormat?.json_schema.name ?? '';

      /**
       Whole sheet as sent.
       */
      const content = request.messages
        .map(function textOf(message,): string {
          return messageText({ message, },);
        },)
        .join('\n',);
      sheets.push(content,);

      /**
       Reply this sheet gets, absent where none is scripted.
       */
      const value: unknown = (schema === 'translation_report')
        ? { translation: rendering, }
        : (schema === 'candidate_ballot')
          ? {
            best: candidateCarrying({
              content,
              needle: rendering,
            },),
            reason: 'the scripted rendering',
          }
          : undefined;
      if ((value === undefined) || (!request.validate(value,))) {
        unplanned.push(schema,);
        throw new Error(`no scripted reply for ${schema}`,);
      }
      return {
        kind: 'ok',
        value: value as ValueT,
        rawText: JSON.stringify(value,),
      };
    },
  };
}

/**
 Settles the one slice of a pair with every translator returning one
 rendering and every judge backing it.

 @param sourceText - original page, one slice

 @param targetText - archive page, one slice

 @param rendering - what every translator returns

 @param archiveDispute - dispute over the slice, absent where there is none

 @returns Record, sheets, unplanned schemas and log lines

 @example
 ```ts
 const settled = await settle({ sourceText: '猫睡了。', targetText: 'The cat slept.', rendering: 'The cat dozed.', },);
 ```
 */
async function settle(
  {
    sourceText,
    targetText,
    rendering,
    archiveDispute,
  }: {
    readonly sourceText: string;
    readonly targetText: string;
    readonly rendering: string;
    readonly archiveDispute?: ArchiveDispute;
  },
): Promise<Settlement> {
  /**
   Preparation the slice comes from.
   */
  const prepared = prepareDocumentPair({
    sourceText,
    targetText,
  },);
  expect(prepared.slices,).toHaveLength(1,);

  /**
   The pair's one slice.
   */
  const [slice,] = prepared.slices;
  if (slice === undefined)
    throw new Error('the pair prepares into one slice',);
  const sheets: string[] = [];
  const unplanned: string[] = [];
  const said: string[] = [];
  const record = await settleTranslateSlice({
    client: scriptedClient({
      rendering,
      sheets,
      unplanned,
    },),
    slice,
    prepared,
    models: {
      translatorModelIds: TRANSLATORS,
      judgeModelIds: JUDGES,
    },
    ...((archiveDispute === undefined) ? {} : { archiveDispute, }),
    signal: AbortSignal.timeout(30_000,),
    perCallTimeoutMs: 5_000,
    l: capturingLogger({ messages: said, },),
  },);
  return {
    record,
    sheets,
    unplanned,
    said,
  };
}

//endregion Fixtures

await describe({
  name: `${settleTranslateSlice.name} quote guard`,
  children: [
    it({
      name: 'REFUSES A WINNER THAT DROPS A QUOTE FROM INSIDE A CONTAINER TAG, which the floor passes because '
        + 'the container is still there, keeping the archive and storing the counts the guard compared '
        + '(ledger B42)',
      fn: async () => {
        /**
         Archive wording, one quote inside a folded block.
         */
        const archive = '<details>\n\n> Feed me at noon.\n\n</details>';

        /**
         Winner, the same block with the quote made prose.
         */
        const rendering = '<details>\n\nShe asked to be fed at noon.\n\n</details>';
        const settled = await settle({
          sourceText: '<details>\n\n> 中午喂我。\n\n</details>',
          targetText: archive,
          rendering,
        },);
        expect(settled.unplanned,).toEqual([],);
        expect(settled.record.stageResult.text,).toBe(rendering,);
        expect(settled.record.disposition,).toBe('refused-quote-loss',);
        expect(settled.record.outputText,).toBe(archive,);
        expect(settled.record.changed,).toBe(false,);

        /**
         Counts the refusal stores.
         */
        const quotedPassages = (settled.record.disposition === 'refused-quote-loss')
          ? settled.record.quotedPassages
          : undefined;
        expect(quotedPassages,).toEqual({
          archive: 1,
          replacement: 0,
        },);
        expect(settled.said,).toContain(quoteLossRefusalFinding({
          sliceIndex: 0,
          quotedPassages: {
            archive: 1,
            replacement: 0,
          },
        },),);
      },
    },),

    it({
      name: 'SHIPS A WINNER WHOSE QUOTE OPENS ON THE LINE AFTER A PARAGRAPH\'S, which the parser and the floor read '
        + 'as the archive\'s quote and the blank-line count read as none (ledger B42, hulicaijia24 slice 2)',
      fn: async () => {
        /**
         Winner, the quote kept with no blank line opening it.
         */
        const rendering = 'The cat left a note:\n> Feed me at noon.';
        const settled = await settle({
          sourceText: '猫留了一张纸条：\n\n> 中午喂我。',
          targetText: 'The cat was leaving a note:\n\n> Feed me at noon.',
          rendering,
        },);
        expect(settled.unplanned,).toEqual([],);
        expect(settled.record.disposition,).toBe('stage-result',);
        expect(settled.record.outputText,).toBe(rendering,);
        expect(settled.record.changed,).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: `${settleTranslateSlice.name} target-only transcript`,
  children: [
    it({
      name: 'HOLDS THE TRANSCRIPT THE ARCHIVE CARRIES PAST ITS ORIGINAL OUT OF EVERY SHEET, says so, and splices it '
        + 'back onto the winner, so a replacement cannot delete the accessible reading of a picture',
      fn: async () => {
        /**
         Judged part of the archive, the component the original ends with
         included.
         */
        const judged = `The cat slept.\n\n${PHOTO_MARKER}`;

        /**
         Archive page, the transcript past the component.
         */
        const archive = `${judged}\n\n${TRANSCRIPT}`;

        /**
         Winner, rendering the original alone.
         */
        const rendering = `The cat dozed.\n\n${PHOTO_MARKER}`;
        const settled = await settle({
          sourceText: `猫睡了。\n\n${PHOTO_MARKER}`,
          targetText: archive,
          rendering,
        },);
        expect(settled.unplanned,).toEqual([],);
        expect(settled.sheets.length,).toBeGreaterThan(0,);
        expect(settled.sheets.some(function showsTranscript(sheet,): boolean {
          return sheet.includes('Dear cat, rest well.',);
        },),).toBe(false,);
        expect(settled.said,).toContain(
          `translate slice 0: holding ${String(TRANSCRIPT.length,)} characters of target-only English out of `
            + `translation, judging ${String(judged.length,)} of ${String(archive.length,)}`,
        );
        expect(settled.record.disposition,).toBe('stage-result',);
        expect(settled.record.outputText,).toBe(`${rendering}\n\n${TRANSCRIPT}`,);
      },
    },),
  ],
},);

await describe({
  name: `${settleTranslateSlice.name} archive dispute`,
  children: [
    it({
      name: 'SENDS NO SHEET THE REPAIR TEXT where the dispute says it may not stand in, judges the archive under the '
        + 'dispute instead, and ships the winner over it (owner, 2026-09-27, "No eligible standing")',
      fn: async () => {
        /**
         Repair lane's text, which the checkers did not confirm.
         */
        const standIn = 'The cat slept on the sill all afternoon.';

        /**
         Dispute over the slice.
         */
        const archiveDispute: ArchiveDispute = {
          sliceIndex: 0,
          standIn,
          standInEligible: false,
          standInRefusal: 'unresolved',
          acceptedClaims: ['accuracy/addition major: The cat did not swallow pills.',],
        };

        /**
         Winner.
         */
        const rendering = 'The cat napped on the windowsill.';
        const settled = await settle({
          sourceText: '猫猫在窗台上打盹。',
          targetText: 'The cat is doing the sleeping on the windowsill and swallowed pills.',
          rendering,
          archiveDispute,
        },);
        expect(settled.unplanned,).toEqual([],);
        expect(settled.sheets.length,).toBeGreaterThan(0,);
        expect(settled.sheets.some(function showsStandIn(sheet,): boolean {
          return sheet.includes(standIn,);
        },),).toBe(false,);
        expect(settled.record.findings,).toContain(describeArchiveDispute({ dispute: archiveDispute, },),);
        expect(settled.record.outputText,).toBe(rendering,);
      },
    },),

    it({
      name: 'SENDS THE REPAIR TEXT AS THE INCUMBENT where the dispute says it may stand in, the positive control for '
        + 'the case beside it',
      fn: async () => {
        /**
         Repair lane's text, which the checkers confirmed.
         */
        const standIn = 'The cat slept on the sill all afternoon.';
        const settled = await settle({
          sourceText: '猫猫在窗台上打盹。',
          targetText: 'The cat is doing the sleeping on the windowsill and swallowed pills.',
          rendering: 'The cat napped on the windowsill.',
          archiveDispute: {
            sliceIndex: 0,
            standIn,
            standInEligible: true,
            acceptedClaims: ['accuracy/addition major: The cat did not swallow pills.',],
          },
        },);
        expect(settled.unplanned,).toEqual([],);
        expect(settled.sheets.some(function showsStandIn(sheet,): boolean {
          return sheet.includes(standIn,);
        },),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: `${settleTranslateSlice.name} where the floor compares nothing`,
  children: [
    it({
      name: 'SETTLES ON THE ARCHIVE\'S OWN BYTES with nobody asked, on a plain slice and on a disputed one whose '
        + 'repair text may stand in, since no floor could check that text either; the record is one a slice that '
        + 'heard nobody may keep (ledger B43)',
      fn: async () => {
        /**
         Original with an expression the strict grammar never closes.
         */
        const sourceText = '猫猫在{窗台上打盹。';

        /**
         Archive wording of the slice.
         */
        const targetText = 'The cat is doing the sleeping on the windowsill.';

        /**
         Each settlement: no dispute, then a dispute whose repair text may
         stand in.
         */
        const settled = await Promise.all([
          settle({
            sourceText,
            targetText,
            rendering: 'The cat dozed on the windowsill.',
          },),
          settle({
            sourceText,
            targetText,
            rendering: 'The cat dozed on the windowsill.',
            archiveDispute: {
              sliceIndex: 0,
              standIn: 'The cat slept on the sill all afternoon.',
              standInEligible: true,
              acceptedClaims: ['accuracy/addition major: The cat did not swallow pills.',],
            },
          },),
        ],);

        expect(settled.map(function whatSettled({
          record,
          sheets,
          unplanned,
        },) {
          // THE CHECK THE DRIVER MAKES before it keeps a record whose stage
          // heard nobody, which throws on anything but the archive unchanged.
          assertUnheardKeptIncumbent({
            sliceIndex: 0,
            record,
            incumbentText: targetText,
          },);
          return {
            sheets: sheets.length,
            unplanned,
            decision: record.stageResult
              .decision,
            outputText: record.outputText,
            changed: record.changed,
            disposition: record.disposition,
          };
        },),).toEqual([0, 1,].map(function expected() {
          return {
            sheets: 0,
            unplanned: [],
            decision: 'unfloored',
            outputText: targetText,
            changed: false,
            disposition: 'stage-result',
          };
        },),);
      },
    },),
  ],
},);
