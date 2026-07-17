import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type { ClaimCluster, } from './aggregate-claims.ts';
import type { SpanAnchor, } from './issue-model.ts';
import { ISSUE_SEVERITIES, } from './issue-taxonomy.ts';

//region Adjudication prompt
// One prompt per panelist per chunk, covering every cluster in it. Claims are
// numbered so ballots reference small integers instead of hex ids, which
// unreliable models mistype. The prompt never names proposers: adjudication
// is provenance-blind by design.

/**
 * Fence line separating instructions from document text.
 */
const ADJUDICATION_FENCE = '=====';

/**
 * System instructions shared by every panelist call.
 */
const ADJUDICATION_SYSTEM_PROMPT = `You are an impartial bilingual adjudicator.
Reviewers reported the numbered claims below against the TRANSLATION of the ORIGINAL document.
You did not write these claims. Judge each claim strictly on the document evidence.

For EVERY claim, cast exactly one vote:
- supported: the documents confirm the defect exists as claimed
- unsupported: the documents contradict the claim, or the quoted evidence does not show the claimed defect
- ambiguous: the documents genuinely permit both readings; a human must decide
- source-defect: the ORIGINAL itself is wrong at the claimed spot (typo, corruption), so the translation must not be "corrected" toward it
- abstain: you cannot judge this claim at all

Optionally re-grade a supported claim's severity: one of ${ISSUE_SEVERITIES.join(', ',)}.
For every GROUP holding more than one claim, also state whether its claims describe one single defect (sameDefect true) or genuinely distinct defects (sameDefect false).

Reply with ONLY a JSON object of shape
{"verdicts": [{"claim": 1, "vote": "supported", "severity": "major"}], "groups": [{"group": 1, "sameDefect": true}]}.
The severity field is optional. No prose, no code fences.
Every claim number must appear exactly once in verdicts.`;

/**
 * One line of human-readable evidence for one span.
 *
 * @param span - anchored evidence to present
 *
 * @returns Line naming side and quoted text, or the insertion-point wording
 *
 * @example
 * ```ts
 * evidenceLine({ span, },);
 * ```
 */
function evidenceLine(
  { span, }: { readonly span: SpanAnchor; },
): string {
  /**
   * Side label in prompt vocabulary.
   */
  const sideLabel = span.side === 'source' ? 'ORIGINAL' : 'TRANSLATION';
  if (span.startOffset === span.endOffset)
    return `- evidence (${sideLabel}): insertion point, content claimed missing here`;

  return `- evidence (${sideLabel}): ${span.quotedText}`;
}

/**
 * Messages plus the index maps ballots resolve through:
 * claim number N on the wire means `claimIds[N - 1]`,
 * group number M means `clusterIds[M - 1]`.
 *
 * @example
 * ```ts
 * const plan: AdjudicationPromptPlan = buildAdjudicationMessages({
 *   sourceText,
 *   targetText,
 *   clusters,
 * },);
 * ```
 */
export type AdjudicationPromptPlan = {
  /**
   * Messages ready for `chatJson`.
   */
  readonly messages: readonly ChatMessage[];

  /**
   * Claim ids in prompt numbering order.
   */
  readonly claimIds: readonly string[];

  /**
   * Cluster ids in prompt numbering order.
   */
  readonly clusterIds: readonly string[];
};

/**
 * Builds the panel sheet for one chunk:
 * documents fenced, clusters as numbered groups, claims numbered globally.
 *
 * @param sourceText - original chunk text
 *
 * @param targetText - translation chunk text
 *
 * @param clusters - aggregation output for this chunk, in document order
 *
 * @returns Messages plus index maps for ballot resolution
 *
 * @example
 * ```ts
 * const plan = buildAdjudicationMessages({ sourceText, targetText, clusters, },);
 * ```
 */
export function buildAdjudicationMessages(
  {
    sourceText,
    targetText,
    clusters,
  }: {
    readonly sourceText: string;
    readonly targetText: string;
    readonly clusters: readonly ClaimCluster[];
  },
): AdjudicationPromptPlan {
  /**
   * Claim ids in numbering order, filled while rendering.
   */
  const claimIds: string[] = [];

  /**
   * Rendered group blocks in document order.
   */
  const groupBlocks = clusters.map(function toGroupBlock(
    cluster,
    clusterIndex,
  ) {
    /**
     * Rendered member claims of this group.
     */
    const memberBlocks = cluster.members
      .map(function toClaimBlock(member,) {
      claimIds.push(member.claimId,);

      /**
       * Evidence lines for every span of this claim.
       */
      const evidence = member
        .claim
        .spans
        .map(function toLine(span,) {
          return evidenceLine({ span, },);
        },)
        .join('\n',);

      return `CLAIM ${claimIds.length}
- category: ${member.claim
  .category}
- claimed severity: ${member.claim
  .severity}
- summary: ${member.claim
  .summary}
${evidence}`;
    },);

    /**
     * Group header; single-claim groups need no same-defect question.
     */
    const header = cluster.members
      .length
      > 1
      ? `GROUP ${clusterIndex + 1} (claims below may describe one defect; answer sameDefect)`
      : `GROUP ${clusterIndex + 1}`;

    return [
      header,
      ...memberBlocks,
    ].join('\n',);
  },);

  return {
    messages: [
      {
        role: 'system',
        content: ADJUDICATION_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `${ADJUDICATION_FENCE} ORIGINAL ${ADJUDICATION_FENCE}
${sourceText}
${ADJUDICATION_FENCE} TRANSLATION ${ADJUDICATION_FENCE}
${targetText}
${ADJUDICATION_FENCE} CLAIMS ${ADJUDICATION_FENCE}
${groupBlocks.join('\n\n',)}
${ADJUDICATION_FENCE} END ${ADJUDICATION_FENCE}`,
      },
    ],
    claimIds,
    clusterIds: clusters.map(function toClusterId(cluster,) {
      return cluster.clusterId;
    },),
  };
}

//endregion Adjudication prompt
