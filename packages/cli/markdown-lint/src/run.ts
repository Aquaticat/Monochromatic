import {
  readFile,
  stat,
} from 'node:fs/promises';
import { relative, } from 'node:path';

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';

import { fixSource, } from './fix.ts';
import { runRules, } from './lint.ts';
import {
  report,
  type FileReport,
  type ReporterName,
} from './reporters.ts';
import { rules, } from './rules/index.ts';
import type { Diagnostic, } from './types.ts';
import {
  discoverFiles,
  type DiscoveredFile,
  explicitFile,
} from './walk-files.ts';
import { writeFileAtomically, } from './write-file-atomically.ts';

/**
 * Bytes per kibibyte, for the size cap.
 */
const BYTES_PER_KIB = 1_024;

/**
 * Largest file the linter reads, in kibibytes. A Markdown file this large is
 * implausible in this corpus; the cap is a backstop so a pathological input is
 * skipped rather than read whole into memory.
 */
const MAX_FILE_KIB = 5_120;

/**
 * Largest file the linter reads, in bytes.
 */
const MAX_FILE_BYTES = MAX_FILE_KIB * BYTES_PER_KIB;

/**
 * Synthetic rule ID for a file that could not be processed. Reporting it as a
 * diagnostic lets one bad file fail the run without aborting sibling writes.
 */
const PROCESSING_ERROR_RULE_ID = 'markdown-lint-error';

/**
 * Synthetic rule ID for safety checks that block a risky autofix write.
 */
const SAFETY_RULE_ID = 'markdown-lint-safety';

/**
 * One path argument classified into the directory roots and explicit files it
 * contributes. A path is exactly one or the other, but both lists keep the
 * shape uniform so callers `flatMap` without a nullish union.
 */
type PathClassification = {
  /**
   * Directory roots to walk (one entry for a directory argument, else none).
   */
  readonly dirs: readonly string[];
  /**
   * Explicit files (a lintable file argument, else none).
   */
  readonly files: readonly DiscoveredFile[];
};

/**
 * One processed file: its report and whether `--fix` rewrote it. A processing
 * step returns zero or one of these so callers `flat()` rather than filter a
 * nullable.
 */
type ProcessedEntry = {
  /**
   * Per-file report.
   */
  readonly report: FileReport;
  /**
   * Whether the file was rewritten by `--fix`.
   */
  readonly fixed: boolean;
};

/**
 * Source read from a file plus the mode that should be preserved if the file is
 * atomically replaced after fixes.
 */
type ReadSource = {
  /**
   * File contents.
   */
  readonly source: string;
  /**
   * Original file mode, including permission bits.
   */
  readonly mode: number;
};

/**
 * Parameters for {@link fileStartDiagnostic}.
 */
type FileStartDiagnosticParams = {
  /**
   * Synthetic rule identifier.
   */
  readonly ruleId: string;
  /**
   * Diagnostic message.
   */
  readonly message: string;
};

/**
 * Resolve the CLI's path arguments into discovered files: a directory argument
 * (or no argument, defaulting to the current directory) is walked with
 * gitignore filtering, while a file argument is taken explicitly. Paths are
 * classified concurrently.
 *
 * @param paths - path arguments, empty to walk the current directory
 *
 * @returns lintable files to process, deduplicated by absolute path
 */
