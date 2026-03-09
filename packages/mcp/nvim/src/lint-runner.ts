import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { Diagnostic } from "./nvim-client.ts";

//region Types -- oxlint JSON output shape

/**
 * Span location within a single diagnostic label.
 *
 * @example
 * ```ts
 * const span: OxlintSpan = { offset: 100, length: 20, line: 5, column: 3 };
 * ```
 */
type OxlintSpan = {
  readonly offset: number;
  readonly length: number;
  readonly line: number;
  readonly column: number;
};

/**
 * Single label attached to an oxlint diagnostic.
 *
 * @example
 * ```ts
 * const label: OxlintLabel = { span: { offset: 0, length: 10, line: 1, column: 1 } };
 * ```
 */
type OxlintLabel = {
  readonly span: OxlintSpan;
};

/**
 * Single diagnostic entry from oxlint `--format json` output.
 *
 * @example
 * ```ts
 * const entry: OxlintDiagnostic = {
 *   message: "Missing TSDoc comment.",
 *   code: "tsdoc(require-tsdoc)",
 *   severity: "error",
 *   causes: [],
 *   filename: "src/index.ts",
 *   labels: [{ span: { offset: 0, length: 10, line: 1, column: 1 } }],
 *   related: [],
 * };
 * ```
 */
export type OxlintDiagnostic = {
  readonly message: string;
  readonly code: string;
  readonly severity: string;
  readonly causes: readonly string[];
  readonly filename: string;
  readonly labels: readonly OxlintLabel[];
  readonly related: readonly unknown[];
  readonly url?: string;
  readonly help?: string;
};

/**
 * Top-level shape of oxlint `--format json` stdout.
 *
 * @example
 * ```ts
 * const output: OxlintJsonOutput = {
 *   diagnostics: [],
 *   number_of_files: 1,
 *   number_of_rules: 300,
 *   threads_count: 8,
 *   start_time: 0.05,
 * };
 * ```
 */
export type OxlintJsonOutput = {
  readonly diagnostics: readonly OxlintDiagnostic[];
  readonly number_of_files: number;
  readonly number_of_rules: number;
  readonly threads_count: number;
  readonly start_time: number;
};

//endregion Types

//region Severity mapping -- oxlint lowercase to our uppercase format

/** Maps oxlint severity strings to the uppercase format used by editor diagnostics. */
const OXLINT_SEVERITY_MAP: Record<string, string> = {
  error: "ERROR",
  warning: "WARN",
};

//endregion Severity mapping

//region Directory walking -- find config files by walking up the filesystem

/**
 * Walks up from a starting directory to find a file by name.
 *
 * @param startDir - Directory to begin searching from.
 * @param filename - File to locate in ancestor directories.
 *
 * @returns Absolute path to the directory containing the file, or null if not found.
 *
 * @example
 * ```ts
 * const root = findAncestorWithFile("/home/user/project/packages/foo/src", ".oxlintrc.json");
 * // => "/home/user/project"
 * ```
 */
