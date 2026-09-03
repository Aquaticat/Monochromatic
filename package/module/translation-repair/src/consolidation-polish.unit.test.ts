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
  assertFinalNaturalnessComplete,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  NaturalnessCompletenessError,
  polishConsolidation,
  reviewParagraphsOf,
  type SettledArtifact,
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
 * Faithful idiomatic rewrite, as a refiner emits it: one line.
 */
const POLISHED = 'She maintained a positive outlook on life and spent some good times with everyone, doing her best to stay hopeful and connected to those around her.';

/**
 * The same rewrite as the page carries it: wrapped at its semantic boundary
 * before the gate sees it (keyword233, 2026-09-03: a gate judge preferred the
 * unwrapped rewrite for "removing the stilted line breaks" and the page
 * shipped single-line).
 */
const WRAPPED_POLISHED = 'She maintained a positive outlook on life and spent some good times with everyone,\n'
  + 'doing her best to stay hopeful and connected to those around her.';

/**
 * The base wording as the wrap would write it: a refinement that is exactly
 * this changes nothing and must not ship as a change.
 */
const WRAPPED_BASE = 'She faced life proactively and spent a good time with everyone,\n'
  + 'while doing her best to stay hopeful and connected to the people around her.';

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

/**
 * Wraps one settled polish in the minimal artifact the completeness guard reads.
 *
 * @param polish - settled polish record as the pipeline would persist it
 *
 * @returns Artifact whose only consolidated body slice carries that polish
 *
 * @example
 * ```ts
 * const artifact = artifactCarrying({ polish, },);
 * ```
 */
