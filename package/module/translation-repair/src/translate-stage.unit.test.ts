/**
 * Tests for the translate lane: several models render one slice from its
 * original, the translation already in the archive stands among them, and
 * judges choose.
 *
 * What these lock down is mostly what the stage does when something is MISSING,
 * because that is the whole reason the lane exists. A slice with no translation
 * must still produce one; a translator that answers with nothing must not put an
 * empty candidate on the ballot; a lost voice must be named rather than reduce
 * quietly to a smaller slate.
 *
 * Judges are scripted BY THE TEXT they see rather than by candidate number, on
 * purpose: the stage rotates the slate per slice so the incumbent does not sit
 * in one position, and a test that pinned index 1 would be asserting the
 * rotation rather than the decision.
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
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type IncumbentKind,
  runTranslateStage,
  type SyntheticClient,
  type SyntheticModelId,
  TranslateAbsenceError,
} from '../dist/final/node/index.mjs';

/**
 * Logger for the stage under test.
 */
const l = tagged({ tag: 'translate-stage-test', },);

/**
 * Original slice every case renders.
 */
const SOURCE_TEXT = '猫猫在窗台上打盹，尾巴垂在暖气片旁边。';

/**
 * Translation already in the archive, awkward but present.
 */
const INCUMBENT_TEXT = 'The cat is doing the sleeping on the windowsill, with tail hanging by the radiator.';

/**
 * Models that render the slice.
 */
const TRANSLATORS: readonly SyntheticModelId[] = [
  'hf:moonshotai/Kimi-K3',
  'hf:zai-org/GLM-5.2',
  'hf:zai-org/GLM-4.7-Flash',
];

/**
 * Whole roster the judges are drawn from, translators included.
 */
const JUDGES: readonly SyntheticModelId[] = [
  ...TRANSLATORS,
  'hf:Qwen/Qwen3.6-27B',
  'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
  'hf:openai/gpt-oss-120b',
];

/**
 * What each model returns when asked to translate.
 *
 * A model absent from the map answers with prose wrapped around its JSON, which
 * fails the wire guard and costs the stage that voice.
 */
type TranslateScript = Readonly<Record<string, string>>;

/**
 * Calls the stage made, by stage name.
 */
type CallLog = {
  translate: number;
  select: number;
};

/**
 * Finds the one-based candidate index whose rendered text carries a needle.
 *
 * The judge sheet numbers candidates and fences their text, so this reads the
 * sheet the way a judge does rather than assuming an order the stage
 * deliberately varies.
 *
 * @param content - judge user message
 *
 * @param needle - text the wanted candidate contains
 *
 * @returns One-based index, or zero when no candidate carries it, which is the
 * ballot value for declining every candidate
 *
 * @example
 * ```ts
 * const best = pickCandidate({ content, needle: 'dozing', },);
 * ```
 */
function pickCandidate(
  {
    content,
    needle,
  }: {
    readonly content: string;
    readonly needle: string;
  },
): number {
  /**
   * Sheet split at each candidate heading; the first piece is the evidence.
   */
  const [, ...blocks] = content.split('CANDIDATE ',);
  for (const block of blocks) {
    /**
     * Heading line carrying this candidate's number.
     */
    const [heading = '',] = block.split('\n',);

    /**
     * Number the heading states.
     */
    const index = Math.trunc(Number(heading,),);
    if (Number.isInteger(index,) && block.includes(needle,))
      return index;
  }
  return 0;
}

/**
 * Client serving both stages of the lane from a script.
 *
 * @param translations - what each translator returns
 *
 * @param needle - text the judges vote for, absent when they should abstain
 *
 * @param needleAfterRetry - text the judges vote for once the panel has been
 * asked a second time, so a case can script a panel that declines and then
 * agrees; without it the panel answers the same way every round
 *
 * @param calls - shared call log the cases assert on
 *
 * @param judgeSheets - every judge sheet this run produced, so a case can read
 * what judges were actually told rather than what the prompt builder is
 * believed to say
 *
 * @returns Client honoring the script
 *
 * @example
 * ```ts
 * const client = laneClient({ translations, needle: 'dozes', calls, },);
 * ```
 */
