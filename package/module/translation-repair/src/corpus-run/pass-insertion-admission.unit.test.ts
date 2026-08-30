/**
 * Tests for production proof before translating source-only passages.
 *
 * A live page had one wholly omitted linked factual paragraph, but verbose
 * English elsewhere made whole-page length look complete. These cat fixtures
 * pin that local destination evidence rescues that class only when whole-page
 * coverage independently says the passage is absent.
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
  decidePassInsertionAdmission,
  type InsertionAdmission,
  makeInsertionChunk,
  messageText,
  type PreparedDocumentPair,
  type RosterModelId,
  type SyntheticClient,
  TranslationRepairInterruptedError,
} from '../../dist/final/node/index.mjs';

/**
 * Production-shaped test roster.
 */
const ROSTER: readonly RosterModelId[] = [
  'hf:zai-org/GLM-5.3-Flash',
  'hf:Qwen/Qwen3.8-27B',
  'hf:moonshotai/Kimi-K3',
];

/**
 * Coverage reply one roster seat returns.
 */
type ScriptedCoverage = {
  readonly coverage: 'full' | 'partial' | 'none';
  readonly quote: string;
};

/**
 * Scripted provider voice that fails before returning coverage.
 */
const COVERAGE_VOICE_LOST: unique symbol = Symbol('scripted coverage voice lost',);

/**
 * One scripted seat outcome.
 */
type ScriptedCoverageOutcome = ScriptedCoverage | typeof COVERAGE_VOICE_LOST;

/**
 * No-op logger accepted by production module.
 */
const l = tagged({ tag: 'pass-insertion-admission-test', },);

/**
 * Whole target carrying enough unrelated prose to defeat page shortfall.
 */
const LONG_TARGET = `## Cats\n\n${'The cat sleeps in warm sunlight. '.repeat(20,)}`;

/**
 * Builds one prepared source-only passage.
 *
 * @param sourcePassage - original with no target wording beside it
 *
 * @param targetText - whole translation searched by coverage
 *
 * @returns Preparation holding one insertion slice
 *
 * @example
 * ```ts
 * const prepared = preparedGap({ sourcePassage: '猫。', targetText: '' });
 * ```
 */
function preparedGap(
  {
    sourcePassage,
    targetText,
  }: {
    readonly sourcePassage: string;
    readonly targetText: string;
  },
): PreparedDocumentPair {
  return {
    sourceText: `${sourcePassage}\n${'猫在窗台晒太阳。'.repeat(20,)}`,
    targetText,
    slices: [{
      source: {
        kind: 'content',
        sliceIndex: 0,
        nodes: [],
        startOffset: 0,
        endOffset: sourcePassage.length,
        text: sourcePassage,
      },
      target: makeInsertionChunk({
        sliceIndex: 0,
        offset: 0,
      },),
    },],
    lineStructuredSliceIndices: new Set(),
    declaredNames: [],
    alignmentFindings: [],
    unclaimedTargetBlocks: [],
    alignmentPairCount: 1,
  };
}

/**
 * Client returning one scripted coverage reply per seat, or failing that seat.
 *
 * @param replies - initial roster-order replies
 *
 * @param followupReplies - replies to prior-verdict challenge
 *
 * @returns Client serving only coverage stage
 *
 * @example
 * ```ts
 * const client = coverageClient({ replies: [{ coverage: 'none', quote: '' }] });
 * ```
 */
