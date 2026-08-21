/**
 * Tests for the consolidation's deciding half, composed end to end.
 *
 * WHAT THIS FILE EXISTS TO STOP is the defect the stage was built to close, at
 * one level up. `floorConsolidateSlate`, `gateConsolidatedSlice` and
 * `wrapConsolidation` were each built, tested, and called by nothing. A unit
 * test of a part cannot say the part is reached, so these drive the composition
 * and assert which rounds were bought.
 *
 * THE TRANSPORT ROUTES ON SHEET CONTENT, NOT ON CALL ORDER. A counter over
 * calls looks like it works and breaks silently: a schema-mismatch retry or a
 * quorum that proceeds early shifts every later index, and the wrong route then
 * answers with a well-formed reply nobody notices is misaddressed. Each case
 * asserts how many calls each route served, which is the router's own positive
 * control.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  buildTranslateCandidates,
  createSyntheticClient,
  describeSlate,
  type ProposalValidity,
  rotateCandidates,
  settleConsolidation,
} from '../dist/final/node/index.mjs';

/**
 * Logger the stage writes through, whose output is not under test.
 */
const l = tagged({ tag: 'consolidate-settle-test', },);

/**
 * Roster of three, the smallest that can produce a two-to-one split.
 */
const ROSTER = [
  'hf:zai-org/GLM-5.2',
  'hf:Qwen/Qwen3.8-27B',
  'hf:moonshotai/Kimi-K3',
] as const;

/**
 * One seated voice, narrowed to the roster so a fixture cannot invent a model
 * the provider catalogue does not carry.
 */
type RosterModelId = (typeof ROSTER)[number];

/**
 * Per-call bound, generous because the transport answers instantly.
 */
const CALL_TIMEOUT_MS = 5_000;

/**
 * Phrase separating the gate's sheet from the selector's, taken from the sheet
 * itself rather than invented, so a rewording breaks the router loudly instead
 * of silently routing every call to one side.
 *
 * CARRIES NO QUOTE CHARACTERS ON PURPOSE. The router reads the serialised
 * exchange, where every quote inside a sheet arrives escaped, so a marker
 * spelled with quotes matches nothing and every gate call is answered with a
 * selector ballot the gate then reads as a schema mismatch. That is what the
 * per-route counts exist to catch, and they caught exactly this.
 *
 * `lane-contest-wire.ts` carries the same sentence, which does not matter here:
 * this stage never asks the lane contest anything, so within one settlement the
 * phrase appears in the gate sheet alone.
 */
const GATE_MARKER = 'Return JSON: choice one of';

/**
 * The slice every case decides about.
 */
const SUBJECT = {
  sourceText: '猫在窗边睡着了。她四点醒来。',
  incumbentText: 'The cat fell asleep by the window and woke at four in the afternoon.',
};

/**
 * Wording in place when the stage begins, written as the wrap rule would have
 * it so a consolidation is not demoted by accident.
 */
const STANDING = 'The cat fell asleep by the window.\nShe woke at four.';

/**
 * A consolidation that differs from what stands in its content, emitted as one
 * line because producers do that.
 */
const FRESH = 'The cat fell asleep beside the window. She woke at four in the afternoon.';

/**
 * Builds one voice as the producing half hands them over.
 *
 * @param modelId - voice that wrote it
 *
 * @param translation - wording it proposed
 *
 * @returns Voice shaped as the gather round returns one
 *
 * @example
 * ```ts
 * const voice = voiceOf({ modelId: ROSTER[0], translation: FRESH, },);
 * ```
 */
function voiceOf(
  {
    modelId,
    translation,
  }: {
    readonly modelId: RosterModelId;
    readonly translation: string;
  },
) {
  return {
    modelId,
    value: { translation, },
  };
}

/**
 * Builds one structural verdict.
 *
 * @param modelId - voice the verdict belongs to
 *
 * @param valid - whether the guard passed it
 *
 * @returns Verdict shaped as the produce half reports one
 *
 * @example
 * ```ts
 * const checked = validityOf({ modelId: ROSTER[0], valid: true, },);
 * ```
 */
function validityOf(
  { modelId, valid, }: { readonly modelId: string; readonly valid: boolean; },
): ProposalValidity {
  return {
    modelId,
    validation: valid
      ? {
        kind: 'valid',
        pageGrammar: 'strict',
      }
      : {
        kind: 'invalid',
        findings: ['The page as it stands is 2 blocks and your rendering is 1.',],
      },
  } as ProposalValidity;
}

