/**
 * Catalog reader for catalog-tighten.
 *
 * Extracts the default `catalog:` block from `pnpm-workspace.yaml` using the
 * `yaml` library, mirroring the sibling `deps-cube` reader. A prior hand-rolled
 * line scanner mis-handled single-quoted entries (#258) and comment lines, so
 * reading now defers to a real YAML parser. Writing back stays surgical string
 * replacement in `index.ts` to preserve the file's formatting, comments, and
 * ordering, which a parse-then-stringify round-trip would lose.
 *
 * Only the default `catalog:` block is read; named `catalogs:` are out of scope
 * for the tighten fix (the lone named entry here is a non-`>=` range, skipped
 * anyway).
 */

import {
  parse as parseYaml,
} from 'yaml';

import {
  isValidPackageName,
} from './package-name.ts';

//region Catalog YAML parsing

/**
 * Catalog-bearing subset of the parsed `pnpm-workspace.yaml` document.
 */
type WorkspaceYaml = {
  /**
   * Default catalog block mapping package name to version range; absent when the file declares none.
   */
  catalog?: Record<string, string>;
};

/**
 * Builds the prototype-less result map. `Object.create(null)` means a crafted
 * `__proto__` key becomes an ordinary own property instead of mutating the
 * map's prototype, the second layer of the issue #195 guard after
 * {@link isValidPackageName}.
 *
 * @returns empty map with no prototype
 *
 * @example
 * ```ts
 * const map = createCatalogMap();
 * map['oxlint'] = '>=1.71.0';
 * ```
 */
function createCatalogMap(): Record<string, string> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.create(null) returns `any`; the cast narrows it to the prototype-less catalog string map
  return Object.create(null,) as Record<string, string>;
}

/**
 * Extracts the default `catalog:` entries from `pnpm-workspace.yaml` content.
 * Parses with the `yaml` library (handling quotes, comments, and block
 * structure natively), then copies each entry into a prototype-less map after
 * validating its key as an npm package name. Keys that fail validation are
 * logged and skipped, preserving the rest of the catalog (issue #195).
 *
 * @param content - raw YAML file content to parse
 *
 * @returns prototype-less map of package names to version range strings under `catalog:`
 *
 * @example
 * ```ts
 * parseCatalogFromYaml("catalog:\n  foo: '>=1.2.3'") // { foo: ">=1.2.3" }
 * ```
 */
export function parseCatalogFromYaml(content: string,): Record<string, string> {
  /* oxlint-disable typescript/no-unsafe-type-assertion -- YAML parse returns `unknown`; pnpm-workspace.yaml's catalog shape is fixed */
  /**
   * Parsed workspace document narrowed to its catalog-bearing subset.
   */
  const parsed = parseYaml(content,) as WorkspaceYaml;
  /* oxlint-enable typescript/no-unsafe-type-assertion */

  /**
   * Default catalog block; empty object keeps the downstream pipeline working when the file declares none.
   */
  const block = parsed.catalog
    ?? {};

  return Object.entries(block,)
    .reduce(
    function appendEntry(
      acc,
      [key, value,],
    ): Record<string, string> {
      if (!isValidPackageName(key,)) {
        // JSON.stringify escapes control chars (including terminal ESC) so a crafted key cannot inject terminal sequences (rule SYB)
        console.warn(
          `Rejected catalog key ${JSON.stringify(key,)}: not a valid npm package name; skipping (issue #195).`,
        );
        return acc;
      }
      acc[key] = value;
      return acc;
    },
    createCatalogMap(),
  );
}

//endregion Catalog YAML parsing
