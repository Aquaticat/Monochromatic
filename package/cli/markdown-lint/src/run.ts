import {
  readFile,
  stat,
} from 'node:fs/promises';
import {
  relative,
  resolve,
} from 'node:path';

import { discoverLfsImageRepo, } from './lfs-image-context.ts';
import {
  processingErrorDiagnostic,
  processSource,
  renderReports,
  selectRules,
} from './process-source.ts';
import type {
  FileReport,
  ReporterName,
} from './reporters.ts';
import {
  discoverFiles,
  type DiscoveredFile,
  explicitFile,
} from './walk-files.ts';
import { writeFileAtomically, } from './write-file-atomically.ts';

/**
 Bytes per kibibyte, for the size cap.
 */
const BYTES_PER_KIB = 1_024;

/**
 Largest file the linter reads, in kibibytes. A Markdown file this large is
 implausible in this corpus; the cap is a backstop so a pathological input is
 skipped rather than read whole into memory.
 */
const MAX_FILE_KIB = 5_120;

/**
 Largest file the linter reads, in bytes.
 */
const MAX_FILE_BYTES = MAX_FILE_KIB * BYTES_PER_KIB;

/**
 Thrown when a standard-input path is not a lintable Markdown or MDX path;
 the CLI reports it as a usage error.
 */
export class StdinPathError extends Error {
  /**
   @param message - reason the path was rejected
   */
  constructor(message: string,) {
    super(message,);
    this.name = 'StdinPathError';
  }
}

/**
 One path argument classified into the directory roots and explicit files it
 contributes. A path is exactly one or the other, but both lists keep the
 shape uniform so callers `flatMap` without a nullish union.
 */
type PathClassification = {
  /**
   Directory roots to walk (one entry for a directory argument, else none).
   */
  readonly dirs: readonly string[];
  /**
   Explicit files (a lintable file argument, else none).
   */
  readonly files: readonly DiscoveredFile[];
};

/**
 One processed file: its report and whether `--fix` rewrote it. A processing
 step returns zero or one of these so callers `flat()` rather than filter a
 nullable.
 */
type ProcessedEntry = {
  /**
   Per-file report.
   */
  readonly report: FileReport;
  /**
   Whether the file was rewritten by `--fix`.
   */
  readonly fixed: boolean;
};

/**
 Source read from a file plus the mode that should be preserved if the file is
 atomically replaced after fixes.
 */
type ReadSource = {
  /**
   File contents.
   */
  readonly source: string;
  /**
   Original file mode, including permission bits.
   */
  readonly mode: number;
};

/**
 Resolve the CLI's path arguments into discovered files: a directory argument
 (or no argument, defaulting to the current directory) is walked with
 gitignore filtering, while a file argument is taken explicitly. Paths are
 classified concurrently.
 
 @param paths - path arguments, empty to walk the current directory
 
 @returns lintable files to process, deduplicated by absolute path
 */
