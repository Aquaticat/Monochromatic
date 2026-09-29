/**
 Tests archive-only provenance, correction, and recorded naturalness under
 the single-round contract: reviewer indecision retains the block with
 findings and never buys a second round.
 
 Cat-themed invention throughout; no corpus content appears here.
 
 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  ARCHIVE_BLOCK_SELECTION_CRITERIA,
  isArchiveSourceQuoteAnchored,
  isVerifiableEditorialArchiveBlock,
  NoProviderForModelError,
  reachableQuorum,
  rosterQuorumSize,
  runArchiveBlockReviewStage,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type RosterModelId,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/** Four seats let two producers receive disinterested selection ballots. */
const ROSTER = [
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
] as const;

/**
 Bench most of whose seats the router refuses, so the share of it a wet
 provider serves is short of the whole bench's quorum; the case built on it
 asserts that before relying on it.
 */
const SHORT_BENCH = [
  'hf:cat/Cat-A',
  'hf:cat/Cat-B',
  'hf:cat/Cat-C',
  'hf:cat/Cat-D',
  'hf:cat/Cat-E',
  'hf:cat/Cat-F',
  'hf:cat/Cat-G',
  'hf:cat/Cat-H',
].map(function toModelId(id,): RosterModelId {
  return id as unknown as RosterModelId;
},);

/** Seats of that bench no provider serves. */
const REFUSED_SEATS: ReadonlySet<string> = new Set([
  'hf:cat/Cat-D',
  'hf:cat/Cat-E',
  'hf:cat/Cat-F',
  'hf:cat/Cat-G',
  'hf:cat/Cat-H',
],);

/**
 What the one page the invented original links says, then one detail the
 attestation verified in it, in the shape `pass-prepare.ts` joins them.
 */
const REFERENCE_CONTEXT = [
  '- reference 1 https://cats.example/posts/mittens ("Mittens"): Mittens had an older sister who was also a tabby, '
    + 'and she slept by the stove.',
  '- attested: the ARCHIVE\'s "The cat has a tabby sister who sleeps by the stove." is stated by reference 1 '
    + '("an older sister who was also a tabby"), 3 of 4 voices checked word for word',
].join('\n',);

/** Declared identity of the invented page. */
const IDENTITY_CONTEXT = '- name: ORIGINAL declares "猫猫", TRANSLATION declares "Mittens"';

/** Archive block only the cited page supports. */
const SISTER_BLOCK = 'The cat has a tabby sister who sleeps by the stove.';

/**
 A text as a captured prompt carries it: the scripted client records each
 exchange as JSON, which escapes quotation marks.

 @param text - text to find

 @returns Text as JSON writes it inside a string
 */
