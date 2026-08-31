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
 * Canonical front-matter key, container, and scalar type row.
 */
type FrontMatterShapeRow = {
  /**
   * YAML object path.
   */
  readonly path: readonly string[];
  /**
   * Value or container kind.
   */
  readonly kind: 'array' | 'boolean' | 'null' | 'number' | 'object' | 'string';
  /**
   * Sorted object keys, empty for nonobjects.
   */
  readonly keys: readonly string[];
  /**
   * Array length, zero for nonarrays.
   */
  readonly length: number;
};

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
 * Refuses number values whose parsed identity is not stable.
 *
 * @param value - parsed YAML numeric scalar
 */
function assertSupportedFrontMatterNumber(value: number,): void {
  if ((!Number.isFinite(value,))
    || Object.is(
      value,
      -0,
    )
    || (Number.isInteger(value,) && (!Number.isSafeInteger(value,))))
    throw new Error('review unit unsupported front matter number differs');
}

/**
 * Collects canonical key, container, and scalar type shape.
 *
 * @returns Structural rows including empty containers
 */
function frontMatterShape({
  value,
  path = [],
}: {
  readonly value: unknown;
  readonly path?: readonly string[];
}): readonly FrontMatterShapeRow[] {
  if (value === undefined)
    return [];
  if (value === null)
    return [{
      path,
      kind: 'null',
      keys: [],
      length: 0,
    },];
  if ((typeof value) === 'string')
    return [{
      path,
      kind: 'string',
      keys: [],
      length: 0,
    },];
  if ((typeof value) === 'boolean')
    return [{
      path,
      kind: 'boolean',
      keys: [],
      length: 0,
    },];
  if ((typeof value) === 'number') {
    assertSupportedFrontMatterNumber(value,);
    return [{
      path,
      kind: 'number',
      keys: [],
      length: 0,
    },];
  }
  if (Array.isArray(value,))
    return [
      {
        path,
        kind: 'array',
        keys: [],
        length: value.length,
      },
      ...value.flatMap(function child(
        item,
        index,
      ) {
        return frontMatterShape({
          value: item,
          path: [
            ...path,
            String(index,),
          ],
        });
      },),
    ];
  if ((typeof value) === 'object') {
    /**
     * Stable object keys independent of YAML source order.
     */
    const keys = Object.keys(value,)
      .toSorted();
    return [
      {
        path,
        kind: 'object',
        keys,
        length: 0,
      },
      ...Object.entries(value,)
        .flatMap(function child([key, item,],) {
        return frontMatterShape({
          value: item,
          path: [
            ...path,
            key,
          ],
        });
      },),
    ];
  }
  throw new Error('review unit unsupported front matter scalar differs');
}

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
  if ((typeof value) === 'boolean')
    return [{
      path,
      value,
    },];
  if ((typeof value) === 'number') {
    assertSupportedFrontMatterNumber(value,);
    return [{
      path,
      value,
    },];
  }
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
  readonly structureDigest: string;
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
   * Canonical source key and container shape.
   */
  const sourceShape = frontMatterShape({ value: sourceValue, });
  /**
   * Canonical target key and container shape.
   */
  const targetShape = frontMatterShape({ value: targetValue, });
  if (JSON.stringify(sourceShape,) !== JSON.stringify(targetShape,))
    throw new Error('review unit front matter structure differs');
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
    structureDigest: hashContent({ content: JSON.stringify(sourceShape,), }),
    scalarDigest: hashContent({ content: JSON.stringify(sourceScalars,), }),
  };
}
