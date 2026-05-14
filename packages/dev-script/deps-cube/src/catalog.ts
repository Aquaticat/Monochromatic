/**
 * Parses `pnpm-workspace.yaml` to extract every catalog entry, normalising
 * aliased entries (`npm:<name>@<range>`) so downstream probes see the real
 * npm package name.
 *
 * Handles both the default `catalog:` block and any named `catalogs.<name>:`
 * blocks; pnpm supports both syntaxes in the same workspace file.
 *
 * @example
 * ```ts
 * import { readCatalog } from './catalog.ts';
 * const entries = await readCatalog();
 * for (const entry of entries) {
 *   console.info(entry.catalogKey, entry.npmName, entry.range);
 * }
 * ```
 */

import { readFile, } from 'node:fs/promises';

import { findUp, } from 'find-up';
import { parse as parseYaml, } from 'yaml';

//region Types

/**
 * Single resolved catalog entry from `pnpm-workspace.yaml`.
 */
export type CatalogEntry = {
  /** Key as written in the catalog (may be an alias when `range` starts with `npm:`). */
  catalogKey: string;
  /** Actual npm package name to query the registry with. */
  npmName: string;
  /** Version range string (semver, exact, `*`, or just the trailing part of `npm:<name>@<range>`). */
  range: string;
  /** Name of the named catalog this entry came from; `undefined` for the default `catalog:` block. */
  catalogName?: string | undefined;
};

/**
 * Shape of the relevant portion of `pnpm-workspace.yaml` after YAML parsing.
 */
type WorkspaceYaml = {
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
};

//endregion Types

//region Helpers

/**
 * Decodes a catalog value, handling `npm:<name>@<range>` aliases.
 *
 * Aliases let a catalog key (often a shorter or scoped name) point at a
 * differently-named npm package. The registry query needs the real package
 * name, not the alias.
 *
 * @param key - Catalog key as written in `pnpm-workspace.yaml`.
 * @param value - Catalog value (range or `npm:<name>@<range>` form).
 *
 * @returns Decoded `{ npmName, range }` pair.
 */
export function decodeAlias(
  {
    key,
    value,
  }: {
    key: string;
    value: string;
  },
): {
  npmName: string;
  range: string;
} {
  if (!value.startsWith('npm:',)) {
    return {
      npmName: key,
      range: value,
    };
  }
  const remainder = value.slice('npm:'.length,);
  const atIndex = remainder.lastIndexOf('@',);
  // No '@' or only the scope-leading '@' (index 0) means no range; entire
  // remainder is the aliased package name.
  if (atIndex <= 0) {
    return {
      npmName: remainder,
      range: '*',
    };
  }
  return {
    npmName: remainder.slice(0, atIndex,),
    range: remainder.slice(atIndex + 1,),
  };
}

/**
 * Flattens a `Record<key, value>` catalog block into resolved entries.
 *
 * @param block - The parsed catalog block (default or named).
 * @param catalogName - Optional name of the named catalog; omitted for the default block.
 *
 * @returns Array of {@link CatalogEntry} for every key/value in the block.
 */
function entriesFromBlock(
  {
    block,
    catalogName,
  }: {
    block: Record<string, string>;
    catalogName?: string | undefined;
  },
): readonly CatalogEntry[] {
  return Object.entries(block,).map(function toEntry([key, value,],): CatalogEntry {
    const {
      npmName,
      range,
    } = decodeAlias({
      key,
      value,
    },);
    return {
      catalogKey: key,
      npmName,
      range,
      catalogName,
    };
  },);
}

//endregion Helpers

//region Public API

/**
 * Locates and parses `pnpm-workspace.yaml`, returning every catalog entry
 * from the default `catalog:` block plus any `catalogs.<name>:` blocks.
 *
 * @param startDir - Directory to start the upward search from. Defaults to `process.cwd()`.
 *
 * @returns Array of normalised catalog entries, one per package per (named-or-default) catalog.
 *
 * @throws When `pnpm-workspace.yaml` cannot be located or contains no catalog blocks.
 */
export async function readCatalog(
  { startDir, }: { startDir?: string; } = {},
): Promise<readonly CatalogEntry[]> {
  const workspaceYamlPath = await findUp(
    'pnpm-workspace.yaml',
    startDir === undefined ? undefined : { cwd: startDir, },
  );
  if (workspaceYamlPath === undefined)
    throw new Error(`Could not locate pnpm-workspace.yaml by walking up from ${startDir ?? process.cwd()}`,);

  const raw = await readFile(workspaceYamlPath, 'utf8',);
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- YAML parse is `unknown`; pnpm-workspace.yaml shape is fixed.
  const parsed = parseYaml(raw,) as WorkspaceYaml;

  const defaultBlock = parsed.catalog ?? {};
  const namedBlocks = parsed.catalogs ?? {};

  const defaultEntries = entriesFromBlock({ block: defaultBlock, },);
  const namedEntries = Object.entries(namedBlocks,).flatMap(function expandNamed([catalogName, block,],) {
    return entriesFromBlock({
      block,
      catalogName,
    },);
  },);

  const combined = [...defaultEntries, ...namedEntries,];
  if (combined.length === 0)
    throw new Error(`No catalog or catalogs entries found in ${workspaceYamlPath}`,);

  return combined;
}

//endregion Public API
