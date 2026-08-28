/**
 * Tests post-consolidation naturalness rewrite through final fidelity gate.
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
  polishConsolidation,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/**
 * Active invented-size roster for every synthetic role.
 */
const ROSTER = [
  'hf:zai-org/GLM-5.2',
  'hf:Qwen/Qwen3.8-27B',
  'hf:moonshotai/Kimi-K3',
] as const;

/**
 * Literal but faithful base wording.
 */
const BASE = 'She faced life proactively and spent a good time with everyone, while doing her best to stay hopeful and connected to the people around her.';

/**
 * Faithful idiomatic rewrite.
 */
const POLISHED = 'She maintained a positive outlook on life and spent some good times with everyone, doing her best to stay hopeful and connected to those around her.';

/**
 * Short literal prose final polish must still review.
 */
const SHORT_BASE = 'She had a good time with everyone.';

/**
 * Faithful idiomatic rewrite of short prose.
 */
const SHORT_POLISHED = 'She spent some happy times with everyone.';

/**
 * Client serving rewrite, selection and final gate schemas.
 */
const client: SyntheticClient = {
  chatText: async () => {
    throw new Error('chatText unused by structured polish stages',);
  },
  chatJson: async <ValueT,>(
    request: ChatJsonRequest<ValueT>,
  ): Promise<ChatJsonOutcome<ValueT>> => {
    /**
     * Schema identifying stage role.
     */
    const schema = request.responseFormat
      ?.json_schema
      .name;
    /**
     * Synthetic reply for requested stage.
     */
    /**
     * Whether request carries sentence-scale final polish fixture.
     */
    const short = JSON.stringify(request.messages,).includes(SHORT_BASE,);
    const value: unknown = (schema === 'refine_report')
      ? {
        rewrites: [
          {
            paragraph: 1,
            newText: short ? SHORT_POLISHED : POLISHED,
          },
        ],
      }
      : (schema === 'candidate_ballot')
      ? {
        best: 1,
        reason: 'clear idiomatic improvement with same meaning',
      }
      : (schema === 'consolidation_polish_gate')
      ? {
        choice: 'polished',
        unsupported: [],
        dropped: [],
        reason: 'equally faithful and more idiomatic',
      }
      : (schema === 'absolute_naturalness_review')
      ? {
        acceptable: true,
        findings: [],
        reason: 'whole passage is publication-ready',
      }
      : {};
    if (!request.validate(value,))
      throw new Error(`synthetic ${String(schema,)} reply failed validation`,);
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

/**
 * Builds client whose initial no-op fails absolute review and whose sole correction follows script.
 *
 * @param correctionText - corrective replacement, absent to return second no-op
 *
 * @param rejectCorrection - whether second absolute review still rejects
 *
 * @param selectionSheets - optional sink receiving candidate-selector prompts
 *
 * @returns Scripted bounded-correction client
 *
 * @example
 * ```ts
 * const correctionClient = boundedCorrectionClient({ correctionText: POLISHED, });
 * ```
 */
function boundedCorrectionClient(
  {
    correctionText,
    rejectCorrection = false,
    selectionSheets,
  }: {
    readonly correctionText?: string;
    readonly rejectCorrection?: boolean;
    readonly selectionSheets?: string[];
  },
): SyntheticClient {
  /**
   * Stateful call counts separating initial and corrective rounds.
   */
  const calls = {
    refine: 0,
    review: 0,
  };
  return {
    chatText: async () => {
      throw new Error('chatText unused by structured polish stages',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       * Schema identifying stage role.
       */
      const schema = request.responseFormat
        ?.json_schema
        .name;
      /**
       * Scripted stage reply.
       */
      const value: unknown = (() => {
        if (schema === 'refine_report') {
          calls.refine += 1;
          return {
            rewrites: ((calls.refine === 1) || (correctionText === undefined))
              ? []
              : [{ paragraph: 1, newText: correctionText, },],
          };
        }
        if (schema === 'candidate_ballot') {
          selectionSheets?.push(JSON.stringify(request.messages,),);
          return {
            best: 1,
            reason: 'correction resolves every supplied finding',
          };
        }
        if (schema === 'consolidation_polish_gate') {
          return {
            choice: 'polished',
            unsupported: [],
            dropped: [],
            reason: 'correction remains faithful',
          };
        }
        if (schema === 'absolute_naturalness_review') {
          calls.review += 1;
          if ((calls.review === 1) || rejectCorrection) {
            return {
              acceptable: false,
              findings: [{
                paragraph: 1,
                problem: 'Replace stiff source-language word order.',
              },],
              reason: 'candidate retains translationese',
            };
          }
          return {
            acceptable: true,
            findings: [],
            reason: 'whole passage is publication-ready',
          };
        }
        return {};
      })();
      if (!request.validate(value,))
        throw new Error(`synthetic ${String(schema,)} reply failed validation`,);
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
  name: polishConsolidation.name,
  children: [
    it({
      name: 'SHIPS IDIOMATIC REWRITE only after selection and fidelity-first gate',
      fn: async () => {
        const polish = await polishConsolidation({
          client,
          sourceText: '她曾积极地面对生活，和大家度过了一段不错的时光。',
          archiveText: BASE,
          baseText: BASE,
          lineStructured: false,
          sliceIndex: 1,
          config: {
            refinerModelIds: [ROSTER[0],],
            judgeModelIds: ROSTER,
            gateModelIds: ROSTER,
            declaredNames: [],
            definitions: '',
          },
          signal: AbortSignal.timeout(5_000,),
          perCallTimeoutMs: 5_000,
          l: tagged({ tag: 'consolidation-polish-test', },),
        },);
        expect(polish.kind,).toBe('settled',);
        if (polish.kind !== 'settled')
          throw new Error('body polish fixture did not run',);
        expect(polish.changed,).toBe(true,);
        expect(polish.text,).toBe(POLISHED,);
        expect(polish.gate?.ships,).toBe('polished',);
        expect(polish.rounds.length,).toBe(1,);
        expect(polish.review.correctionCount,).toBe(0,);
        expect(polish.review.rounds[0]?.verdict,).toBe('acceptable',);
      },
    },),

    it({
      name: 'REVIEWS SHORT BODY PROSE below repair-lane refinement window',
      fn: async () => {
        const polish = await polishConsolidation({
          client,
          sourceText: '她和大家度过了一段不错的时光。',
          archiveText: SHORT_BASE,
          baseText: SHORT_BASE,
          lineStructured: false,
          sliceIndex: 2,
          config: {
            refinerModelIds: [ROSTER[0],],
            judgeModelIds: ROSTER,
            gateModelIds: ROSTER,
            declaredNames: [],
            definitions: '',
          },
          signal: AbortSignal.timeout(5_000,),
          perCallTimeoutMs: 5_000,
          l: tagged({ tag: 'consolidation-polish-test', },),
        },);
        expect(polish.kind,).toBe('settled',);
        expect(polish.kind === 'settled' ? polish.text : '',).toBe(SHORT_POLISHED,);
      },
    },),

    it({
      name: 'CORRECTS ABSOLUTE REVIEW FINDINGS once and re-reviews exact gated text',
      fn: async () => {
        /** Selector prompts across required correction. */
        const selectionSheets: string[] = [];
        const polish = await polishConsolidation({
          client: boundedCorrectionClient({ correctionText: POLISHED, selectionSheets, }),
          sourceText: '她曾积极地面对生活，和大家度过了一段不错的时光。',
          archiveText: BASE,
          baseText: BASE,
          lineStructured: false,
          sliceIndex: 1,
          config: {
            refinerModelIds: [ROSTER[0],],
            judgeModelIds: ROSTER,
            gateModelIds: ROSTER,
            declaredNames: [],
            definitions: '',
          },
          signal: AbortSignal.timeout(5_000,),
          perCallTimeoutMs: 5_000,
          l: tagged({ tag: 'consolidation-polish-correction-test', },),
        },);
        expect(polish.kind,).toBe('settled',);
        if (polish.kind !== 'settled')
          throw new Error('bounded correction fixture remained unsettled',);
        expect(polish.text,).toBe(POLISHED,);
        expect(polish.review.correctionCount,).toBe(1,);
        expect(polish.review.rounds.map(function verdict(review,): string {
          return review.verdict;
        },),).toEqual([
          'unacceptable',
          'acceptable',
        ],);
        expect(polish.rounds.length,).toBe(1,);
        expect(selectionSheets.join('\n',),).toContain('CURRENT English translation, which cannot ship unchanged',);
        expect(selectionSheets.join('\n',),).toContain('REQUIRED FINDINGS',);
      },
    },),

    it({
      name: 'RETURNS UNSETTLED when sole correction makes no approved text change',
      fn: async () => {
        const polish = await polishConsolidation({
          client: boundedCorrectionClient({}),
          sourceText: '她曾积极地面对生活，和大家度过了一段不错的时光。',
          archiveText: BASE,
          baseText: BASE,
          lineStructured: false,
          sliceIndex: 1,
          config: {
            refinerModelIds: [ROSTER[0],],
            judgeModelIds: ROSTER,
            gateModelIds: ROSTER,
            declaredNames: [],
            definitions: '',
          },
          signal: AbortSignal.timeout(5_000,),
          perCallTimeoutMs: 5_000,
          l: tagged({ tag: 'consolidation-polish-unsettled-test', },),
        },);
        expect(polish.kind,).toBe('unsettled',);
        expect(polish.kind === 'unsettled' ? polish.review.correctionCount : 0,).toBe(1,);
      },
    },),

    it({
      name: 'RETURNS UNSETTLED when post-correction absolute review still rejects',
      fn: async () => {
        const polish = await polishConsolidation({
          client: boundedCorrectionClient({ correctionText: POLISHED, rejectCorrection: true, }),
          sourceText: '她曾积极地面对生活，和大家度过了一段不错的时光。',
          archiveText: BASE,
          baseText: BASE,
          lineStructured: false,
          sliceIndex: 1,
          config: {
            refinerModelIds: [ROSTER[0],],
            judgeModelIds: ROSTER,
            gateModelIds: ROSTER,
            declaredNames: [],
            definitions: '',
          },
          signal: AbortSignal.timeout(5_000,),
          perCallTimeoutMs: 5_000,
          l: tagged({ tag: 'consolidation-polish-rejection-test', },),
        },);
        expect(polish.kind,).toBe('unsettled',);
        expect(polish.kind === 'unsettled' ? polish.review.rounds.length : 0,).toBe(2,);
      },
    },),

    it({
      name: 'SKIPS SYNTAX-BEARING FRONT MATTER before any model call',
      fn: async () => {
        const polish = await polishConsolidation({
          client,
          sourceText: '---\nname: 猫猫\n---\n',
          archiveText: '---\nname: Maomao\n---\n',
          baseText: '---\nname: Maomao\n---\n',
          syntax: 'front-matter',
          lineStructured: false,
          sliceIndex: 0,
          signal: AbortSignal.timeout(5_000,),
          perCallTimeoutMs: 5_000,
          l: tagged({ tag: 'consolidation-polish-test', },),
        },);
        expect(polish,).toEqual({
          kind: 'not-run',
          reason: 'front-matter',
        },);
      },
    },),
  ],
},);
