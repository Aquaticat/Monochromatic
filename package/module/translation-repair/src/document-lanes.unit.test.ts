/**
 * Tests for running both lanes over one preparation.
 *
 * What this covers that neither lane's own tests can: that the two outputs come
 * back side by side with nothing merged or preferred, that the preparation's
 * alignment findings are reported once rather than per lane, that the lanes run
 * in the stated order, and that a failure in the first lane stops the second
 * from spending anything.
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
  prepareDocumentPair,
  type RepairModels,
  runDocumentLanes,
  type SyntheticClient,
  type SyntheticModelId,
  type TranslateModels,
} from '../dist/final/node/index.mjs';

/**
 * Logger for the driver under test.
 */
const l = tagged({ tag: 'document-lanes-test', },);

/**
 * Deadline per exchange, short because nothing here reaches a provider.
 */
const CALL_TIMEOUT_MS = 50;

/**
 * Original document: two sections, each one paragraph.
 */
const SOURCE_TEXT = `## 第一节

猫猫在窗台上打盹。

## 第二节

窗台上有一只鸟。
`;

/**
 * Translation as it stands, awkward but complete.
 */
const TARGET_TEXT = `## Section one

The cat is doing the sleeping on the windowsill.

## Section two

On the windowsill there is being a bird.
`;

/**
 * Sentence every translator returns for the first section.
 */
const FRESH = 'The cat naps on the windowsill.';

/**
 * Models that produce and judge.
 */
const ROSTER: readonly SyntheticModelId[] = [
  'hf:moonshotai/Kimi-K3',
  'hf:zai-org/GLM-5.2',
  'hf:zai-org/GLM-4.7-Flash',
  'hf:Qwen/Qwen3.6-27B',
  'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
  'hf:openai/gpt-oss-120b',
];

/**
 * Translate lane roster.
 */
const TRANSLATE_MODELS: TranslateModels = {
  translatorModelIds: ROSTER.slice(
    0,
    3,
  ),
  judgeModelIds: ROSTER,
};

/**
 * Repair lane roster. The critics here raise nothing, so the stages after them
 * never seat anyone.
 */
const REPAIR_MODELS: RepairModels = {
  criticModelIds: ROSTER.slice(
    0,
    3,
  ),
  panelModelIds: ROSTER.slice(
    3,
    6,
  ),
  editorModelIds: ROSTER.slice(
    0,
    3,
  ),
  judgeModelIds: ROSTER,
  checkerModelIds: ROSTER.slice(
    3,
    6,
  ),
  refinerModelIds: ROSTER.slice(
    0,
    3,
  ),
};

/**
 * Every schema the script served, in order, so a case can say which lane ran
 * first without reading a clock.
 */
type SchemaLog = string[];

/**
 * Client serving both lanes from one script.
 *
 * @param served - schema names appended in call order
 *
 * @param controller - abort the script may fire, standing in for the entry
 * deadline
 *
 * @param abortAfterCriticCalls - critic calls served before the script aborts;
 * absent means it never does
 *
 * @returns Client honoring the script
 *
 * @example
 * ```ts
 * const client = lanesClient({ served, controller, },);
 * ```
 */