function artifactCarrying(
  { polish, }: { readonly polish: unknown; },
): SettledArtifact {
  // Serialization round-trip first, because persistence writes JSON and the
  // guard must accept what a resumed run would read back.
  // oxlint-disable-next-line unicorn/prefer-structured-clone -- JSON semantics are the point: persistence writes JSON, so undefined-valued keys must drop and a non-serializable field must fail here, both of which structuredClone would hide.
  return JSON.parse(JSON.stringify({
    laneSelection: {
      kind: 'contested',
      slices: [{
        sliceIndex: 1,
        verdict: { kind: 'lane-won', lane: 'translate', },
        ballots: [],
        usable: 2,
      },],
    },
    consolidation: {
      kind: 'settled',
      slices: [{
        sliceIndex: 1,
        terminal: 'gate-kept-standing',
        shipped: { kind: 'unchanged', },
        rewrapped: false,
        demoted: false,
        verdicts: [],
        gate: { kind: 'not-asked', },
        polish,
      },],
    },
  },),) as SettledArtifact;
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
          config: CONFIG,
          signal: AbortSignal.timeout(5_000,),
          perCallTimeoutMs: 5_000,
          l: tagged({ tag: 'consolidation-polish-test', },),
        },);
        expect(polish.kind,).toBe('settled',);
        if (polish.kind !== 'settled')
          throw new Error('body polish fixture did not run',);
        expect(polish.changed,).toBe(true,);
        expect(polish.text,).toBe(WRAPPED_POLISHED,);
        expect(polish.gate?.ships,).toBe('polished',);
        expect(polish.rounds.length,).toBe(1,);
        expect(polish.review.correctionCount,).toBe(0,);
        expect(polish.review.rounds[0]?.verdict,).toBe('acceptable',);
        expect(polish.review.confirmations,).toHaveLength(1,);
      },
    },),

    it({
      name: 'WRAPS THE REFINEMENT BEFORE ITS GATE so the gate judges the bytes the page carries, '
        + 'LEAVES a line-structured slice as the refiner wrote it, and DEMOTES a refinement that is '
        + 'only the base re-wrapped',
      fn: async () => {
        /**
         * Gate subjects the scripted gate was shown, so the test can prove
         * the wrapped bytes reached the deciders rather than only the page.
         */
        const gateSubjects: string[] = [];
        /**
         * Client answering the refine schema with a given rewrite and
         * recording what the polish gate is asked about.
         *
         * @param newText - rewrite the refiner returns for paragraph 1
         *
         * @returns Scripted client
         */
        function rewritingClient({ newText, }: { readonly newText: string; },): SyntheticClient {
          return {
            ...client,
            chatJson: async <ValueT,>(
              request: ChatJsonRequest<ValueT>,
            ): Promise<ChatJsonOutcome<ValueT>> => {
              /**
               * Schema identifying stage role.
               */
              const schema = request.responseFormat
                ?.json_schema
                .name;
              if (schema === 'consolidation_polish_gate')
                gateSubjects.push(JSON.stringify(request.messages,),);
              if (schema !== 'refine_report')
                return await client.chatJson(request,);
              /**
               * Scripted rewrite.
               */
              const value: unknown = {
                rewrites: [{
                  paragraph: 1,
                  newText,
                },],
              };
              if (!request.validate(value,))
                throw new Error('scripted refine reply failed validation',);
              return {
                kind: 'ok',
                value,
                rawText: JSON.stringify(value,),
              };
            },
          };
        }

        const wrapped = await polishConsolidation({
          client: rewritingClient({ newText: POLISHED, },),
          sourceText: '她曾积极地面对生活，和大家度过了一段不错的时光。',
          archiveText: BASE,
          baseText: BASE,
          lineStructured: false,
          sliceIndex: 1,
          config: CONFIG,
          signal: AbortSignal.timeout(5_000,),
          perCallTimeoutMs: 5_000,
          l: tagged({ tag: 'consolidation-polish-wrap-test', },),
        },);
        expect(wrapped.kind,).toBe('settled',);
        if (wrapped.kind !== 'settled')
          throw new Error('wrap fixture did not settle',);
        expect(wrapped.text,).toBe(WRAPPED_POLISHED,);
        expect(wrapped.proposedText,).toBe(WRAPPED_POLISHED,);
        // The gate was asked about the wrapped bytes, not the refiner's line.
        expect(gateSubjects.length,).toBeGreaterThan(0,);
        expect(gateSubjects.every((subject,) => subject.includes(JSON.stringify(WRAPPED_POLISHED,).slice(1, -1),),),).toBe(true,);

        // Line-structured: the one-line source keeps a one-line rewrite as
        // written; a wrap here would break the line count the rule protects.
        const governed = await polishConsolidation({
          client: rewritingClient({ newText: POLISHED, },),
          sourceText: '她曾积极地面对生活，和大家度过了一段不错的时光。',
          archiveText: BASE,
          baseText: BASE,
          lineStructured: true,
          sliceIndex: 1,
          config: CONFIG,
          signal: AbortSignal.timeout(5_000,),
          perCallTimeoutMs: 5_000,
          l: tagged({ tag: 'consolidation-polish-governed-test', },),
        },);
        expect(governed.kind,).toBe('settled',);
        if (governed.kind !== 'settled')
          throw new Error('governed fixture did not settle',);
        expect(governed.text,).toBe(POLISHED,);

        // A refinement that is the base with its line break put back is not a
        // change: the slice keeps the base byte for byte and says why.
        const rewrapOnly = await polishConsolidation({
          client: rewritingClient({ newText: WRAPPED_BASE, },),
          sourceText: '她曾积极地面对生活，和大家度过了一段不错的时光。',
          archiveText: BASE,
          baseText: BASE,
          lineStructured: false,
          sliceIndex: 1,
          config: CONFIG,
          signal: AbortSignal.timeout(5_000,),
          perCallTimeoutMs: 5_000,
          l: tagged({ tag: 'consolidation-polish-rewrap-test', },),
        },);
        expect(rewrapOnly.kind,).toBe('settled',);
        if (rewrapOnly.kind !== 'settled')
          throw new Error('rewrap fixture did not settle',);
        expect(rewrapOnly.changed,).toBe(false,);
        expect(rewrapOnly.text,).toBe(BASE,);
        expect(
          rewrapOnly.findings
            .some(function namesDemotion(finding,): boolean {
              return finding.includes('matched the base once wrapped',);
            },),
        ).toBe(true,);
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
        expect(polish.text,).toBe(WRAPPED_POLISHED,);
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
        expect(polish.text,).toBe(WRAPPED_POLISHED,);
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
        expect(polish.text,).toBe(WRAPPED_POLISHED,);
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
      name: 'ROUND-TRIPS A REJECTED AND A QUORUMLESS FINAL REVIEW through the persistence completeness guard',
      fn: async () => {
        // The exact shape this remediation exists for: verdicts recorded as
        // findings while the page ships. The completeness guard re-parses
        // the review with the correction chain required, so any latent
        // acceptable-final assumption in that parser would refuse this
        // record at persist time, after a whole entry was paid for.
        const [
          rejected,
          quorumless,
        ] = await Promise.all([
          polishConsolidation({
            client: singleRoundClient({ reviewAcceptableByRound: [false,], },),
            sourceText: '她曾积极地面对生活，和大家度过了一段不错的时光。',
            archiveText: BASE,
            baseText: BASE,
            lineStructured: false,
            sliceIndex: 1,
            config: CONFIG,
            signal: AbortSignal.timeout(5_000,),
            perCallTimeoutMs: 5_000,
            l: tagged({ tag: 'consolidation-polish-roundtrip-rejection-test', },),
          },),
          polishConsolidation({
            client: singleRoundClient({ reviewAcceptableByRound: [], },),
            sourceText: '她曾积极地面对生活，和大家度过了一段不错的时光。',
            archiveText: BASE,
            baseText: BASE,
            lineStructured: false,
            sliceIndex: 1,
            config: CONFIG,
            signal: AbortSignal.timeout(5_000,),
            perCallTimeoutMs: 5_000,
            l: tagged({ tag: 'consolidation-polish-roundtrip-quorum-test', },),
          },),
        ],);
        expect(rejected.kind,).toBe('settled',);
        expect(quorumless.kind,).toBe('settled',);
        // A throw here is the failure this test exists to catch.
        assertFinalNaturalnessComplete({
          artifact: artifactCarrying({ polish: rejected, },),
        },);
        assertFinalNaturalnessComplete({
          artifact: artifactCarrying({ polish: quorumless, },),
        },);
      },
    },),

    it({
      name: 'ACCEPTS AN UNENDORSED STANDING THAT SHIPPED WITH ITS FINDING, whose polish never ran over the '
        + 'unsafe baseline (the no-loop single attempt), and still REFUSES every other body slice without a '
        + 'settled polish: the Toka_ls rerun of 2026-09-02 ended INCOMPLETE after 117 minutes on exactly '
        + 'this record',
      fn: async () => {
        assertFinalNaturalnessComplete({
          artifact: artifactCarrying({
            polish: {
              kind: 'not-run',
              reason: 'unsafe-baseline',
            },
          },),
        },);
        expect(() => assertFinalNaturalnessComplete({
          artifact: artifactCarrying({
            polish: {
              kind: 'not-run',
              reason: 'not-configured',
            },
          },),
        },),).toThrow(NaturalnessCompletenessError,);
        expect(() => assertFinalNaturalnessComplete({
          artifact: artifactCarrying({ polish: undefined, },),
        },),).toThrow(NaturalnessCompletenessError,);
      },
    },),

    it({
      name: 'SHOWS THE REVIEWER EVERY BODY BLOCK and records that count, so a blockquote candidate with '
        + 'no refinable paragraph still gives a reviewer one paragraph to cite (Toka_ls slice 10, '
        + '2026-09-02: zero refinable paragraphs, six of nine ballots refused as out of range), and the '
        + 'completeness guard recomputes the same set',
      fn: async () => {
        /**
         * A letter in blockquote, which the polish may not edit but a reviewer
         * must still be able to cite.
         */
        const poem = '> By the time you read this letter,\n> I should already be living on in everyone’s memories.\n>\n> From the moment we met,\n> time really flew by.';
        expect(reviewParagraphsOf({ text: poem, },),).toEqual([poem,],);
        expect(reviewParagraphsOf({ text: `${poem}\n\nA closing paragraph.`, },),)
          .toEqual([poem, 'A closing paragraph.',],);
        expect(reviewParagraphsOf({ text: '', },),).toEqual([],);

        const polish = await polishConsolidation({
          client: singleRoundClient({ reviewAcceptableByRound: [true,], },),
          sourceText: '> 当你读到这封信的时候，\n> 我应该已经活在大家的回忆里了。\n>\n> 从我们相遇开始，\n> 时间过得真快。',
          archiveText: poem,
          baseText: poem,
          lineStructured: true,
          sliceIndex: 1,
          config: CONFIG,
          signal: AbortSignal.timeout(5_000,),
          perCallTimeoutMs: 5_000,
          l: tagged({ tag: 'consolidation-polish-blockquote-test', },),
        },);
        expect(polish.kind,).toBe('settled',);
        if (polish.kind !== 'settled')
          throw new Error('the polish did not settle',);
        expect(polish.review.rounds[0]?.paragraphCount,).toBe(1,);
        // The guard recomputes the paragraph digests from the final text with
        // the same set the writer used; a mismatch here is the generation-ten
        // reader disagreeing with its writer.
        assertFinalNaturalnessComplete({
          artifact: artifactCarrying({ polish, },),
        },);
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
