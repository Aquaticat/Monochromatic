import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type { ClaimCluster, } from './aggregate-claims.ts';
import type { SpanAnchor, } from './issue-model.ts';
import { ISSUE_SEVERITIES, } from './issue-taxonomy.ts';
import { HOUSE_POLICY_BLOCK, } from './house-policy.ts';

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
 * What the neighbouring blocks are for, stated inside the panel sheet.
 *
 * THE PANEL NEEDS THIS MORE THAN THE CRITIC DOES, because it decides claims
 * rather than raises them. A critic that can see next door may raise a claim
 * saying a passage belongs to a neighbouring section; a panel that CANNOT see
 * next door has no way to check that and must reject it as unfounded. Widening
 * the critic without widening the panel would therefore produce exactly the
 * claims the panel is guaranteed to throw away.
 */
const NEARBY_RULE = 'THE TWO NEARBY BLOCKS ARE CONTEXT, not text under review. '
  + 'Use them to decide whether a claim about wording unsupported here, or '
  + 'missing here, is explained by a neighbouring passage holding it instead';

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

Before voting supported, check the claim against its OWN quoted evidence, which is the cheapest way a claim fails. A claim that something is missing is contradicted when the quoted TRANSLATION text already carries it, even in different words; a claim that something was added is contradicted when the quoted ORIGINAL text already carries it. Vote unsupported whenever the claim's own quotes refute it, however confidently it is worded.

${HOUSE_POLICY_BLOCK}

Translation policy, which governs what may count as a defect at all. A claim that survives its own quotes can still be unsupported because it asks for the wrong thing:
- Non-literalness is not a defect. A rendering whose wording, sentence boundaries, or clause order differ from the ORIGINAL is correct when it reads naturally and carries the same feeling. Vote unsupported on any claim whose whole case is that a more literal rendering exists.
- A merely possible alternative gloss is not a defect. When the claim argues that a word "could be" or "should be" some other rendering, and the shipped rendering is defensible in context, vote unsupported. The question is whether the translation is wrong, not whether another choice was available.
- Fluency-serving additions are not additions. Conjunctions, discourse connectives, pronouns, and other small words that English grammar or readability requires carry no new content, so a claim reporting one as accuracy/addition is unsupported.
- Do not apply prose standards to verse. When the span is poetry, lyrics, or deliberately stylized lines, compression, inversion, unusual punctuation, and non-literal imagery are the form working as intended, not defects.
- In-group vocabulary rendered by its conventional meaning is correct even when a literal reading of the characters says otherwise; never vote supported on the strength of a literal reading alone.
- The ORIGINAL is not golden. A TRANSLATION that is clearer, better punctuated, or more explicit than the ORIGINAL is doing its job, and that alone is never a defect.
- Accurate detail a translator ADDED is not an addition. A citation carrying the translator, publisher, edition or ISBN where the ORIGINAL names only the work, a contributor credit, or a gloss identifying someone the ORIGINAL assumes known, is correct information a reader benefits from. Vote unsupported on a claim whose whole case is that the ORIGINAL does not carry it; vote supported only when the added detail is WRONG.

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
    neighbouringIncumbentText,
    neighbouringSourceText,
  }: {
    readonly sourceText: string;
    readonly targetText: string;
    readonly clusters: readonly ClaimCluster[];
    readonly neighbouringIncumbentText?: string;
    readonly neighbouringSourceText?: string;
  },
): AdjudicationPromptPlan {
  /**
   * The passages either side, or nothing when this slice stands alone.
   *
   * PLACED BEFORE THE CLAIMS AND AFTER THE PAIR, so a panelist reads the
   * evidence in the order the question needs it: what is under review, then
   * what sits beside it, then what is alleged about the first.
   */
  const nearbyBlock = ((neighbouringSourceText === undefined)
      || (neighbouringSourceText === ''))
      && ((neighbouringIncumbentText === undefined)
        || (neighbouringIncumbentText === ''))
    ? ''
    : `${ADJUDICATION_FENCE} NEARBY ORIGINAL, CONTEXT ONLY ${ADJUDICATION_FENCE}
${neighbouringSourceText ?? ''}
${ADJUDICATION_FENCE} NEARBY EXISTING TRANSLATION, CONTEXT ONLY ${ADJUDICATION_FENCE}
${neighbouringIncumbentText ?? ''}
${ADJUDICATION_FENCE} ${NEARBY_RULE} ${ADJUDICATION_FENCE}
`;

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
${nearbyBlock}${ADJUDICATION_FENCE} CLAIMS ${ADJUDICATION_FENCE}
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
