import type { JsoncComment, } from './comment.ts';

//region Constants

/**
 * One level of canonical indentation.
 */
const INDENT_UNIT = '  ';

/**
 * Block-comment close delimiter; a comment body containing it cannot be emitted
 * as a block comment, since C-family block comments do not nest.
 */
const BLOCK_CLOSE = '*/';

//endregion Constants

//region Comment emit

/**
 * Tests whether a comment body fits on a single line, deciding whether it can be
 * emitted as a trailing comment.
 *
 * @param comment - Comment to test.
 *
 * @returns `true` when the body has no newline.
 *
 * @example
 * ```ts
 * isSingleLineComment({ type: 'inline', text: ' note' }); // => true
 * ```
 */
export function isSingleLineComment(comment: JsoncComment,): boolean {
  return !comment.text
    .includes('\n',);
}

/**
 * Emits a single-line comment to sit after a value on the same line, always as a
 * `//` line comment so no `*\/` termination hazard arises.
 *
 * @param comment - Single-line comment to emit.
 *
 * @returns Comment text, without indentation.
 *
 * @example
 * ```ts
 * trailingComment({ comment: { type: 'inline', text: ' note' } }); // => '// note'
 * ```
 */
export function trailingComment({
  comment,
}: {
  readonly comment: JsoncComment;
},): string {
  return `//${comment.text}`;
}

/**
 * Emits a comment as leading lines before a node, indented to its level and
 * terminated with a newline. A block comment whose body has no `*\/` is kept as a
 * block; everything else becomes one `//` line per body line, which is always
 * safe to re-parse.
 *
 * @param comment - Comment to emit.
 *
 * @param indent - Indentation depth in levels.
 *
 * @returns Indented comment text ending in a newline.
 *
 * @example
 * ```ts
 * leadingComment({ comment: { type: 'inline', text: ' a' }, indent: 1 });
 * // => '  // a\n'
 * ```
 */
export function leadingComment({
  comment,
  indent,
}: {
  readonly comment: JsoncComment;
  readonly indent: number;
},): string {
  /**
   * Indentation prefix for this depth.
   */
  const pad = INDENT_UNIT.repeat(indent,);
  if ((comment.type === 'block') && (!comment.text
    .includes(BLOCK_CLOSE,)))
    return `${pad}/*${comment.text}*/\n`;
  return `${comment.text
    .split('\n',)
    .map(function lineToComment(line: string,): string {
      return `${pad}//${line}`;
    },)
    .join('\n',)}\n`;
}

//endregion Comment emit
