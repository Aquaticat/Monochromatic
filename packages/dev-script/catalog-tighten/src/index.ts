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
function parseCatalogFromYaml(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const catalogMatch = content.match(/^catalog:\s*\n((?:[ \t]+.+\n)*)/m,);
  if (catalogMatch === null) return result;
  const catalogBlock = catalogMatch[1];
  if (catalogBlock === undefined) return result;
  const entryPattern = /^\s+"?([^":]+)"?\s*:\s*"?([^"\n]+)"?\s*$/gm;
  let match = entryPattern.exec(catalogBlock,);
  while (match !== null) {
    const name = match[1];
    const value = match[2];
    if (name !== undefined && value !== undefined) {
      result[name] = value;
    }
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

/** Collected tightening results for the summary log. */
const results: TightenResult[] = [];

/** Count of entries skipped (not `>=` ranges). */
let skippedCount = 0;

/** Count of entries where the installed version matched the catalog range (already tight). */
let alreadyTightCount = 0;

/** Count of entries where the package was not found in node_modules. */
let notFoundCount = 0;

/** Classifies and processes each catalog entry for tightening. */
Object.entries(catalog,).forEach(function processEntry([name, value,],) {
  /** Parsed range prefix and version, or `undefined` if not a `>=` range. */
  const parsed = parseRange(value,);
  if (parsed === undefined) {
    skippedCount += 1;
    console.info(`SKIP  ${name}: ${value} (not a >= range)`,);
    return;
  }

  /** Candidate npm package names to probe in node_modules. */
  const npmNames = resolveNpmNames(
    name,
    value,
  );
  /** First npm name candidate whose installed version resolves. */
  const resolved = npmNames
    .map(function probeCandidate(candidate,) {
      return {
        name: candidate,
        version: readInstalledVersion(candidate, monorepoRoot,),
      };
    },)
    .find(function hasVersion(r,) {
      return r.version !== undefined;
    },);

  if (resolved === undefined || resolved.version === undefined) {
    notFoundCount += 1;
    console.warn(
      `MISS  ${name}: not found in node_modules (tried ${npmNames.join(', ',)})`,
    );
    return;
  }

  if (!isStrictlyGreater(
    parsed.version,
    resolved.version,
  )) {
    alreadyTightCount += 1;
    console.info(
      `OK    ${name}: >=${parsed.version} -- installed ${resolved.version} (already tight)`,
    );
    return;
  }

  /** Tightened version range using the installed version as the lower bound. */
  const newRange = `${parsed.prefix}>=${resolved.version}`;
  results.push({
    name,
    oldRange: value,
    newRange,
  },);
  console.info(`TIGHT ${name}: ${value} -> ${newRange} (installed ${resolved.version})`,);
},);

//region Write results

if (results.length === 0)
  console.info('\nNo catalog entries to tighten.',);
else if (dryRun)
  console.info(`\nDry run: ${String(results.length,)} entries would be tightened.`,);
else {
  /**
   * Rewrite pnpm-workspace.yaml using string replacement to preserve formatting.
   * Each catalog entry is replaced individually to avoid touching unrelated content.
   * Handles both quoted (`">=1.2.3"`) and unquoted (`>=1.2.3`) YAML values.
   */
  const rewritten = results.reduce(
    function applyTightening(
      acc,
      { name, oldRange, newRange, },
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
  console.info(`\nWrote ${String(results.length,)} tightened entries to pnpm-workspace.yaml.`,);
}

//endregion Write results

//region Summary

console.info(`\nSummary:`,);
console.info(`  Tightened: ${String(results.length,)}`,);
console.info(`  Already tight: ${String(alreadyTightCount,)}`,);
console.info(`  Skipped (not >=): ${String(skippedCount,)}`,);
console.info(`  Not found: ${String(notFoundCount,)}`,);

//endregion Summary

//endregion Main
