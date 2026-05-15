#!/usr/bin/env bun

/**
 * Tightens monorepo `pnpm-workspace.yaml` catalog `>=x.y.z` ranges
 * to match the versions actually installed in `node_modules`.
 *
 * Only touches entries in the default `catalog` object
 * whose range starts with `>=`. Entries using `*`, exact versions,
 * GitHub references, or named catalogs are skipped.
 *
 * @example
 * ```sh
 * bun packages/dev-script/catalog-tighten/src/index.ts
 * bun packages/dev-script/catalog-tighten/src/index.ts --dry-run
 * ```
 */

import {
  readFileSync,
  writeFileSync,
} from 'node:fs';
import {
  join,
  resolve,
} from 'node:path';

import {
  isStrictlyGreater,
  type ParsedRange,
  parseRange,
  readInstalledVersion,
  resolveNpmNames,
} from './version.ts';

export {};

//region Types

/**
 * Result of comparing catalog range against installed version.
 */
type TightenResult = {
  /** Package name as it appears in the catalog key. */
  name: string;
  /** Original catalog range string, e.g. `">=1.2.0"`. */
  oldRange: string;
  /** New tightened range string, e.g. `">=1.3.0"`. */
  newRange: string;
};

//endregion Types

//region Main

/** Whether `--dry-run` was passed on the command line. */
const dryRun = process.argv.includes('--dry-run',);

/** Absolute path to the monorepo root (where this script is invoked from). */
const monorepoRoot = resolve('.',);

/** Absolute path to pnpm-workspace.yaml. */
const workspaceYamlPath = join(
  monorepoRoot,
  'pnpm-workspace.yaml',
);

/** Raw content of pnpm-workspace.yaml, preserved for minimal-diff rewriting. */
const workspaceYamlContent = readFileSync(
  workspaceYamlPath,
  'utf8',
);

/**
 * Extracts `catalog:` entries from pnpm-workspace.yaml using regex.
 * Avoids a YAML parser dependency for this simple key-value structure.
 * Matches lines like `  "package-name": ">=1.2.3"` or `  package-name: ">=1.2.3"` under `catalog:`.
 *
 * @param content - Raw YAML file content to parse.
 *
 * @returns Map of package names to version range strings found under the `catalog:` section.
 */