async function resolveFiles(paths: readonly string[],): Promise<readonly DiscoveredFile[]> {
  /**
   * Paths to process, defaulting to the current directory when none are given.
   */
  const effectivePaths = paths.length === 0
    ? ['.',]
    : paths;
  /**
   * Each path classified into the dirs and files it contributes.
   */
  const classified = await Promise.all(effectivePaths.map(
    async function classify(path: string,): Promise<PathClassification> {
      /**
       * Whether this path is a directory.
       */
      const isDir = (await stat(path,)).isDirectory();
      return isDir
        ? {
          dirs: [path,],
          files: [],
        }
        : {
          dirs: [],
          files: explicitFile(path,),
        };
    },
  ),);
  /**
   * Directory roots to walk.
   */
  const dirs = classified.flatMap(function pickDirs(entry: PathClassification,): readonly string[] {
    return entry.dirs;
  },);
  /**
   * Explicitly named files, which bypass the gitignore walk.
   */
  const explicitFiles = classified.flatMap(function pickFiles(entry: PathClassification,): readonly DiscoveredFile[] {
    return entry.files;
  },);
  /**
   * Files discovered by walking the directory roots.
   */
  const walked = await discoverFiles(dirs,);
  /**
   * All files keyed by absolute path so explicit and walked sets do not double up.
   */
  const byPath = new Map<string, DiscoveredFile>();
  for (const file of [
    ...walked,
    ...explicitFiles,
  ]) {
    byPath.set(
      file.path,
      file,
    );
  }
  return [...byPath.values(),];
}

/**
 * Read a file's source unless it exceeds the size cap. Returns a one-element
 * list when read, empty when skipped for size, so callers destructure rather
 * than handle a nullable. The walk already restricts reads to `.md`/`.mdx`, so
 * this only guards against a single pathologically large file.
 *
 * @param path - file to read
 *
 * @returns the source as a one-element list, or empty when over the size cap
 */
async function readBoundedSource(path: string,): Promise<readonly ReadSource[]> {
  /**
   * File metadata used for the size guard and mode preservation.
   */
  const fileStat = await stat(path,);
  if (fileStat.size > MAX_FILE_BYTES) {
    return [];
  }
  return [{
    source: await readFile(
      path,
      'utf8',
    ),
    mode: fileStat.mode,
  },];
}

/**
 * Order diagnostics by source position so the report reads top-to-bottom even
 * though rules run in their own order.
 *
 * @param diagnostics - diagnostics for one file
 *
 * @returns diagnostics sorted by line then column
 */
function byPosition(diagnostics: readonly Diagnostic[],): readonly Diagnostic[] {
  return diagnostics.toSorted(function compare(
    left: Diagnostic,
    right: Diagnostic,
  ): number {
    return (left.line - right.line) || (left.column - right.column);
  },);
}

/**
 * Create a synthetic diagnostic at the start of a file.
 *
 * @param ruleId - synthetic rule identifier
 *
 * @param message - diagnostic message
 *
 * @returns diagnostic anchored at line 1, column 1
 */
function fileStartDiagnostic({
  ruleId,
  message,
}: FileStartDiagnosticParams,): Diagnostic {
  return {
    ruleId,
    message,
    line: 1,
    column: 1,
  };
}

/**
 * Diagnostic for a file-processing failure.
 *
 * @param error - value caught from file processing
 *
 * @returns synthetic diagnostic for the report
 *
 * @mutates error - `caughtValueText` may invoke string-conversion hooks.
 */
function processingErrorDiagnostic(error: unknown,): Diagnostic {
  /**
   * Error text preserving empty-message class names from existing CLI output.
   */
  const errorText = Error.isError(error,) && (error.message === '')
    ? error.constructor
      .name
    : caughtValueText(error,);
  return fileStartDiagnostic({
    ruleId: PROCESSING_ERROR_RULE_ID,
    message: `Could not process file: ${errorText}`,
  },);
}

/**
 * Diagnostic for a fixpoint result that would erase a non-empty file.
 *
 * @returns synthetic diagnostic for the report
 */
function emptyRewriteDiagnostic(): Diagnostic {
  return fileStartDiagnostic({
    ruleId: SAFETY_RULE_ID,
    message: 'Autofix would replace non-empty file with empty output; leaving file unchanged.',
  },);
}

/**
 * Parameters for {@link run}.
 */
export type RunParams = {
  /**
   * Path arguments (files or directories); empty walks the current directory.
   */
  readonly paths: readonly string[];
  /**
   * Whether to apply fixes in place.
   */
  readonly fix: boolean;
  /**
   * Reporter for the rendered output.
   */
  readonly reporter: ReporterName;
  /**
   * Directory the display paths are made relative to.
   */
  readonly cwd: string;
};

