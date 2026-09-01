/**
 * Tests the single fixed polish round: refiners propose, judges select,
 * the deterministic gate applies, and the absolute review that follows is
 * recorded evidence on the settlement, never withholding authority and
 * never buying a correction round.
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
  'hf:zai-org/GLM-5.3-Flash',
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
 * Target-authoritative contributor attribution baseline.
 */
const CONTRIBUTOR_BASE = 'Contributors for this entry: [Snow](https://example.test/snow)';

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
 * Builds a client whose absolute reviews follow a per-round verdict script
 * and whose refiners may answer exactly once.
 *
 * A SECOND REFINE CALL THROWS: the fixed polish round buys one proposal, so
 * any correction re-ask is a regression this harness turns into a failure.
 *
 * @param reviewAcceptableByRound - acceptable status per one-based review round; absent rounds throw as lost seats
 *
 * @returns Scripted single-round client
 *
 * @example
 * ```ts
 * const rejecting = singleRoundClient({ reviewAcceptableByRound: [false,], },);
 * ```
 */
function singleRoundClient(
  { reviewAcceptableByRound, }: { readonly reviewAcceptableByRound: readonly boolean[]; },
): SyntheticClient {
  /**
   * Stateful call counts separating refine and review rounds.
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
          if (calls.refine > 1)
            throw new Error('a second refine round was bought; the polish round must never re-ask',);
          return {
            rewrites: [{
              paragraph: 1,
              newText: POLISHED,
            },],
          };
        }
        if (schema === 'candidate_ballot') {
          return {
            best: 1,
            reason: 'clear idiomatic improvement with same meaning',
          };
        }
        if (schema === 'consolidation_polish_gate') {
          return {
            choice: 'polished',
            unsupported: [],
            dropped: [],
            reason: 'scripted fidelity comparison',
          };
        }
        if (schema === 'absolute_naturalness_review') {
          calls.review += 1;
          /**
           * One-based absolute review round across every roster seat.
           */
          const reviewRound = Math.ceil(calls.review / ROSTER.length,);
          /**
           * Scripted acceptance for this round, absent to lose the seat.
           */
          const acceptable = reviewAcceptableByRound.at(reviewRound - 1,);
          if (acceptable === undefined)
            throw new Error('scripted lost review seat',);
          if (!acceptable) {
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

/**
 * Model roles shared by every case.
 */
const CONFIG = {
  refinerModelIds: [ROSTER[0],],
  judgeModelIds: ROSTER,
  gateModelIds: ROSTER,
  declaredNames: [],
  definitions: '',
} as const;

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
          config: CONFIG,
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
        expect(polish.review.confirmations,).toHaveLength(1,);
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
          config: CONFIG,
          signal: AbortSignal.timeout(5_000,),
          perCallTimeoutMs: 5_000,
          l: tagged({ tag: 'consolidation-polish-test', },),
        },);
        expect(polish.kind,).toBe('settled',);
        expect(polish.kind === 'settled' ? polish.text : '',).toBe(SHORT_POLISHED,);
      },
    },),

    it({
      name: 'KEEPS TARGET CONTRIBUTOR BASELINE when polish candidate drops authority',
      fn: async () => {
        const polish = await polishConsolidation({
          client,
          sourceText: '本条目贡献者：雪猫',
          archiveText: CONTRIBUTOR_BASE,
          baseText: CONTRIBUTOR_BASE,
          lineStructured: false,
          sliceIndex: 1,
          config: CONFIG,
          signal: AbortSignal.timeout(5_000,),
          perCallTimeoutMs: 5_000,
          l: tagged({ tag: 'consolidation-polish-contributor-test', },),
        },);
        expect(polish.kind,).toBe('settled',);
        if (polish.kind !== 'settled')
          throw new Error('contributor authority fixture did not settle',);
        expect(polish.text,).toBe(CONTRIBUTOR_BASE,);
        expect(polish.changed,).toBe(false,);
      },
    },),

    it({
      name: 'RECORDS AN ABSOLUTE REJECTION AS EVIDENCE and ships the gated text with no correction call',
      fn: async () => {
        const polish = await polishConsolidation({
          client: singleRoundClient({ reviewAcceptableByRound: [false,], },),
          sourceText: '她曾积极地面对生活，和大家度过了一段不错的时光。',
          archiveText: BASE,
          baseText: BASE,
          lineStructured: false,
          sliceIndex: 1,
          config: CONFIG,
          signal: AbortSignal.timeout(5_000,),
          perCallTimeoutMs: 5_000,
          l: tagged({ tag: 'consolidation-polish-rejection-test', },),
        },);
        // The reviewer verdict is evidence, not authority: the gated text
        // ships and the located problem lives on the findings. The scripted
        // client throws on any second refine call, so returning at all proves
        // no correction was bought.
        expect(polish.kind,).toBe('settled',);
        if (polish.kind !== 'settled')
          throw new Error('rejection fixture did not settle',);
        expect(polish.text,).toBe(POLISHED,);
        expect(polish.review
          .correctionCount,).toBe(0,);
        expect(polish.review
          .rounds[0]
          ?.verdict,).toBe('unacceptable',);
        expect(
          polish.findings
            .some(function namesRecording(finding,): boolean {
              return finding.includes('absolute naturalness rejection recorded as evidence',);
            },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'RECORDS CONFIRMATION REJECTION AS EVIDENCE instead of buying a correction',
      fn: async () => {
        const polish = await polishConsolidation({
          client: singleRoundClient({
            reviewAcceptableByRound: [
              true,
              false,
            ],
          },),
          sourceText: '她曾积极地面对生活，和大家度过了一段不错的时光。',
          archiveText: BASE,
          baseText: BASE,
          lineStructured: false,
          sliceIndex: 1,
          config: CONFIG,
          signal: AbortSignal.timeout(5_000,),
          perCallTimeoutMs: 5_000,
          l: tagged({ tag: 'consolidation-polish-confirmation-test', },),
        },);
        // Discovery accepted, the acceptance challenge rejected: the decisive
        // rejection is recorded beside the earlier acceptance and nothing is
        // withheld or re-asked.
        expect(polish.kind,).toBe('settled',);
        if (polish.kind !== 'settled')
          throw new Error('confirmation rejection fixture did not settle',);
        expect(polish.text,).toBe(POLISHED,);
        expect(polish.review
          .rounds[0]
          ?.verdict,).toBe('unacceptable',);
        expect(polish.review
          .confirmations,).toHaveLength(1,);
        expect(
          polish.findings
            .some(function namesRecording(finding,): boolean {
              return finding.includes('absolute naturalness rejection recorded as evidence',);
            },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'RECORDS QUORUM-NOT-MET AS EVIDENCE and ships the gated text',
      fn: async () => {
        // Every review seat is lost, so the review roster is unheard; the
        // producing round already settled, and reviewer absence after it must
        // not withhold the entry.
        const polish = await polishConsolidation({
          client: singleRoundClient({ reviewAcceptableByRound: [], },),
          sourceText: '她曾积极地面对生活，和大家度过了一段不错的时光。',
          archiveText: BASE,
          baseText: BASE,
          lineStructured: false,
          sliceIndex: 1,
          config: CONFIG,
          signal: AbortSignal.timeout(5_000,),
          perCallTimeoutMs: 5_000,
          l: tagged({ tag: 'consolidation-polish-quorum-test', },),
        },);
        expect(polish.kind,).toBe('settled',);
        if (polish.kind !== 'settled')
          throw new Error('quorum fixture did not settle',);
        expect(polish.text,).toBe(POLISHED,);
        expect(polish.review
          .rounds[0]
          ?.verdict,).toBe('quorum-not-met',);
        expect(
          polish.findings
            .some(function namesRecording(finding,): boolean {
              return finding.includes('absolute naturalness review quorum not met',);
            },),
        ).toBe(true,);
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
