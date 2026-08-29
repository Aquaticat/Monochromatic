/**
 * Tests for wrapping consolidation proposals before the slate is built.
 *
 * THE DEFECT THIS FILE EXISTS TO STOP is both deciders approving bytes the run
 * then changes. `wrapConsolidation` used to be the only wrap on this path, and
 * it runs AFTER the slate judges have chosen a rendering and the gate has
 * approved it, so what shipped was not what either of them read. Measured over
 * the two most recent runs of the band pair's six entries, 15 of the 16
 * consolidations that shipped came back from that wrap altered.
 *
 * WHAT THIS FILE COVERS is the wrapper alone, as a function. What the STAGE does
 * with it is `consolidate-slate-carries-shipping-text.unit.test.ts`, and the
 * two are apart for a diagnostic reason rather than a tidiness one: the runner
 * abandons a whole FILE once a describe in it fails, so end-to-end cases sharing
 * a file with unit cases go unrun exactly when something has broken and their
 * answer matters most.
 *
 * THE INVARIANT BOTH FILES SERVE: a candidate on the slate is the text that
 * ships if it wins. Proposals arrive wrapped, the incumbent arrives untouched,
 * and a governed slice arrives exactly as its producers wrote it.
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
  wrapConsolidationProposals,
  wrapReplacementText,
} from '../dist/final/node/index.mjs';

/**
 * Logger the stage writes through, whose output is not under test.
 */
const l = tagged({ tag: 'consolidate-proposal-wrap-test', },);

/**
 * Roster of three, matching the sibling settle tests.
 */
const ROSTER = [
  'hf:zai-org/GLM-5.3-Flash',
  'hf:Qwen/Qwen3.8-27B',
  'hf:moonshotai/Kimi-K3',
] as const;

/**
 * One seated voice, narrowed to the roster so a fixture cannot invent a model
 * the provider catalogue does not carry.
 */
type FixtureModelId = (typeof ROSTER)[number];

/**
 * Per-call bound, generous because the transport answers instantly.
 */
const CALL_TIMEOUT_MS = 5_000;

/**
 * Phrase separating the gate's sheet from the selector's, taken from the sheet
 * rather than invented, for the reason `consolidate-settle.unit.test.ts` gives:
 * a marker spelled with quote characters matches nothing once the exchange is
 * serialised, and every gate call is then answered with a selector ballot.
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
 * Wording in place, written as the wrap rule would have it, which is what lane
 * output looks like by the time it stands.
 */
const STANDING = 'The cat fell asleep by the window.\nShe woke at four.';

/**
 * That same wording as a producer emits it, on one line.
 *
 * VERIFIED RATHER THAN ASSUMED, by the case that uses it: wrapping this yields
 * {@link STANDING} byte for byte. A fixture that only nearly matched would make
 * every collapse assertion here report on the wording instead of on the stage.
 */
const REWRAPPING = 'The cat fell asleep by the window. She woke at four.';

/**
 * A proposal that changes the content rather than the line breaks, emitted on
 * one line as producers do.
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
    readonly modelId: FixtureModelId;
    readonly translation: string;
  },
) {
  return {
    modelId,
    value: { translation, },
  };
}

/**
 * Builds a passing structural verdict.
 *
 * Every case here means to reach the slate, so no case needs the refusing
 * shape; `consolidate-settle.unit.test.ts` owns the floor's own behaviour.
 *
 * @param modelId - voice the verdict belongs to
 *
 * @returns Verdict shaped as the produce half reports one
 *
 * @example
 * ```ts
 * const checked = passing({ modelId: ROSTER[0], },);
 * ```
 */
function passing({ modelId, }: { readonly modelId: string; },): ProposalValidity {
  return {
    modelId,
    validation: {
      kind: 'valid',
      pageGrammar: 'strict',
    },
  } as ProposalValidity;
}

/**
 * Renders one passage as it appears inside a serialised request body.
 *
 * NEEDED BECAUSE THE SHEET ASSERTIONS READ JSON. A recorded body is a JSON
 * string, so a passage carrying a newline appears in it with that newline
 * escaped, and searching for the raw text finds nothing.
 *
 * WHAT IS RECORDED MATTERS AS MUCH AS THIS. The router reads the whole
 * serialised exchange, where the body is a string INSIDE another JSON document
 * and every escape is doubled. Sheets are recorded as `bodyJson` for that
 * reason: one level of escaping, which is the level this function produces.
 *
 * @param text - passage as it exists in memory
 *
 * @returns Same passage spelled as a JSON string body carries it
 *
 * @example
 * ```ts
 * const needle = asSent({ text: STANDING, },);
 * ```
 */
function asSent({ text, }: { readonly text: string; },): string {
  return JSON.stringify(text,)
    .slice(1, -1,);
}

/**
 * Works out which numbered candidate carries one rendering, by replaying both
 * the pre-slate wrap and the rotation the judges will see.
 *
 * REPLAYS THE WRAP, unlike the sibling helper it is modelled on. The slate now
 * carries wrapped proposals, so a lookup that skipped the wrap would search for
 * a rendering that is not on the ballot and throw.
 *
 * @param proposals - what each producing voice offered
 *
 * @param incumbentText - wording in place
 *
 * @param lineStructured - whether the verse rule governs this slice
 *
 * @param wanted - rendering whose position is sought
 *
 * @returns One-based ballot index naming it
 *
 * @example
 * ```ts
 * const best = positionOfText({ proposals: [FRESH,], incumbentText: STANDING, lineStructured: false, wanted: FRESH, },);
 * ```
 */
