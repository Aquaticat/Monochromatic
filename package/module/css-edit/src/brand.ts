/**
 * Branded CSS document source string.
 *
 * The brand is a compile-time marker only; at runtime a `StringCss` is an
 * ordinary string. Callers assert the brand at the boundary where they know a
 * string holds CSS, so downstream signatures can demand proven-CSS input
 * instead of any string.
 *
 * @example
 * ```ts
 * const source = '.btn { color: red; }' as StringCss;
 * ```
 */
export type StringCss = string & {
  readonly __brand: 'css-document';
};