function lanesClient(
  {
    served,
    controller,
    abortAfterCriticCalls,
  }: {
    readonly served: SchemaLog;
    readonly controller: AbortController;
    readonly abortAfterCriticCalls?: number;
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused by either lane',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       * Schema the caller asked for, which names the stage.
       */
      const schema = request.responseFormat
        ?.json_schema
        .name
        ?? 'unnamed';

      /**
       * Everything the caller sent, which carries the slice original.
       */
      const content = request.messages
        .map(function toContent(message,) {
          return message.content;
        },)
        .join('\n',);
      served.push(schema,);

      /**
       * Critic calls served so far, which is what the script counts down to
       * its abort: it stands in for an entry deadline landing mid-lane.
       */
      const criticCalls = served.filter(function isCritic(name,) {
        return name === 'critic_report';
      },)
        .length;
      if ((schema === 'critic_report')
        && (abortAfterCriticCalls !== undefined)
        && (criticCalls > abortAfterCriticCalls))
        controller.abort(new Error('entry deadline reached',),);
      if (request.signal
        .aborted)
        throw new Error('exchange torn down by abort',);

      /**
       * Reply for whichever stage asked, keyed by its schema.
       */
      const value: unknown = replyFor({
        schema,
        content,
      },);
      if (!request.validate(value,))
        throw new Error(`scripted ${schema} failed the wire guard`,);
      return {
        kind: 'ok',
        value,
        rawText: JSON.stringify(value,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused by either lane',);
    },
  };
}

/**
 * Scripted reply for one stage.
 *
 * The repair lane's critics find nothing, so that lane settles every slice
 * unchanged and the naturalness lane leaves each paragraph alone. The translate
 * lane renders each slice afresh and its judges pick that rendering. So the two
 * lanes disagree about the document by construction, which is what makes "both
 * outputs, neither chosen" a testable claim.
 *
 * @param schema - schema name the stage asked for
 *
 * @param content - everything the stage sent
 *
 * @returns Wire value for that stage
 *
 * @throws {@link Error} when a stage this script does not serve asks
 *
 * @example
 * ```ts
 * const value = replyFor({ schema: 'critic_report', content, },);
 * ```
 */
function replyFor(
  {
    schema,
    content,
  }: {
    readonly schema: string;
    readonly content: string;
  },
): unknown {
  if (schema === 'critic_report')
    return { issues: [], };
  if (schema === 'refine_report')
    return { rewrites: [], };
  if (schema === 'translation_report')
    return { translation: renderingFor({ content, },), };
  if (schema === 'candidate_ballot') {
    return {
      best: pickCandidate({
        content,
        needle: FRESH,
      },),
      reason: 'scripted',
    };
  }
  throw new Error(`no script for ${schema}`,);
}

/**
 * Renders one slice the way a translator that respected block structure would.
 *
 * @param content - translator prompt, which carries the slice original
 *
 * @returns Rendering for that slice
 *
 * @example
 * ```ts
 * const rendering = renderingFor({ content, },);
 * ```
 */
function renderingFor({ content, }: { readonly content: string; },): string {
  if (content.includes('第一节',))
    return `## Section one\n\n${FRESH}`;
  if (content.includes('第二节',))
    return '## Section two\n\nA bird sits on the windowsill.';
  return FRESH;
}

/**
 * Finds the one-based candidate index whose rendering carries a needle.
 *
 * @param content - judge user message
 *
 * @param needle - text the wanted candidate contains
 *
 * @returns One-based index, or zero when no candidate carries it
 *
 * @example
 * ```ts
 * const best = pickCandidate({ content, needle: FRESH, },);
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
 * Runs both lanes over the fixture pair.
 *
 * @param served - schema log, passed in so a case expecting a REJECTION can
 * still read what was bought
 *
 * @param abortAfterCriticCalls - critic calls served before the script aborts
 *
 * @returns Both lane results
 *
 * @example
 * ```ts
 * const lanes = await runLanes({ served: [], },);
 * ```
 */
async function runLanes(
  {
    served,
    abortAfterCriticCalls,
  }: {
    readonly served: SchemaLog;
    readonly abortAfterCriticCalls?: number;
  },
) {
  /**
   * Run steering, which the script may abort part way through.
   */
  const controller = new AbortController();
  return await runDocumentLanes({
    client: lanesClient({
      served,
      controller,
      ...((abortAfterCriticCalls === undefined)
        ? {}
        : { abortAfterCriticCalls, }),
    },),
    prepared: prepareDocumentPair({
      sourceText: SOURCE_TEXT,
      targetText: TARGET_TEXT,
    },),
    repairModels: REPAIR_MODELS,
    translateModels: TRANSLATE_MODELS,
    signal: controller.signal,
    perCallTimeoutMs: CALL_TIMEOUT_MS,
    l,
  },);
}

await describe({
  name: runDocumentLanes.name,
  children: [
    it({
      name: 'returns BOTH documents and prefers neither, which is the whole '
        + 'contract: which one should ship is the open question, and a driver '
        + 'that answered it here would answer it invisibly for every count '
        + 'downstream',
      fn: async () => {
        /**
         * Schemas the run served, in order.
         */
        const served: SchemaLog = [];

        const lanes = await runLanes({ served, },);
        // The repair lane found nothing to repair, so it hands back the archive.
        expect(lanes.repair
          .status,).toBe('unchanged',);
        expect(lanes.repair
          .repairedText,).toBe(TARGET_TEXT,);
        // The translate lane rewrote both slices, so its document differs.
        expect(lanes.translate
          .translatedText,).toContain(FRESH,);
        expect(lanes.translate
          .translatedText,).not.toBe(TARGET_TEXT,);
        // Nothing merged the two, and nothing named a winner.
        expect(Object.keys(lanes,)
          .toSorted(),).toEqual([
          'alignmentFindings',
          'repair',
          'translate',
        ],);
      },
    },),

    it({
      name: 'runs the REPAIR lane first, since its naturalness phase settles '
        + 'after the slice loop and nothing persists what that phase produced, '
        + 'while every translate slice is cached as it finishes',
      fn: async () => {
        /**
         * Schemas the run served, in order.
         */
        const served: SchemaLog = [];

        await runLanes({ served, },);

        /**
         * First critic call, which only the repair lane makes.
         */
        const firstRepair = served.indexOf('critic_report',);

        /**
         * First translator call, which only the translate lane makes.
         */
        const firstTranslate = served.indexOf('translation_report',);
        expect(firstRepair,).toBeGreaterThanOrEqual(0,);
        expect(firstTranslate,).toBeGreaterThanOrEqual(0,);
        expect(firstRepair,).toBeLessThan(firstTranslate,);
      },
    },),

    it({
      name: 'reports the preparation`s alignment findings ONCE, at the top '
        + 'level. Both lanes ran over one preparation, so counting them per '
        + 'lane would count one defect in the archive twice',
      fn: async () => {
        /**
         * Schemas the run served, in order.
         */
        const served: SchemaLog = [];

        /**
         * Preparation the assertion compares against, made the same way the
         * driver makes it.
         */
        const prepared = prepareDocumentPair({
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
        },);

        const lanes = await runLanes({ served, },);
        expect(lanes.alignmentFindings,).toEqual(prepared.alignmentFindings,);
      },
    },),

    it({
      name: 'STOPS at the first lane`s failure and buys nothing for the '
        + 'second. An abort inside repair must not be followed by a whole '
        + 'translate lane over the same document, which is the failure a '
        + 'driver that caught and continued would produce',
      fn: async () => {
        /**
         * Schemas the run served, in order, read after the rejection.
         */
        const served: SchemaLog = [];

        /**
         * Failure the run raised.
         */
        let caught: unknown;
        try {
          await runLanes({
            served,
            abortAfterCriticCalls: 1,
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(Error,);
        expect(served.includes('critic_report',),).toBe(true,);
        expect(served.includes('translation_report',),).toBe(false,);
        expect(served.includes('candidate_ballot',),).toBe(false,);
      },
    },),
  ],
},);
