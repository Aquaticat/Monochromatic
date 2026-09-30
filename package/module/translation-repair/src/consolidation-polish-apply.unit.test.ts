/**
 Tests pre-polish baseline contributor authority floor.
 
 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  applyFinalPolish,
  NaturalnessRepairInterruptedError,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';
import {
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
} from './roster-seats.test-fixture.ts';

/**
 Invented-size roster for every polish role.
 */
const ROSTER = [
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
] as const;

/**
 Dispute note the consolidate gate read over this slice.
 */
const DISPUTE_NOTE = 'ARCHIVE RENDERING DISPUTED: the adjudicators accepted 1 claim(s) about the tabby\'s nap.';

/**
 Client proposing one rewrite, recording each polish gate sheet.

 @param gateSheets - where each polish gate sheet is recorded

 @param sheetsBySchema - where every sheet is recorded under its reply
 schema's name, for the cases reading what each role was shown

 @param rewrite - the refiner's proposal, a faithful one unless a case needs
 another

 @returns Scripted client
 */
function recordingClient(
  {
    gateSheets,
    sheetsBySchema,
    rewrite = 'The tabby napped in the warm window all afternoon.',
  }: {
    readonly gateSheets: string[];
    readonly sheetsBySchema?: Map<string, readonly string[]>;
    readonly rewrite?: string;
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused by structured polish stages',);
    },
    chatJson: async <ValueT,>(request: ChatJsonRequest<ValueT>,): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       Stage the request belongs to, by its reply schema.
       */
      const schema = request.responseFormat?.json_schema.name ?? '';
      if (schema === 'consolidation_polish_gate')
        gateSheets.push(JSON.stringify(request.messages,),);
      sheetsBySchema?.set(schema, [
        ...(sheetsBySchema.get(schema,) ?? []),
        JSON.stringify(request.messages,),
      ],);
      /**
       Reply for the stage.
       */
      const value: unknown = (schema === 'refine_report')
        ? { rewrites: [{ paragraph: 1, newText: rewrite, },], }
        : (schema === 'candidate_ballot')
        ? { best: 1, reason: 'more idiomatic', }
        : (schema === 'consolidation_polish_gate')
        ? { choice: 'polished', unsupported: [], dropped: [], reason: 'equally faithful', }
        : (schema === 'absolute_naturalness_review')
        ? { acceptable: true, findings: [], reason: 'publication-ready', }
        : {};
      if (!request.validate(value,))
        throw new Error(`synthetic ${schema} reply failed validation`,);
      return {
        kind: 'ok',
        value,
        rawText: JSON.stringify(value,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused by polish stages',);
    },
  };
}

