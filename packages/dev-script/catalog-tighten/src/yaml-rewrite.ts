/**
 * Surgical catalog-range rewriter for catalog-tighten.
 *
 * Writes tightened ranges back into `pnpm-workspace.yaml` by string replacement
 * on the raw text, preserving the file's formatting, comments, ordering, and
 * quote style. A yaml parse-then-stringify round-trip would lose all of that,
 * so the writer stays surgical even though the reader uses the yaml library.
 *
 * The prior writer matched only double-quoted entries (`"name": "range"`) and
 * silently rewrote nothing on the single-quoted file (#258); this matches the
 * entry by its key, regardless of quote style, and replaces only the value.
 */

//region Catalog rewrite

/**
 * One tightened catalog entry: the original value text and its replacement.
 */
export type TightenedRange = {
  /**
   * Catalog key (package name) whose line carries the value to rewrite.
   */
  readonly name: string;
  /**
   * Original catalog value as written, e.g. `>=1.2.0` or `npm:@jsr/x@>=1.2.0`.
   */
  readonly oldRange: string;
  /**
   * Replacement value, e.g. `>=1.3.0`.
   */
  readonly newRange: string;
};

/**
 * Sentinel returned by {@link lineKey} for a line with no `key:` shape. A
 * `unique symbol`; callers narrow with `=== NO_KEY`.
 */
const NO_KEY: unique symbol = Symbol('catalog-tighten/line carries no catalog key',);

/**
 * Extracts the catalog key from one entry line, stripping a matching single or
 * double quote pair. Returns {@link NO_KEY} when the line has no `key:` shape
 * (blank lines, comments, the `catalog:` header).
 *
 * @param line - one raw line from the workspace file
 *
 * @returns unquoted key, or {@link NO_KEY}
 *
 * @example
 * ```ts
 * lineKey("  'oxlint': '>=1.71.0'") // "oxlint"
 * lineKey("  # comment") // NO_KEY
 * ```
 */
function lineKey(line: string,): string | typeof NO_KEY {
  /**
   * Whitespace-trimmed line; leading indent and trailing space removed before key extraction.
   */
  const trimmed = line.trim();
  /**
   * Position of the key/value colon; `<= 0` means there is no key before a colon.
   */
  const colonIdx = trimmed.indexOf(':',);
  if (colonIdx <= 0)
    return NO_KEY;
  /**
   * Raw key segment before the colon, trailing space stripped.
   */
  const rawKey = trimmed
    .slice(
      0,
      colonIdx,
    )
    .trimEnd();
  /**
   * Leading character; a wrapping quote must match on both ends to be stripped.
   */
  const first = rawKey.charAt(0,);
  /**
   * Whether the leading character is an ASCII quote that could wrap the key.
   */
  const isQuote = (first === '"')
    || (first === '\'');
  /**
   * Whether `rawKey` is wrapped in a matching quote pair, so a layer can be stripped.
   */
  const wrapped = (rawKey.length >= 2)
    && isQuote
    && rawKey.endsWith(first,);
  if (wrapped) {
    return rawKey.slice(
      1,
      -1,
    );
  }
  return rawKey;
}

/**
 * Rewrites every tightened entry's value in `content`, preserving formatting.
 * Walks lines, matches each by its (unquoted) key against `results`, and on a
 * match replaces the first occurrence of the old value with the new one,
 * leaving the surrounding quotes and spacing untouched.
 *
 * @param content - raw `pnpm-workspace.yaml` text
 *
 * @param results - {@link TightenedRange} entries to write back
 *
 * @returns rewritten file text
 *
 * @example
 * ```ts
 * rewriteCatalogRanges({
 *   content: "catalog:\n  'oxlint': '>=1.71.0'",
 *   results: [{ name: 'oxlint', oldRange: '>=1.71.0', newRange: '>=1.71.1' }],
 * }) // "catalog:\n  'oxlint': '>=1.71.1'"
 * ```
 */
export function rewriteCatalogRanges(
  {
    content,
    results,
  }: {
    readonly content: string;
    readonly results: readonly TightenedRange[];
  },
): string {
  return content
    .split('\n',)
    .map(function rewriteLine(line,): string {
      /**
       * Key parsed from this line; `NO_KEY` for non-entry lines, which pass through unchanged.
       */
      const key = lineKey(line,);
      if (key === NO_KEY)
        return line;
      /**
       * Tightened entry whose key matches this line, if any.
       */
      const result = results.find(function matchesKey(candidate,): boolean {
        return candidate.name === key;
      },);
      if (result === undefined)
        return line;
      return line.replace(
        result.oldRange,
        result.newRange,
      );
    },)
    .join('\n',);
}

//endregion Catalog rewrite