function findAncestorWithFile(startDir: string, filename: string): string | null {
  let current = startDir;
  // eslint-disable-next-line no-constant-condition -- walk up until filesystem root
  while (true) {
    if (existsSync(resolve(current, filename))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

//endregion Directory walking

//region Parsing -- convert oxlint JSON diagnostics to our Diagnostic type

/**
 * Converts a parsed oxlint JSON output into grouped diagnostics keyed by absolute file path.
 * Pure function extracted for testability.
 *
 * @param output - Parsed oxlint JSON output.
 * @param cwd - Working directory used to resolve relative filenames.
 *
 * @returns Map from absolute file path to diagnostics found in that file.
 *
 * @example
 * ```ts
 * const result = parseOxlintOutput(jsonOutput, "/home/user/project");
 * // => Map { "/home/user/project/src/index.ts" => [{ severity: "ERROR", ... }] }
 * ```
 */
export function parseOxlintOutput(output: OxlintJsonOutput, cwd: string): Map<string, Diagnostic[]> {
  const result = new Map<string, Diagnostic[]>();

  for (const entry of output.diagnostics) {
    const span = entry.labels[0]?.span;
    if (span === undefined) {
      continue;
    }

    const absolutePath = resolve(cwd, entry.filename);
    const message = entry.help !== undefined && entry.help.length > 0
      ? `${entry.message} (help: ${entry.help})`
      : entry.message;
    const diagnostic: Diagnostic = {
      severity: OXLINT_SEVERITY_MAP[entry.severity] ?? `UNKNOWN(${entry.severity})`,
      lnum: span.line,
      col: span.column,
      end_lnum: span.line,
      end_col: span.column,
      message,
      source: "oxlint",
      code: entry.code,
    };

    const existing = result.get(absolutePath);
    if (existing !== undefined) {
      existing.push(diagnostic);
    } else {
      result.set(absolutePath, [diagnostic]);
    }
  }

  return result;
}

//endregion Parsing

//region Runner -- spawn oxlint process and collect results

/** Timeout in milliseconds for the oxlint process. */
const OXLINT_TIMEOUT_MS = 10_000;

/**
 * Result from a lint run, including diagnostics and any caveat notes.
 *
 * @example
 * ```ts
 * const result: LintResult = {
 *   diagnostics: new Map(),
 *   notes: ["oxlint ran without --type-aware; some rules may not report."],
 * };
 * ```
 */
export type LintResult = {
  readonly diagnostics: Map<string, Diagnostic[]>;
  readonly notes: readonly string[];
};

/**
 * Runs oxlint on the specified files and returns parsed diagnostics.
 * Groups files by their nearest `tsconfig.json` ancestor for correct `--type-aware` resolution.
 * Falls back to non-type-aware mode with a caveat note when no `tsconfig.json` is found.
 * Returns empty results gracefully when oxlint is unavailable.
 *
 * @param options - Files to lint.
 * @param options.files - Absolute paths to lint.
 *
 * @returns Diagnostics grouped by absolute file path, plus any caveat notes.
 *
 * @example
 * ```ts
 * const result = await runOxlint({ files: ["/home/user/project/src/index.ts"] });
 * ```
 */
export async function runOxlint({ files }: { files: readonly string[] }): Promise<LintResult> {
  if (files.length === 0) {
    return { diagnostics: new Map(), notes: [] };
  }

  const configDir = findAncestorWithFile(dirname(files[0]!), ".oxlintrc.json");
  if (configDir === null) {
    console.error("[mcp-nvim] Could not find .oxlintrc.json in any ancestor directory");
    return { diagnostics: new Map(), notes: [] };
  }
  const configPath = resolve(configDir, ".oxlintrc.json");

  //region Group files by tsconfig ancestor -- each group runs in its own cwd
  const groupsByPackageRoot = new Map<string, string[]>();
  const filesWithoutTsconfig: string[] = [];

  for (const filePath of files) {
    const packageRoot = findAncestorWithFile(dirname(filePath), "tsconfig.json");
    if (packageRoot !== null) {
      const existing = groupsByPackageRoot.get(packageRoot);
      if (existing !== undefined) {
        existing.push(filePath);
      } else {
        groupsByPackageRoot.set(packageRoot, [filePath]);
      }
    } else {
      filesWithoutTsconfig.push(filePath);
    }
  }
  //endregion Group files by tsconfig ancestor

  const merged = new Map<string, Diagnostic[]>();
  const notes: string[] = [];

  //region Run per-package-root invocations with --type-aware
  const packageRuns = [...groupsByPackageRoot.entries()].map(
    async function runPackageOxlint([packageRoot, packageFiles]) {
      return spawnOxlint({
        configPath,
        cwd: packageRoot,
        files: packageFiles,
        typeAware: true,
      });
    },
  );
  //endregion Run per-package-root invocations with --type-aware

  //region Run fallback invocation without --type-aware for orphaned files
  let fallbackRun: Promise<Map<string, Diagnostic[]> | null> = Promise.resolve(null);
  if (filesWithoutTsconfig.length > 0) {
    notes.push(
      "Some files have no tsconfig.json in any ancestor directory; "
      + "oxlint ran without --type-aware for those files and some type-aware rules may not report.",
    );
    fallbackRun = spawnOxlint({
      configPath,
      cwd: configDir,
      files: filesWithoutTsconfig,
      typeAware: false,
    });
  }
  //endregion Run fallback invocation without --type-aware for orphaned files

  const [packageResults, fallbackResult] = await Promise.all([
    Promise.all(packageRuns),
    fallbackRun,
  ]);

  for (const resultMap of packageResults) {
    mergeInto(merged, resultMap);
  }
  if (fallbackResult !== null) {
    mergeInto(merged, fallbackResult);
  }

  return { diagnostics: merged, notes };
}

//endregion Runner

//region Process spawning -- low-level oxlint invocation

/**
 * Spawns a single oxlint process and returns parsed diagnostics.
 *
 * @param options - Spawn configuration.
 * @param options.configPath - Absolute path to `.oxlintrc.json`.
 * @param options.cwd - Working directory for the oxlint process.
 * @param options.files - Absolute file paths to lint.
 * @param options.typeAware - Whether to pass `--type-aware`.
 *
 * @returns Diagnostics grouped by absolute file path.
 */
async function spawnOxlint({ configPath, cwd, files, typeAware }: {
  configPath: string;
  cwd: string;
  files: readonly string[];
  typeAware: boolean;
}): Promise<Map<string, Diagnostic[]>> {
  const args = [
    "--format", "json",
    "-c", configPath,
    ...(typeAware ? ["--type-aware"] : []),
    ...files,
  ];

  try {
    const proc = Bun.spawn(["oxlint", ...args], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });

    const timeoutId = setTimeout(() => {
      proc.kill();
    }, OXLINT_TIMEOUT_MS);

    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    clearTimeout(timeoutId);

    // oxlint exits non-zero when it finds diagnostics, which is expected
    if (stdout.trim().length === 0) {
      console.error(`[mcp-nvim] oxlint produced no output (exit code ${exitCode})`);
      return new Map();
    }

    const parsed = JSON.parse(stdout) as OxlintJsonOutput;
    return parseOxlintOutput(parsed, cwd);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[mcp-nvim] Failed to run oxlint: ${message}`);
    return new Map();
  }
}

//endregion Process spawning

//region Utilities -- map merging

/**
 * Merges diagnostics from a source map into a target map, mutating target in place.
 *
 * @param target - Map to merge into.
 * @param source - Map to merge from.
 */
function mergeInto(target: Map<string, Diagnostic[]>, source: Map<string, Diagnostic[]>): void {
  for (const [filePath, diagnostics] of source) {
    const existing = target.get(filePath);
    if (existing !== undefined) {
      existing.push(...diagnostics);
    } else {
      target.set(filePath, [...diagnostics]);
    }
  }
}

//endregion Utilities
