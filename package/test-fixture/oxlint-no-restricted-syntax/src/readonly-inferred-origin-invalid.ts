//region Shared source

/**
 * Primitive source values for inferred producer controls.
 */
const SOURCE_VALUES = [1, 2,];

/**
 * Named mutable element type for type-origin control.
 */
type NamedMutableRow = {
  claimId: string;
};

//endregion Shared source

//region Unique callable origin

/**
 * Rows inferred from one mapping callback.
 */
const judged = SOURCE_VALUES.map(function toJudged(value,) {
  return {
    verdict: value > 1,
  };
},);

/**
 * Reads first consumer of inferred rows.
 */
export const matchedJudged = judged.filter(function matchesJudged(entry,) {
  return entry.verdict;
},);

/**
 * Reads second consumer through local alias.
 */
const judgedAlias = judged;

/**
 * Counts inferred rows through aliased receiver.
 */
export const countedJudged = judgedAlias.reduce(
  function countJudged(sum, entry,) {
    return sum + (entry.verdict ? 1 : 0);
  },
  0,
);

//endregion Unique callable origin

//region Named type origin

/**
 * Rows carrying authored mutable element type.
 */
const namedRows: NamedMutableRow[] = [];

/**
 * Reads contextually inferred named row.
 */
export const matchingNamedRows = namedRows.filter(function matchingNamed(entry,) {
  return entry.claimId.length > 0;
},);

//endregion Named type origin

//region Multiple origins

/**
 * Left inferred producer.
 */
const leftRows = SOURCE_VALUES.map(function toLeft(value,) {
  return { left: value, };
},);

/**
 * Right inferred producer.
 */
const rightRows = SOURCE_VALUES.map(function toRight(value,) {
  return { right: value, };
},);

/**
 * Merge whose inferred union has two producer declarations.
 */
const mergedRows = [
  ...leftRows,
  ...rightRows,
];

/**
 * Reads merged inferred row.
 */
export const matchingMergedRows = mergedRows.filter(function matchingMerged(entry,) {
  return ('left' in entry) || ('right' in entry);
},);

//endregion Multiple origins

//region Arrow and normalized-origin controls

/**
 * Rows inferred from anonymous arrow producer.
 */
const arrowRows = SOURCE_VALUES.map(value => ({ arrow: value, }),);

/**
 * Reads rows from one anonymous arrow origin.
 */
export const matchingArrowRows = arrowRows.filter(entry => entry.arrow > 0,);

/**
 * Same-line arrow producers whose display locations collide but identities do not.
 */
const sameLineLeft = SOURCE_VALUES.map(value => ({ sameLineLeft: value, }),); const sameLineRight = SOURCE_VALUES.map(value => ({ sameLineRight: value, }),);

/**
 * Merge carrying two same-line origins.
 */
const sameLineMerged = [
  ...sameLineLeft,
  ...sameLineRight,
];

/**
 * Reads merge whose producers share one display line.
 */
export const matchingSameLineRows = sameLineMerged.filter(
  entry => ('sameLineLeft' in entry) || ('sameLineRight' in entry),
);

/**
 * Rows whose union constituents share one producer callable.
 */
const sameOwnerRows = SOURCE_VALUES.map(function toEither(value,) {
  return value > 1
    ? { sameOwnerLeft: value, }
    : { sameOwnerRight: value, };
},);

/**
 * Reads union produced by one callable.
 */
export const matchingSameOwnerRows = sameOwnerRows.filter(
  entry => ('sameOwnerLeft' in entry) || ('sameOwnerRight' in entry),
);

/**
 * Left side of authored intersection.
 */
type IntersectionLeft = {
  left: number;
};

/**
 * Right side of authored intersection.
 */
type IntersectionRight = {
  right: number;
};

/**
 * Rows contextually inferred from authored intersection.
 */
const intersectionRows: (IntersectionLeft & IntersectionRight)[] = [];

/**
 * Reads intersection carrying two type origins.
 */
export const matchingIntersectionRows = intersectionRows.filter(
  entry => entry.left + entry.right > 0,
);

//endregion Arrow and normalized-origin controls

//region No workspace origin

/**
 * Default-library errors with no workspace type declaration.
 */
const errors: Error[] = [];

/**
 * Reads inferred default-library error.
 */
export const namedErrors = errors.filter(function namedError(error,) {
  return error.name.length > 0;
},);

//endregion No workspace origin

//region Authored guidance

/**
 * Reads authored array eligible for exact readonly-array replacement.
 *
 * @param values - Primitive array read without mutation.
 *
 * @returns element count.
 *
 * @example
 * ```ts
 * exactAuthoredGuidance(['value']);
 * ```
 */
export function exactAuthoredGuidance(values: string[],): number {
  return values.length;
}

/**
 * Mutable element for authored array without local exact projection.
 */
type NestedMutableRow = {
  value: number;
};

/**
 * Reads authored array whose element remains writable.
 *
 * @param values - Mutable rows read without mutation.
 *
 * @returns element count.
 *
 * @example
 * ```ts
 * cautiousAuthoredGuidance([{ value: 1 }]);
 * ```
 */
export function cautiousAuthoredGuidance(values: NestedMutableRow[],): number {
  return values.length;
}

//endregion Authored guidance
