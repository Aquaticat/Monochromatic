// PROTOTYPE ONLY: Candidate K front-matter semantic review subjects.

import { hashContent, } from './document-node.ts';
import { splitFrontMatter, } from './front-matter.ts';
import {
  MAX_REVIEW_UNIT_FRONT_MATTER_SUBJECTS,
  type ReviewUnitFrontMatterSubject,
} from './prototype-review-unit-plan-model.ts';

/**
 * Normalized non-string YAML scalar.
 */
type FrontMatterScalarValue = boolean | number | 'yaml-null';

/**
 * Internal front-matter scalar leaf before equality proof.
 */
type FrontMatterScalarLeaf = {
  /**
   * YAML object path.
   */
  readonly path: readonly string[];
  /**
   * Normalized JSON scalar value.
   */
  readonly value: FrontMatterScalarValue;
};

/**
 * Internal front-matter string leaf before source and target join.
 */
type FrontMatterLeaf = {
  /**
   * YAML object path.
   */
  readonly path: readonly string[];
  /**
   * String value at path.
   */
  readonly text: string;
};

/**
 * Collects every bounded structural string leaf from parsed YAML.
 *
 * @returns String leaves in parser order
 */
function frontMatterLeaves({
  value,
  path = [],
}: {
  readonly value: unknown;
  readonly path?: readonly string[];
}): readonly FrontMatterLeaf[] {
  if ((typeof value) === 'string')
    return [{
      path,
      text: value,
    },];
  if (Array.isArray(value,))
    return value.flatMap(function child(
      item,
      index,
    ) {
      return frontMatterLeaves({
        value: item,
        path: [
          ...path,
          String(index,),
        ],
      });
    },);
  if (((typeof value) === 'object') && (value !== null))
    return Object.entries(value,)
      .flatMap(function child([key, item,],) {
        return frontMatterLeaves({
          value: item,
          path: [
            ...path,
            key,
          ],
        });
      },);
  return [];
}

/**
 * Collects every non-string JSON scalar leaf from parsed YAML.
 *
 * @returns Normalized scalar leaves in parser order
 */
function frontMatterScalarLeaves({
  value,
  path = [],
}: {
  readonly value: unknown;
  readonly path?: readonly string[];
}): readonly FrontMatterScalarLeaf[] {
  if (value === null)
    return [{
      path,
      value: 'yaml-null',
    },];
  if (((typeof value) === 'boolean') || ((typeof value) === 'number'))
    return [{
      path,
      value,
    },];
  if (Array.isArray(value,))
    return value.flatMap(function child(
      item,
      index,
    ) {
      return frontMatterScalarLeaves({
        value: item,
        path: [
          ...path,
          String(index,),
        ],
      });
    },);
  if (((typeof value) === 'object') && (value !== null))
    return Object.entries(value,)
      .flatMap(function child([key, item,],) {
        return frontMatterScalarLeaves({
          value: item,
          path: [
            ...path,
            key,
          ],
        });
      },);
  return [];
}

/**
 * Stable YAML-path identity.
 *
 * @param path - parsed YAML property path
 *
 * @returns Canonical path string
 */
function frontMatterPathKey(path: readonly string[],): string {
  return JSON.stringify(path,);
}

/**
 * Sorts scalar records by canonical YAML path.
 *
 * @param value - parsed YAML value
 *
 * @returns Canonically ordered scalar leaves
 */
function sortedScalars(value: unknown,): readonly FrontMatterScalarLeaf[] {
  return frontMatterScalarLeaves({ value, })
    .toSorted(function path(
      left,
      right,
    ) {
      return frontMatterPathKey(left.path,)
        .localeCompare(frontMatterPathKey(right.path,),);
    },);
}

/**
 * Compiles front-matter semantic subjects and scalar equality proof.
 *
 * @returns String subjects plus deterministic non-string scalar digest
 *
 * @example
 * ```ts
 * const review = compileReviewUnitFrontMatter({ sourceText, targetText, });
 * ```
 */
export function compileReviewUnitFrontMatter({
  sourceText,
  targetText,
}: {
  readonly sourceText: string;
  readonly targetText: string;
}): {
  readonly subjects: readonly ReviewUnitFrontMatterSubject[];
  readonly scalarDigest: string;
} {
  /**
   * Parsed source front-matter value.
   */
  const sourceValue = splitFrontMatter({ text: sourceText, })
    .frontMatter
    ?.data;
  /**
   * Parsed target front-matter value.
   */
  const targetValue = splitFrontMatter({ text: targetText, })
    .frontMatter
    ?.data;
  /**
   * Canonical source scalar records.
   */
  const sourceScalars = sortedScalars(sourceValue,);
  /**
   * Canonical target scalar records.
   */
  const targetScalars = sortedScalars(targetValue,);
  if (JSON.stringify(sourceScalars,) !== JSON.stringify(targetScalars,))
    throw new Error('review unit non-string front matter differs');
  /**
   * Source string leaves in parser order.
   */
  const sourceLeaves = frontMatterLeaves({ value: sourceValue, });
  /**
   * Target string leaves in parser order.
   */
  const targetLeaves = frontMatterLeaves({ value: targetValue, });
  /**
   * Every source and target path before canonical deduplication.
   */
  const allPaths = [
    ...sourceLeaves,
    ...targetLeaves,
  ]
    .map(function path(leaf,) { return leaf.path; });
  /**
   * Canonical first occurrence for every string path.
   */
  const paths = allPaths.filter(function first(
    path,
    index,
  ) {
    return allPaths.findIndex(function same(value,) {
      return frontMatterPathKey(value,) === frontMatterPathKey(path,);
    },) === index;
  },);
  if (paths.length > MAX_REVIEW_UNIT_FRONT_MATTER_SUBJECTS)
    throw new Error('review unit front matter exceeds finite bound');
  /**
   * Semantic string subjects with exact target-anchor slots.
   */
  const subjects = paths.map(function subject(
    path,
    subjectIndex,
  ) {
    /**
     * Source value at canonical path.
     */
    const source = sourceLeaves.find(function same(leaf,) {
      return frontMatterPathKey(leaf.path,) === frontMatterPathKey(path,);
    },)
      ?.text
      ?? '';
    /**
     * Target value at canonical path.
     */
    const target = targetLeaves.find(function same(leaf,) {
      return frontMatterPathKey(leaf.path,) === frontMatterPathKey(path,);
    },)
      ?.text
      ?? '';
    return {
      subjectIndex,
      path,
      targetSlotKey: `fm${String(subjectIndex,)}`,
      sourceText: source,
      targetText: target,
      sourceDigest: hashContent({ content: source, }),
      targetDigest: hashContent({ content: target, }),
    };
  },);
  return {
    subjects,
    scalarDigest: hashContent({ content: JSON.stringify(sourceScalars,), }),
  };
}
