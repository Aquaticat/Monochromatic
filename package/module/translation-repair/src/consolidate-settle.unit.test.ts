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
  type ChatJsonOutcome,
  type ChatJsonRequest,
  createSyntheticClient,
  describeSlate,
  type ProposalValidity,
  TRANSLATE_LINE_STRUCTURE_CRITERION,
  rotateCandidates,
  settleConsolidation,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/**
 * Logger the stage writes through, whose output is not under test.
 */
const l = tagged({ tag: 'consolidate-settle-test', },);

/**
 * Roster of three, the smallest that can produce a two-to-one split.
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
 * Idiomatic final rewrite used to prove standing-text polish reachability.
 */
const POLISHABLE_STANDING = 'She faced life proactively and spent a good time with everyone, while doing her best to stay hopeful and connected to the people around her.';

/**
 * Faithful idiomatic rewrite of polishable standing text.
 */
const POLISHED_STANDING = 'She maintained a positive outlook on life and spent some good times with everyone, doing her best to stay hopeful and connected to those around her.';

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
    judgeSheets,
  }: {
    readonly judgeReply: string;
    readonly gateReply: string;
    readonly served: { judge: number; gate: number; };

    /**
     * Where to record each slate judge's request, for the cases that read what
     * the judges were shown rather than what they answered.
     */
    readonly judgeSheets?: string[];
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
      else {
        served.judge += 1;
        judgeSheets?.push(sent,);
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
  },);
}

/**
 * Builds direct client proving final polish remains reachable after slate decline.
 *
 * @param servedSchemas - schema names called in execution order
 *
 * @returns Client declining consolidation slate but approving final polish
 *
 * @example
 * ```ts
 * const client = standingPolishClient({ servedSchemas: [], });
 * ```
 */
