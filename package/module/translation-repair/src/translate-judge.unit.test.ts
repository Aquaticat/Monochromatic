/**
 * Tests for judging a slate that already exists.
 *
 * WHAT THIS FILE IS FOR, and it is one claim: the same slate can be judged more
 * than once, and the second judging sees the same candidates as the first. That
 * is the whole reason the stage was split. While producing and judging were one
 * call, a caller asking the same question twice bought two slates, so the two
 * answers differed in the candidates as well as in whatever the caller meant to
 * vary. `#108` varies the judges' evidence; a position-bias probe would vary
 * ballot position. Neither means anything if the texts move underneath.
 *
 * `translate-stage.unit.test.ts` still covers what the composed stage decides,
 * unchanged, and is the evidence that splitting changed no behaviour.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  BlankSelectionError,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  judgeTranslateSlate,
  messageText,
  type ProducedSlate,
  produceTranslateSlate,
  type SyntheticClient,
  type RosterModelId,
  TRANSLATE_LINE_STRUCTURE_CRITERION,
  TranslateAbsenceError,
} from '../dist/final/node/index.mjs';

/**
 * Logger the halves write their progress to.
 */
const l = tagged({ tag: 'translate-judge-test', },);

/**
 * Schema name the producing half asks translators for.
 */
const TRANSLATE_SCHEMA = 'translation_report';

/**
 * Original slice both halves work over.
 */
const SOURCE_TEXT = '猫猫在窗台上打盹，尾巴垂在暖气片旁边。';

/**
 * Translation already in the archive, awkward but present.
 */
const INCUMBENT_TEXT = 'The cat is doing the sleeping on the windowsill, with tail hanging by the radiator.';

/**
 * Models that render the slice.
 */
const TRANSLATORS: readonly RosterModelId[] = [
  'hf:cat/Cat-A',
  'hf:cat/Cat-B',
].map(function toId(id,) {
  return id as unknown as RosterModelId;
},);

/**
 * Judges, three so selection can reach its minimum weight.
 */
const JUDGES: readonly RosterModelId[] = [
  'hf:cat/Cat-A',
  'hf:cat/Cat-B',
  'hf:cat/Cat-C',
].map(function toId(id,) {
  return id as unknown as RosterModelId;
},);

/**
 * What each translator renders, keyed by model.
 *
 * DIFFERENT PER MODEL AND PER CALL COUNT, so a second production would be
 * visibly different from the first. That is what lets the test tell a reused
 * slate from a rebought one rather than assuming it.
 */
const RENDERINGS: readonly string[] = [
  'The cat dozes on the windowsill, tail draped beside the radiator.',
  'A cat naps on the sill, its tail hanging near the heater.',
  'The cat is asleep by the window, tail near the warm pipes.',
  'A sleeping cat lies on the ledge, tail beside the radiator.',
];

/**
 * Client whose translators answer differently on every call, and whose judges
 * abstain so the incumbent stands.
 *
 * @returns Client plus the judge sheets it was sent
 *
 * @example
 * ```ts
 * const rig = driftingClient();
 * ```
 */
function driftingClient(): {
  readonly client: SyntheticClient;
  readonly judgeSheets: string[];
} {
  /**
   * Translator calls served so far, which drives the drift.
   *
   * A `const` holding a mutable field rather than a root `let`, which
   * `no-function-root-let` forbids.
   */
  const served = { count: 0, };

  /**
   * Sheets the judges received.
   */
  const judgeSheets: string[] = [];

  return {
    judgeSheets,
    client: {
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
         * Schema the caller asked for, which names the role.
         */
        const schema = request.responseFormat
          ?.json_schema
          .name;
        if (schema === TRANSLATE_SCHEMA) {
          /**
           * Rendering for this call, different from the last one.
           */
          const translation = RENDERINGS[served.count % RENDERINGS.length]
            ?? RENDERINGS[0]
            ?? '';
          served.count += 1;

          /**
           * Wire reply carrying it.
           */
          const value: unknown = { translation, };
          if (!request.validate(value,)) {
            return {
              kind: 'schema-mismatch',
              rawText: JSON.stringify(value,),
              detail: 'reply failed the wire guard',
            };
          }
          return {
            kind: 'ok',
            value,
            rawText: JSON.stringify(value,),
          };
        }

        judgeSheets.push(request.messages
          .map(function toContent(message,) {
            return messageText({ message, },);
          },)
          .join('\n',),);

        /**
         * Ballot declining every candidate, so the incumbent stands and no case
         * here depends on which candidate wins.
         */
        const ballot: unknown = {
          best: 0,
          reason: 'fixture',
        };
        if (!request.validate(ballot,)) {
          return {
            kind: 'schema-mismatch',
            rawText: JSON.stringify(ballot,),
            detail: 'reply failed the wire guard',
          };
        }
        return {
          kind: 'ok',
          value: ballot as ValueT,
          rawText: JSON.stringify(ballot,),
        };
      },
    },
  };
}

