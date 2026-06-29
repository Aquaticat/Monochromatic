/**
 * Line-oriented `catalog:` block parser for catalog-tighten.
 *
 * Extracts `name: range` entries from `pnpm-workspace.yaml` without a YAML
 * parser dependency, mirroring the prior regex anchors with string-API scans.
 * Lives in its own module so the pure parser is unit-testable apart from
 * `index.ts`, whose top-level body reads and rewrites the workspace file.
 */

import {
  isValidPackageName,
} from './package-name.ts';

//region Catalog YAML parsing

/**
 * Sentinel returned by {@link parseCatalogEntry} for a line that does not match
 * the indented `key: value` catalog shape. A `unique symbol`; callers narrow
 * with `=== MALFORMED_ENTRY`.
 */
const MALFORMED_ENTRY: unique symbol = Symbol('catalog-tighten/catalog entry cannot be parsed',);

/**
 * Returns true when `c` is a space or tab character.
 *
 * @param c - candidate character
 *
 * @returns whether the character is horizontal whitespace
 */
function isSpaceOrTab(c: string,): boolean {
  return (c === ' ') || (c === '\t');
}

/**
 * Collects the contiguous block of indented (space/tab-leading) non-empty
 * lines starting at `from`. Mirrors `((?:[ \t]+.+\n)*)` against a
 * line-oriented input: every member line must begin with space/tab and
 * contain at least one further char before its trailing `\n`.
 *
 * Single linear pass over the tail of `lines`: each qualifying line is pushed
 * and the scan breaks at the first line that is empty, not space/tab-indented,
 * or carries no character after its indent. Replaces a prior cursor recursion
 * whose `[...acc, line]` accumulator copied the block on every step (O(n^2))
 * and whose call depth grew with the block length, overflowing the stack on
 * long input under engines (such as V8) that lack tail-call elimination.
 *
 * @param lines - file content split on `\n`
 *
 * @param from - cursor index into `lines`
 *
 * @returns ordered slice of indented entry lines
 *
 * @example
 * ```ts
 * collectIndentedBlock({ lines: ["catalog:", "  a: 1", "next:"], from: 1 }) // ["  a: 1"]
 * ```
 */
export function collectIndentedBlock({
  lines,
  from,
}: {
  readonly lines: readonly string[];
  readonly from: number;
},): readonly string[] {
  /**
   * Indented entry lines collected in source order; returned as the block.
   */
  const block: string[] = [];
  for (const line of lines.slice(from,)) {
    /**
     * First character of the line; non-space/tab ends the block.
     */
    const first = line.charAt(0,);
    if ((line.length
      === 0) || (!isSpaceOrTab(first,)))
      break;
    /**
     * Line body after the leading indent; must be non-empty to count.
     */
    const rest = line.slice(1,);
    if (rest.length
      === 0)
      break;
    block.push(line,);
  }
  return block;
}

/**
 * Parsed `key: value` shape from one catalog entry line; {@link MALFORMED_ENTRY} for
 * lines that do not match the expected indented `key: value` form.
 */
type CatalogEntry = {
  /**
   * Unquoted key.
   */
  key: string;
  /**
   * Unquoted value.
   */
  value: string;
};

/**
 * Strips a single layer of matching ASCII quotes from `s`, single or double.
 * `pnpm-workspace.yaml` quotes catalog keys and values with single quotes
 * (`'oxlint': '>=1.71.0'`), so a double-quote-only strip (issue #258) left the
 * quotes embedded in every key and value and broke resolution. Returns `s`
 * unchanged when no matching wrapping quote pair is present.
 *
 * @param s - candidate token
 *
 * @returns token with the wrapping quotes removed if any
 */
function unquote(s: string,): string {
  /**
   * Leading character; the wrapping quote must be this exact char on both ends.
   */
  const first = s.charAt(0,);
  if (
    (s.length
      >= 2)
    && ((first === '"') || (first === '\''))
    && s
      .endsWith(first,)
  ) {
    return s.slice(
      1,
      -1,
    );
  }
  return s;
}