function asCaptured(text: string,): string {
  return JSON.stringify(text,).slice(1, -1,);
}

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
    refusedFor = () => false,
  }: {
    readonly replyFor: ReplyFor;
    readonly prompts: string[];
    readonly payloads?: string[];
    /**
     Seats whose every reply the completion cap cut before its content, the
     shape `chat-json-outcome.ts` reads off `finish_reason=length`.
     */
    readonly unreadableFor?: (modelId: string) => boolean;
    /**
     Seats the router refuses because no provider serving them is wet, the
     refusal `stage-call.ts` counts out of reach.
     */
    readonly refusedFor?: (modelId: string) => boolean;
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
      if (refusedFor(request.modelId,)) {
        throw new NoProviderForModelError({
          modelId: request.modelId,
          reason: 'every provider serving this model is out of budget',
        },);
      }
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
      name: 'ANCHORS A QUOTE WHOSE CORNER BRACKETS CAME BACK AS ENGLISH QUOTES (ledger B24), the evidence fold '
        + 'reading the marks and nothing else',
      fn: async () => {
        for (const sourceQuote of [
          '猫说：“窗边安静。”',
          '猫说："窗边安静。"',
        ]) {
          expect(isArchiveSourceQuoteAnchored({
            sourceContext: '猫说：「窗边安静。」然后睡了。',
            sourceQuote,
          },),).toBe(true,);
        }
        expect(isArchiveSourceQuoteAnchored({
          sourceContext: '猫说：「窗边安静。」然后睡了。',
          sourceQuote: '猫说：“门边安静。”',
        },),).toBe(false,);
      },
    },),
    it({
      name: 'COUNTS THE MINIMUM IN CHARACTERS, not UTF-16 units (ledger B24), so two ideographs past the first '
        + 'plane are two',
      fn: async () => {
        expect(isArchiveSourceQuoteAnchored({
          sourceContext: '猫\u{20000}\u{20001}猫。',
          sourceQuote: '\u{20000}\u{20001}',
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
        + 'a verdict, not an outage (it ended one entry in 114 seconds on 2026-09-02 as '
        + '"provider-unavailable" with every seat answering), and the no-loop design retains an '
        + 'unresolved block with its findings',
      fn: async () => {
        const prompts: string[] = [];
        /**
         Seats asked for a review, in first-call order. The first one anchors
         its quote: the gather rotates the bench by the prompt
         (`rotatedBench`), so a seat named by roster position can be the one
         the quorum closes without whenever a sheet's wording changes.
         */
        const reviewers: string[] = [];
        const outcome = await runArchiveBlockReviewStage({
          client: scriptedClient({
            prompts,
            replyFor: ({ schema, modelId, },) => {
              if (schema !== 'archive_block_review')
                return ACCEPTABLE_NATURALNESS;
              if (!reviewers.includes(modelId,))
                reviewers.push(modelId,);
              return {
                disposition: 'source-supported',
                sourceQuote: modelId === reviewers[0] ? '窗边安静地睡觉' : '不存在的来源句子',
                replacementText: '',
                finding: 'Source support claim.',
              };
            },
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
        + 'an answer nobody could read is not silence (class thirty-one: one entry was interrupted '
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
      name: 'REVIEWS the block on the seats the router could serve (ledger B27): with most of the bench refused, '
        + 'every reachable seat anchoring its quote meets the reachable share, so the block buys its '
        + 'naturalness read instead of standing unresolved below the quorum the whole bench would need',
      fn: async () => {
        const prompts: string[] = [];
        /** Share the gather closes on once the refusals are known. */
        const { needed, reachable, } = reachableQuorum({
          benchSize: SHORT_BENCH.length,
          unreachable: REFUSED_SEATS.size,
        },);
        // The case tests the threshold only while every reachable seat
        // anchoring still falls short of the whole bench's quorum.
        expect(reachable,).toBeLessThan(rosterQuorumSize({ rosterSize: SHORT_BENCH.length, },),);
        expect(reachable,).toBeGreaterThanOrEqual(needed,);
        const outcome = await runArchiveBlockReviewStage({
          client: scriptedClient({
            prompts,
            refusedFor: (modelId,) => REFUSED_SEATS.has(modelId,),
            replyFor: ({ schema, },) => schema === 'archive_block_review'
              ? {
                disposition: 'source-supported',
                sourceQuote: '窗边安静地睡觉',
                replacementText: '',
                finding: 'Expected section supports this sentence.',
              }
              : ACCEPTABLE_NATURALNESS,
          },),
          modelIds: SHORT_BENCH,
          sourceText: '猫在窗边安静地睡觉。',
          targetText: 'The cat sleeps quietly by the window.',
          blockText: 'The cat sleeps quietly by the window.',
          priorFindings: [],
          signal: new AbortController().signal,
          exchangeTimeoutMs: 5_000,
          l,
        },);
        // The review gather itself counted every refusal.
        expect(outcome.findings,).toContain(
          `stage-short-bench (archive-block-review reachable ${String(reachable,)} of ${
            String(SHORT_BENCH.length,)
          }, quorum ${String(needed,)})`,
        );
        expect(outcome.kind,).toBe('retained',);
        expect(outcome.text,).toBe('The cat sleeps quietly by the window.',);
        expect(outcome.findings.join('\n',),).not.toContain('archive review left the block unresolved',);
        expect(outcome.findings,).toContain('archive block absolute naturalness accepted and challenged',);
      },
    },),
    it({
      name: 'REVIEWS the block when its anchored voices exactly meet the quorum (ledger B27): the threshold is a '
        + 'floor the block reaches, not one it must exceed',
      fn: async () => {
        /** Anchored voices the four-seat bench needs, every seat reachable. */
        const quorum = rosterQuorumSize({ rosterSize: ROSTER.length, },);
        /**
         Seats asked for a review, in first-call order; exactly the first
         `quorum` of them anchor their quote, since the gather rotates the
         bench by the prompt and a seat named by roster position could fall
         outside the seats it closes on.
         */
        const reviewers: string[] = [];
        const outcome = await runArchiveBlockReviewStage({
          client: scriptedClient({
            prompts: [],
            replyFor: ({ schema, modelId, },) => {
              if (schema !== 'archive_block_review')
                return ACCEPTABLE_NATURALNESS;
              if (!reviewers.includes(modelId,))
                reviewers.push(modelId,);
              return {
                disposition: 'source-supported',
                sourceQuote: reviewers.indexOf(modelId,) < quorum ? '窗边安静地睡觉' : '不存在的来源句子',
                replacementText: '',
                finding: 'Source support claim.',
              };
            },
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
        expect(outcome.findings.join('\n',),).not.toContain('archive review left the block unresolved',);
        expect(outcome.findings,).toContain('archive block absolute naturalness accepted and challenged',);
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
          // Ledger S5: the selector's first criterion once read a translator's
          // note or a gloss as a claim to remove; every judge now reads the
          // apparatus exemption and the narrative bound beside it.
          expect(prompt,).toContain('is not such a claim: retain it unless it is wrong',);
          expect(prompt,).toContain('WHAT HAPPENED IS NEVER APPARATUS',);
        }
      },
    },),
    it({
      name: 'WITHHOLDS a revision whose block shape is not the block\'s own, so a one-paragraph label ships as the archive wrote it (class seventy-seven, 2026-09-21: a four-block letter replaced the intro line)',
      fn: async () => {
        const prompts: string[] = [];
        /** Label block under review: one paragraph. */
        const label = 'English translation of the letter the cat sent:';
        /** Revision a reviewer wrote instead: four blocks of a letter, the third cut mid-sentence. */
        const letter = 'Good evening,\n\nI just finished my supper. I would like to sit on your lap.\n\nBut trust me, the sunny spot on the porch is far more\n\nWarm purrs\nThe Cat';
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
      name: 'WITHHOLDS a removal of a footnote definition the page still references, so the note ships as the archive wrote it (class eighty-four, 2026-09-22: [^10] removed as unsupported, its marker left dangling)',
      fn: async () => {
        const prompts: string[] = [];
        /** Definition block under review: a translator's note the source never carried. */
        const note = '[^1]: Formerly the Cat Café, renamed the Kitten Café in 2025.';
        const outcome = await runArchiveBlockReviewStage({
          client: scriptedClient({
            prompts,
            replyFor: ({ schema, },) => schema === 'archive_block_review'
              ? {
                disposition: 'revise',
                sourceQuote: '',
                replacementText: '',
                finding: 'The rename is not in the original.',
              }
              : {
                best: 1,
                reason: 'Removal is the only candidate.',
              },
          },),
          modelIds: ROSTER,
          sourceText: '到了猫咖，我们坐下等待。',
          targetText: `At the Cat Café[^1], we sat down to wait.\n\n${note}`,
          blockText: note,
          priorFindings: [],
          signal: new AbortController().signal,
          exchangeTimeoutMs: 5_000,
          l,
        },);

        expect(outcome.text,).toBe(note);
        expect(outcome.findings
          .some(function refusedOnFootnotes(finding,): boolean {
            return finding.startsWith('archive-revision-refused',)
              && finding.includes('unresolved-reference',);
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
    it({
      name: 'SHOWS the reviewers and the correction selectors the declared names and the cited references '
        + '(ledger B28): the review judges archive wording against the original, and a detail a cited page '
        + 'states is the translator\'s knowledge rather than an addition',
      fn: async () => {
        const prompts: string[] = [];
        await runArchiveBlockReviewStage({
          client: scriptedClient({
            prompts,
            replyFor: ({ schema, },) => schema === 'archive_block_review'
              ? {
                disposition: 'revise',
                sourceQuote: '',
                replacementText: 'The cat sleeps by the window.',
                finding: 'Remove unsupported sister claim.',
              }
              : { best: 1, reason: 'Only supported details remain.', },
          },),
          modelIds: ROSTER,
          sourceText: '猫在窗边安静地睡觉。',
          targetText: `The cat sleeps by the window.\n\n${SISTER_BLOCK}`,
          blockText: SISTER_BLOCK,
          priorFindings: [],
          identityContext: IDENTITY_CONTEXT,
          referenceContext: REFERENCE_CONTEXT,
          signal: new AbortController().signal,
          exchangeTimeoutMs: 5_000,
          l,
        },);
        /** Prompts of the review round. */
        const reviews = prompts.filter(function isReview(prompt,): boolean {
          return prompt.includes('Review English archive wording',);
        },);
        /** Prompts of the correction slate. */
        const selections = prompts.filter(function isSelection(prompt,): boolean {
          return prompt.includes('CURRENT ARCHIVE BLOCK',);
        },);
        // Both rounds ran, so the case reads prompts that exist.
        expect(reviews.length,).toBeGreaterThan(0,);
        expect(selections.length,).toBeGreaterThan(0,);
        for (const prompt of [...reviews, ...selections,]) {
          expect(prompt,).toContain(asCaptured(IDENTITY_CONTEXT,),);
          expect(prompt,).toContain(asCaptured(REFERENCE_CONTEXT.split('\n',)[0] ?? '',),);
          expect(prompt,).toContain('CITED REFERENCES',);
        }
        // The selector's first criterion counts a cited page as support, or the
        // evidence beside it is overruled by the instruction to remove.
        expect(ARCHIVE_BLOCK_SELECTION_CRITERIA[0],).toContain('CITED REFERENCES',);
      },
    },),
    it({
      name: 'ANCHORS a retention in one cited reference page (ledger B28), and the naturalness read it buys '
        + 'sees the declared names',
      fn: async () => {
        const prompts: string[] = [];
        const outcome = await runArchiveBlockReviewStage({
          client: scriptedClient({
            prompts,
            replyFor: ({ schema, },) => schema === 'archive_block_review'
              ? {
                disposition: 'source-supported',
                sourceQuote: 'an older sister who was also a tabby',
                replacementText: '',
                finding: 'The cited page states the sister.',
              }
              : ACCEPTABLE_NATURALNESS,
          },),
          modelIds: ROSTER,
          sourceText: '猫在窗边安静地睡觉。',
          targetText: `The cat sleeps by the window.\n\n${SISTER_BLOCK}`,
          blockText: SISTER_BLOCK,
          priorFindings: [],
          identityContext: IDENTITY_CONTEXT,
          referenceContext: REFERENCE_CONTEXT,
          signal: new AbortController().signal,
          exchangeTimeoutMs: 5_000,
          l,
        },);
        expect(outcome.kind,).toBe('retained',);
        expect(outcome.text,).toBe(SISTER_BLOCK,);
        expect(outcome.findings,).not.toContain('archive review discarded uncorroborated retention claim',);
        expect(outcome.findings,).toContain('archive block absolute naturalness accepted and challenged',);
        /** Prompts of the naturalness read. */
        const naturalness = prompts.filter(function isNaturalness(prompt,): boolean {
          return prompt.includes('publication-ready English',);
        },);
        expect(naturalness.length,).toBeGreaterThan(0,);
        for (const prompt of naturalness)
          expect(prompt,).toContain(asCaptured(IDENTITY_CONTEXT,),);
      },
    },),
    it({
      name: 'DISCARDS a retention quoting the archive\'s own words off an attested line, or a reference\'s address '
        + '(ledger B28): an attested line carries an archive quote, and only a page\'s text is support',
      fn: async () => {
        /** One review per quote: the archive's own words, then the page's address. */
        const outcomes = await Promise.all([SISTER_BLOCK, 'https://cats.example/posts/mittens',]
          .map(async function reviewQuoting(sourceQuote,) {
            return await runArchiveBlockReviewStage({
              client: scriptedClient({
                prompts: [],
                replyFor: ({ schema, },) => schema === 'archive_block_review'
                  ? {
                    disposition: 'source-supported',
                    sourceQuote,
                    replacementText: '',
                    finding: 'Supported.',
                  }
                  : ACCEPTABLE_NATURALNESS,
              },),
              modelIds: ROSTER,
              sourceText: '猫在窗边安静地睡觉。',
              targetText: `The cat sleeps by the window.\n\n${SISTER_BLOCK}`,
              blockText: SISTER_BLOCK,
              priorFindings: [],
              identityContext: IDENTITY_CONTEXT,
              referenceContext: REFERENCE_CONTEXT,
              signal: new AbortController().signal,
              exchangeTimeoutMs: 5_000,
              l,
            },);
          },),);
        for (const outcome of outcomes) {
          expect(outcome.kind,).toBe('retained',);
          expect(outcome.findings,).toContain('archive review discarded uncorroborated retention claim',);
          expect(outcome.findings.join('\n',),).toContain('archive review left the block unresolved: 0 of',);
        }
      },
    },),
  ],
},);