/**
 * Works out which numbered candidate carries one rendering, by replaying the
 * rotation the judges will see.
 *
 * NOT HARDCODED, because the slate is rotated by a hash of the source so the
 * incumbent does not sit in one position across a document. A fixture that
 * guessed the number would pass or fail on the fixture's wording rather than on
 * the stage's behaviour.
 *
 * @param texts - proposals reaching the slate, in roster order
 *
 * @param wanted - rendering whose position is sought
 *
 * @returns One-based ballot index naming it
 *
 * @example
 * ```ts
 * const best = positionOfText({ texts: [FRESH,], wanted: FRESH, },);
 * ```
 */
function positionOfText(
  { texts, wanted, }: { readonly texts: readonly string[]; readonly wanted: string; },
): number {
  const built = buildTranslateCandidates({
    voices: texts.map(function toVoice(translation, at,) {
      return voiceOf({ modelId: ROSTER[at] ?? ROSTER[0], translation, },);
    },),
    translatorModelIds: ROSTER,
    incumbentText: STANDING,
  },);

  const entries = describeSlate({
    candidates: rotateCandidates({
      candidates: built.candidates,
      sourceText: SUBJECT.sourceText,
    },),
  },);

  const found = entries.find(function carriesWanted(entry,) {
    return entry.text === wanted;
  },);
  if (found === undefined)
    throw new Error('the wanted rendering never reached the slate, so the fixture is wrong',);
  return found.index;
}

/**
 * Builds a client that answers each round from its own script.
 *
 * @param judgeReply - body every slate judge returns
 *
 * @param gateReply - body every gate voice returns
 *
 * @param served - counter the caller reads afterwards
 *
 * @returns Client over a routing transport
 *
 * @example
 * ```ts
 * const client = routedClient({ judgeReply, gateReply, served, },);
 * ```
 */
function routedClient(
  {
    judgeReply,
    gateReply,
    served,
  }: {
    readonly judgeReply: string;
    readonly gateReply: string;
    readonly served: { judge: number; gate: number; };
  },
) {
  return createSyntheticClient({
    apiKey: 'test-key',
    transport: async function routingTransport(exchange,) {
      /**
       * Everything the call is sending, which is where the sheet lives.
       */
      const sent = JSON.stringify(exchange,);

      /**
       * Whether this call carries the gate's sheet rather than the selector's.
       */
      const isGate = sent.includes(GATE_MARKER,);
      if (isGate)
        served.gate += 1;
      else
        served.judge += 1;

      return {
        status: 200,
        bodyText: `data: ${
          JSON.stringify({
            choices: [
              {
                index: 0,
                delta: { content: isGate ? gateReply : judgeReply, },
              },
            ],
          },)
        }\n\ndata: [DONE]\n\n`,
      };
    },
  },);
}

/**
 * Builds a slate judge's reply.
 *
 * @param best - ballot index, zero to decline
 *
 * @returns Reply body a judge would return
 *
 * @example
 * ```ts
 * const reply = judgeBallot({ best: 0, },);
 * ```
 */
function judgeBallot({ best, }: { readonly best: number; },): string {
  return JSON.stringify({
    best,
    reason: 'it says what the original says',
  },);
}

/**
 * Builds a gate voice's reply.
 *
 * @param choice - rendering this voice names
 *
 * @returns Reply body a gate voice would return
 *
 * @example
 * ```ts
 * const reply = gateBallot({ choice: 'standing', },);
 * ```
 */
function gateBallot({ choice, }: { readonly choice: string; },): string {
  return JSON.stringify({
    choice,
    unsupported: [],
    dropped: [],
    reason: 'the original supports it',
  },);
}

/**
 * Runs one settlement over a scripted roster.
 *
 * @param voices - proposals reaching the stage
 *
 * @param validity - what the guard made of each
 *
 * @param standingText - wording in place, overridable to test its absence
 *
 * @param judgeReply - body every slate judge returns
 *
 * @param gateReply - body every gate voice returns
 *
 * @param producedFindings - what gathering and repairing recorded
 *
 * @returns Settlement beside the calls each round served
 *
 * @example
 * ```ts
 * const { settled, served, } = await settleWith({ voices, validity, },);
 * ```
 */
