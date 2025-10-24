import * as Jsonc from '../../../../t/index.ts';

export function mergeComments(
  { value, value2, }: {
    value?: undefined;
    value2?: undefined;
  },
): undefined;
export function mergeComments(
  { value, value2, }: {
    value: Jsonc.Comment;
    value2?: Jsonc.Comment | undefined;
  } | {
    value?: Jsonc.Comment | undefined;
    value2: Jsonc.Comment;
  },
): Jsonc.Comment;
export function mergeComments(
  { value, value2, }: { value?: Jsonc.Comment | undefined;
    value2?: Jsonc.Comment | undefined; },
): Jsonc.Comment | undefined {
  if (value === undefined)
    return value2;
  // value is determined to not be undefined here.
  if (value2 === undefined)
    return value;
  // Both has comment.
  // No trimming needed because we wanna support both `// This is` and `//region`.
  // Be careful not to indent here.
  const commentValue = `${value.commentValue}
${value2.commentValue}`;
  return value.type === value2.type
    ? { ...value, commentValue, }
    : { ...value, type: 'mixed', commentValue, };
}