/**
 * Parses one indented catalog entry line into its key/value pair.
 *
 * Mirrors `/^\s+"?([^":]+)"?\s*:\s*"?([^"\n]+)"?\s*$/` without regex: trims
 * whitespace, splits on the first `:`, unquotes both sides. The key must
 * be non-empty and contain no embedded `:`; the value must be non-empty.
 *
 * @param line - raw indented line from the catalog block
 *
 * @returns parsed entry, or {@link MALFORMED_ENTRY} when the line shape is unexpected
 */
function parseCatalogEntry(line: string,): CatalogEntry | typeof MALFORMED_ENTRY {
  /**
   * Whitespace-trimmed line; surrounding indentation and trailing CR/space are dropped.
   */
  const trimmed = line.trim();
  if (trimmed.length
    === 0)
    return MALFORMED_ENTRY;
  /**
   * Position of the colon separator; `-1` indicates a malformed line.
   */
  const colonIdx = trimmed.indexOf(':',);
  if (colonIdx <= 0)
    return MALFORMED_ENTRY;
  /**
   * Raw key segment before the colon, trailing whitespace stripped.
   */
  const rawKey = trimmed
    .slice(
      0,
      colonIdx,
    )
    .trimEnd();
  /**
   * Raw value segment after the colon, surrounding whitespace stripped.
   */
  const rawValue = trimmed
    .slice(colonIdx + 1,)
    .trim();
  /**
   * Key with one layer of wrapping quotes removed if present.
   */
  const key = unquote(rawKey,);
  /**
   * Value with one layer of wrapping quotes removed if present.
   */
  const value = unquote(rawValue,);
  if ((key.length
    === 0) || (value.length
      === 0))
    return MALFORMED_ENTRY;
  return {
    key,
    value,
  };
}

/**
 * Extracts `catalog:` entries from pnpm-workspace.yaml using a small
 * line-oriented parser. Avoids a YAML parser dependency for this simple
 * key-value structure.
 * Matches lines like `  "package-name": ">=1.2.3"` or `  package-name: ">=1.2.3"` under `catalog:`.
 *
 * @param content - Raw YAML file content to parse.
 *
 * @returns Map of package names to version range strings found under the `catalog:` section.
 *
 * @example
 * ```ts
 * parseCatalogFromYaml("catalog:\n  foo: \">=1.2.3\"") // { foo: ">=1.2.3" }
 * ```
 */
export function parseCatalogFromYaml(content: string,): Record<string, string> {
  /**
   * Content split into lines; preserves the file's order so the regex anchor semantics translate cleanly.
   */
  const lines = content.split('\n',);
  /**
   * Index of the first line whose trimmed-right form is exactly `catalog:`; `-1` ends the search.
   */
  const headerIdx = lines.findIndex(function isCatalogHeader(line,): boolean {
    return line.trimEnd()
      === 'catalog:';
  },);
  if (headerIdx === (-1))
    return {};
  /**
   * Indented body of the `catalog:` block; each line is one `name: range` entry.
   */
  const block = collectIndentedBlock({
    lines,
    from: headerIdx + 1,
  },);
  /**
   * Prototype-less seed mutated in place as each parsed entry is appended.
   * `Object.create(null)` means a crafted `__proto__:` key becomes an ordinary
   * own property instead of mutating the map's prototype (issue #195 guard).
   */
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.create(null) returns `any`; the cast narrows it to the prototype-less catalog string map
  const seed = Object.create(null,) as Record<string, string>;
  return block.reduce(
    function appendEntry(
      acc,
      line,
    ): Record<string, string> {
      /**
       * Parsed entry; `MALFORMED_ENTRY` when the line shape does not match the catalog convention.
       */
      const entry = parseCatalogEntry(line,);
      if (entry === MALFORMED_ENTRY)
        return acc;
      if (!isValidPackageName(entry.key,)) {
        // JSON.stringify escapes control chars (including terminal ESC) so a crafted key cannot inject terminal sequences (rule SYB)
        console.warn(
          `Rejected catalog key ${JSON.stringify(entry.key,)}: not a valid npm package name; skipping (issue #195).`,
        );
        return acc;
      }
      acc[entry.key] = entry.value;
      return acc;
    },
    seed,
  );
}

//endregion Catalog YAML parsing
