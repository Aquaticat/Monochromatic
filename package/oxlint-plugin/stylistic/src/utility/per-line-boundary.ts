/**
 * Explicit offsets for a delimited item list whose AST node span is wider than
 * the bracket pair that should be checked and fixed.
 *
 * Function-like parameter nodes are the motivating case: the AST node span may
 * include the function body, return type, or `new` prefix, while the per-line
 * rule must compare only the opening and closing parentheses.
 *
 * @example
 * ```ts
 * const boundary = { openOffset: openParen, closeOffset: closeParen };
 * ```
 */
export type PerLineBoundaryOffsets = {
  /**
   * Byte offset of the opening delimiter.
   */
  readonly openOffset: number;
  /**
   * Byte offset of the closing delimiter.
   */
  readonly closeOffset: number;
};
