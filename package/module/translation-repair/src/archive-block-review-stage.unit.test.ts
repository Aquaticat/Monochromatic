/**
 * Tests archive-only provenance, correction, and recorded naturalness under
 * the single-round contract: reviewer indecision retains the block with
 * findings and never buys a second round.
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
  isArchiveSourceQuoteAnchored,
  isVerifiableEditorialArchiveBlock,
  runArchiveBlockReviewStage,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/** Four seats let two producers receive disinterested selection ballots. */
const ROSTER = [
  'hf:zai-org/GLM-5.3-Flash',
  'hf:Qwen/Qwen3.8-27B',
  'hf:moonshotai/Kimi-K3',
  'hf:openai/gpt-oss-120b',
] as const;

/** Logger for archive-block stage tests. */
const l = tagged({ tag: 'archive-block-review-stage-test', },);

/** Reply selector for one scripted request. */
type ReplyFor = (input: {
  readonly schema: string;
  readonly prompt: string;
  readonly modelId: string;
}) => unknown;

/**
 * Creates schema-aware direct client and captures exact prompts.
 *
 * @param replyFor - reply selector
 *
 * @param prompts - prompt capture sink
 *
 * @param payloads - optional model-plus-prompt identity sink
 *
 * @returns Scripted client
 */
function scriptedClient(
  {
    replyFor,
    prompts,
    payloads,
  }: {
    readonly replyFor: ReplyFor;
    readonly prompts: string[];
    readonly payloads?: string[];
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText not used',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /** Structured schema naming requested responsibility. */
      const schema = request.responseFormat?.json_schema.name ?? '';
      /** Complete prompt used for responsibility and anonymity assertions. */
      const prompt = JSON.stringify(request.messages,);
      prompts.push(prompt,);
      payloads?.push(`${request.modelId}\u0000${prompt}`,);
      /** Scripted value for current role. */
      const value = replyFor({ schema, prompt, modelId: request.modelId, });
      if (!request.validate(value,))
        throw new Error(`scripted ${schema} reply failed validator`,);
      return {
        kind: 'ok',
        value,
        rawText: JSON.stringify(value,),
      };
    },
    quotas: async () => {
      throw new Error('quotas not used',);
    },
  };
}

/** Acceptable absolute-naturalness reply. */
const ACCEPTABLE_NATURALNESS = {
  acceptable: true,
  findings: [],
  reason: 'Publication-ready wording.',
} as const;

