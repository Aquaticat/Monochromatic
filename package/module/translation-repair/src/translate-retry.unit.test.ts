/**
 * Tests for the second judging a declined slate buys.
 *
 * Three doors: a first judging that decides is returned as it stands with no
 * second ask; a first decline followed by a decision keeps the decision and
 * carries both rounds' findings; two declines settle as `no-candidate-backed`.
 * The thrown door, for a slice with nothing in the archive, is covered by the
 * stage suite.
 *
 * Fixtures are cat-themed invention.
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
  judgeSlateWithRetry,
  messageText,
  produceTranslateSlate,
  type RosterModelId,
  type SyntheticClient,
  type TranslateStageResult,
} from '../dist/final/node/index.mjs';

/**
 * Logger for the judgings under test.
 */
const l = tagged({ tag: 'translate-retry-test', },);

/**
 * Schema name the producing half asks translators for; every other structured
 * ask is a judge sheet.
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
 * What the translators render, one each in call order.
 */
const RENDERINGS: readonly string[] = [
  'The cat dozes on the windowsill, tail draped beside the radiator.',
  'A cat naps on the sill, its tail hanging near the heater.',
];

/**
 * Candidate number on a judge sheet whose block carries the needle, zero when
 * none does, which is a rejection of the whole slate.
 *
 * @param content - judge sheet as sent
 *
 * @param needle - text the wanted candidate carries
 *
 * @returns Candidate number, or zero
 *
 * @example
 * ```ts
 * const best = pickCandidate({ content, needle: 'dozes', },);
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
   * Candidate blocks, each opening with its number.
   */
  const [, ...blocks] = content.split('CANDIDATE ',);
  for (const block of blocks) {
    /**
     * Number the block opens with.
     */
    const [heading = '',] = block.split('\n',);
    const index = Math.trunc(Number(heading,),);
    if (Number.isInteger(index,) && block.includes(needle,))
      return index;
  }
  return 0;
}

/**
 * Client whose translators render in call order and whose judges answer as the
 * per-round script says.
 *
 * @param ballotFor - what the judges say, given how many judgings have been
 * asked so far (the first is 1)
 *
 * @returns Client plus the count of judge calls made
 *
 * @example
 * ```ts
 * const rig = scriptedRig({ ballotFor: () => 'reject', },);
 * ```
 */