/**
 * Buys one slate and reports the sheet its judges were sent.
 *
 * READS THE REQUEST, NOT THE RESULT. What a judge decided is a fact about the
 * fixture; what a judge was SHOWN is the fact these cases are about, and the two
 * are only connected while the wiring is right, which is the thing under test.
 *
 * @param lineStructured - whether this round is governed by the verse rule
 *
 * @returns Sheet the judges received, joined as they read it
 *
 * @example
 * ```ts
 * const sheet = await judgeSheetFor({ lineStructured: true, },);
 * ```
 */
async function judgeSheetFor(
  { lineStructured, }: { readonly lineStructured: boolean; },
): Promise<string> {
  const rig = driftingClient();

  /**
   * Slate for the judges to decide over.
   */
  const produced = await produceTranslateSlate({
    client: rig.client,
    translatorModelIds: TRANSLATORS,
    sourceText: SOURCE_TEXT,
    incumbentText: INCUMBENT_TEXT,
    lineStructured,
    signal: AbortSignal.timeout(30_000,),
    perCallTimeoutMs: 5_000,
    l,
  },);

  /**
   * Where the producer sheets end, so the verse rule reaching a TRANSLATOR
   * cannot be mistaken for it reaching a judge. Both carry the same fact and
   * only one of them is what these cases are about.
   */
  const beforeJudging = rig.judgeSheets.length;

  await judgeTranslateSlate({
    client: rig.client,
    produced,
    judgeModelIds: JUDGES,
    sourceText: SOURCE_TEXT,
    incumbentText: INCUMBENT_TEXT,
    incumbentKind: 'present',
    lineStructured,
    signal: AbortSignal.timeout(30_000,),
    perCallTimeoutMs: 5_000,
    l,
  },);

  return rig.judgeSheets
    .slice(beforeJudging,)
    .join('\n',);
}


/**
 * Client that fails if anything asks it a question.
 *
 * THE POINT OF THE TWO CASES BELOW IS THAT NO ROUND IS BOUGHT. An empty slate
 * has nothing to judge, so a judge that called a model would be spending on a
 * question with no candidates in it, and this turns that into a failure rather
 * than a slower green.
 */
const NOBODY_TO_ASK: SyntheticClient = {
  chatText: async () => {
    throw new Error('an empty slate must buy no judging round',);
  },
  chatJson: async () => {
    throw new Error('an empty slate must buy no judging round',);
  },
} as unknown as SyntheticClient;

/**
 * Builds an empty slate that reports how many translators were heard producing
 * it.
 *
 * @param heardTranslators - translators that answered usably, zero when every
 * voice on the slate was lost
 *
 * @returns Slate carrying no candidates
 *
 * @example
 * ```ts
 * const produced = emptySlate({ heardTranslators: 0, },);
 * ```
 */
function emptySlate(
  { heardTranslators, }: { readonly heardTranslators: number; },
): ProducedSlate {
  return {
    candidates: [],
    heardTranslators,
    findings: [],
  };
}

/**
 * Judges an empty slate over a passage the archive has no English for, and
 * returns whatever it refused with.
 *
 * @param heardTranslators - translators that answered usably
 *
 * @returns Refusal raised, so a case can name its class and reason
 *
 * @example
 * ```ts
 * const refusal = await refusalOverAnchor({ heardTranslators: 0, },);
 * ```
 */
