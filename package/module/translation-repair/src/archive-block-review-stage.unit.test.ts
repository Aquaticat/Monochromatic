/**
 Tests archive-only provenance, correction, and recorded naturalness under
 the single-round contract: reviewer indecision retains the block with
 findings and never buys a second round.
 
 Fixtures are cat-themed invention.
 
 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  isArchiveSourceQuoteAnchored,
  isVerifiableEditorialArchiveBlock,
  runArchiveBlockReviewStage,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
  SEAT_SYNTHETIC_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/** Four seats let two producers receive disinterested selection ballots. */
const ROSTER = [
  SEAT_SYNTHETIC_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
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
 Creates schema-aware direct client and captures exact prompts.
 
 @param replyFor - reply selector
 
 @param prompts - prompt capture sink
 
 @param payloads - optional model-plus-prompt identity sink
 
 @returns Scripted client
 */
function scriptedClient(
  {
    replyFor,
    prompts,
    payloads,
    unreadableFor = () => false,
  }: {
    readonly replyFor: ReplyFor;
    readonly prompts: string[];
    readonly payloads?: string[];
    /**
     Seats whose every reply the completion cap cut before its content, the
     shape `chat-json-outcome.ts` reads off `finish_reason=length`.
     */
    readonly unreadableFor?: (modelId: string) => boolean;
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
      if (unreadableFor(request.modelId,)) {
        return {
          kind: 'schema-mismatch',
          rawText: '',
          reason: 'truncated-completion',
          detail: 'provider reported a truncating completion (model stopped with finish_reason=length)',
        };
      }
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
      name: 'RETAINS the block when the bench answered but the cap cut most replies before their content: '
        + 'an answer nobody could read is not silence (class thirty-one: Mio13 was interrupted '
        + '"provider-unavailable" on 2026-09-16 at 4 of 12 heard with every provider wet, seven seats '
        + 'having spent their whole completion cap reasoning about the first chat translation)',
      fn: async () => {
        const prompts: string[] = [];
        /** Seats asked, so the case proves the whole bench was reached. */
        const asked = new Set<string>();
        const outcome = await runArchiveBlockReviewStage({
          client: scriptedClient({
            prompts,
            unreadableFor: (modelId,) => {
              asked.add(modelId,);
              return modelId !== ROSTER[0];
            },
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
        expect(asked.size,).toBe(ROSTER.length,);
        expect(outcome.kind,).toBe('retained',);
        expect(outcome.text,).toBe('The cat sleeps quietly by the window.',);
        expect(outcome.findings.join('\n',),).toContain('stage-quorum-unmet (archive-block-review 1/',);
        expect(outcome.findings.join('\n',),).toContain('archive review left the block unresolved: 1 of 1',);
      },
    },),
    it({
      name: 'SHIPS a revision in the archive quote style when the reviewer wrote straight quotes (class thirty-eight)',
      fn: async () => {
        /** Prompts, captured so the judges are shown to read the restored bytes. */
        const prompts: string[] = [];
        /** Reviewer's wording, straight quotes throughout. */
        const written = 'The cat\'s "nap" by the window.';
        /** Same wording in the archive's curly convention. */
        const restored = 'The cat’s “nap” by the window.';
        /** Actual review stage over a curly-quoted archive. */
        const outcome = await runArchiveBlockReviewStage({
          client: scriptedClient({
            prompts,
            replyFor: ({ schema, },) => schema === 'archive_block_review'
              ? {
                disposition: 'revise',
                sourceQuote: '',
                replacementText: written,
                finding: 'Remove unsupported award claim.',
              }
              : { best: 1, reason: 'Only supported details remain.', },
          },),
          modelIds: ROSTER,
          sourceText: '猫在窗边打盹。',
          targetText: 'The cat’s “nap” by the window and won an award.',
          blockText: 'The cat’s “nap” by the window and won an award.',
          priorFindings: [],
          signal: new AbortController().signal,
          exchangeTimeoutMs: 5_000,
          l,
        },);
        expect(outcome.kind,).toBe('revised',);
        expect(outcome.text,).toBe(restored,);
        expect(prompts.some(function judgedRestored(prompt,): boolean {
          return prompt.includes('CURRENT ARCHIVE BLOCK',) && prompt.includes(restored,);
        },),).toBe(true,);
      },
    },),
    it({
      name: 'ACCEPTS quoted source evidence beside a revision instead of losing the reviewer to schema mismatch',
      fn: async () => {
        /** Prompts prove the reply reaches independent correction selection. */
        const prompts: string[] = [];
        /** Source-supported part remains while the unsupported award is removed. */
        const corrected = 'The cat sleeps by the window.';
        /** Actual review stage, including its custom guard and quorum accounting. */
        const outcome = await runArchiveBlockReviewStage({
          client: scriptedClient({
            prompts,
            replyFor: ({ schema, },) => schema === 'archive_block_review'
              ? {
                disposition: 'revise',
                sourceQuote: '猫在窗边睡觉',
                replacementText: corrected,
                finding: 'The quoted source supports sleeping, but not the award.',
              }
              : { best: 1, reason: 'Keep the supported detail and remove the unsupported claim.', },
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
        expect(outcome.kind,).toBe('revised',);
        expect(outcome.text,).toBe(corrected,);
        expect(prompts.some(function selected(prompt,): boolean {
          return prompt.includes('CURRENT ARCHIVE BLOCK',);
        },),).toBe(true,);
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
          return prompt.includes('CURRENT ARCHIVE BLOCK',);
        },);
        // One prompt per judge: four seats are a bench whose window could not
        // carry a unanimous slate on self-votes, so the whole bench is asked
        // (`candidate-select-fanout.ts`).
        expect(selectionPrompts,).toHaveLength(4);
        for (const prompt of selectionPrompts) {
          for (const modelId of ROSTER)
            expect(prompt.includes(modelId,),).toBe(false,);
        }
      },
    },),
    it({
      name: 'WITHHOLDS a revision whose block shape is not the block\'s own, so a one-paragraph label ships as the archive wrote it (class seventy-seven, zheermao2 2026-09-21: a four-block letter replaced the intro line)',
      fn: async () => {
        const prompts: string[] = [];
        /** Label block under review: one paragraph. */
        const label = 'English translation of the letter the cat sent:';
        /** Revision a reviewer wrote instead: four blocks of a letter, the third cut mid-sentence. */
        const letter = 'Good evening,\n\nI just refreshed my inbox. I would like to hug you.\n\nBut please believe me, the stories that are living are much more\n\nWarm wishes\nThe Cat';
        const outcome = await runArchiveBlockReviewStage({
          client: scriptedClient({
            prompts,
            replyFor: ({ schema, },) => schema === 'archive_block_review'
              ? {
                disposition: 'revise',
                sourceQuote: '',
                replacementText: letter,
                finding: 'The block carries no translation.',
              }
              : {
                best: 1,
                reason: 'Only the letter carries content.',
              },
          },),
          modelIds: ROSTER,
          sourceText: '猫寄来的信。',
          targetText: `${label}\n\n> Good evening.`,
          blockText: label,
          priorFindings: [],
          signal: new AbortController().signal,
          exchangeTimeoutMs: 5_000,
          l,
        },);

        expect(outcome.text,).toBe(label);
        expect(outcome.findings
          .some(function refusedOnShape(finding,): boolean {
            return finding.startsWith('archive-revision-refused',)
              && finding.includes('paragraph',);
          },),).toBe(true,);
        // No selection round is bought over a slate the floor emptied.
        expect(prompts.some(function isSelection(prompt,): boolean {
          return prompt.includes('CURRENT ARCHIVE BLOCK',);
        },),).toBe(false,);
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
