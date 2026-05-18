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

/**
 * Collects the contiguous block of indented (space/tab-leading) non-empty
 * lines starting at `from`. Mirrors `((?:[ \t]+.+\n)*)` against a
 * line-oriented input: every member line must begin with space/tab and
 * contain at least one further char before its trailing `\n`.
 *
 * @param lines - file content split on `\n`
 *
 * @param from - cursor index into `lines`
 *
 * @returns ordered slice of indented entry lines
 */
function collectIndentedBlock({
  lines,
  from,
}: {
  lines: readonly string[];
  from: number;
},): readonly string[] {
  /**
   * Recursive accumulator that stops at the first non-indented or empty
   * line, mirroring the regex's `[ \t]+.+\n` requirement.
   *
   * @param idx - cursor index into `lines`
   *
   * @param acc - lines collected so far
   *
   * @returns final block
   */
  function walk({
    idx,
    acc,
  }: {
    idx: number;
    acc: readonly string[];
  },): readonly string[] {
    if (idx >= lines.length)
      return acc;
    /** Line at the cursor; checked for indented + non-empty before joining the block. */
    const line = lines[idx];
    if (line === undefined)
      return acc;
    /** First character of the line; non-space/tab ends the block. */
    const first = line.charAt(0,);
    if ((line.length === 0) || (!isSpaceOrTab(first,)))
      return acc;
    /** Line body after the leading indent; must be non-empty to count. */
    const rest = line.slice(1,);
    if (rest.length === 0)
      return acc;
    return walk({
      idx: idx + 1,
      acc: [
        ...acc,
        line,
      ],
    },);
  }
  return walk({
    idx: from,
    acc: [],
  },);
}

/**
 * Parsed `key: value` shape from one catalog entry line; `null` for lines
 * that do not match the expected indented `key: value` form.
 */
type CatalogEntry = {
  /** Unquoted key. */
  key: string;
  /** Unquoted value. */
  value: string;
};

/**
 * Strips a single layer of matching ASCII double quotes from `s`. Returns
 * `s` unchanged when the wrapping quotes are not present.
 *
 * @param s - candidate token
 *
 * @returns token with the wrapping quotes removed if any
 */
function unquote(s: string,): string {
  if ((s.length >= 2) && s.startsWith('"',) && s.endsWith('"',)) {
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
 * @returns parsed entry, or `null` when the line shape is unexpected
 */
function parseCatalogEntry(line: string,): CatalogEntry | null {
  /** Whitespace-trimmed line; surrounding indentation and trailing CR/space are dropped. */
  const trimmed = line.trim();
  if (trimmed.length === 0)
    return null;
  /** Position of the colon separator; `-1` indicates a malformed line. */
  const colonIdx = trimmed.indexOf(':',);
  if (colonIdx <= 0)
    return null;
  /** Raw key segment before the colon, trailing whitespace stripped. */
  const rawKey = trimmed
    .slice(
      0,
      colonIdx,
    )
    .trimEnd();
  /** Raw value segment after the colon, surrounding whitespace stripped. */
  const rawValue = trimmed.slice(colonIdx + 1,).trim();
  /** Key with one layer of wrapping quotes removed if present. */
  const key = unquote(rawKey,);
  /** Value with one layer of wrapping quotes removed if present. */
  const value = unquote(rawValue,);
  if ((key.length === 0) || (value.length === 0))
    return null;
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
 */
function parseCatalogFromYaml(content: string,): Record<string, string> {
  /** Content split into lines; preserves the file's order so the regex anchor semantics translate cleanly. */
  const lines = content.split('\n',);
  /** Index of the first line whose trimmed-right form is exactly `catalog:`; `-1` ends the search. */
  const headerIdx = lines.findIndex(function isCatalogHeader(line,): boolean {
    return line.trimEnd() === 'catalog:';
  },);
  if (headerIdx === (-1))
    return {};
  /** Indented body of the `catalog:` block; each line is one `name: range` entry. */
  const block = collectIndentedBlock({
    lines,
    from: headerIdx + 1,
  },);
  return block.reduce(
    function appendEntry(
      acc: Record<string, string>,
      line,
    ): Record<string, string> {
      /** Parsed entry; `null` when the line shape does not match the catalog convention. */
      const entry = parseCatalogEntry(line,);
      if (entry === null)
        return acc;
      acc[entry.key] = entry.value;
      return acc;
    },
    {},
  );
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