function laneClient(
  {
    translations,
    needle,
    needleAfterRetry,
    calls,
    judgeSheets,
  }: {
    readonly translations: TranslateScript;
    readonly needle: string;
    readonly needleAfterRetry?: string;
    readonly calls: CallLog;
    readonly judgeSheets: string[];
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused by the translate lane',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       * Schema the caller asked for, which names the stage.
       */
      const schema = request.responseFormat
        ?.json_schema
        .name;
      if (schema === 'translation_report') {
        calls.translate += 1;

        /**
         * Rendering this translator was scripted to return, absent when it was
         * scripted to answer unusably.
         */
        const scripted = translations[request.modelId];
        if (scripted === undefined) {
          return {
            kind: 'schema-mismatch',
            rawText: 'Here is my translation:\n{"translation": "..."}',
            detail: 'prose around the JSON',
          };
        }

        /**
         * Wire reply carrying it.
         */
        const value: unknown = { translation: scripted, };
        // EXACTLY WHAT THE REAL CLIENT DOES with a reply that fails the
        // caller's guard, rather than throwing at the script: a model is free
        // to answer with a blank translation, and what the lane must do about
        // it is the thing under test.
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
      calls.select += 1;

      /**
       * Judge sheet as this judge received it.
       */
      const content = request.messages
        .map(function toContent(message,) {
          return message.content;
        },)
        .join('\n',);

      judgeSheets.push(content,);

      /**
       * Text this round votes for, which changes once the panel has been asked
       * again. `calls.select` counts individual judges, so a whole first round
       * is one per judge.
       */
      const roundNeedle = ((needleAfterRetry !== undefined) && (calls.select > JUDGES.length))
        ? needleAfterRetry
        : needle;

      /**
       * Ballot naming the candidate carrying the needle.
       */
      const ballot: unknown = {
        best: (roundNeedle === '') ? 0 : pickCandidate({
          content,
          needle: roundNeedle,
        },),
        reason: 'scripted',
      };
      if (!request.validate(ballot,))
        throw new Error('scripted ballot failed the wire guard',);
      return {
        kind: 'ok',
        value: ballot,
        rawText: JSON.stringify(ballot,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused by the translate lane',);
    },
  };
}

/**
 * Runs the lane over the fixture slice.
 *
 * @param translations - what each translator returns
 *
 * @param needle - text the judges vote for, empty to make them decline
 *
 * @param incumbentText - translation as it stands
 *
 * @returns Stage result plus the call log
 *
 * @example
 * ```ts
 * const { result, } = await runLane({ translations, needle: 'dozes', },);
 * ```
 */
async function runLane(
  {
    translations,
    needle,
    needleAfterRetry,
    incumbentText,
    incumbentKind = 'present',
    neighbouringSourceText,
  }: {
    readonly translations: TranslateScript;
    readonly needle: string;
    readonly needleAfterRetry?: string;
    readonly incumbentText: string;
    readonly incumbentKind?: IncumbentKind;
    readonly neighbouringSourceText?: string;
  },
) {
  /**
   * Calls each stage made.
   */
  const calls: CallLog = {
    translate: 0,
    select: 0,
  };

  /**
   * What the lane decided for this slice.
   */
  /**
   * Judge sheets this round produced, so a case can read what judges were told.
   */
  const judgeSheets: string[] = [];

  const result = await runTranslateStage({
    client: laneClient({
      translations,
      needle,
      ...((needleAfterRetry === undefined) ? {} : { needleAfterRetry, }),
      calls,
      judgeSheets,
    },),
    translatorModelIds: TRANSLATORS,
    judgeModelIds: JUDGES,
    sourceText: SOURCE_TEXT,
    incumbentText,
    incumbentKind,
    ...((neighbouringSourceText === undefined) ? {} : { neighbouringSourceText, }),
    lineStructured: false,
    signal: new AbortController().signal,
    perCallTimeoutMs: 1_000,
    l,
  },);
  return {
    result,
    calls,
    judgeSheets,
  };
}

await describe({
  name: runTranslateStage.name,
  children: [
    it({
      name: 'translates a slice that has NO translation at all, which the '
        + 'editor stage cannot reach: an absent passage files no defect, so '
        + 'the defect-driven loop never sees it',
      fn: async () => {
        const { result, } = await runLane({
          translations: {
            'hf:moonshotai/Kimi-K3': 'The cat dozes on the windowsill, tail draped beside the radiator.',
            'hf:zai-org/GLM-5.2': 'A cat naps on the sill, its tail hanging near the heater.',
            'hf:zai-org/GLM-4.7-Flash': 'The cat sleeps on the ledge, tail beside the radiator.',
          },
          needle: 'dozes',
          incumbentText: '',
        },);
        expect(result.origin,).toBe('fresh',);
        expect(result.decision,).toBe('judged',);
        expect(result.text,).toBe(
          'The cat dozes on the windowsill, tail draped beside the radiator.',
        );
        // Three renderings and nothing else: an empty incumbent is not offered,
        // since "leave it untranslated" is not a candidate.
        expect(result.candidateCount,).toBe(3,);
      },
    },),

    it({
      name: 'stands the existing translation among the candidates and reports '
        + 'it as KEPT when judges prefer it, which is the measurement the '
        + 'whole lane exists to produce',
      fn: async () => {
        const { result, } = await runLane({
          translations: {
            'hf:moonshotai/Kimi-K3': 'The cat dozes on the windowsill, tail draped beside the radiator.',
            'hf:zai-org/GLM-5.2': 'A cat naps on the sill, its tail hanging near the heater.',
            'hf:zai-org/GLM-4.7-Flash': 'The cat sleeps on the ledge, tail beside the radiator.',
          },
          needle: 'is doing the sleeping',
          incumbentText: INCUMBENT_TEXT,
        },);
        expect(result.origin,).toBe('incumbent',);
        expect(result.decision,).toBe('judged',);
        expect(result.text,).toBe(INCUMBENT_TEXT,);
        expect(result.candidateCount,).toBe(4,);
        // Six judges, three of them translators. Nobody wrote the incumbent, so
        // every ballot for it carries full weight.
        expect(result.voteWeight,).toBe(6,);
      },
    },),

    it({
      name: 'NAMES a translator whose reply arrives wrapped in prose and ships '
        + 'from the voices that remain, since a smaller slate that says '
        + 'nothing about why reads exactly like a slate nobody had more to '
        + 'offer for',
      fn: async () => {
        const { result, } = await runLane({
          translations: {
            // Kimi is absent from the script, so its reply arrives wrapped
            // in prose and fails the wire guard.
            'hf:zai-org/GLM-5.2': 'A cat naps on the sill, its tail hanging near the heater.',
            'hf:zai-org/GLM-4.7-Flash': 'The cat sleeps on the ledge, tail beside the radiator.',
          },
          needle: 'naps on the sill',
          incumbentText: INCUMBENT_TEXT,
        },);
        expect(result.heardTranslators,).toBe(2,);
        expect(result.findings,).toContain(
          'stage-voice-lost (translate hf:moonshotai/Kimi-K3)',
        );
        expect(result.origin,).toBe('fresh',);
        expect(result.text,).toBe('A cat naps on the sill, its tail hanging near the heater.',);
      },
    },),

    it({
      name: 'RE-ASKS a translator that answered with EMPTY text rather than counting it as heard, since '
        + 'a reply saying nothing is not a reply: the roster gets another round out of that model, and '
        + 'the loss is named if it stays blank',
      fn: async () => {
        const { result, } = await runLane({
          translations: {
            'hf:moonshotai/Kimi-K3': '   \n  ',
            'hf:zai-org/GLM-5.2': 'A cat naps on the sill, its tail hanging near the heater.',
            'hf:zai-org/GLM-4.7-Flash': 'The cat sleeps on the ledge, tail beside the radiator.',
          },
          needle: 'naps on the sill',
          incumbentText: INCUMBENT_TEXT,
        },);
        // NOT heard, which is the change: the blank used to arrive as a voice
        // and be filtered off the ballot afterwards, so the model was recorded
        // as having answered and never re-asked.
        expect(result.heardTranslators,).toBe(2,);
        expect(result.findings,).toContain(
          'stage-voice-lost (translate hf:moonshotai/Kimi-K3)',
        );
        expect(result.candidateCount,).toBe(3,);
      },
    },),

    it({
      name: 'KEEPS the existing translation when judges decline TWICE, and records '
        + 'that as a decline rather than a win. A tie, a lost round and an '
        + 'empty slate all ship the incumbent too, and counting those as wins '
        + 'would report the archive as vindicated by the rounds that examined '
        + 'nothing',
      fn: async () => {
        const { result, calls, } = await runLane({
          translations: {
            'hf:moonshotai/Kimi-K3': 'The cat dozes on the windowsill, tail draped beside the radiator.',
            'hf:zai-org/GLM-5.2': 'A cat naps on the sill, its tail hanging near the heater.',
            'hf:zai-org/GLM-4.7-Flash': 'The cat sleeps on the ledge, tail beside the radiator.',
          },
          needle: '',
          incumbentText: INCUMBENT_TEXT,
        },);
        expect(result.decision,).toBe('no-candidate-backed',);
        expect(result.origin,).toBe('incumbent',);
        expect(result.text,).toBe(INCUMBENT_TEXT,);
        expect(result.voteWeight,).toBe(0,);
        expect(result.findings,).toContain('translate-declined (rejection)',);
        // The panel was asked twice about the same candidates, which is what
        // separates a settled decline from a momentary one.
        expect(result.findings,).toContain('translate-declined-retried',);
        expect(calls.select,).toBe(JUDGES.length * 2,);
      },
    },),

    it({
      name: 'ACCEPTS a candidate the panel backs on the SECOND ask, which is the '
        + 'whole reason the retry is bought: a panel that declines once has not '
        + 'necessarily settled anything, and shipping the incumbent there would '
        + 'discard a rendering the judges did in the end prefer',
      fn: async () => {
        const { result, calls, } = await runLane({
          translations: {
            'hf:moonshotai/Kimi-K3': 'The cat dozes on the windowsill, tail draped beside the radiator.',
            'hf:zai-org/GLM-5.2': 'A cat naps on the sill, its tail hanging near the heater.',
            'hf:zai-org/GLM-4.7-Flash': 'The cat sleeps on the ledge, tail beside the radiator.',
          },
          needle: '',
          needleAfterRetry: 'dozes',
          incumbentText: INCUMBENT_TEXT,
        },);
        expect(result.decision,).toBe('judged',);
        expect(result.origin,).not
          .toBe('incumbent',);
        expect(result.findings,).toContain('translate-declined-retried',);
        expect(calls.select,).toBe(JUDGES.length * 2,);
      },
    },),

    it({
      name: 'BUYS NO SECOND ROUND when the first one decided, since the retry '
        + 'exists to separate a momentary decline from a settled one and a '
        + 'decision is neither',
      fn: async () => {
        const { result, calls, } = await runLane({
          translations: {
            'hf:moonshotai/Kimi-K3': 'The cat dozes on the windowsill, tail draped beside the radiator.',
            'hf:zai-org/GLM-5.2': 'A cat naps on the sill, its tail hanging near the heater.',
            'hf:zai-org/GLM-4.7-Flash': 'The cat sleeps on the ledge, tail beside the radiator.',
          },
          needle: 'dozes',
          incumbentText: INCUMBENT_TEXT,
        },);
        expect(result.decision,).toBe('judged',);
        expect(result.findings,).not
          .toContain('translate-declined-retried',);
        expect(calls.select,).toBe(JUDGES.length,);
      },
    },),


    it({
      name: 'ships UNJUDGED when every translator reproduced the existing '
        + 'translation, since nothing could change whatever the judges said, '
        + 'and names the models that matched it: a text several models arrive '
        + 'at independently is not the same evidence as one nobody examined',
      fn: async () => {
        const { result, calls, } = await runLane({
          translations: {
            'hf:moonshotai/Kimi-K3': INCUMBENT_TEXT,
            'hf:zai-org/GLM-5.2': INCUMBENT_TEXT,
            'hf:zai-org/GLM-4.7-Flash': INCUMBENT_TEXT,
          },
          needle: 'is doing the sleeping',
          incumbentText: INCUMBENT_TEXT,
        },);
        expect(result.decision,).toBe('sole-candidate',);
        expect(result.origin,).toBe('incumbent',);
        expect(result.candidateCount,).toBe(1,);
        // No judge was asked, which is the cost this exit saves.
        expect(calls.select,).toBe(0,);
        expect(result.findings,).toContain(
          'translate-matched-incumbent (hf:moonshotai/Kimi-K3)',
        );
      },
    },),

    it({
      name: 'TELLS THE JUDGES what declining actually costs, which differs by slice: the shared sheet '
        + 'promises that the caller keeps text it already trusts, and at a slice with no translation '
        + 'that promise is false and buys a missing passage with the caution it asks for',
      fn: async () => {
        /** Round over a slice the archive HAS translated. */
        const present = await runLane({
          translations: {
            'hf:moonshotai/Kimi-K3': 'The cat dozes on the windowsill, tail draped beside the radiator.',
            'hf:zai-org/GLM-5.2': 'A cat naps on the sill, its tail hanging near the heater.',
            'hf:zai-org/GLM-4.7-Flash': 'The cat sleeps on the ledge, tail beside the radiator.',
          },
          needle: 'dozes',
          incumbentText: INCUMBENT_TEXT,
        },);

        /** Round over one it has not. */
        const absent = await runLane({
          translations: {
            'hf:moonshotai/Kimi-K3': 'The cat dozes on the windowsill, tail draped beside the radiator.',
            'hf:zai-org/GLM-5.2': 'A cat naps on the sill, its tail hanging near the heater.',
            'hf:zai-org/GLM-4.7-Flash': 'The cat sleeps on the ledge, tail beside the radiator.',
          },
          needle: 'dozes',
          incumbentText: '',
          incumbentKind: 'absent',
        },);
        expect(present.judgeSheets
          .length,).toBeGreaterThan(0,);
        expect(absent.judgeSheets
          .length,).toBeGreaterThan(0,);
        expect(present.judgeSheets
          .every(function keepsTrustedText(sheet: string,): boolean {
            return sheet.includes('keeps text it already trusts',);
          },),).toBe(true,);
        expect(absent.judgeSheets
          .every(function saysUntranslated(sheet: string,): boolean {
            return sheet.includes('leaves it untranslated',);
          },),).toBe(true,);
        expect(absent.judgeSheets
          .some(function keepsTrustedText(sheet: string,): boolean {
            return sheet.includes('keeps text it already trusts',);
          },),).toBe(false,);
      },
    },),

    it({
      name: 'FILLS a slice the archive never translated, which is the ordinary absent-mode round: the '
        + 'incumbent is not on the ballot because there is none, and the judges choose among the '
        + 'renderings alone',
      fn: async () => {
        const { result, } = await runLane({
          translations: {
            'hf:moonshotai/Kimi-K3': 'The cat dozes on the windowsill, tail draped beside the radiator.',
            'hf:zai-org/GLM-5.2': 'A cat naps on the sill, its tail hanging near the heater.',
            'hf:zai-org/GLM-4.7-Flash': 'The cat sleeps on the ledge, tail beside the radiator.',
          },
          needle: 'dozes',
          incumbentText: '',
          incumbentKind: 'absent',
        },);
        expect(result.origin,).toBe('fresh',);
        expect(result.decision,).toBe('judged',);
        expect(result.candidateCount,).toBe(3,);
      },
    },),

    it({
      name: 'REFUSES rather than settling when a slice with no translation gets nothing usable: every '
        + 'fallback here ships the wording already in the archive, and where there is none the same '
        + 'fallback ships the empty string while the record reads as a slice that settled',
      fn: async () => {
        await expect(runLane({
          // Nobody is scripted, so every reply arrives wrapped in prose and
          // fails the wire guard: no voice, no candidate, and no incumbent to
          // stand in for them.
          translations: {},
          needle: 'dozes',
          incumbentText: '',
          incumbentKind: 'absent',
        },),).rejects.toThrow(TranslateAbsenceError,);
      },
    },),

    it({
      name: 'REFUSES a DECLINE for the same slice, which the ordinary path answers by keeping the '
        + 'archive`s wording. Judges who could not agree have said nothing about a translation that '
        + 'does not exist, so there is nothing their silence can protect',
      fn: async () => {
        await expect(runLane({
          translations: {
            'hf:moonshotai/Kimi-K3': 'The cat dozes on the windowsill, tail draped beside the radiator.',
            'hf:zai-org/GLM-5.2': 'A cat naps on the sill, its tail hanging near the heater.',
            'hf:zai-org/GLM-4.7-Flash': 'The cat sleeps on the ledge, tail beside the radiator.',
          },
          needle: '',
          incumbentText: '',
          incumbentKind: 'absent',
        },),).rejects.toThrow(TranslateAbsenceError,);
      },
    },),

    it({
      name: 'carries the evidence into the refusal rather than losing it with the exception, so a run '
        + 'reporting a passage it could not fill can say which translators were heard and what the '
        + 'judges counted',
      fn: async () => {
        /** Refusal the declined round raised. */
        let raised: unknown;
        try {
          await runLane({
            translations: {
              'hf:moonshotai/Kimi-K3': 'The cat dozes on the windowsill, tail draped beside the radiator.',
              'hf:zai-org/GLM-5.2': 'A cat naps on the sill, its tail hanging near the heater.',
              'hf:zai-org/GLM-4.7-Flash': 'The cat sleeps on the ledge, tail beside the radiator.',
            },
            needle: '',
            incumbentText: '',
            incumbentKind: 'absent',
          },);
        }
        catch (error) {
          raised = error;
        }
        expect(raised instanceof TranslateAbsenceError,).toBe(true,);
        if (!(raised instanceof TranslateAbsenceError))
          throw new Error('expected the absent-mode refusal',);
        // NAMED FOR THE PAIR OF ROUNDS, not for either one: the panel saw these
        // same candidates twice and backed none of them, which is a stronger
        // statement than one round's rejection and the one worth recording.
        expect(raised.reason,).toBe('no-candidate-backed',);
        expect(raised.findings,).toContain('translate-declined (rejection)',);
        expect(raised.findings,).toContain('translate-declined-retried',);
        expect(raised.findings
          .some(function namesTheSlate(finding: string,): boolean {
            return finding.startsWith('translate-candidates',);
          },),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: `${runTranslateStage.name} window`,
  children: [
    it({
      name: 'renders NO surrounding block when a caller does not ask for one, in EVERY judge '
        + 'sheet, so every measurement taken before this parameter existed still describes the '
        + 'sheet production sends',
      fn: async () => {
        const { judgeSheets, } = await runLane({
          translations: {
            'hf:moonshotai/Kimi-K3': 'The cat dozes on the windowsill, tail draped beside the radiator.',
            'hf:zai-org/GLM-5.2': 'A cat naps on the sill, its tail hanging near the heater.',
            'hf:zai-org/GLM-4.7-Flash': 'The cat sleeps on the ledge, tail beside the radiator.',
          },
          needle: 'dozes',
          incumbentText: INCUMBENT_TEXT,
        },);
        expect(judgeSheets.length,).toBeGreaterThan(0,);
        expect(judgeSheets
          .filter(function carriesLabel(sheet,) {
            return sheet.includes('SURROUNDING ORIGINAL',);
          },)
          .length,).toBe(0,);
      },
    },),
    it({
      name: 'renders the surrounding block AND its context-only caveat when a caller supplies '
        + 'one, which is what lets a flagged slice be judged twice differing in exactly one '
        + 'thing, as `#107` needs',
      fn: async () => {
        const { judgeSheets, } = await runLane({
          translations: {
            'hf:moonshotai/Kimi-K3': 'The cat dozes on the windowsill, tail draped beside the radiator.',
            'hf:zai-org/GLM-5.2': 'A cat naps on the sill, its tail hanging near the heater.',
            'hf:zai-org/GLM-4.7-Flash': 'The cat sleeps on the ledge, tail beside the radiator.',
          },
          needle: 'dozes',
          incumbentText: INCUMBENT_TEXT,
          neighbouringSourceText: '她看着外面的鸟。\n',
        },);
        expect(judgeSheets
          .filter(function carriesContext(sheet,) {
            if (!sheet.includes('SURROUNDING ORIGINAL',))
              return false;
            if (!sheet.includes('她看着外面的鸟。',))
              return false;
            return sheet.includes('not expected to render this',);
          },)
          .length,).toBe(judgeSheets.length,);
      },
    },),
  ],
},);