function coverageClient(
  {
    replies,
    followupReplies = [],
  }: {
    readonly replies: readonly ScriptedCoverageOutcome[];
    readonly followupReplies?: readonly ScriptedCoverageOutcome[];
  },
): SyntheticClient {
  /**
   * Iterator advancing one response per roster seat.
   */
  const responses = replies.values();
  /**
   * Follow-up responses advanced independently from initial recovery retries.
   */
  const followups = followupReplies.values();
  return {
    chatText: async () => {
      throw new Error('chatText unused by coverage',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       * Next scripted seat outcome, which must exist for every requested seat.
       */
      /**
       * Whether latest unresolved verdict is present in this prompt.
       */
      const isFollowup = request.messages.some(function hasPriorVerdict(message,): boolean {
        return messageText({ message, },).includes('PRIOR UNRESOLVED VERDICT',);
      },);
      const next = isFollowup ? followups.next() : responses.next();
      if (next.done === true)
        throw new Error('coverage stage asked beyond scripted roster',);
      const { value: reply, } = next;
      if ((typeof reply) === 'symbol') {
        if (reply === COVERAGE_VOICE_LOST)
          throw new Error('scripted lost coverage voice',);
        throw new Error('unknown scripted coverage outcome',);
      }
      const value: unknown = {
        ...reply,
        reason: 'scripted',
      };
      if (!request.validate(value,))
        throw new Error('scripted coverage reply failed wire guard',);
      return {
        kind: 'ok',
        value: value as ValueT,
        rawText: JSON.stringify(value,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused by coverage',);
    },
  };
}

/**
 * Runs one admission case.
 *
 * @param sourcePassage - insertion source
 *
 * @param targetText - whole target page
 *
 * @param replies - initial roster replies
 *
 * @param followupReplies - replies to prior-verdict challenge
 *
 * @returns Admission from production module
 *
 * @example
 * ```ts
 * const admission = await runAdmission({ sourcePassage: '猫。', targetText: '', replies: [] });
 * ```
 */
async function runAdmission(
  {
    sourcePassage,
    targetText,
    replies,
    followupReplies,
  }: {
    readonly sourcePassage: string;
    readonly targetText: string;
    readonly replies: readonly ScriptedCoverageOutcome[];
    readonly followupReplies?: readonly ScriptedCoverageOutcome[];
  },
): Promise<InsertionAdmission> {
  return await decidePassInsertionAdmission({
    client: coverageClient({
      replies,
      ...((followupReplies === undefined) ? {} : { followupReplies, }),
    },),
    prepared: preparedGap({ sourcePassage, targetText, },),
    modelIds: ROSTER,
    overlap: 1,
    signal: new AbortController().signal,
    perCallTimeoutMs: 1_000,
    l,
  },);
}

/**
 * Repeats one reply across whole roster.
 *
 * @param reply - answer every seat gives
 *
 * @returns One answer per roster seat
 *
 * @example
 * ```ts
 * const replies = unanimous({ coverage: 'none', quote: '' });
 * ```
 */
function unanimous(reply: ScriptedCoverage,): readonly ScriptedCoverage[] {
  return ROSTER.map(function sameReply(): ScriptedCoverage {
    return reply;
  },);
}

await describe({
  name: decidePassInsertionAdmission.name,
  children: [
    it({
      name: 'ADMITS a linked factual passage on destination evidence when roster says whole passage is absent, '
        + 'even though unrelated verbosity makes whole page look long enough',
      fn: async () => {
        const admission = await runAdmission({
          sourcePassage: 'The cat record is linked at [memo](https://example.test/cat-record).',
          targetText: LONG_TARGET,
          replies: unanimous({ coverage: 'none', quote: '', },),
        },);
        expect([...admission.positions,],).toEqual([0,],);
      },
    },),
    it({
      name: 'ADMITS a link-free passage within whole-page shortfall when roster says it is absent',
      fn: async () => {
        const admission = await runAdmission({
          sourcePassage: '猫的记录没有译文。',
          targetText: 'Cat.',
          replies: unanimous({ coverage: 'none', quote: '', },),
        },);
        expect([...admission.positions,],).toEqual([0,],);
      },
    },),
    it({
      name: 'REFUSES an absent verdict with neither deterministic corroborator, preserving duplicate protection',
      fn: async () => {
        await expect(runAdmission({
          sourcePassage: '猫的记录没有译文。',
          targetText: LONG_TARGET,
          replies: unanimous({ coverage: 'none', quote: '', },),
        },),).rejects.toThrow(TranslationRepairInterruptedError,);
      },
    },),
    it({
      name: 'RECORDS full coverage as carried elsewhere instead of insertion or interruption',
      fn: async () => {
        const admission = await runAdmission({
          sourcePassage: '[Cat](https://example.test/cat-record) sleeps.',
          targetText: LONG_TARGET,
          replies: unanimous({ coverage: 'full', quote: '## Cats\n\nThe cat sleeps in warm sunlight.', },),
        },);
        expect([...admission.positions,],).toEqual([],);
        expect(admission.carried,).toEqual([{
          position: 0,
          sliceIndex: 0,
          sourceText: '[Cat](https://example.test/cat-record) sleeps.',
          evidence: [
            '## Cats\n\nThe cat sleeps in warm sunlight.',
            '## Cats\n\nThe cat sleeps in warm sunlight.',
            '## Cats\n\nThe cat sleeps in warm sunlight.',
          ],
        },],);
      },
    },),
    it({
      name: 'REFUSES partial coverage because inserting whole passage would duplicate carried content',
      fn: async () => {
        await expect(runAdmission({
          sourcePassage: '[Cat](https://example.test/cat-record) sleeps and dreams.',
          targetText: LONG_TARGET,
          replies: unanimous({ coverage: 'partial', quote: 'The cat sleeps in warm sunlight.', },),
        },),).rejects.toThrow(TranslationRepairInterruptedError,);
      },
    },),
    it({
      name: 'REFUSES a split roster rather than treating one absence voice as proof',
      fn: async () => {
        await expect(runAdmission({
          sourcePassage: '[Cat](https://example.test/cat-record) sleeps.',
          targetText: LONG_TARGET,
          replies: [
            { coverage: 'full', quote: 'The cat sleeps in warm sunlight.', },
            { coverage: 'none', quote: '', },
            COVERAGE_VOICE_LOST,
          ],
        },),).rejects.toThrow(TranslationRepairInterruptedError,);
      },
    },),
    it({
      name: 'CONTINUES split placement with distinct follow-up and admits when latest roster proves absence',
      fn: async () => {
        const admission = await runAdmission({
          sourcePassage: '[Cat](https://example.test/cat-record) sleeps.',
          targetText: LONG_TARGET,
          replies: [
            { coverage: 'full', quote: '## Cats\n\nThe cat sleeps in warm sunlight.', },
            { coverage: 'none', quote: '', },
            COVERAGE_VOICE_LOST,
          ],
          followupReplies: unanimous({ coverage: 'none', quote: '', },),
        },);
        expect([...admission.positions,],).toEqual([0,],);
      },
    },),
    it({
      name: 'REFUSES an inconclusive roster when every coverage voice is lost',
      fn: async () => {
        await expect(runAdmission({
          sourcePassage: '[Cat](https://example.test/cat-record) sleeps.',
          targetText: LONG_TARGET,
          replies: [ COVERAGE_VOICE_LOST, COVERAGE_VOICE_LOST, COVERAGE_VOICE_LOST, ],
        },),).rejects.toThrow(TranslationRepairInterruptedError,);
      },
    },),
    it({
      name: 'TREATS trailing-slash destination spellings as same address rather than false local corroboration',
      fn: async () => {
        await expect(runAdmission({
          sourcePassage: '[Cat](https://example.test/cat-record/) sleeps.',
          targetText: `${LONG_TARGET}\nhttps://example.test/cat-record`,
          replies: unanimous({ coverage: 'none', quote: '', },),
        },),).rejects.toThrow(TranslationRepairInterruptedError,);
      },
    },),
    it({
      name: 'READS a reference-style source destination as local corroboration',
      fn: async () => {
        const admission = await runAdmission({
          sourcePassage: '[Cat memo][memo]\n\n[memo]: https://example.test/cat-record',
          targetText: LONG_TARGET,
          replies: unanimous({ coverage: 'none', quote: '', },),
        },);
        expect([...admission.positions,],).toEqual([0,],);
      },
    },),
  ],
},);