function parseCatalogFromYaml(content: string,): Record<string, string> {
  /** Accumulator mapping each catalog package name to its raw range value; mutated in place during scanning. */
  const result: Record<string, string> = {};
  /** Block-level match locating the `catalog:` section and capturing its indented body for entry scanning. */
  const catalogMatch = /^catalog:\s*\n((?:[ \t]+.+\n)*)/m.exec(content,);
  if (catalogMatch === null)
    return result;
  /** Indented body of the `catalog:` block; each line inside is one `name: range` entry. */
  const [, catalogBlock,] = catalogMatch;
  if (catalogBlock === undefined)
    return result;
  /** Stateful regex over the catalog block; the `g` flag advances `lastIndex` across `.exec` calls. */
  const entryPattern = /^\s+"?([^":]+)"?\s*:\s*"?([^"\n]+)"?\s*$/gm;
  /** Current entry match; `null` ends the scan loop. */
  let match = entryPattern.exec(catalogBlock,);
  while (match !== null) {
    /** Package name and version range captured from one entry line. */
    const [, name, value,] = match;
    if ((name !== undefined) && (value !== undefined))
      result[name] = value;
    match = entryPattern.exec(catalogBlock,);
  }
  return result;
}

/** Workspace catalog mapping package names to version ranges. */
const catalog = parseCatalogFromYaml(workspaceYamlContent,);
if (Object.keys(catalog,).length === 0) {
  console.error('No catalog found in pnpm-workspace.yaml',);
  process.exitCode = 1;
  throw new Error('No catalog found in pnpm-workspace.yaml',);
}

/**
 * Aggregated outcome of processing every catalog entry.
 *
 * Folded by `Array.reduce` over `Object.entries(catalog)` so the per-category
 * counters and `results` accumulator live on the same object instead of as
 * module-root `let` bindings.
 */
type CatalogSummary = {
  /** Tightening results to write back to `pnpm-workspace.yaml`. */
  results: TightenResult[];
  /** Count of entries skipped (not `>=` ranges). */
  skippedCount: number;
  /** Count of entries where the installed version matched the catalog range (already tight). */
  alreadyTightCount: number;
  /** Count of entries where the package was not found in node_modules. */
  notFoundCount: number;
};

/** Initial summary fed into the reduce; every counter starts at zero with an empty result list. */
const initialSummary: CatalogSummary = {
  results: [],
  skippedCount: 0,
  alreadyTightCount: 0,
  notFoundCount: 0,
};

/** Classifies and processes each catalog entry for tightening. */
const summary: CatalogSummary = Object.entries(catalog,).reduce(
  function processEntry(
    acc,
    [name, value,],
  ): CatalogSummary {
    /** Parsed range prefix and version, or `undefined` if not a `>=` range. */
    const parsed = parseRange(value,);
    if (parsed === undefined) {
      console.info(`SKIP  ${name}: ${value} (not a >= range)`,);
      acc.skippedCount += 1;
      return acc;
    }

    /** Candidate npm package names to probe in node_modules. */
    const npmNames = resolveNpmNames({
      catalogKey: name,
      catalogValue: value,
    },);
    /** First npm name candidate whose installed version resolves. */
    const resolved = npmNames
      .map(function probeCandidate(candidate,) {
        return {
          name: candidate,
          version: readInstalledVersion({
            npmName: candidate,
            monorepoRoot,
          },),
        };
      },)
      .find(function hasVersion(r,) {
        return r.version !== undefined;
      },);

    if ((resolved === undefined) || (resolved.version === undefined)) {
      console.warn(
        `MISS  ${name}: not found in node_modules (tried ${npmNames.join(', ',)})`,
      );
      acc.notFoundCount += 1;
      return acc;
    }

    if (!isStrictlyGreater({
      cataloged: parsed.version,
      installed: resolved.version,
    },)) {
      console.info(
        `OK    ${name}: >=${parsed.version} -- installed ${resolved.version} (already tight)`,
      );
      acc.alreadyTightCount += 1;
      return acc;
    }

    /** Tightened version range using the installed version as the lower bound. */
    const newRange = `${parsed.prefix}>=${resolved.version}`;
    console.info(
      `TIGHT ${name}: ${value} -> ${newRange} (installed ${resolved.version})`,
    );
    acc.results.push({
      name,
      oldRange: value,
      newRange,
    },);
    return acc;
  },
  initialSummary,
);

//region Write results

if (summary.results.length === 0)
  console.info('\nNo catalog entries to tighten.',);
else if (dryRun) {
  console.info(
    `\nDry run: ${String(summary.results.length,)} entries would be tightened.`,
  );
}
else {
  /**
   * Rewrite pnpm-workspace.yaml using string replacement to preserve formatting.
   * Each catalog entry is replaced individually to avoid touching unrelated content.
   * Handles both quoted (`">=1.2.3"`) and unquoted (`>=1.2.3`) YAML values.
   */
  const rewritten = summary.results.reduce(
    function applyTightening(
      acc,
      {
        name,
        oldRange,
        newRange,
      },
    ) {
      return acc
        .replace(
          `"${name}": "${oldRange}"`,
          `"${name}": "${newRange}"`,
        )
        .replace(
          `"${name}": ${oldRange}`,
          `"${name}": "${newRange}"`,
        );
    },
    workspaceYamlContent,
  );

  writeFileSync(
    workspaceYamlPath,
    rewritten,
  );
  console.info(
    `\nWrote ${
      String(summary.results.length,)
    } tightened entries to pnpm-workspace.yaml.`,
  );
}

//endregion Write results

//region Summary

console.info(`\nSummary:`,);
console.info(`  Tightened: ${String(summary.results.length,)}`,);
console.info(`  Already tight: ${String(summary.alreadyTightCount,)}`,);
console.info(`  Skipped (not >=): ${String(summary.skippedCount,)}`,);
console.info(`  Not found: ${String(summary.notFoundCount,)}`,);

//endregion Summary

//endregion Main