async function settleWith(
  {
    voices,
    validity,
    standingText = STANDING,
    judgeReply = judgeBallot({ best: 0, },),
    gateReply = gateBallot({ choice: 'standing', },),
    producedFindings = [],
  }: {
    readonly voices: readonly {
      readonly modelId: RosterModelId;
      readonly value: { readonly translation: string; };
    }[];
    readonly validity: readonly ProposalValidity[];
    readonly standingText?: string;
    readonly judgeReply?: string;
    readonly gateReply?: string;
    readonly producedFindings?: readonly string[];
  },
) {
  /**
   * Calls each route served, which every case asserts on.
   */
  const served = {
    judge: 0,
    gate: 0,
  };

  const settled = await settleConsolidation({
    client: routedClient({
      judgeReply,
      gateReply,
      served,
    },),
    roster: ROSTER,
    subject: SUBJECT,
    voices,
    validity,
    producedFindings,
    standingText,
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS * 8,),
    perCallTimeoutMs: CALL_TIMEOUT_MS,
    l,
  },);

  return {
    settled,
    served,
  };
}

await describe({
  name: settleConsolidation.name,
  children: [
    it({
      name: 'BUYS NOTHING AT ALL FOR A SLATE THE GUARD REJECTED ENTIRELY, and records it as '
        + 'incumbent-only rather than as a decision. This is the case the band pair hit twice: '
        + 'Zha_Ke#1 finished its repair round with five candidates and zero valid ones, in both runs, '
        + 'and a consolidation shipped at both',
      fn: async () => {
        const { settled, served, } = await settleWith({
          voices: ROSTER.map(function toVoice(modelId,) {
            return voiceOf({ modelId, translation: FRESH, },);
          },),
          validity: ROSTER.map(function toVerdict(modelId,) {
            return validityOf({ modelId, valid: false, },);
          },),
        },);

        expect(settled.terminal,).toBe('incumbent-only',);
        expect(settled.text,).toBe(STANDING,);
        expect(served.judge,).toBe(0,);
        expect(served.gate,).toBe(0,);
      },
    },),

    it({
      name: 'READS AN ABSENT STANDING TEXT AHEAD OF AN EMPTY SLATE when a slice is both at once, '
        + 'because the missing standing text is the older fact: the floor would have refused a slate '
        + 'this slice was never going to use. A census counting terminal states has to be told which '
        + 'one it is',
      fn: async () => {
        const { settled, served, } = await settleWith({
          standingText: '',
          voices: ROSTER.map(function toVoice(modelId,) {
            return voiceOf({ modelId, translation: FRESH, },);
          },),
          validity: ROSTER.map(function toVerdict(modelId,) {
            return validityOf({ modelId, valid: false, },);
          },),
        },);

        expect(settled.terminal,).toBe('no-standing-text',);
        expect(served.judge,).toBe(0,);
        expect(served.gate,).toBe(0,);
      },
    },),

    it({
      name: 'KEEPS A REFUSED VOICE OFF THE SLATE AND ON THE RECORD, which the floor alone cannot do: '
        + 'it names refusals only when nothing survived, and run 8 carried 7 invalid candidates across '
        + 'slices that all shipped normally with nothing downstream able to see them',
      fn: async () => {
        const { settled, } = await settleWith({
          voices: ROSTER.map(function toVoice(modelId,) {
            return voiceOf({ modelId, translation: FRESH, },);
          },),
          validity: [
            validityOf({ modelId: ROSTER[0], valid: true, },),
            validityOf({ modelId: ROSTER[1], valid: false, },),
            validityOf({ modelId: ROSTER[2], valid: false, },),
          ],
        },);

        expect(settled.floor.kind,).toBe('proposals',);
        expect(settled.verdicts.length,).toBe(3,);
        expect(
          settled.verdicts.filter(function refused(verdict,) {
            return verdict.kind === 'invalid';
          },).length,
        ).toBe(2,);
        expect(settled.verdicts[1]?.findings.length,).toBeGreaterThan(0,);
      },
    },),

    it({
      name: 'KEEPS THE STANDING TEXT WHEN EVERY JUDGE DECLINES, and never reaches the gate. The gate '
        + 'question is whether a consolidation beats what stands, and there is no consolidation to ask '
        + 'about once the judges have kept the incumbent',
      fn: async () => {
        const { settled, served, } = await settleWith({
          voices: [voiceOf({ modelId: ROSTER[0], translation: FRESH, },),],
          validity: [validityOf({ modelId: ROSTER[0], valid: true, },),],
          judgeReply: judgeBallot({ best: 0, },),
        },);

        expect(settled.terminal,).toBe('slate-kept-standing',);
        expect(settled.text,).toBe(STANDING,);
        expect(served.judge,).toBeGreaterThan(0,);
        expect(served.gate,).toBe(0,);
      },
    },),

    it({
      name: 'CARRIES THE PRODUCE HALF\'S FINDINGS INTO WHAT THE JUDGING HALF REPORTS, which ProducedSlate '
        + 'requires by contract and the stage did not do: a repair round\'s record stopped at the stage '
        + 'boundary, so a run could not tell a clean slate from one that took two attempts',
      fn: async () => {
        /**
         * A finding only the gather round could have produced.
         */
        const gathered = 'hf:cat/Cat-A answered with nothing to ship, so its voice was lost';

        const { settled, } = await settleWith({
          voices: [voiceOf({ modelId: ROSTER[0], translation: FRESH, },),],
          validity: [validityOf({ modelId: ROSTER[0], valid: true, },),],
          producedFindings: [gathered,],
        },);

        expect(settled.decided?.findings.includes(gathered,),).toBe(true,);
      },
    },),

    it({
      name: 'SHIPS A CONSOLIDATION BOTH ROUNDS BACKED, WRAPPED, which is the whole point of the stage: '
        + 'the judges pick it, the gate agrees the original supports it, and the wrap gives it the '
        + 'semantic line breaks both lanes apply at their own assembly step and this stage had none',
      fn: async () => {
        const { settled, served, } = await settleWith({
          voices: [voiceOf({ modelId: ROSTER[0], translation: FRESH, },),],
          validity: [validityOf({ modelId: ROSTER[0], valid: true, },),],
          judgeReply: judgeBallot({ best: positionOfText({ texts: [FRESH,], wanted: FRESH, },), },),
          gateReply: gateBallot({ choice: 'consolidated', },),
        },);

        expect(settled.terminal,).toBe('consolidated',);
        expect(settled.rewrapped,).toBe(true,);
        expect(settled.demoted,).toBe(false,);
        expect(settled.text.split('\n',).length,).toBeGreaterThan(1,);
        expect(served.gate,).toBeGreaterThan(0,);
      },
    },),

    it({
      name: 'KEEPS THE STANDING TEXT WHEN THE GATE REFUSES A CONSOLIDATION THE JUDGES CHOSE, because '
        + 'the selector question is a preference while the gate question is what the original supports, '
        + 'and the second measured better on the lane pair',
      fn: async () => {
        const { settled, served, } = await settleWith({
          voices: [voiceOf({ modelId: ROSTER[0], translation: FRESH, },),],
          validity: [validityOf({ modelId: ROSTER[0], valid: true, },),],
          judgeReply: judgeBallot({ best: positionOfText({ texts: [FRESH,], wanted: FRESH, },), },),
          gateReply: gateBallot({ choice: 'standing', },),
        },);

        expect(settled.terminal,).toBe('gate-kept-standing',);
        expect(settled.text,).toBe(STANDING,);
        expect(settled.demoted,).toBe(false,);
        expect(served.gate,).toBeGreaterThan(0,);
      },
    },),

    it({
      name: 'SEPARATES A WRAP THAT ERASED THE DIFFERENCE FROM A GATE THAT REFUSED, though both keep the '
        + 'standing text. Three of the 20 real consolidations in the band pair differed from what stood '
        + 'only in where the lines broke, and each was recorded as a consolidation that shipped',
      fn: async () => {
        /**
         * The standing text as a producer that ignored the wrap rule emits it.
         */
        const unwrapped = STANDING.replaceAll('\n', ' ',);

        const { settled, } = await settleWith({
          voices: [voiceOf({ modelId: ROSTER[0], translation: unwrapped, },),],
          validity: [validityOf({ modelId: ROSTER[0], valid: true, },),],
          judgeReply: judgeBallot({ best: positionOfText({ texts: [unwrapped,], wanted: unwrapped, },), },),
          gateReply: gateBallot({ choice: 'consolidated', },),
        },);

        expect(settled.terminal,).toBe('wrap-erased-difference',);
        expect(settled.text,).toBe(STANDING,);
        expect(settled.demoted,).toBe(true,);
      },
    },),
  ],
},);