/**
 * Result of {@link run}.
 */
export type RunResult = {
  /**
   * Rendered report for the chosen reporter.
   */
  readonly output: string;
  /**
   * Whether any unfixed violation remains (drives the exit code).
   */
  readonly hadViolations: boolean;
  /**
   * Number of files rewritten by `--fix`.
   */
  readonly fixedFiles: number;
};

/**
 * Lint (or fix) every resolved file and render a report. With `fix`, each file
 * is run through the fixpoint loop and rewritten only when its content changed;
 * the reported diagnostics are then whatever remains unfixed. Display paths are
 * relativized to `cwd`.
 *
 * @param paths - path arguments (files or directories)
 *
 * @param fix - whether to apply fixes in place
 *
 * @param reporter - reporter for the rendered output
 *
 * @param cwd - directory the display paths are made relative to
 *
 * @returns rendered report, whether violations remain, and how many files were fixed
 *
 * @example
 * ```ts
 * await run({ paths: ['docs'], fix: false, reporter: 'pretty', cwd: process.cwd() });
 * ```
 */
export async function run({
  paths,
  fix,
  reporter,
  cwd,
}: RunParams,): Promise<RunResult> {
  /**
   * Files to lint or fix.
   */
  const files = await resolveFiles(paths,);
  /**
   * One processed entry per non-skipped file, built concurrently.
   */
  const present = (await Promise.all(files.map(
    async function processFile(file: DiscoveredFile,): Promise<readonly ProcessedEntry[]> {
      /**
       * Display path relative to the working directory.
       */
      const displayPath = relative(
        cwd,
        file.path,
      );
      try {
        /**
         * File source as a one-element list, empty when skipped for size.
         */
        const [readSource,] = await readBoundedSource(file.path,);
        if (readSource === undefined) {
          return [];
        }
        /**
         * Source text and mode for the file being processed.
         */
        const {
          source,
          mode,
        } = readSource;
        if (!fix) {
          return [{
            report: {
              path: displayPath,
              diagnostics: byPosition(runRules({
                rules,
                source,
                mdx: file.mdx,
              },),),
            },
            fixed: false,
          },];
        }
        /**
         * Source and remaining diagnostics after the fixpoint loop.
         */
        const fixed = fixSource({
          rules,
          source,
          mdx: file.mdx,
        },);
        if ((source !== '') && (fixed.source === '')) {
          return [{
            report: {
              path: displayPath,
              diagnostics: [emptyRewriteDiagnostic(),],
            },
            fixed: false,
          },];
        }
        if (fixed.source !== source) {
          await writeFileAtomically({
            path: file.path,
            source: fixed.source,
            mode,
          },);
        }
        return [{
          report: {
            path: displayPath,
            diagnostics: byPosition(fixed.diagnostics,),
          },
          fixed: fixed.source !== source,
        },];
      } catch (error) {
        return [{
          report: {
            path: displayPath,
            diagnostics: [processingErrorDiagnostic(error,),],
          },
          fixed: false,
        },];
      }
    },
  ),)).flat();
  /**
   * Per-file reports that actually carry diagnostics, sorted by path.
   */
  const reports = present
    .map(function toReport(entry: ProcessedEntry,): FileReport {
      return entry.report;
    },)
    .filter(function hasDiagnostics(fileReport: FileReport,): boolean {
      return fileReport.diagnostics
        .length
        > 0;
    },)
    .toSorted(function byPath(
      left: FileReport,
      right: FileReport,
    ): number {
      return left.path < right.path
        ? -1
        : left.path > right.path
        ? 1
        : 0;
    },);
  return {
    output: report({
      reporter,
      files: reports,
    },),
    hadViolations: reports.length > 0,
    fixedFiles: present
      .filter(function wasFixed(entry: ProcessedEntry,): boolean {
        return entry.fixed;
      },)
      .length,
  };
}