async function refusalOverAnchor(
  { heardTranslators, }: { readonly heardTranslators: number; },
): Promise<unknown> {
  try {
    await judgeTranslateSlate({
      client: NOBODY_TO_ASK,
      produced: emptySlate({ heardTranslators, },),
      judgeModelIds: JUDGES,
      sourceText: SOURCE_TEXT,
      incumbentText: '',
      incumbentKind: 'absent',
      lineStructured: false,
      signal: AbortSignal.timeout(30_000,),
      perCallTimeoutMs: 5_000,
      l,
    },);
    return undefined;
  } catch (error) {
    return error;
  }
}

await describe({
  name: `${judgeTranslateSlate.name} tells a lost voice from a hard passage`,
  children: [
    it({
      name:
        'REFUSES AN ANCHOR AS `no-voice-heard` WHEN NOBODY ANSWERED, because an empty slate with no '
        + 'translator heard says nothing about the passage and everything about the hour. Recorded as '
        + '`no-candidate` until `#198`, which is how a provider having a bad hour left holes in '
        + 'published pages that nothing could tell from passages the models genuinely could not render',
      fn: async () => {
        const refusal = await refusalOverAnchor({ heardTranslators: 0, },);

        expect(refusal,).toBeInstanceOf(TranslateAbsenceError,);
        expect((refusal as { readonly reason?: unknown; }).reason,).toBe('no-voice-heard',);
      },
    },),

    it({
      name:
        'REFUSES AN ANCHOR AS `no-candidate` WHEN TRANSLATORS WERE HEARD AND PROPOSED NOTHING USABLE, '
        + 'which is the half that really is about the passage. Both cases are needed: one reason '
        + 'covering both would satisfy either case alone, so only the PAIR shows the distinction is '
        + 'drawn rather than a constant returned',
      fn: async () => {
        const refusal = await refusalOverAnchor({ heardTranslators: 3, },);

        expect(refusal,).toBeInstanceOf(TranslateAbsenceError,);
        expect((refusal as { readonly reason?: unknown; }).reason,).toBe('no-candidate',);
      },
    },),
  ],
},);

