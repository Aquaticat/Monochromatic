import type { MicromarkToken, } from 'markdownlint';

/**
 * Read-only structural view of the micromark token fields the rule and the HTML
 * transform read. A `MicromarkToken` is structurally assignable to this view, so
 * `params.parsers.micromark.tokens` flows in without a cast.
 *
 * `type` is `string` rather than micromark's `keyof TokenTypeMap` on purpose, for
 * two reasons that both bite the obvious `token.type === 'table'` spelling:
 *
 * - The GFM table type names (`'table'`, `'tableRow'`, `'tableContent'`, ...) are
 *   contributed by `micromark-extension-gfm-table`'s `TokenTypeMap` augmentation,
 *   which does not resolve into this package's type program; `keyof TokenTypeMap`
 *   therefore excludes them and a literal comparison reports TS2367 "no overlap".
 *   markdownlint's own table rules sidestep this by matching through
 *   `filterByTypes([...])` (a `string[]`), never a literal `===`.
 * - The fully-readonly shape satisfies `prefer-readonly-parameter-types` for a
 *   token markdownlint exposes as deeply mutable (`children: MicromarkToken[]`),
 *   so no per-function lint suppression is needed.
 */
export type ReadonlyToken = {
  /** Token type (a micromark token-type name such as `'table'`). */
  readonly type: string;
  /** Leaf token text; the `\|` table escape survives here. */
  readonly text: string;
  /** Start line (1-based). */
  readonly startLine: number;
  /** End line (1-based). */
  readonly endLine: number;
  /** Start column (1-based); `1` for a top-level, unindented token. */
  readonly startColumn: number;
  /** Child tokens. */
  readonly children: readonly ReadonlyToken[];
};

/**
 * Structural-assignability witness: a value of markdownlint's `MicromarkToken`
 * must remain assignable to {@link ReadonlyToken}, or call sites passing
 * `params.parsers.micromark.tokens` would silently need a cast. Type-only, so it
 * is erased from the build output.
 */
export type AssignableFromMicromark = MicromarkToken extends ReadonlyToken ? true : never;