await describe({
  name: 'archive block review stage',
  children: [
    it({
      name: 'REQUIRES substantive source quote inside expected aligned section',
      fn: async () => {
        expect(isArchiveSourceQuoteAnchored({
          sourceContext: '猫在窗边安静地睡觉。',
          sourceQuote: '窗边安静地睡觉',
        },),).toBe(true,);
        expect(isArchiveSourceQuoteAnchored({
          sourceContext: '猫在窗边安静地睡觉。',
          sourceQuote: '猫在',
        },),).toBe(false,);
        expect(isArchiveSourceQuoteAnchored({
          sourceContext: '猫在窗边安静地睡觉。',
          sourceQuote: '狗在门边等待',
        },),).toBe(false,);
      },
    },),
    it({
      name: 'CORROBORATES narrow editorial apparatus without licensing factual prose',
      fn: async () => {
        expect(isVerifiableEditorialArchiveBlock({ blockText: 'Translator: Cat Friend', },),).toBe(true,);
        expect(isVerifiableEditorialArchiveBlock({ blockText: 'Source: [Cat notes](https://example.test)', },),).toBe(true,);
        expect(isVerifiableEditorialArchiveBlock({ blockText: 'The cat won an award in spring.', },),).toBe(false,);
      },
    },),
    it({
      name: 'RETAINS anchored source wording only after two distinct naturalness responsibilities',
      fn: async () => {
        const prompts: string[] = [];
        const outcome = await runArchiveBlockReviewStage({
          client: scriptedClient({
            prompts,
            replyFor: ({ schema, },) => schema === 'archive_block_review'
              ? {
                disposition: 'source-supported',
                sourceQuote: '窗边安静地睡觉',
                replacementText: '',
                finding: 'Expected section supports this sentence.',
              }
              : ACCEPTABLE_NATURALNESS,
          },),
          modelIds: ROSTER,
          sourceText: '猫在窗边安静地睡觉。',
          targetText: 'The cat sleeps quietly by the window.',
          blockText: 'The cat sleeps quietly by the window.',
          priorFindings: [],
          signal: new AbortController().signal,
          exchangeTimeoutMs: 5_000,
          l,
        },);

        expect(outcome.kind,).toBe('retained');
        const naturalnessPrompts = prompts.filter(function isNaturalness(prompt,): boolean {
          return prompt.includes('publication-ready English',);
        },);
        expect(new Set(naturalnessPrompts,).size,).toBe(2);
      },
    },),
    it({
      name: 'RETAINS the block with an unresolved finding when post-anchor voices fall below exact-half '
        + 'participation, buying no naturalness review: a heard roster whose support does not anchor is '
        + 'a verdict, not an outage (it ended XIEPT2 in 114 seconds on 2026-09-02 as '
        + '"provider-unavailable" with every seat answering), and the no-loop design retains an '
        + 'unresolved block with its findings',
      fn: async () => {
        const prompts: string[] = [];
        const outcome = await runArchiveBlockReviewStage({
          client: scriptedClient({
            prompts,
            replyFor: ({ schema, modelId, },) => schema === 'archive_block_review'
              ? {
                disposition: 'source-supported',
                sourceQuote: modelId === ROSTER[0] ? '窗边安静地睡觉' : '不存在的来源句子',
                replacementText: '',
                finding: 'Source support claim.',
              }
              : ACCEPTABLE_NATURALNESS,
          },),
          modelIds: ROSTER,
          sourceText: '猫在窗边安静地睡觉。',
          targetText: 'The cat sleeps quietly by the window.',
          blockText: 'The cat sleeps quietly by the window.',
          priorFindings: [],
          signal: new AbortController().signal,
          exchangeTimeoutMs: 5_000,
          l,
        },);
        expect(outcome.kind,).toBe('retained',);
        expect(outcome.text,).toBe('The cat sleeps quietly by the window.',);
        expect(outcome.findings.join('\n',),).toContain('archive review left the block unresolved: 1 of',);
        expect(outcome.findings.join('\n',),).toContain('archive review discarded uncorroborated retention claim',);
        // No naturalness review is bought for a block nobody could anchor.
        expect(prompts.some(function isNaturalness(prompt,): boolean {
          return prompt.includes('publication-ready English',);
        },),).toBe(false,);
      },
    },),
    it({
      name: 'SELECTS correction without exposing producer model ids to candidate judges',
      fn: async () => {
        const prompts: string[] = [];
        const outcome = await runArchiveBlockReviewStage({
          client: scriptedClient({
            prompts,
            replyFor: ({ schema, },) => schema === 'archive_block_review'
              ? {
                disposition: 'revise',
                sourceQuote: '',
                replacementText: 'The cat sleeps by the window.',
                finding: 'Remove unsupported award claim.',
              }
              : {
                best: 1,
                reason: 'Only supported details remain.',
              },
          },),
          modelIds: ROSTER,
          sourceText: '猫在窗边睡觉。',
          targetText: 'The cat sleeps by the window and won an award.',
          blockText: 'The cat sleeps by the window and won an award.',
          priorFindings: [],
          signal: new AbortController().signal,
          exchangeTimeoutMs: 5_000,
          l,
        },);

        expect(outcome.text,).toBe('The cat sleeps by the window.');
        const selectionPrompts = prompts.filter(function isSelection(prompt,): boolean {
          return prompt.includes('Choose a publishable correction',);
        },);
        expect(selectionPrompts,).toHaveLength(4);
        for (const prompt of selectionPrompts) {
          for (const modelId of ROSTER)
            expect(prompt.includes(modelId,),).toBe(false,);
        }
      },
    },),
    it({
      name: 'RETAINS the block when every proposed correction drops contributor identity',
      fn: async () => {
        const prompts: string[] = [];
        const outcome = await runArchiveBlockReviewStage({
          client: scriptedClient({
            prompts,
            replyFor: ({ schema, },) => schema === 'archive_block_review'
              ? {
                disposition: 'revise',
                sourceQuote: '',
                replacementText: '',
                finding: 'Remove the attribution block.',
              }
              : {
                best: 1,
                reason: 'Remove the only candidate.',
              },
          },),
          modelIds: ROSTER,
          sourceText: '',
          targetText: 'Contributors for this entry: Cat Friend',
          blockText: 'Contributors for this entry: Cat Friend',
          priorFindings: [],
          signal: new AbortController().signal,
          exchangeTimeoutMs: 5_000,
          l,
        },);
        // Every candidate dropped the authoritative identity, so the slate is
        // empty, the selection declines without a call, and the original ships.
        expect(outcome.kind,).toBe('retained');
        expect(outcome.text,).toBe('Contributors for this entry: Cat Friend');
        expect(outcome.findings
          .includes('archive correction slate declined',),).toBe(true,);
      },
    },),
    it({
      name: 'RECORDS a naturalness rejection as findings on the retained block, never a second round',
      fn: async () => {
        const prompts: string[] = [];
        const outcome = await runArchiveBlockReviewStage({
          client: scriptedClient({
            prompts,
            replyFor: ({ schema, },) => schema === 'archive_block_review'
              ? {
                disposition: 'source-supported',
                sourceQuote: '窗边安静地睡觉',
                replacementText: '',
                finding: 'Expected section supports this sentence.',
              }
              : {
                acceptable: false,
                findings: [{
                  paragraph: 1,
                  problem: 'Awkward archive wording.',
                },],
                reason: 'Revision is required.',
              },
          },),
          modelIds: ROSTER,
          sourceText: '猫在窗边安静地睡觉。',
          targetText: 'The cat by the window quietly sleeping is.',
          blockText: 'The cat by the window quietly sleeping is.',
          priorFindings: [],
          signal: new AbortController().signal,
          exchangeTimeoutMs: 5_000,
          l,
        },);

        // The reviewer verdict is evidence, not withholding authority: the
        // anchored block ships with the located problem on its findings.
        expect(outcome.kind,).toBe('retained');
        expect(outcome.text,).toBe('The cat by the window quietly sleeping is.');
        expect(outcome.findings
          .includes('archive naturalness paragraph 1: Awkward archive wording.',),).toBe(true,);
        const reviewPrompts = prompts.filter(function isReview(prompt,): boolean {
          return prompt.includes('Review English archive wording',);
        },);
        expect(new Set(reviewPrompts,).size,).toBe(1);
      },
    },),
    it({
      name: 'RETAINS the block when judges decline every correction, buying no second round',
      fn: async () => {
        const prompts: string[] = [];
        const payloads: string[] = [];
        const outcome = await runArchiveBlockReviewStage({
          client: scriptedClient({
            prompts,
            payloads,
            replyFor: ({ schema, },) => schema === 'archive_block_review'
              ? {
                disposition: 'revise',
                sourceQuote: '',
                replacementText: 'The cat sleeps.',
                finding: 'Remove unsupported award claim.',
              }
              : {
                best: 0,
                reason: 'No correction is yet acceptable.',
              },
          },),
          modelIds: ROSTER,
          sourceText: '猫在睡觉。',
          targetText: 'The cat won an award.',
          blockText: 'The cat won an award.',
          priorFindings: [],
          signal: new AbortController().signal,
          exchangeTimeoutMs: 5_000,
          l,
        },);
        // Archive wording is the shipping default; the decline is recorded
        // evidence and the stage never re-asks.
        expect(outcome.kind,).toBe('retained');
        expect(outcome.text,).toBe('The cat won an award.');
        expect(outcome.findings
          .includes('archive correction slate declined',),).toBe(true,);
        const reviewPrompts = prompts.filter(function isReview(prompt,): boolean {
          return prompt.includes('Review English archive wording',);
        },);
        expect(new Set(reviewPrompts,).size,).toBe(1);
        expect(new Set(payloads,).size,).toBe(payloads.length);
      },
    },),
  ],
},);
