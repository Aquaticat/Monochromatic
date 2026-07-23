import type { IssueClaim, } from './issue-model.ts';

//region Non-translation evidence
// Deterministic contradiction check for wire-level non-translation votes.
// The category names a WHOLLY unrelated pair, so critics anchoring
// substantive content critique into the target text contradict the votes by
// the category's own definition. Deterministic evidence outranks model
// consensus here: the first real-corpus false block (Aniloviraw) drew four
// of seven critic votes AND a panel acceptance, proving model judgment
// noisy at both layers on divergence-heavy translated pairs.

/**
 * Wire-level critical non-translation votes required before repair may be
 * blocked; two independent voices outrank one model's judgment on
 * degenerate pairs where anchoring is best-effort.
 */
export const NON_TRANSLATION_BLOCK_VOTES = 2;

/**
 * Validated content-critique claims anchored into target text at which
 * non-translation votes stand contradicted.
 * Derivation: the observed false block carried 44 such claims, while
 * correct blocks come from skeleton or untranslated targets offering
 * little translated content to critique; eight keeps an ensemble-scale
 * margin (more than one claim per heard critic on a seven-critic roster)
 * above that noise floor.
 */
export const NON_TRANSLATION_CONTRADICTION_MIN = 8;

/**
 * Category leaves evidencing MISSING translation rather than defective
 * translation; claims under these leaves anchor happily onto skeleton or
 * untranslated targets, so they never count toward contradiction.
 */
const MISSING_TRANSLATION_LEAVES: ReadonlySet<string> = new Set([
  'omission',
  'untranslated',
  'non-translation',
]);

/**
 * Verdict of deterministic evidence over pending non-translation votes.
 *
 * @example
 * ```ts
 * const evidence: NonTranslationEvidence = {
 *   contradicted: true,
 *   contradictionClaimCount: 44,
 * };
 * ```
 */
export type NonTranslationEvidence = {
  /**
   * Whether votes reached the block threshold yet contradiction reached
   * its floor, so repair proceeds and votes are dismissed as noise.
   */
  readonly contradicted: boolean;

  /**
   * Validated content-critique claims anchored into target text.
   */
  readonly contradictionClaimCount: number;
};

/**
 * Rules whether validated claims deterministically contradict wire-level
 * non-translation votes.
 * Counts claims outside the missing-translation leaves that anchor at
 * least one span into the target; enough such claims prove the pair is a
 * critiquable translation, not a wholly unrelated pairing.
 *
 * @param votes - wire-level critical non-translation votes heard
 *
 * @param claims - validated claims across every heard critic
 *
 * @returns Contradiction verdict plus supporting claim count
 *
 * @example
 * ```ts
 * const evidence = assessNonTranslationEvidence({
 *   votes: critic.nonTranslationVotes,
 *   claims: critic.claims,
 * },);
 * if (evidence.contradicted) proceedInsteadOfBlocking();
 * ```
 */
export function assessNonTranslationEvidence(
  {
    votes,
    claims,
  }: {
    readonly votes: number;
    readonly claims: readonly IssueClaim[];
  },
): NonTranslationEvidence {
  /**
   * Claims critiquing translated target content.
   */
  const contradictionClaimCount = claims
    .filter(function critiquesTargetContent(claim,) {
      /**
       * Leaf segment of the category slug.
       */
      const leaf = claim.category
        .slice(claim.category
          .lastIndexOf('/',)
          + 1,);
      if (MISSING_TRANSLATION_LEAVES.has(leaf,))
        return false;
      return claim.spans
        .some(function anchorsTarget(span,) {
          return span.side === 'target';
        },);
    },)
    .length;

  return {
    contradicted: (votes >= NON_TRANSLATION_BLOCK_VOTES)
      && (contradictionClaimCount >= NON_TRANSLATION_CONTRADICTION_MIN),
    contradictionClaimCount,
  };
}

/**
 * Screening result carrying the claims and findings the pipeline
 * continues with after vote assessment.
 *
 * @example
 * ```ts
 * const screening: NonTranslationScreening = {
 *   contradicted: true,
 *   claims: [],
 *   findings: ['non-translation votes contradicted (4 votes, 44 content-critique claims); votes dismissed',],
 * };
 * ```
 */
export type NonTranslationScreening = {
  /**
   * Whether votes stand contradicted; callers must never block when true.
   */
  readonly contradicted: boolean;

  /**
   * Claims to continue with; contradicted votes take their
   * non-translation claims along so envelopes never carry them.
   */
  readonly claims: readonly IssueClaim[];

  /**
   * Contradiction record for the chunk's findings; empty when votes
   * stand.
   */
  readonly findings: readonly string[];
};

/**
 * Screens wire-level non-translation votes against deterministic
 * evidence, dismissing contradicted votes together with their claims.
 *
 * @param votes - wire-level critical non-translation votes heard
 *
 * @param claims - validated claims across every heard critic
 *
 * @returns Continuing claims, contradiction findings, and verdict
 *
 * @example
 * ```ts
 * const screening = screenNonTranslationVotes({
 *   votes: critic.nonTranslationVotes,
 *   claims: critic.claims,
 * },);
 * ```
 */
export function screenNonTranslationVotes(
  {
    votes,
    claims,
  }: {
    readonly votes: number;
    readonly claims: readonly IssueClaim[];
  },
): NonTranslationScreening {
  /**
   * Deterministic verdict over pending votes.
   */
  const evidence = assessNonTranslationEvidence({
    votes,
    claims,
  },);
  if (!evidence.contradicted) {
    return {
      contradicted: false,
      claims,
      findings: [],
    };
  }

  return {
    contradicted: true,
    claims: claims.filter(function keepsContentCritique(claim,) {
      return !claim.category
        .endsWith('/non-translation',);
    },),
    findings: [
      `non-translation votes contradicted (${String(votes,)} votes, ${
        String(evidence.contradictionClaimCount,)
      } content-critique claims); votes dismissed`,
    ],
  };
}

//endregion Non-translation evidence