await describe({
  name: judgeTranslateSlate.name,
  children: [
    it({
      name: 'SHOWS A GOVERNED SLICE\'S JUDGES THE RULE AGAINST MERGING LINES. Until 2026-08-22 this '
        + 'function had no line-structure parameter at all, so the rule reached both producer sheets '
        + 'and no judge in either lane, and a producer that unmerged what the page had merged was '
        + 'marked down by a panel told a shape the ORIGINAL lacks is no fault',
      fn: async () => {
        expect(
          (await judgeSheetFor({ lineStructured: true, },))
            .includes(TRANSLATE_LINE_STRUCTURE_CRITERION,),
        ).toBe(true,);
      },
    },),
    it({
      name: 'LEAVES IT OUT OF A SLICE IT DOES NOT GOVERN, which is what makes the case above evidence '
        + 'rather than a tautology. A sheet carrying the criterion unconditionally would satisfy that '
        + 'one exactly as well and would mean the flag was never read',
      fn: async () => {
        expect(
          (await judgeSheetFor({ lineStructured: false, },))
            .includes(TRANSLATE_LINE_STRUCTURE_CRITERION,),
        ).toBe(false,);
      },
    },),
    it({
      name: 'JUDGES ONE SLATE TWICE OVER THE SAME CANDIDATES, which is the capability the split '
        + 'exists for. The translators here answer differently on every call, so a second '
        + 'production would be visibly different; both judgings seeing identical candidate text is '
        + 'what shows the slate was reused rather than rebought',
      fn: async () => {
        const rig = driftingClient();

        /**
         * Slate bought once.
         */
        const produced = await produceTranslateSlate({
          client: rig.client,
          translatorModelIds: TRANSLATORS,
          sourceText: SOURCE_TEXT,
          incumbentText: INCUMBENT_TEXT,
          lineStructured: false,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);
        expect(produced.candidates
          .length,).toBeGreaterThan(1,);

        /**
         * Judge sheets before the first judging, so the two arms can be split.
         */
        const beforeFirst = rig.judgeSheets.length;

        await judgeTranslateSlate({
          client: rig.client,
          produced,
          judgeModelIds: JUDGES,
          sourceText: SOURCE_TEXT,
          incumbentText: INCUMBENT_TEXT,
          incumbentKind: 'present',
          lineStructured: false,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);

        /**
         * Boundary between the two judgings.
         */
        const betweenArms = rig.judgeSheets.length;

        await judgeTranslateSlate({
          client: rig.client,
          produced,
          judgeModelIds: JUDGES,
          sourceText: SOURCE_TEXT,
          incumbentText: INCUMBENT_TEXT,
          incumbentKind: 'present',
          lineStructured: false,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);

        /**
         * Sheets each judging sent.
         */
        const first = rig.judgeSheets.slice(
          beforeFirst,
          betweenArms,
        );

        /**
         * Second judging's sheets.
         */
        const second = rig.judgeSheets.slice(betweenArms,);
        expect(first.length,).toBe(JUDGES.length,);
        expect(second.length,).toBe(JUDGES.length,);

        // EVERY CANDIDATE TEXT APPEARS IN BOTH ARMS. Comparing the sheets
        // wholesale would also pass on two rebought slates that happened to
        // match, so this checks the texts the slate actually carries.
        for (const candidate of produced.candidates) {
          for (const sheet of [...first,
            ...second,]) {
            expect(sheet.includes(candidate.value
              .text,),).toBe(true,);
          }
        }
      },
    },),
    it({
      name: 'sends the WINDOW only on the arm that asked for it, so one slate judged twice differs '
        + 'in exactly the evidence `#108` varies and in nothing else',
      fn: async () => {
        const rig = driftingClient();
        const produced = await produceTranslateSlate({
          client: rig.client,
          translatorModelIds: TRANSLATORS,
          sourceText: SOURCE_TEXT,
          incumbentText: INCUMBENT_TEXT,
          lineStructured: false,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);

        const beforeNarrow = rig.judgeSheets.length;
        await judgeTranslateSlate({
          client: rig.client,
          produced,
          judgeModelIds: JUDGES,
          sourceText: SOURCE_TEXT,
          incumbentText: INCUMBENT_TEXT,
          incumbentKind: 'present',
          lineStructured: false,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);
        const betweenArms = rig.judgeSheets.length;

        await judgeTranslateSlate({
          client: rig.client,
          produced,
          judgeModelIds: JUDGES,
          sourceText: SOURCE_TEXT,
          incumbentText: INCUMBENT_TEXT,
          incumbentKind: 'present',
          neighbouringSourceText: '傍晚她回到炉火旁，炉子里的火已经快灭了。',
          lineStructured: false,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);

        /**
         * Narrow arm's sheets.
         */
        const narrow = rig.judgeSheets.slice(
          beforeNarrow,
          betweenArms,
        );

        /**
         * Wide arm's sheets.
         */
        const wide = rig.judgeSheets.slice(betweenArms,);
        expect(narrow.filter(function carries(sheet,) {
          return sheet.includes('SURROUNDING ORIGINAL',);
        },)
          .length,).toBe(0,);
        expect(wide.filter(function carries(sheet,) {
          return sheet.includes('SURROUNDING ORIGINAL',);
        },)
          .length,).toBe(JUDGES.length,);
      },
    },),
    it({
      name: 'CARRIES THE ARCHIVE EITHER SIDE when one is supplied, which is the half of the window '
        + 'that shows a relocation. The Chinese says each thing once in its own place, so wording '
        + 'this passage calls for that is already sitting next door was carried across a boundary '
        + 'rather than invented, and a judge shown only the original condemns the archive for both',
      fn: async () => {
        const rig = driftingClient();
        const produced = await produceTranslateSlate({
          client: rig.client,
          translatorModelIds: TRANSLATORS,
          sourceText: SOURCE_TEXT,
          incumbentText: INCUMBENT_TEXT,
          lineStructured: false,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);

        /**
         * Where the narrow arm's sheets begin.
         */
        const beforeNarrow = rig.judgeSheets.length;
        await judgeTranslateSlate({
          client: rig.client,
          produced,
          judgeModelIds: JUDGES,
          sourceText: SOURCE_TEXT,
          incumbentText: INCUMBENT_TEXT,
          incumbentKind: 'present',
          lineStructured: false,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);

        /**
         * Where the narrow arm's sheets end and the wide arm's begin.
         */
        const betweenArms = rig.judgeSheets.length;
        await judgeTranslateSlate({
          client: rig.client,
          produced,
          judgeModelIds: JUDGES,
          sourceText: SOURCE_TEXT,
          incumbentText: INCUMBENT_TEXT,
          incumbentKind: 'present',
          neighbouringIncumbentText: 'By evening she was back beside the stove, whose fire had almost gone out.',
          lineStructured: false,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);

        /**
         * Narrow arm's sheets.
         */
        const narrow = rig.judgeSheets.slice(
          beforeNarrow,
          betweenArms,
        );

        /**
         * Wide arm's sheets.
         */
        const wide = rig.judgeSheets.slice(betweenArms,);

        expect(narrow.filter(function carries(sheet,) {
          return sheet.includes('SURROUNDING EXISTING TRANSLATION',);
        },)
          .length,).toBe(0,);
        expect(wide.filter(function carries(sheet,) {
          return sheet.includes('SURROUNDING EXISTING TRANSLATION',);
        },)
          .length,).toBe(JUDGES.length,);

        // The wording travels, not only its label: a sheet naming the section
        // and carrying none of it would pass a label-only assertion.
        expect(wide.filter(function carries(sheet,) {
          return sheet.includes('back beside the stove',);
        },)
          .length,).toBe(JUDGES.length,);
      },
    },),
    it({
      name: 'THROWS BlankSelectionError WHEN A JUDGED WINNER SAYS NOTHING FOR A SOURCE THAT SAYS '
        + 'SOMETHING, the invariant the branch calls unreachable in its own comment while the slate '
        + 'is built the way it is. Nothing in `produceTranslateSlate` can place a blank candidate on '
        + 'a slate, so this places one by hand: the only way to ask what judging does the day that '
        + 'invariant stops holding, rather than trusting it to hold forever',
      fn: async () => {
        /**
         * Model this hand-built candidate is credited to, disjoint from every
         * judge so its win is a plain majority rather than a discounted
         * self-vote.
         */
        const soleProposer = 'hf:cat/Cat-D' as unknown as RosterModelId;

        /**
         * Client whose one judge call always names the sole candidate.
         * `produceTranslateSlate` is never called in this case, so no
         * translator schema request ever reaches this client.
         */
        const client: SyntheticClient = {
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
             * Ballot naming the only candidate on the hand-built slate.
             */
            const ballot: unknown = {
              best: 1,
              reason: 'the only candidate on this hand-built slate',
            };
            if (!request.validate(ballot,)) {
              return {
                kind: 'schema-mismatch',
                rawText: JSON.stringify(ballot,),
                detail: 'reply failed the wire guard',
              };
            }
            return {
              kind: 'ok',
              value: ballot as ValueT,
              rawText: JSON.stringify(ballot,),
            };
          },
        };

        /**
         * Slate built by hand rather than bought from `produceTranslateSlate`,
         * since that producer is exactly what keeps a blank candidate off a
         * real slate. Its sole candidate says nothing at all.
         */
        const produced: ProducedSlate = {
          candidates: [
            {
              producer: {
                kind: 'model',
                modelId: soleProposer,
              },
              value: {
                text: '   ',
                origin: 'fresh',
              },
              rendered: '   ',
            },
          ],
          heardTranslators: 1,
          findings: ['translate-blank-fixture-marker',],
        };

        /**
         * Failure the judging half raised.
         */
        let caught: unknown;
        try {
          await judgeTranslateSlate({
            client,
            produced,
            judgeModelIds: JUDGES,
            sourceText: SOURCE_TEXT,
            incumbentText: INCUMBENT_TEXT,
            incumbentKind: 'present',
            lineStructured: false,
            signal: AbortSignal.timeout(30_000,),
            perCallTimeoutMs: 5_000,
            l,
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(BlankSelectionError,);
        // Carries what the round had already found rather than a fresh empty
        // list, so a caller reading the failure sees the evidence gathered
        // before the winner came back blank.
        expect((caught as BlankSelectionError).findings,).toContain('translate-blank-fixture-marker',);
      },
    },),
  ],
},);
