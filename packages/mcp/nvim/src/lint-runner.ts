/**
 * Oxlint lint runner.
 *
 * Orchestrates oxlint invocations across files grouped by their
 * nearest `tsconfig.json` ancestor for correct `--type-aware` resolution.
 *
 * @module
 */

import {
  dirname,
  resolve,
} from 'node:path';

import type { Diagnostic, } from './nvim-client.ts';
import { findAncestorWithFile, } from './oxlint-parse.ts';
import { spawnOxlint, } from './oxlint-spawn.ts';

//region Types -- lint result shape

/**
 * Result from a lint run, including diagnostics and any caveat notes.
 *
 * @example
 * ```ts
 * const result: LintResult = {
 *
 *   diagnostics: new Map(),
 *
 *   notes: ["oxlint ran without --type-aware; some rules may not report."],
 * };
 * ```
 */
export type LintResult = {
  readonly diagnostics: Map<string, Diagnostic[]>;
  readonly notes: readonly string[];
};

//endregion Types

//region Runner -- orchestrate oxlint across file groups

/**
 * Runs oxlint on the specified files and returns parsed diagnostics.
 * Groups files by their nearest `tsconfig.json` ancestor for correct `--type-aware` resolution.
 * Falls back to non-type-aware mode with a caveat note when no `tsconfig.json` is found.
 * Returns empty results gracefully when oxlint is unavailable.
 *
 * @param files - Absolute paths to lint.
 *
 * @returns Diagnostics grouped by absolute file path, plus any caveat notes.
 *
 * @example
 * ```ts
 * const result = await runOxlint({ files: ["/home/user/project/src/index.ts"] });
 * ```
 */
export async function runOxlint(
  { files, }: { files: readonly string[]; },
): Promise<LintResult> {
  if (files.length === 0) {
    return {
      diagnostics: new Map(),
      notes: [],
    };
  }

  /** First file's directory as starting point for config search. */
  const [firstFile,] = files;
  if (firstFile === undefined) {
    return {
      diagnostics: new Map(),
      notes: [],
    };
  }
  const configDir = findAncestorWithFile(
    dirname(firstFile,),
    '.oxlintrc.json',
  );
  if (configDir === null) {
    console.error('[mcp-nvim] Could not find .oxlintrc.json in any ancestor directory',);
    return {
      diagnostics: new Map(),
      notes: [],
    };
  }
  const configPath = resolve(
    configDir,
    '.oxlintrc.json',
  );

  //region Group files by tsconfig ancestor -- each group runs in its own cwd
  const groupsByPackageRoot = new Map<string, string[]>();
  const filesWithoutTsconfig: string[] = [];

  for (const filePath of files) {
    const packageRoot = findAncestorWithFile(
      dirname(filePath,),
      'tsconfig.json',
    );
    if (packageRoot !== null) {
      const existing = groupsByPackageRoot.get(packageRoot,);
      if (existing !== undefined)
        existing.push(filePath,);
      else {
        groupsByPackageRoot.set(
          packageRoot,
          [filePath,],
        );
      }
    }
    else {
      filesWithoutTsconfig.push(filePath,);
    }
  }
  //endregion Group files by tsconfig ancestor

  const merged = new Map<string, Diagnostic[]>();
  const notes: string[] = [];

  //region Run per-package-root invocations with --type-aware
  const packageRuns = [...groupsByPackageRoot.entries(),].map(
    function runPackageOxlint([packageRoot, packageFiles,],) {
      return spawnOxlint({
        configPath,
        cwd: packageRoot,
        files: packageFiles,
        typeAware: true,
      },);
    },
  );
  //endregion Run per-package-root invocations with --type-aware

  //region Run fallback invocation without --type-aware for orphaned files
  // oxlint-disable-next-line promise/prefer-await-to-then -- initial value for conditional Promise.all
  let fallbackRun: Promise<Map<string, Diagnostic[]> | null> = Promise.resolve(null,);
  if (filesWithoutTsconfig.length > 0) {
    notes.push(
      'Some files have no tsconfig.json in any ancestor directory; '
        + 'oxlint ran without --type-aware for those files and some type-aware rules may not report.',
    );
    fallbackRun = spawnOxlint({
      configPath,
      cwd: configDir,
      files: filesWithoutTsconfig,
      typeAware: false,
    },);
  }
  //endregion Run fallback invocation without --type-aware for orphaned files

  const [packageResults, fallbackResult,] = await Promise.all([
    Promise.all(packageRuns,),
    fallbackRun,
  ],);

  for (const resultMap of packageResults) {
    mergeInto(
      merged,
      resultMap,
    );
  }
  if (fallbackResult !== null) {
    mergeInto(
      merged,
      fallbackResult,
    );
  }

  return {
    diagnostics: merged,
    notes,
  };
}

//endregion Runner

//region Utilities -- map merging

/**
 * Merges diagnostics from a source map into a target map, mutating target in place.
 *
 * @param target - Map to merge into.
 *
 * @param source - Map to merge from.
 */
function mergeInto(
  target: Map<string, Diagnostic[]>,
  source: Map<string, Diagnostic[]>,
): void {
  for (const [filePath, diagnostics,] of source) {
    const existing = target.get(filePath,);
    if (existing !== undefined)
      existing.push(...diagnostics,);
    else {
      target.set(
        filePath,
        [...diagnostics,],
      );
    }
  }
}

//endregion Utilities
