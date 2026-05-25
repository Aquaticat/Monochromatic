import type * as Jsonc from '../../../../t/index.ts';

/**
 * Merges two optional JSONC comments into a single combined comment.
 * Returns `undefined` when both inputs are `undefined`, or the defined comment
 * when only one is present. When both exist, concatenates their content.
 *
 * @param value - first comment to merge
 *
 * @param value2 - second comment to merge
 *
 * @returns merged comment, single comment, or `undefined`
 */
export function mergeComments(
  {
    value,
    value2,
  }: {
    value?: undefined;
    value2?: undefined;
  },
): undefined;
export function mergeComments(
  {
    value,
    value2,
  }: {
    value: Jsonc.Comment;
    value2?: Jsonc.Comment | undefined;
  } | {
    value?: Jsonc.Comment | undefined;
    value2: Jsonc.Comment;
  },
): Jsonc.Comment;
/**
 * {@inheritDoc mergeComments}
 *
 * @returns merged comment, single comment, or `undefined`
 */
export function mergeComments(
  {
    value,
    value2,
  }: {
    value?: Jsonc.Comment | undefined;
    value2?: Jsonc.Comment | undefined;
  },
): Jsonc.Comment | undefined {
  if (value === undefined)
    return value2;
  // value is determined to not be undefined here.
  if (value2 === undefined)
    return value;
  // Both has comment.
  // No trimming needed because we wanna support both `// This is` and `//region`.
  // Be careful not to indent here.
  /** Concatenated comment body preserving raw line breaks between the two inputs. */
  const commentValue = `${value.commentValue}
${value2.commentValue}`;
  return value.type
    === value2
    .type
    ? {
      ...value,
      commentValue,
    }
    : {
      ...value,
      type: 'mixed',
      commentValue,
    };
}
