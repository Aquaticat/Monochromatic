// PROTOTYPE ONLY: Candidate K model-facing finding rules.

import { hashContent, } from './document-node.ts';
import { refuseReviewUnit, } from './prototype-review-unit-admission-error.ts';
import {
  REVIEW_UNIT_DEFECT_CLASSES,
  REVIEW_UNIT_MAX_TARGET_ANCHORS,
  type ReviewUnitDefectClass,
  type ReviewUnitFinding,
  type ReviewUnitFindingScope,
} from './prototype-review-unit-model.ts';

/**
 * Maximum target anchors for one non-relation subject.
 */
export const REVIEW_UNIT_NARROW_TARGET_ANCHOR_MAX = 3;

/**
 * Source evidence requirement understood by model and caller.
 */
export type ReviewUnitSourceEvidenceMode = 'empty' | 'optional' | 'subject-exact';

/**
 * Image evidence requirement understood by model and caller.
 */
export type ReviewUnitImageEvidenceMode =
  | 'empty'
  | 'image-relation-required-otherwise-empty';

/**
 * Target-anchor cardinality rule understood by model and caller.
 */
export type ReviewUnitTargetAnchorMode =
  | 'omission-empty-otherwise-one-to-three'
  | 'one-to-four'
  | 'one-to-three';

/**
 * Complete scope-specific model-facing finding rule.
 */
export type ReviewUnitFindingRule = {
  /**
   * Finding scope governed by rule.
   */
  readonly scope: ReviewUnitFindingScope;
  /**
   * Exact defect-class indexes legal for scope.
   */
  readonly allowedDefectClassIndexes: readonly number[];
  /**
   * Source evidence cardinality and ownership.
   */
  readonly sourceEvidenceMode: ReviewUnitSourceEvidenceMode;
  /**
   * Image evidence cardinality and ownership.
   */
  readonly imageEvidenceMode: ReviewUnitImageEvidenceMode;
  /**
   * Target anchor cardinality and omission behavior.
   */
  readonly targetAnchorMode: ReviewUnitTargetAnchorMode;
};

/**
 * Returns canonical indexes for named defect classes.
 *
 * @param classes - defect classes requiring numeric wire indexes
 *
 * @returns Numeric indexes in supplied order
 */
function classIndexes(classes: readonly ReviewUnitDefectClass[],): readonly number[] {
  return classes.map(function index(value,) {
    /**
     * Existing canonical wire position.
     */
    const found = REVIEW_UNIT_DEFECT_CLASSES.indexOf(value,);
    if (found === (-1))
      throw new Error('review unit finding rule class is absent');
    return found;
  },);
}

/**
 * Digest-bound model-facing rules in canonical scope order.
 */
export const REVIEW_UNIT_FINDING_RULES: readonly ReviewUnitFindingRule[] = [
  {
    scope: 'fm',
    allowedDefectClassIndexes: classIndexes([
      'wrong-meaning',
      'omission',
      'unsupported-addition',
      'identity-attribution',
      'actor-reference',
      'technical-legal-term',
      'grammar-usage',
      'tense',
      'register',
      'source-language-calque',
    ],),
    sourceEvidenceMode: 'empty',
    imageEvidenceMode: 'empty',
    targetAnchorMode: 'omission-empty-otherwise-one-to-three',
  },
  {
    scope: 'c',
    allowedDefectClassIndexes: classIndexes(REVIEW_UNIT_DEFECT_CLASSES.filter(function clause(value,) {
      return (value !== 'paragraph-relation') && (value !== 'image-relation');
    },),),
    sourceEvidenceMode: 'subject-exact',
    imageEvidenceMode: 'empty',
    targetAnchorMode: 'omission-empty-otherwise-one-to-three',
  },
  {
    scope: 'r',
    allowedDefectClassIndexes: classIndexes([
      'wrong-meaning',
      'actor-reference',
      'chronology',
      'technical-legal-term',
      'paragraph-relation',
    ],),
    sourceEvidenceMode: 'subject-exact',
    imageEvidenceMode: 'empty',
    targetAnchorMode: 'one-to-four',
  },
  {
    scope: 'sl',
    allowedDefectClassIndexes: classIndexes([
      'actor-reference',
      'technical-legal-term',
      'grammar-usage',
      'tense',
      'register',
      'source-language-calque',
    ],),
    sourceEvidenceMode: 'empty',
    imageEvidenceMode: 'empty',
    targetAnchorMode: 'one-to-three',
  },
  {
    scope: 'g',
    allowedDefectClassIndexes: classIndexes(REVIEW_UNIT_DEFECT_CLASSES.filter(function global(value,) {
      return value !== 'omission';
    },),),
    sourceEvidenceMode: 'optional',
    imageEvidenceMode: 'image-relation-required-otherwise-empty',
    targetAnchorMode: 'one-to-four',
  },
];

