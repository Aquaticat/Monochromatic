#!/usr/bin/env bun

/**
 * Tightens monorepo root `package.json` catalog `>=x.y.z` ranges
 * to match the versions actually installed in `node_modules`.
 *
 * Only touches entries in the default `workspaces.catalog` object
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

/** Absolute path to the root package.json. */
const packageJsonPath = join(monorepoRoot, 'package.json',);

/** Raw content of package.json, preserved for minimal-diff rewriting. */
const packageJsonContent = readFileSync(packageJsonPath, 'utf8',);

/** Parsed root package.json. */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- root package.json structure is well-known
const packageJson = JSON.parse(packageJsonContent,) as {
  workspaces?: {
    catalog?: Record<string, string>;
  };
};

/** Workspace catalog mapping package names to version ranges. */
const catalog = packageJson.workspaces?.catalog;
if (catalog === undefined) {
  console.error('No workspaces.catalog found in package.json',);
  process.exitCode = 1;
  throw new Error('No workspaces.catalog found in package.json',);
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
  const npmNames = resolveNpmNames(name, value,);
  /** First npm name candidate whose installed version resolves. */
  const resolved = npmNames
    .map(function probeCandidate(candidate,) {
      return { name: candidate,
        version: readInstalledVersion(candidate, monorepoRoot,), };
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

  if (!isStrictlyGreater(parsed.version, resolved.version,)) {
    alreadyTightCount += 1;
    console.info(
      `OK    ${name}: >=${parsed.version} -- installed ${resolved.version} (already tight)`,
    );
    return;
  }

  /** Tightened version range using the installed version as the lower bound. */
  const newRange = `${parsed.prefix}>=${resolved.version}`;
  results.push({ name, oldRange: value, newRange, },);
  console.info(`TIGHT ${name}: ${value} -> ${newRange} (installed ${resolved.version})`,);
},);

//region Write results

if (results.length === 0)
  console.info('\nNo catalog entries to tighten.',);
else if (dryRun)
  console.info(`\nDry run: ${String(results.length,)} entries would be tightened.`,);
else {
  /**
   * Rewrite package.json using string replacement to preserve formatting.
   * Each catalog entry is replaced individually to avoid touching unrelated content.
   */
  const rewritten = results.reduce(
    function applyTightening(acc, { name, oldRange, newRange, },) {
      return acc.replace(`"${name}": "${oldRange}"`, `"${name}": "${newRange}"`,);
    },
    packageJsonContent,
  );

  writeFileSync(packageJsonPath, rewritten,);
  console.info(`\nWrote ${String(results.length,)} tightened entries to package.json.`,);
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