await describe({
  name: applyFinalPolish.name,
  children: [
    it({
      name: 'PAUSES INVALID BASE before no-polish fallback can retain contributor respelling',
      fn: async () => {
        const client: SyntheticClient = {
          chatText: async () => {
            throw new Error('model calls must not run before baseline floor',);
          },
          chatJson: async () => {
            throw new Error('model calls must not run before baseline floor',);
          },
          quotas: async () => {
            throw new Error('meter unused by baseline floor fixture',);
          },
        };
        let caught: unknown;
        try {
          await applyFinalPolish({
            client,
            settlement: {
              terminal: 'consolidated',
              text: 'Contributors for this entry: Snowflake',
              floor: { kind: 'proposals', validModelIds: [], },
              verdicts: [],
              rewrapped: false,
              demoted: false,
              findings: [],
            },
            subject: {
              sourceText: '本条目贡献者：雪猫',
              incumbentText: 'Contributors for this entry: [Snow](https://example.test/snow)',
            },
            lineStructured: false,
            sliceIndex: 1,
            eligible: true,
            signal: AbortSignal.timeout(5_000,),
            perCallTimeoutMs: 5_000,
            l: tagged({ tag: 'contributor-baseline-floor-test', },),
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(NaturalnessRepairInterruptedError,);
      },
    },),
    it({
      name: 'CARRIES the slice\'s dispute note to every polish gate sheet (ledger S12: the consolidate gate read '
        + 'it before approving the base, and the polish gate deciding a rewrite of that base never did)',
      fn: async () => {
        /**
         Every polish gate sheet the settlement sent.
         */
        const gateSheets: string[] = [];
        await applyFinalPolish({
          client: recordingClient({ gateSheets, },),
          settlement: {
            terminal: 'consolidated',
            text: 'The tabby spent the whole afternoon napping in the warm window.',
            floor: { kind: 'proposals', validModelIds: [], },
            verdicts: [],
            rewrapped: false,
            demoted: false,
            findings: [],
          },
          subject: {
            sourceText: '虎斑猫整个下午都在温暖的窗边打盹。',
            incumbentText: 'The tabby dozed by the warm window all afternoon long.',
            archiveDisputeNote: DISPUTE_NOTE,
          },
          lineStructured: false,
          sliceIndex: 2,
          polishConfig: {
            refinerModelIds: [ROSTER[0],],
            judgeModelIds: ROSTER,
            gateModelIds: ROSTER,
            declaredNames: [],
            definitions: '',
          },
          eligible: true,
          signal: AbortSignal.timeout(20_000,),
          perCallTimeoutMs: 5_000,
          l: tagged({ tag: 'polish-dispute-note-test', },),
        },);
        expect(gateSheets.length,).toBeGreaterThan(0,);
        expect(gateSheets.every(function carriesNote(sheet,): boolean {
          return sheet.includes(DISPUTE_NOTE,);
        },),).toBe(true,);
      },
    },),
    it({
      name: 'REFUSES a polish that lands on a disputed wording (ledger B29): the consolidation refuses the '
        + 'archive\'s disputed reading as standing, lane offer and proposal, and the polish ran after it '
        + 'without the list',
      fn: async () => {
        /** Text the settlement approved before the polish. */
        const base = 'The tabby spent the whole afternoon napping in the warm window.';
        /** The final settlement over a slice whose disputed wording is exactly what the refiner proposes. */
        const final = await applyFinalPolish({
          client: recordingClient({ gateSheets: [], },),
          settlement: {
            terminal: 'consolidated',
            text: base,
            floor: { kind: 'proposals', validModelIds: [], },
            verdicts: [],
            rewrapped: false,
            demoted: false,
            findings: [],
          },
          subject: {
            sourceText: '虎斑猫整个下午都在温暖的窗边打盹。',
            incumbentText: 'The tabby dozed by the warm window all afternoon long.',
            archiveDisputeNote: DISPUTE_NOTE,
            disputedWordings: [{
              text: 'The tabby napped in the warm window all afternoon.',
              reason: 'the archive rendering the adjudicators disputed',
            },],
          },
          lineStructured: false,
          sliceIndex: 2,
          polishConfig: {
            refinerModelIds: [ROSTER[0],],
            judgeModelIds: ROSTER,
            gateModelIds: ROSTER,
            declaredNames: [],
            definitions: '',
          },
          eligible: true,
          signal: AbortSignal.timeout(20_000,),
          perCallTimeoutMs: 5_000,
          l: tagged({ tag: 'polish-disputed-wording-test', },),
        },);
        expect(final.text,).toBe(base,);
      },
    },),
    it({
      name: 'CARRIES the slice\'s cited references to the refiner, the rewrite judges and the polish gate (class '
        + 'forty-one), and to no naturalness review, whose sheet judges wording and leaves fidelity to the gate',
      fn: async () => {
        /** What the cited page says, marked so a sheet carrying it is plain. */
        const references = 'CITED PAGE SAYS: the tabby naps in the window every afternoon.';
        /** Every sheet the polish sent, by reply schema. */
        const sheetsBySchema = new Map<string, readonly string[]>();
        await applyFinalPolish({
          client: recordingClient({ gateSheets: [], sheetsBySchema, },),
          settlement: {
            terminal: 'consolidated',
            text: 'The tabby spent the whole afternoon napping in the warm window.',
            floor: { kind: 'proposals', validModelIds: [], },
            verdicts: [],
            rewrapped: false,
            demoted: false,
            findings: [],
          },
          subject: {
            sourceText: '虎斑猫整个下午都在温暖的窗边打盹。',
            incumbentText: 'The tabby dozed by the warm window all afternoon long.',
            referenceContext: references,
          },
          lineStructured: false,
          sliceIndex: 2,
          polishConfig: {
            refinerModelIds: [ROSTER[0],],
            judgeModelIds: ROSTER,
            gateModelIds: ROSTER,
            declaredNames: [],
            definitions: '',
          },
          eligible: true,
          signal: AbortSignal.timeout(20_000,),
          perCallTimeoutMs: 5_000,
          l: tagged({ tag: 'polish-references-test', },),
        },);
        /**
         For each role, how many sheets it was sent and how many carried the
         references.
         */
        const carried = [
          'refine_report',
          'candidate_ballot',
          'consolidation_polish_gate',
          'absolute_naturalness_review',
        ].map(function countFor(schema,): readonly [number, number,] {
          /** Sheets this role was sent. */
          const sheets = sheetsBySchema.get(schema,) ?? [];
          return [
            sheets.length,
            sheets.filter(function carries(sheet,): boolean {
              return sheet.includes(references,);
            },).length,
          ];
        },);
        expect(carried.map(function isAsExpected([sent, carrying,],): string {
          return (sent === 0) ? 'never asked' : ((carrying === sent) ? 'all' : ((carrying === 0) ? 'none' : 'some'));
        },),).toEqual([ 'all', 'all', 'all', 'none', ],);
      },
    },),
    it({
      name: 'REFUSES a polish that drops the declared form from a linked title when the configuration carries the '
        + 'page\'s declared names (class one hundred fourteen), before any gate; the same polish reaches the gate '
        + 'when the configuration carries none',
      fn: async () => {
        /** The approved text, whose linked title carries the declared form. */
        const base = 'The cat said: [Good morning. Eat all your breakfast today, Mittens.]'
          + '(https://example.invalid/breakfast-mimi.html)';
        /**
         Polish of one configuration, with the gate sheets it sent.

         @param declaredNamePairs - the page's declared names, none left out

         @returns Final text beside the gate sheets
         */
        async function polishWith(
          { declaredNamePairs, }: {
            readonly declaredNamePairs?: readonly { readonly source: string; readonly rendering: string; }[];
          },
        ): Promise<{ readonly text: string; readonly gateSheets: readonly string[]; }> {
          /** Every polish gate sheet this run sent. */
          const gateSheets: string[] = [];
          /** Settlement after the polish. */
          const final = await applyFinalPolish({
            client: recordingClient({
              gateSheets,
              rewrite: 'The cat said: [Morning! Eat up your breakfast today, Whiskers.]'
                + '(https://example.invalid/breakfast-mimi.html)',
            },),
            settlement: {
              terminal: 'consolidated',
              text: base,
              floor: { kind: 'proposals', validModelIds: [], },
              verdicts: [],
              rewrapped: false,
              demoted: false,
              findings: [],
            },
            subject: {
              sourceText: '猫咪说：[早安。今天也要乖乖吃饭哦，咪咪。](https://example.invalid/breakfast-mimi.html)',
              incumbentText: base,
            },
            lineStructured: false,
            sliceIndex: 3,
            polishConfig: {
              refinerModelIds: [ROSTER[0],],
              judgeModelIds: ROSTER,
              gateModelIds: ROSTER,
              declaredNames: [],
              definitions: '',
              ...((declaredNamePairs === undefined) ? {} : { declaredNamePairs, }),
            },
            eligible: true,
            signal: AbortSignal.timeout(20_000,),
            perCallTimeoutMs: 5_000,
            l: tagged({ tag: 'polish-declared-pairs-test', },),
          },);
          return {
            text: final.text,
            gateSheets,
          };
        }
        /** Without the page's declared names. */
        const undeclared = await polishWith({},);
        /** With them. */
        const declared = await polishWith({ declaredNamePairs: [{ source: '咪咪', rendering: 'Mittens', },], },);
        expect([
          [undeclared.text === base, undeclared.gateSheets.length > 0,],
          [declared.text === base, declared.gateSheets.length > 0,],
        ],).toEqual([
          [false, true,],
          [true, false,],
        ],);
      },
    },),
  ],
},);
