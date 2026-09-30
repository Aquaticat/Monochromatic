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
 Client proposing one faithful rewrite, recording each polish gate sheet.

 @param gateSheets - where each polish gate sheet is recorded

 @returns Scripted client
 */
function recordingClient({ gateSheets, }: { readonly gateSheets: string[]; },): SyntheticClient {
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
      /**
       Reply for the stage.
       */
      const value: unknown = (schema === 'refine_report')
        ? { rewrites: [{ paragraph: 1, newText: 'The tabby napped in the warm window all afternoon.', },], }
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
  ],
},);