function scriptedRig(
  { ballotFor, }: { readonly ballotFor: (judging: number) => 'reject' | 'dozes'; },
): {
  readonly client: SyntheticClient;
  readonly judgeCalls: { count: number; };
  readonly judgePrompts: string[];
} {
  /**
   * Translator calls served so far.
   */
  const served = { count: 0, };

  /**
   * Judge calls made so far, which says which judging this is.
   */
  const judgeCalls = { count: 0, };
  /**
   * Exact model-plus-message identities across judging rounds.
   */
  const judgePrompts: string[] = [];

  return {
    judgeCalls,
    judgePrompts,
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
         * Which sheet this is.
         */
        const schema = request.responseFormat
          ?.json_schema
          .name;
        if (schema === TRANSLATE_SCHEMA) {
          /**
           * Rendering this call gets.
           */
          const translation = RENDERINGS[served.count % RENDERINGS.length] ?? '';
          served.count += 1;
          /**
           * Reply as the wire expects it.
           */
          const value: unknown = { translation, };
          if (!request.validate(value,))
            throw new Error('the fixture translation failed the wire guard',);
          return {
            kind: 'ok',
            value,
            rawText: JSON.stringify(value,),
          };
        }
        judgeCalls.count += 1;
        judgePrompts.push(JSON.stringify({
          modelId: request.modelId,
          messages: request.messages,
        },),);

        /**
         * Which judging this call belongs to, every judge answering once per
         * judging.
         */
        const judging = Math.ceil(judgeCalls.count / JUDGES.length,);

        /**
         * Sheet text, for finding the wanted candidate.
         */
        const content = request.messages
          .map(function toContent(message,) {
            return messageText({ message, },);
          },)
          .join('\n',);

        /**
         * Ballot for this judging.
         */
        const ballot: unknown = {
          best: (ballotFor(judging,) === 'reject')
            ? 0
            : pickCandidate({
              content,
              needle: 'dozes',
            },),
          reason: 'fixture',
        };
        if (!request.validate(ballot,))
          throw new Error('the fixture ballot failed the wire guard',);
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
 * Judges one freshly produced slate through the retry, under one script.
 *
 * @param ballotFor - what the judges say per judging
 *
 * @returns Stage result plus the judge calls it cost
 *
 * @example
 * ```ts
 * const { result, } = await judgedUnder({ ballotFor: () => 'dozes', },);
 * ```
 */
async function judgedUnder(
  { ballotFor, }: { readonly ballotFor: (judging: number) => 'reject' | 'dozes'; },
): Promise<{
  readonly result: TranslateStageResult;
  readonly judgeCalls: number;
  readonly judgePrompts: readonly string[];
}> {
  /**
   * Scripted client and its counter.
   */
  const rig = scriptedRig({ ballotFor, },);

  /**
   * Slate the translators produced.
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

  /**
   * What the retry settled on.
   */
  const result = await judgeSlateWithRetry({
    judging: {
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
    },
  },);
  return {
    result,
    judgeCalls: rig.judgeCalls.count,
    judgePrompts: rig.judgePrompts,
  };
}

/**
 * Finding the retry writes between the two rounds' findings.
 */
const RETRY_FINDING = 'translate-declined-retried';

await describe({
  name: judgeSlateWithRetry.name,
  children: [
    it({
      name: 'KEEPS a second judging\'s decision after a first decline, carrying the first round\'s findings and '
        + 'the retry marker, so the record shows both asks',
      fn: async () => {
        const { result, judgeCalls, judgePrompts, } = await judgedUnder({
          ballotFor: function firstRejects(judging,): 'reject' | 'dozes' {
            return (judging === 1) ? 'reject' : 'dozes';
          },
        },);

        expect(result.origin,).toBe('fresh',);
        expect(result.text.includes('dozes',),).toBe(true,);
        expect(result.findings.includes(RETRY_FINDING,),).toBe(true,);
        expect(result.findings.includes('translate-declined (rejection)',),).toBe(true,);
        expect(judgeCalls,).toBe(JUDGES.length * 2,);
        expect(new Set(judgePrompts,).size,).toBe(judgeCalls,);
      },
    },),

    it({
      name: 'asks ONCE when the first judging decides, and writes no retry marker',
      fn: async () => {
        const { result, judgeCalls, } = await judgedUnder({
          ballotFor: function alwaysDecides(): 'reject' | 'dozes' {
            return 'dozes';
          },
        },);

        expect(result.origin,).toBe('fresh',);
        expect(result.findings.includes(RETRY_FINDING,),).toBe(false,);
        expect(judgeCalls,).toBe(JUDGES.length,);
      },
    },),

    it({
      name: 'SETTLES two declines as no-candidate-backed rather than as the momentary reason, keeping the '
        + 'incumbent and both rounds\' findings',
      fn: async () => {
        const { result, judgeCalls, } = await judgedUnder({
          ballotFor: function alwaysRejects(): 'reject' | 'dozes' {
            return 'reject';
          },
        },);

        expect(result.decision,).toBe('no-candidate-backed',);
        expect(result.origin,).toBe('incumbent',);
        expect(result.text,).toBe(INCUMBENT_TEXT,);
        expect(result.findings.filter(function isRetry(finding,): boolean {
          return finding === RETRY_FINDING;
        },).length,).toBe(1,);
        expect(judgeCalls,).toBe(JUDGES.length * 2,);
      },
    },),
  ],
},);