function positionOfText(
  {
    proposals,
    incumbentText,
    lineStructured,
    wanted,
  }: {
    readonly proposals: readonly string[];
    readonly incumbentText: string;
    readonly lineStructured: boolean;
    readonly wanted: string;
  },
): number {
  const built = buildTranslateCandidates({
    voices: wrapConsolidationProposals({
      voices: proposals.map(function toVoice(translation, at,) {
        return voiceOf({ modelId: ROSTER[at] ?? ROSTER[0], translation, },);
      },),
      lineStructured,
    },),
    translatorModelIds: ROSTER,
    incumbentText,
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
 * Runs one settlement over a scripted roster, recording what each round served.
 *
 * ONE PRODUCER IS THE USUAL SHAPE, not three, and the reason is the vote
 * weighting rather than brevity. Judges are drawn from the same roster as
 * producers, and a judge weighing its own roster-mate's proposal is discounted
 * to half a vote. With all three seats producing, three half votes fall short of
 * the minimum weight and every slate declines, so a case meaning to reach the
 * gate never gets there. Cases that buy no round at all may use all three.
 *
 * @param proposals - what each producing voice offered, in roster order
 *
 * @param standingText - wording in place
 *
 * @param lineStructured - whether the verse rule governs this slice
 *
 * @param judgeReply - body every slate judge returns
 *
 * @param gateReply - body every gate voice returns
 *
 * @returns Settlement, beside the calls each round served and the sheets sent
 *
 * @example
 * ```ts
 * const { settled, served, } = await settleWith({ proposals: [REWRAPPING,], },);
 * ```
 */
async function settleWith(
  {
    proposals,
    standingText = STANDING,
    lineStructured = false,
    judgeReply,
    gateReply,
  }: {
    readonly proposals: readonly string[];
    readonly standingText?: string;
    readonly lineStructured?: boolean;
    readonly judgeReply: string;
    readonly gateReply: string;
  },
) {
  /**
   * Calls each route served, which is how a case says a round was never bought.
   */
  const served = {
    judge: 0,
    gate: 0,
  };

  /**
   * Every slate judge's request, for the cases reading what was shown.
   */
  const judgeSheets: string[] = [];

  const settled = await settleConsolidation({
    client: createSyntheticClient({
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
        else {
          served.judge += 1;
          judgeSheets.push(exchange.bodyJson ?? '',);
        }

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
    },),
    roster: ROSTER,
    subject: SUBJECT,
    voices: proposals.map(function toVoice(translation, at,) {
      return voiceOf({ modelId: ROSTER[at] ?? ROSTER[0], translation, },);
    },),
    validity: proposals.map(function toVerdict(_proposal, at,) {
      return passing({ modelId: ROSTER[at] ?? ROSTER[0], },);
    },),
    producedFindings: [],
    standingText,
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS * 8,),
    perCallTimeoutMs: CALL_TIMEOUT_MS,
    lineStructured,
    l,
  },);

  return {
    settled,
    served,
    judgeSheets,
  };
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
 * const reply = judgeBallot({ best: 2, },);
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
 * const reply = gateBallot({ choice: 'consolidated', },);
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

await describe({
  name: wrapConsolidationProposals.name,
  children: [
    it({
      name: 'REWRITES A FLAT PROPOSAL INTO THE LINES IT WOULD SHIP ON, and leaves a governed slice\'s '
        + 'proposals exactly as their producer wrote them. Both halves in one case because the '
        + 'second is what makes the first evidence: a wrapper that ran unconditionally would '
        + 'satisfy the first just as well',
      fn: async () => {
        const voices = ROSTER.map(function toVoice(modelId,) {
          return voiceOf({ modelId, translation: FRESH, },);
        },);

        const ungoverned = wrapConsolidationProposals({ voices, lineStructured: false, },);
        const governed = wrapConsolidationProposals({ voices, lineStructured: true, },);

        // The wrap must actually move this fixture, or neither half means
        // anything. That is this case's own positive control.
        expect(wrapReplacementText({ text: FRESH, },),).not
          .toBe(FRESH,);

        expect(ungoverned.every(function carriesWrapped(voice,): boolean {
          return voice.value
            .translation === wrapReplacementText({ text: FRESH, },);
        },),).toBe(true,);

        expect(governed.every(function carriesEmitted(voice,): boolean {
          return voice.value
            .translation === FRESH;
        },),).toBe(true,);
      },
    },),

    it({
      name: 'HANDS BACK THE VERY ARRAY IT WAS GIVEN FOR A GOVERNED SLICE, by identity rather than '
        + 'rebuilt. A verse slice must reach the slate as it did before this existed, and an '
        + 'equal-but-rebuilt array would let a later edit change what governed slices are shown '
        + 'while every value assertion still passed',
      fn: async () => {
        const voices = ROSTER.map(function toVoice(modelId,) {
          return voiceOf({ modelId, translation: FRESH, },);
        },);

        expect(wrapConsolidationProposals({ voices, lineStructured: true, },),).toBe(voices,);
      },
    },),
  ],
},);
