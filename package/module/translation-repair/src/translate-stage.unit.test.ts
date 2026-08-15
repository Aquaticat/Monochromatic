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
  runTranslateStage,
  type SyntheticClient,
  type SyntheticModelId,
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
 * @param calls - shared call log the cases assert on
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
    calls,
  }: {
    readonly translations: TranslateScript;
    readonly needle: string;
    readonly calls: CallLog;
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
        if (!request.validate(value,))
          throw new Error('scripted translation failed the wire guard',);
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

      /**
       * Ballot naming the candidate carrying the needle.
       */
      const ballot: unknown = {
        best: (needle === '') ? 0 : pickCandidate({
          content,
          needle,
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
    incumbentText,
  }: {
    readonly translations: TranslateScript;
    readonly needle: string;
    readonly incumbentText: string;
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
  const result = await runTranslateStage({
    client: laneClient({
      translations,
      needle,
      calls,
    },),
    translatorModelIds: TRANSLATORS,
    judgeModelIds: JUDGES,
    sourceText: SOURCE_TEXT,
    incumbentText,
    lineStructured: false,
    signal: new AbortController().signal,
    perCallTimeoutMs: 1_000,
    l,
  },);
  return {
    result,
    calls,
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
      name: 'keeps a translator that answered with EMPTY text off the ballot '
        + 'and says so, because a blank candidate reads to a judge as a real '
        + 'option to render nothing',
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
        // Heard, and still not offered: the voice arrived, it simply proposed
        // nothing to ship.
        expect(result.heardTranslators,).toBe(3,);
        expect(result.findings,).toContain('translate-blank (hf:moonshotai/Kimi-K3)',);
        expect(result.candidateCount,).toBe(3,);
      },
    },),

    it({
      name: 'KEEPS the existing translation when judges decline, and records '
        + 'that as a decline rather than a win. A tie, a lost round and an '
        + 'empty slate all ship the incumbent too, and counting those as wins '
        + 'would report the archive as vindicated by the rounds that examined '
        + 'nothing',
      fn: async () => {
        const { result, } = await runLane({
          translations: {
            'hf:moonshotai/Kimi-K3': 'The cat dozes on the windowsill, tail draped beside the radiator.',
            'hf:zai-org/GLM-5.2': 'A cat naps on the sill, its tail hanging near the heater.',
            'hf:zai-org/GLM-4.7-Flash': 'The cat sleeps on the ledge, tail beside the radiator.',
          },
          needle: '',
          incumbentText: INCUMBENT_TEXT,
        },);
        expect(result.decision,).toBe('declined-rejection',);
        expect(result.origin,).toBe('incumbent',);
        expect(result.text,).toBe(INCUMBENT_TEXT,);
        expect(result.voteWeight,).toBe(0,);
        expect(result.findings,).toContain('translate-declined (rejection)',);
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
  ],
},);