function standingPolishClient(
  { servedSchemas, }: { readonly servedSchemas: string[]; },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused by structured consolidation stages',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       * Structured schema naming current stage.
       */
      const schema = request.responseFormat
        ?.json_schema
        .name ?? '';
      servedSchemas.push(schema,);
      /**
       * Whether candidate ballot belongs to final naturalness selector.
       */
      const choosingPolish = JSON.stringify(request.messages,)
        .includes(POLISHED_STANDING,);
      /**
       * Reply preserving declined consolidation while approving polish.
       */
      const value: unknown = (schema === 'refine_report')
        ? {
          rewrites: [{
            paragraph: 1,
            newText: POLISHED_STANDING,
          },],
        }
        : (schema === 'candidate_ballot')
        ? {
          best: choosingPolish ? 1 : 0,
          reason: choosingPolish
            ? 'same meaning in more idiomatic English'
            : 'no consolidation clearly improves the standing text',
        }
        : (schema === 'consolidation_polish_gate')
        ? {
          choice: 'polished',
          unsupported: [],
          dropped: [],
          reason: 'same meaning in more idiomatic English',
        }
        : (schema === 'absolute_naturalness_review')
        ? {
          acceptable: true,
          findings: [],
          reason: 'whole passage is publication-ready',
        }
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
      throw new Error('quotas unused by consolidation stages',);
    },
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
    lineStructured = false,
  }: {
    readonly voices: readonly {
      readonly modelId: FixtureModelId;
      readonly value: { readonly translation: string; };
    }[];
    readonly validity: readonly ProposalValidity[];
    readonly standingText?: string;
    readonly judgeReply?: string;
    readonly gateReply?: string;
    readonly producedFindings?: readonly string[];

    /**
     * Whether the enclosing chunk is governed by the verse rule, which decides
     * what the judges of this round are asked.
     */
    readonly lineStructured?: boolean;
  },
) {
  /**
   * Calls each route served, which every case asserts on.
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
    client: routedClient({
      judgeReply,
      gateReply,
      served,
      judgeSheets,
    },),
    roster: ROSTER,
    subject: SUBJECT,
    voices,
    validity,
    producedFindings,
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
      name: 'KEEPS WHAT THE PRODUCE HALF RECORDED ON AN INCUMBENT-ONLY SLICE, which is the '
        + 'terminal those findings explain. This path ends before a judged round and before a '
        + 'gate round, and the findings rode inside those rounds, so what said WHY a slate had '
        + 'nothing valid on it was dropped at exactly the slices reporting that it had nothing',
      fn: async () => {
        const { settled, } = await settleWith({
          voices: ROSTER.map(function toVoice(modelId,) {
            return voiceOf({ modelId, translation: FRESH, },);
          },),
          validity: ROSTER.map(function toVerdict(modelId,) {
            return validityOf({ modelId, valid: false, },);
          },),
          producedFindings: ['cat-gather-lost-a-voice',],
        },);

        expect(settled.terminal,).toBe('incumbent-only',);
        expect(settled.findings,).toContain('cat-gather-lost-a-voice',);
      },
    },),

    it({
      name: 'KEEPS THEM ON A SLICE WITH NO STANDING TEXT TOO, the other terminal ending before '
        + 'either round. Both were losing the same list, and neither loss depended on a cache: a '
        + 'fresh run dropped them exactly as a resumed one did',
      fn: async () => {
        const { settled, } = await settleWith({
          voices: ROSTER.map(function toVoice(modelId,) {
            return voiceOf({ modelId, translation: FRESH, },);
          },),
          validity: ROSTER.map(function toVerdict(modelId,) {
            return validityOf({ modelId, valid: true, },);
          },),
          standingText: '',
          producedFindings: ['cat-gather-lost-a-voice',],
        },);

        expect(settled.terminal,).toBe('no-standing-text',);
        expect(settled.findings,).toContain('cat-gather-lost-a-voice',);
      },
    },),

    it({
      name: 'REPORTS EACH FINDING ONCE ON A PATH THAT REACHED BOTH ROUNDS, which is the trap in '
        + 'fixing the two above. The judged round is already handed what the produce half '
        + 'recorded, so a settlement appending that list beside the judged round would report one '
        + 'lost voice twice and double every count taken over it',
      fn: async () => {
        const { settled, } = await settleWith({
          voices: ROSTER.map(function toVoice(modelId,) {
            return voiceOf({ modelId, translation: FRESH, },);
          },),
          validity: ROSTER.map(function toVerdict(modelId,) {
            return validityOf({ modelId, valid: true, },);
          },),
          producedFindings: ['cat-gather-lost-a-voice',],
        },);

        expect(
          settled.findings
            .filter(function isTheOne(finding,): boolean {
              return finding === 'cat-gather-lost-a-voice';
            },)
            .length,
        ).toBe(1,);
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

        // NAMED AS A DECLINE, which the merged terminal could not say. This
        // test always described a declining panel, and always asserted the
        // name a panel ENDORSING the archive would carry.
        expect(settled.terminal,).toBe('slate-declined-standing',);
        expect(settled.text,).toBe(STANDING,);
        expect(served.judge,).toBeGreaterThan(0,);
        expect(served.gate,).toBe(0,);
      },
    },),

    it({
      name: 'POLISHES AN ENDORSED STANDING TEXT after consolidation judges decline their slate',
      fn: async () => {
        /**
         * Structured stages reached by settlement.
         */
        const servedSchemas: string[] = [];
        const settled = await settleConsolidation({
          client: standingPolishClient({ servedSchemas, }),
          roster: ROSTER,
          subject: {
            sourceText: '她曾积极地面对生活，和大家度过了一段不错的时光。',
            incumbentText: POLISHABLE_STANDING,
          },
          voices: [voiceOf({ modelId: ROSTER[0], translation: FRESH, },),],
          validity: [validityOf({ modelId: ROSTER[0], valid: true, },),],
          producedFindings: [],
          standingText: POLISHABLE_STANDING,
          lineStructured: false,
          sliceIndex: 1,
          polishConfig: {
            refinerModelIds: [ROSTER[0],],
            judgeModelIds: ROSTER,
            gateModelIds: ROSTER,
            declaredNames: [],
            definitions: '',
          },
          standingMayShip: true,
          signal: AbortSignal.timeout(CALL_TIMEOUT_MS * 8,),
          perCallTimeoutMs: CALL_TIMEOUT_MS,
          l,
        },);
        expect(settled.terminal,).toBe('slate-declined-standing',);
        expect(settled.text,).toBe(POLISHED_STANDING,);
        expect(settled.polish?.kind,).toBe('settled',);
        expect(settled.polish?.kind === 'settled' ? settled.polish.changed : false,).toBe(true,);
        expect(servedSchemas,).toContain('refine_report',);
        expect(servedSchemas,).toContain('consolidation_polish_gate',);
      },
    },),

    it({
      name: 'REFUSES TO POLISH AN UNENDORSED STANDING TEXT after consolidation judges decline',
      fn: async () => {
        /**
         * Structured stages reached before provenance refusal.
         */
        const servedSchemas: string[] = [];
        const settled = await settleConsolidation({
          client: standingPolishClient({ servedSchemas, }),
          roster: ROSTER,
          subject: {
            sourceText: '她曾积极地面对生活，和大家度过了一段不错的时光。',
            incumbentText: POLISHABLE_STANDING,
          },
          voices: [voiceOf({ modelId: ROSTER[0], translation: FRESH, },),],
          validity: [validityOf({ modelId: ROSTER[0], valid: true, },),],
          producedFindings: [],
          standingText: POLISHABLE_STANDING,
          lineStructured: false,
          sliceIndex: 1,
          polishConfig: {
            refinerModelIds: [ROSTER[0],],
            judgeModelIds: ROSTER,
            gateModelIds: ROSTER,
            declaredNames: [],
            definitions: '',
          },
          standingMayShip: false,
          signal: AbortSignal.timeout(CALL_TIMEOUT_MS * 8,),
          perCallTimeoutMs: CALL_TIMEOUT_MS,
          l,
        },);
        expect(settled.terminal,).toBe('slate-declined-standing',);
        expect(settled.text,).toBe(POLISHABLE_STANDING,);
        expect(settled.polish,).toEqual({
          kind: 'not-run',
          reason: 'unsafe-baseline',
        },);
        expect(servedSchemas,).not.toContain('refine_report',);
        expect(servedSchemas,).not.toContain('consolidation_polish_gate',);
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
      name: 'SHIPS A CONSOLIDATION BOTH ROUNDS BACKED, CARRYING THE SEMANTIC LINE BREAKS both lanes '
        + 'apply at their own assembly step and this stage had none. REWRAPPED IS FALSE AND THAT IS '
        + 'THE POINT since `#162`: the breaks are there before either decider reads the proposal, so '
        + 'the shipping wrap finds nothing left to correct. It asserted true until 2026-08-22, when '
        + 'what shipped was still being altered after the gate had approved it',
      fn: async () => {
        const { settled, served, } = await settleWith({
          voices: [voiceOf({ modelId: ROSTER[0], translation: FRESH, },),],
          validity: [validityOf({ modelId: ROSTER[0], valid: true, },),],
          judgeReply: judgeBallot({ best: positionOfText({ texts: [FRESH,], wanted: FRESH, },), },),
          gateReply: gateBallot({ choice: 'consolidated', },),
        },);

        expect(settled.terminal,).toBe('consolidated',);
        expect(settled.rewrapped,).toBe(false,);
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
      name: 'SETTLES A PURE RE-WRAPPING WITHOUT BUYING EITHER ROUND, which is what `#162` changed. '
        + 'This case asserted wrap-erased-difference until 2026-08-22: the proposal reached the slate '
        + 'unwrapped, both deciders spent ballots on where the lines broke, and the shipping wrap '
        + 'demoted it at the end. Wrapped before the slate it IS the standing text, the candidate '
        + 'dedup folds it in, and nothing is bought. The demote is still reachable where the standing '
        + 'text is unwrapped archive wording, which consolidate-proposal-wrap.unit.test.ts covers',
      fn: async () => {
        /**
         * The standing text as a producer that ignored the wrap rule emits it.
         */
        const unwrapped = STANDING.replaceAll('\n', ' ',);

        const { settled, served, } = await settleWith({
          voices: [voiceOf({ modelId: ROSTER[0], translation: unwrapped, },),],
          validity: [validityOf({ modelId: ROSTER[0], valid: true, },),],
          judgeReply: judgeBallot({ best: positionOfText({ texts: [unwrapped,], wanted: unwrapped, },), },),
          gateReply: gateBallot({ choice: 'consolidated', },),
        },);

        expect(settled.terminal,).toBe('slate-unjudged-standing',);
        expect(settled.text,).toBe(STANDING,);
        expect(settled.demoted,).toBe(false,);
        expect(served.judge,).toBe(0,);
        expect(served.gate,).toBe(0,);
      },
    },),

    it({
      name: 'SHOWS A GOVERNED ROUND\'S JUDGES THE RULE AGAINST MERGING LINES. `#176` gave this fact to the '
        + 'consolidation PRODUCERS and stopped there, so for a day the judges weighed proposals written to '
        + 'unmerge a passage against a criterion telling them a shape the ORIGINAL lacks is no fault. This '
        + 'reads the judges\' own request rather than the settlement, because a settlement decided the right '
        + 'way on a sheet missing the rule would look identical',
      fn: async () => {
        const { judgeSheets, } = await settleWith({
          voices: [voiceOf({ modelId: ROSTER[0], translation: FRESH, },),],
          validity: [validityOf({ modelId: ROSTER[0], valid: true, },),],
          lineStructured: true,
        },);

        expect(judgeSheets.length,).toBeGreaterThan(0,);
        expect(
          judgeSheets.some(function carriesCriterion(sheet,): boolean {
            return sheet.includes(TRANSLATE_LINE_STRUCTURE_CRITERION,);
          },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'LEAVES IT OUT OF A ROUND IT DOES NOT GOVERN, which is what makes the case above evidence. A '
        + 'sheet carrying the criterion unconditionally would satisfy that one just as well and would mean '
        + 'the flag this function has always received was still reaching nobody',
      fn: async () => {
        const { judgeSheets, } = await settleWith({
          voices: [voiceOf({ modelId: ROSTER[0], translation: FRESH, },),],
          validity: [validityOf({ modelId: ROSTER[0], valid: true, },),],
          lineStructured: false,
        },);

        expect(judgeSheets.length,).toBeGreaterThan(0,);
        expect(
          judgeSheets.some(function carriesCriterion(sheet,): boolean {
            return sheet.includes(TRANSLATE_LINE_STRUCTURE_CRITERION,);
          },),
        ).toBe(false,);
      },
    },),
  ],
},);
