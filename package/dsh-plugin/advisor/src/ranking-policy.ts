/**
 DSH default-reviewer ranking policy for the shared selection seam:
 largest context window first, then model name, then canonical slug. @module
 */

import type {
  AdvisorDefaultRanking,
  AdvisorRankingCandidate,
} from '@monochromatic-dev/agent-harness-shared-advisor/ts';

//region Public API

/**
 Rank default-reviewer candidates for the DSH variant.

 The shared core ranks by expected call cost; the DSH variant instead prefers
 the route with the largest advertised context window (then `name`, then
 canonical slug) because DSH routes carry no text pricing and the widest
 context is the most likely to hold the full conversation. Observed windows
 are recorded in the reason so decision logs can reconstruct the order.

 @param candidates - eligible scoped candidates with their estimated input
 tokens

 @param maxOutputTokens - request output budget shared by every candidate

 @returns candidates ordered best-first with an observed-window reason

 @example
 ```ts
 const ranking = dshRankDefaultCandidates({ candidates, maxOutputTokens: 4096 });
 ```
 */
export function dshRankDefaultCandidates(
  {
    candidates,
    maxOutputTokens,
  }: {
    readonly candidates: readonly AdvisorRankingCandidate[];
    readonly maxOutputTokens: number;
  },
): AdvisorDefaultRanking {
  void maxOutputTokens;
  /**
   Candidates ordered by largest context window, then name, then slug.
   */
  const ranked = [...candidates,]
    .toSorted(function byWindowNameSlug(
      a,
      b,
    ) {
    /**
     Context-window comparison, widest first.
     */
      const windowDelta = b
        .scopedModel
        .model
        .contextWindow
        - a
          .scopedModel
          .model
          .contextWindow;
      if (windowDelta
        !== 0)
        return windowDelta;
    /**
     Name comparison, lexicographic ascending.
     */
      const nameOrder = a
        .scopedModel
        .model
        .name
        .localeCompare(b
          .scopedModel
          .model
          .name,);
      if (nameOrder
        !== 0)
        return nameOrder;
      return a
        .scopedModel
        .canonicalSlug
        .localeCompare(b
          .scopedModel
          .canonicalSlug,);
    },)
    .map(function toScopedModel(candidate,) {
      return candidate.scopedModel;
    },);
  /**
   Observed context windows in ranked order, recorded as decision evidence.
   */
  const windowEvidence = ranked
    .map(function toWindowEvidence(entry,) {
      return `${entry.canonicalSlug}=${String(entry.model
      .contextWindow,)}`;
    },)
    .join(', ',);
  return {
    ranked,
    reason: `dsh default ranking: largest context window first, then name, then slug; observed windows ${windowEvidence}`,
  };
}

//endregion Public API