/**
 * Canonical finding-rule identity bound into manifest and prompt.
 */
export const REVIEW_UNIT_FINDING_RULE_DIGEST: string = hashContent({
  content: JSON.stringify(REVIEW_UNIT_FINDING_RULES,),
});

/**
 * Returns exact rule for scope or throws.
 *
 * @returns Digest-bound rule for supplied scope
 *
 * @example
 * ```ts
 * const rule = reviewUnitFindingRule({ scope: 'c', });
 * ```
 */
export function reviewUnitFindingRule({
  scope,
}: {
  readonly scope: ReviewUnitFindingScope;
}): ReviewUnitFindingRule {
  /**
   * Existing rule for exact scope.
   */
  const rule = REVIEW_UNIT_FINDING_RULES
    .find(function same(value,) { return value.scope === scope; });
  if (rule === undefined)
    throw new Error('review unit finding rule scope is absent');
  return rule;
}

/**
 * Refuses one finding whose evidence cardinality violates model-facing rule.
 *
 * @example
 * ```ts
 * assertReviewUnitRuleCardinality({ finding, defectClass, rule, });
 * ```
 */
export function assertReviewUnitRuleCardinality({
  finding,
  defectClass,
  rule,
}: {
  readonly finding: ReviewUnitFinding;
  readonly defectClass: ReviewUnitDefectClass;
  readonly rule: ReviewUnitFindingRule;
}): void {
  if ((rule.sourceEvidenceMode === 'empty')
    && (finding.sourceEvidenceIndexes
      .length
      > 0))
    refuseReviewUnit({
      failureCategory: 'finding-shape',
      message: 'review unit rule source evidence differs',
    });
  /**
   * Whether finding claims source-image-target mismatch.
   */
  const imageRelation = defectClass === 'image-relation';
  if (((rule.imageEvidenceMode === 'empty') && (finding.imageEvidenceIndexes
    .length
    > 0))
    || ((rule.imageEvidenceMode === 'image-relation-required-otherwise-empty')
      && ((imageRelation && (finding.imageEvidenceIndexes
        .length
        === 0))
        || ((!imageRelation) && (finding.imageEvidenceIndexes
          .length
          > 0)))))
    refuseReviewUnit({
      failureCategory: 'finding-shape',
      message: 'review unit rule image evidence differs',
    });
  /**
   * Exact target-anchor count checked against rule.
   */
  const anchorCount = finding.targetAnchors
    .length;
  if (((rule.targetAnchorMode === 'omission-empty-otherwise-one-to-three')
      && (((defectClass === 'omission') && (anchorCount !== 0))
        || ((defectClass !== 'omission')
          && ((anchorCount === 0) || (anchorCount > REVIEW_UNIT_NARROW_TARGET_ANCHOR_MAX)))))
    || ((rule.targetAnchorMode === 'one-to-three')
      && ((anchorCount === 0) || (anchorCount > REVIEW_UNIT_NARROW_TARGET_ANCHOR_MAX)))
    || ((rule.targetAnchorMode === 'one-to-four')
      && ((anchorCount === 0) || (anchorCount > REVIEW_UNIT_MAX_TARGET_ANCHORS))))
    refuseReviewUnit({
      failureCategory: 'anchor',
      message: 'review unit rule target anchors differ',
    });
}
