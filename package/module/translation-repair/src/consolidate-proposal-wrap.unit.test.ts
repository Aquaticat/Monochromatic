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
 * WHY IT IS ITS OWN FILE. The mechanism spans three units that no single
 * existing file owns: `wrapConsolidationProposals` decides what goes on the
 * slate, `buildTranslateCandidates` collapses duplicates, and
 * `judgeTranslateSlate` declines to buy a round for a slate holding only the
 * incumbent. `consolidate-wrap.unit.test.ts` covers the shipping wrap alone and
 * `consolidate-settle.unit.test.ts` covers the rounds; neither is the home for
 * an invariant about what the two wraps mean together.
 *
 * THE INVARIANT EVERY CASE HERE SERVES: a candidate on the slate is the text
 * that ships if it wins. Proposals arrive wrapped, the incumbent arrives
 * untouched, and a governed slice arrives exactly as its producers wrote it.
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

await describe({
  name: `${settleConsolidation.name} over wrapped proposals`,
  children: [
    it({
      name: 'BUYS NO SLATE ROUND AND NO GATE ROUND WHEN EVERY PROPOSAL IS ONLY A RE-WRAPPING of the '
        + 'text already standing. Wrapped before the slate they become that text exactly, the '
        + 'candidate dedup folds them into the incumbent, and a slate holding the incumbent alone '
        + 'settles unjudged',
      fn: async () => {
        const { settled, served, } = await settleWith({
          proposals: [REWRAPPING, REWRAPPING, REWRAPPING,],
          judgeReply: judgeBallot({ best: 1, },),
          gateReply: gateBallot({ choice: 'consolidated', },),
        },);

        // The fixture's premise, asserted rather than trusted: this proposal
        // and the standing text differ only in where the lines break.
        expect(wrapReplacementText({ text: REWRAPPING, },),).toBe(STANDING,);
        expect(REWRAPPING,).not
          .toBe(STANDING,);

        expect(served.judge,).toBe(0,);
        expect(served.gate,).toBe(0,);
        expect(settled.terminal,).toBe('slate-unjudged-standing',);
        expect(settled.text,).toBe(STANDING,);
      },
    },),

    it({
      name: 'BUYS BOTH ROUNDS FOR THAT SAME PROPOSAL WHEN THE VERSE RULE GOVERNS THE SLICE, which is '
        + 'what makes the case above evidence of the wrap rather than of the dedup. The proposal '
        + 'reaches the judges as one line against a standing text of two, so nothing collapses',
      fn: async () => {
        const { served, judgeSheets, } = await settleWith({
          proposals: [REWRAPPING, REWRAPPING, REWRAPPING,],
          lineStructured: true,
          judgeReply: judgeBallot({ best: 0, },),
          gateReply: gateBallot({ choice: 'standing', },),
        },);

        expect(served.judge,).toBeGreaterThan(0,);
        expect(judgeSheets.some(function carriesEmitted(sheet,): boolean {
          return sheet.includes(asSent({ text: REWRAPPING, },),);
        },),).toBe(true,);
      },
    },),

    it({
      name: 'SHOWS THE SLATE JUDGES THE WRAPPED RENDERING AND NOT THE LINE THE PRODUCER EMITTED, '
        + 'which is the whole point: the judges were reading text the run then changed on the way '
        + 'out, on 15 of the 16 consolidations that shipped across the band pair\'s two most '
        + 'recent runs',
      fn: async () => {
        const { judgeSheets, } = await settleWith({
          proposals: [FRESH,],
          judgeReply: judgeBallot({
            best: positionOfText({
              proposals: [FRESH,],
              incumbentText: STANDING,
              lineStructured: false,
              wanted: wrapReplacementText({ text: FRESH, },),
            },),
          },),
          gateReply: gateBallot({ choice: 'consolidated', },),
        },);

        expect(judgeSheets.length,).toBeGreaterThan(0,);

        expect(judgeSheets.some(function carriesWrapped(sheet,): boolean {
          return sheet.includes(asSent({ text: wrapReplacementText({ text: FRESH, },), },),);
        },),).toBe(true,);

        expect(judgeSheets.some(function carriesEmitted(sheet,): boolean {
          return sheet.includes(asSent({ text: FRESH, },),);
        },),).toBe(false,);
      },
    },),

    it({
      name: 'SHIPS THE WINNER THE DECIDERS READ, BYTE FOR BYTE, so the shipping wrap has nothing left '
        + 'to correct and REFUSES to report a rewrap. A settlement recording rewrapped true after '
        + 'this change means a proposal reached the slate unwrapped',
      fn: async () => {
        const { settled, } = await settleWith({
          proposals: [FRESH,],
          judgeReply: judgeBallot({
            best: positionOfText({
              proposals: [FRESH,],
              incumbentText: STANDING,
              lineStructured: false,
              wanted: wrapReplacementText({ text: FRESH, },),
            },),
          },),
          gateReply: gateBallot({ choice: 'consolidated', },),
        },);

        expect(settled.terminal,).toBe('consolidated',);
        expect(settled.rewrapped,).toBe(false,);
        expect(settled.text,).toBe(wrapReplacementText({ text: FRESH, },),);
      },
    },),

    it({
      name: 'STILL DEMOTES A RE-WRAPPING OF UNWRAPPED ARCHIVE WORDING, and buys both rounds to do it. '
        + 'This is the residue the pre-slate wrap does NOT cover and the reason wrapConsolidation '
        + 'keeps its standingAsWritten key: where a lane contest settled on the incumbent, what '
        + 'stands is the archive\'s own wording, which nothing has ever wrapped, so no wrapped '
        + 'proposal can collapse into it',
      fn: async () => {
        const { settled, served, } = await settleWith({
          proposals: [STANDING,],
          standingText: REWRAPPING,
          judgeReply: judgeBallot({
            best: positionOfText({
              proposals: [STANDING,],
              incumbentText: REWRAPPING,
              lineStructured: false,
              wanted: STANDING,
            },),
          },),
          gateReply: gateBallot({ choice: 'consolidated', },),
        },);

        expect(served.judge,).toBeGreaterThan(0,);
        expect(served.gate,).toBeGreaterThan(0,);
        expect(settled.terminal,).toBe('wrap-erased-difference',);
        expect(settled.demoted,).toBe(true,);
        expect(settled.text,).toBe(REWRAPPING,);
      },
    },),
  ],
},);
