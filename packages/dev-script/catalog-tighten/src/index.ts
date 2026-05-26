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
  ABSENT,
  type Maybe,
} from './maybe.ts';
import {
  isStrictlyGreater,
  type ParsedRange,
  parseRange,
  readInstalledVersion,
  resolveNpmNames,
} from './version.ts';
import {
  parseCatalogFromYaml,
} from './yaml-parse.ts';

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

/**
 * One npm-name probe paired with its resolved installed version.
 *
 * Annotating the probe shape keeps `version` as `Maybe<string>` instead of
 * letting the `.map` object literal widen the {@link ABSENT} sentinel to the
 * general `symbol` type, which would block the later `=== ABSENT` narrowing.
 */
type ProbedCandidate = {
  /** npm name that was looked up in node_modules. */
  name: string;
  /** Installed version, or {@link ABSENT} when this name did not resolve. */
  version: Maybe<string>;
};

//endregion Types

//region Main

/** Whether `--dry-run` was passed on the command line. */
const dryRun = process.argv
  .includes('--dry-run',);

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
 * Returns true when every char in `s` is ASCII whitespace (space, tab,
 * newline, carriage return, form feed, vertical tab). Empty strings are
 * vacuously whitespace-only, matching `\s*$` semantics for a blank trailing
 * tail.
 *
 * @param s - candidate string
 *
 * @returns whether `s` consists solely of whitespace
 */
function isWhitespaceOnly(s: string,): boolean {
  for (const c of s) {
    /** Whether the current char satisfies regex `\s`. */
    const ok = (c === ' ')
      || (c === '\t')
      || (c === '\n')
      || (c === '\r')
      || (c === '\f')
      || (c === '\v');
    if (!ok)
      return false;
  }
  return true;
}

/** Workspace catalog mapping package names to version ranges. */
const catalog = parseCatalogFromYaml(workspaceYamlContent,);
if (Object.keys(catalog,)
  .length
  === 0) {
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

/** Catalog as `[name, value]` entry pairs, folded into the per-category summary below. */
const catalogEntries = Object.entries(catalog,);
/** Classifies and processes each catalog entry for tightening. */
const summary: CatalogSummary = catalogEntries.reduce(
  function processEntry(
    acc,
    [name, value,],
  ): CatalogSummary {
    /** Parsed range prefix and version, or `ABSENT` if not a `>=` range. */
    const parsed = parseRange(value,);
    if (parsed === ABSENT) {
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
      .map(function probeCandidate(candidate,): ProbedCandidate {
        return {
          name: candidate,
          version: readInstalledVersion({
            npmName: candidate,
            monorepoRoot,
          },),
        };
      },)
      .find(function hasVersion(r,) {
        return r.version
          !== ABSENT;
      },);

    if ((resolved === undefined) || (resolved.version
      === ABSENT)) {
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
    acc.results
      .push({
      name,
      oldRange: value,
      newRange,
    },);
    return acc;
  },
  initialSummary,
);

//region Write results

if (summary.results
  .length
  === 0)
  console.info('\nNo catalog entries to tighten.',);
else if (dryRun) {
  console.info(
    `\nDry run: ${String(summary.results
      .length,)} entries would be tightened.`,
  );
}
else {
  /**
   * Rewrite pnpm-workspace.yaml using string replacement to preserve formatting.
   * Each catalog entry is replaced individually to avoid touching unrelated content.
   * Handles both quoted (`">=1.2.3"`) and unquoted (`>=1.2.3`) YAML values.
   */
  const rewritten = summary.results
    .reduce(
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
      String(summary.results
        .length,)
    } tightened entries to pnpm-workspace.yaml.`,
  );
}

//endregion Write results

//region Summary

console.info(`\nSummary:`,);
console.info(`  Tightened: ${String(summary.results
  .length,)}`,);
console.info(`  Already tight: ${String(summary.alreadyTightCount,)}`,);
console.info(`  Skipped (not >=): ${String(summary.skippedCount,)}`,);
console.info(`  Not found: ${String(summary.notFoundCount,)}`,);

//endregion Summary

//endregion Main
