/**
 * Naturalness review must retain its wider quorum across artifact serialization.
 *
 * @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  confirmAbsoluteNaturalness,
  parseNaturalnessReview,
  reviewAbsoluteNaturalness,
  type RosterModelId,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/** Asked seats matching the live failure's provider-independent shape. */
const ROSTER = [
  'gemma-4-26b-a4b-it',
  'deepseek-v4-pro-0813',
  'deepseek-v4-flash-0731',
  'glm-5.3',
  'google.gemma-4-e2b',
  'inception/mercury-2.5',
] as const;
/** Exact candidate shared by every review and its artifact. */
const TEXT = 'The cat sleeps on the windowsill.';
/** Wider independent bench requiring five usable voices. */
const WIDE_BENCH = 9;

/**
 * Scripts four usable voices, either immediately or only during confirmation.
 *
 * @param loseOnChallenge - whether discovery first hears every seat
 *
 * @returns Client with no provider traffic
 */
function clientFor({ loseOnChallenge = false, }: { readonly loseOnChallenge?: boolean; },): SyntheticClient {
  /** Per-seat calls separate discovery from its same-seat challenge. */
  const calls = new Map<RosterModelId, number>();
  return {
    chatText: async () => { throw new Error('Unexpected text call',); },
    quotas: async () => { throw new Error('Unexpected quota read',); },
    chatJson: async <ValueT,>(request: ChatJsonRequest<ValueT>,): Promise<ChatJsonOutcome<ValueT>> => {
      /** Earlier calls by this independently scripted seat. */
      const previous = calls.get(request.modelId,) ?? 0;
      calls.set(request.modelId, previous + 1,);
      if ((!loseOnChallenge || previous > 0)
        && (request.modelId === 'glm-5.3' || request.modelId === 'inception/mercury-2.5')) {
        return { kind: 'schema-mismatch', rawText: '{}', detail: 'Fixture unusable seat', };
      }
      /** Every usable seat independently accepts the candidate. */
      const value: unknown = { acceptable: true, findings: [], reason: 'The cat sentence is natural.', };
      if (!request.validate(value,))
        throw new Error('Fixture does not satisfy reviewer schema',);
      return { kind: 'ok', value, rawText: JSON.stringify(value,), };
    },
  };
}

/**
 * Uses production whole-bench quorum with the asked-seat window made explicit.
 *
 * @param client - scripted independent reviewer replies
 *
 * @returns Shared request for discovery and confirmation
 */
function requestFor(client: SyntheticClient,): Parameters<typeof reviewAbsoluteNaturalness>[0] {
  return {
    client,
    modelIds: ROSTER,
    quorumOver: WIDE_BENCH,
    subject: { sourceText: '猫睡在窗台上。', candidateText: TEXT, paragraphs: [TEXT,], },
    signal: AbortSignal.timeout(5_000,),
    exchangeTimeoutMs: 5_000,
    graceMs: 0,
    fanOut: 'whole-bench',
    l: tagged({ tag: 'naturalness-quorum-roundtrip', },),
  };
}

await describe({
  name: 'naturalness quorum provenance',
  children: [
    it({
      name: 'ROUND TRIPS a live-shaped four-of-six review requiring five voices',
      fn: async () => {
        /** Real producing stage, not a hand-written verdict fixture. */
        const round = await reviewAbsoluteNaturalness(requestFor(clientFor({},),),);
        expect(round.usable,).toBe(4,);
        expect(round.verdict,).toBe('quorum-not-met',);
        /** JSON serialization must retain every fact the reader needs. */
        const parsed = parseNaturalnessReview({
          value: JSON.parse(JSON.stringify({ correctionCount: 0, corrections: [], confirmations: [], rounds: [round,], },),),
          path: 'consolidation.slices[3].polish.review',
          finalText: TEXT,
          correctionChainRequired: true,
          everyBodyBlockReviewed: true,
          quorumBasisRequired: true,
        },);
        expect(parsed.rounds[0]?.verdict,).toBe('quorum-not-met',);
        expect(parsed.rounds[0],).toHaveProperty('quorumOver', WIDE_BENCH,);
      },
    },),
    it({
      name: 'KEEPS the discovery quorum when confirmation asks its reduced roster',
      fn: async () => {
        /** Discovery accepts, but confirmation hears only four of the six seats. */
        const confirmed = await confirmAbsoluteNaturalness(requestFor(clientFor({ loseOnChallenge: true, },),),);
        expect(confirmed.confirmations,).toHaveLength(1,);
        expect(confirmed.review.usable,).toBe(4,);
        expect(confirmed.review.verdict,).toBe('quorum-not-met',);
        /** Both distinct perspectives retain the same quorum basis. */
        const parsed = parseNaturalnessReview({
          value: JSON.parse(JSON.stringify({ correctionCount: 0, corrections: [], confirmations: confirmed.confirmations, rounds: [confirmed.review,], },),),
          path: 'review',
          finalText: TEXT,
          correctionChainRequired: true,
          everyBodyBlockReviewed: true,
          quorumBasisRequired: true,
        },);
        expect(parsed.confirmations?.[0],).toHaveProperty('quorumOver', WIDE_BENCH,);
        expect(parsed.rounds[0],).toHaveProperty('quorumOver', WIDE_BENCH,);
      },
    },),
  ],
},);
