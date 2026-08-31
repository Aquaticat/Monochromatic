// PROTOTYPE ONLY: Candidate K prior-global ownership mapping.

import {
  REVIEW_UNIT_GLOBAL_ACTOR_INDEX,
  REVIEW_UNIT_GLOBAL_AUTHORITY_INDEX,
  REVIEW_UNIT_GLOBAL_LANGUAGE_INDEX,
  REVIEW_UNIT_GLOBAL_RELATION_INDEX,
  REVIEW_UNIT_GLOBAL_TERM_INDEX,
  type ReviewUnitGlobalOwnership,
} from './prototype-review-unit-plan-model.ts';
import type { RealizationGlobalCriterion, } from './prototype-realization-model.ts';

/**
 * Returns fixed explicit ownership for prior Candidate I global.
 *
 * @param priorCriterion - prior global criterion requiring successor owner
 *
 * @returns Candidate K ownership row
 *
 * @example
 * ```ts
 * const ownership = reviewUnitGlobalOwnership('chronology',);
 * ```
 */
export function reviewUnitGlobalOwnership(
  priorCriterion: RealizationGlobalCriterion,
): ReviewUnitGlobalOwnership {
  if (priorCriterion === 'unsupported-addition')
    return {
      priorCriterion,
      globalIndexes: [],
      clauseOwned: true,
      relationOwned: false,
      languageOwned: false,
    };
  if (priorCriterion === 'identity-attribution')
    return {
      priorCriterion,
      globalIndexes: [
        REVIEW_UNIT_GLOBAL_ACTOR_INDEX,
        REVIEW_UNIT_GLOBAL_AUTHORITY_INDEX,
      ],
      clauseOwned: true,
      relationOwned: false,
      languageOwned: false,
    };
  if (priorCriterion === 'actor-reference')
    return {
      priorCriterion,
      globalIndexes: [REVIEW_UNIT_GLOBAL_ACTOR_INDEX,],
      clauseOwned: true,
      relationOwned: true,
      languageOwned: true,
    };
  if (priorCriterion === 'chronology')
    return {
      priorCriterion,
      globalIndexes: [REVIEW_UNIT_GLOBAL_RELATION_INDEX,],
      clauseOwned: true,
      relationOwned: true,
      languageOwned: false,
    };
  if (priorCriterion === 'technical-legal-term')
    return {
      priorCriterion,
      globalIndexes: [REVIEW_UNIT_GLOBAL_TERM_INDEX,],
      clauseOwned: true,
      relationOwned: false,
      languageOwned: true,
    };
  if (priorCriterion === 'grammar-usage')
    return {
      priorCriterion,
      globalIndexes: [REVIEW_UNIT_GLOBAL_LANGUAGE_INDEX,],
      clauseOwned: false,
      relationOwned: false,
      languageOwned: true,
    };
  if (priorCriterion === 'tense')
    return {
      priorCriterion,
      globalIndexes: [REVIEW_UNIT_GLOBAL_LANGUAGE_INDEX,],
      clauseOwned: false,
      relationOwned: true,
      languageOwned: true,
    };
  if (priorCriterion === 'register')
    return {
      priorCriterion,
      globalIndexes: [
        REVIEW_UNIT_GLOBAL_LANGUAGE_INDEX,
        REVIEW_UNIT_GLOBAL_AUTHORITY_INDEX,
      ],
      clauseOwned: false,
      relationOwned: false,
      languageOwned: true,
    };
  if (priorCriterion === 'paragraph-relation')
    return {
      priorCriterion,
      globalIndexes: [REVIEW_UNIT_GLOBAL_RELATION_INDEX,],
      clauseOwned: false,
      relationOwned: true,
      languageOwned: true,
    };
  if (priorCriterion === 'source-language-calque')
    return {
      priorCriterion,
      globalIndexes: [REVIEW_UNIT_GLOBAL_LANGUAGE_INDEX,],
      clauseOwned: false,
      relationOwned: false,
      languageOwned: true,
    };
  throw new Error('review unit prior global criterion is unreachable');
}