async function resolveFiles(paths: readonly string[],): Promise<readonly DiscoveredFile[]> {
  /**
   Paths to process, defaulting to the current directory when none are given.
   */
  const effectivePaths = paths.length === 0
    ? ['.',]
    : paths;
  /**
   Each path classified into the dirs and files it contributes.
   */
  const classified = await Promise.all(effectivePaths.map(
    async function classify(path: string,): Promise<PathClassification> {
      /**
       Whether this path is a directory.
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
   Directory roots to walk.
   */
  const dirs = classified.flatMap(function pickDirs(entry: PathClassification,): readonly string[] {
    return entry.dirs;
  },);
  /**
   Explicitly named files, which bypass the gitignore walk.
   */
  const explicitFiles = classified.flatMap(function pickFiles(entry: PathClassification,): readonly DiscoveredFile[] {
    return entry.files;
  },);
  /**
   Files discovered by walking the directory roots.
   */
  const walked = await discoverFiles(dirs,);
  /**
   All files keyed by absolute path so explicit and walked sets do not double up.
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
 Read a file's source unless it exceeds the size cap. Returns a one-element
 list when read, empty when skipped for size, so callers destructure rather
 than handle a nullable. The walk already restricts reads to `.md`/`.mdx`, so
 this only guards against a single pathologically large file.
 
 @param path - file to read
 
 @returns the source as a one-element list, or empty when over the size cap
 */
async function readBoundedSource(path: string,): Promise<readonly ReadSource[]> {
  /**
   File metadata used for the size guard and mode preservation.
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
 Options shared by every entry point.
 */
type CommonRunParams = {
  /**
   Whether to apply fixes.
   */
  readonly fix: boolean;
  /**
   Reporter for the rendered output.
   */
  readonly reporter: ReporterName;
  /**
   Directory the display paths are made relative to and the `.lfsconfig`
   search starts from.
   */
  readonly cwd: string;
  /**
   gitignore-syntax patterns, relative to the repository root, for files the
   `lfs-image-url` rule must leave alone.
   */
  readonly lfsImageExclude?: readonly string[];
  /**
   Rule ids to run; empty runs every rule. Unknown ids are the caller's
   usage error and are validated before this point.
   */
  readonly ruleIds?: readonly string[];
};

/**
 Parameters for {@link run}.
 */
export type RunParams = CommonRunParams & {
  /**
   Path arguments (files or directories); empty walks the current directory.
   */
  readonly paths: readonly string[];
};

/**
 Parameters for {@link runStdin}.
 */
export type RunStdinParams = CommonRunParams & {
  /**
   Repository-relative (or `cwd`-relative) path the source is treated as
   living at, so relative image targets and the MDX flag resolve as they
   would for the real file.
   */
  readonly stdinPath: string;
  /**
   Source read from standard input.
   */
  readonly source: string;
};

/**
 Result of {@link run}.
 */
export type RunResult = {
  /**
   Rendered report for the chosen reporter.
   */
  readonly output: string;
  /**
   Whether any unfixed violation remains (drives the exit code).
   */
  readonly hadViolations: boolean;
  /**
   Number of files rewritten by `--fix`.
   */
  readonly fixedFiles: number;
};

/**
 Result of {@link runStdin}.
 */
export type RunStdinResult = {
  /**
   Rendered report for the chosen reporter.
   */
  readonly output: string;
  /**
   Whether any unfixed violation remains (drives the exit code).
   */
  readonly hadViolations: boolean;
  /**
   Source after fixes; identical to the input without `fix` or when
   nothing changed.
   */
  readonly fixedSource: string;
};

/**
 Lint (or fix) every resolved file and render a report. With `fix`, each file
 is run through the fixpoint loop and rewritten only when its content changed;
 the reported diagnostics are then whatever remains unfixed. Display paths are
 relativized to `cwd`.

 @param paths - path arguments (files or directories)

 @param fix - whether to apply fixes in place

 @param reporter - reporter for the rendered output

 @param cwd - directory the display paths are made relative to

 @param lfsImageExclude - gitignore-syntax patterns for files the `lfs-image-url` rule must leave alone

 @param ruleIds - rule ids to run; empty runs every rule

 @returns rendered report, whether violations remain, and how many files were fixed

 @example
 ```ts
 await run({ paths: ['docs'], fix: false, reporter: 'pretty', cwd: process.cwd() });
 ```
 */
export async function run({
  paths,
  fix,
  reporter,
  cwd,
  lfsImageExclude = [],
  ruleIds = [],
}: RunParams,): Promise<RunResult> {
  /**
   Files to lint or fix.
   */
  const files = await resolveFiles(paths,);
  /**
   Repository facts for the `lfs-image-url` rule; empty makes the rule inert.
   */
  const lfsRepos = await discoverLfsImageRepo({
    cwd,
    exclude: lfsImageExclude,
  },);
  /**
   Rules to run.
   */
  const selectedRules = selectRules(ruleIds,);
  /**
   One processed entry per non-skipped file, built concurrently.
   */
  const present = (await Promise.all(files.map(
    async function processFile(file: DiscoveredFile,): Promise<readonly ProcessedEntry[]> {
      /**
       Display path relative to the working directory.
       */
      const displayPath = relative(
        cwd,
        file.path,
      );
      try {
        /**
         File source as a one-element list, empty when skipped for size.
         */
        const [readSource,] = await readBoundedSource(file.path,);
        if (readSource === undefined) {
          return [];
        }
        /**
         Source text and mode for the file being processed.
         */
        const {
          source,
          mode,
        } = readSource;
        /**
         Report and fixed source for this file.
         */
        const processed = await processSource({
          source,
          filePath: file.path,
          displayPath,
          mdx: file.mdx,
          fix,
          selectedRules,
          lfsRepos,
        },);
        /**
         Whether the fixpoint loop changed the file.
         */
        const changed = processed.fixedSource !== source;
        if (changed) {
          await writeFileAtomically({
            path: file.path,
            source: processed.fixedSource,
            mode,
          },);
        }
        return [{
          report: processed.report,
          fixed: changed,
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
   Rendered output over every file report.
   */
  const rendered = renderReports({
    reporter,
    fileReports: present.map(function toReport(entry: ProcessedEntry,): FileReport {
      return entry.report;
    },),
  },);
  return {
    ...rendered,
    fixedFiles: present
      .filter(function wasFixed(entry: ProcessedEntry,): boolean {
        return entry.fixed;
      },)
      .length,
  };
}

/**
 Lint (or fix) one source read from standard input as if it lived at
 `stdinPath`, and return the fixed source instead of writing any file. Used
 by the cli-git policy, which owns the bytes it commits.

 @param stdinPath - path the source is treated as living at, relative to `cwd`

 @param source - source read from standard input

 @param fix - whether to run the fixpoint loop

 @param reporter - reporter for the rendered output

 @param cwd - directory `stdinPath` resolves against

 @param lfsImageExclude - gitignore-syntax patterns for files the `lfs-image-url` rule must leave alone

 @param ruleIds - rule ids to run; empty runs every rule

 @returns rendered report, whether violations remain, and the fixed source

 @example
 ```ts
 await runStdin({ stdinPath: 'README.md', source, fix: true, reporter: 'json', cwd: process.cwd() });
 ```
 */
export async function runStdin({
  stdinPath,
  source,
  fix,
  reporter,
  cwd,
  lfsImageExclude = [],
  ruleIds = [],
}: RunStdinParams,): Promise<RunStdinResult> {
  /**
   Lintable file the source is treated as, resolved against `cwd`.
   */
  const [file,] = explicitFile(resolve(
    cwd,
    stdinPath,
  ),);
  if (file === undefined) {
    throw new StdinPathError(`Standard input path must end in .md or .mdx: ${stdinPath}`,);
  }
  /**
   Repository facts for the `lfs-image-url` rule; empty makes the rule inert.
   */
  const lfsRepos = await discoverLfsImageRepo({
    cwd,
    exclude: lfsImageExclude,
  },);
  /**
   Report and fixed source.
   */
  const processed = await processSource({
    source,
    filePath: file.path,
    displayPath: stdinPath,
    mdx: file.mdx,
    fix,
    selectedRules: selectRules(ruleIds,),
    lfsRepos,
  },);
  return {
    ...renderReports({
      reporter,
      fileReports: [processed.report,],
    },),
    fixedSource: processed.fixedSource,
  };
}
