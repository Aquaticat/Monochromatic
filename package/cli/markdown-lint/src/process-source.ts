/**
 Per-source pipeline shared by the path runner and the standard-input runner:
 rule selection, per-file LFS context, lint or fixpoint, and report rendering.

 @module
 */

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';

import { fixSource, } from './fix.ts';
import {
  type LfsImageContext,
  type LfsImageRepo,
  prepareLfsImageContext,
} from './lfs-image-context.ts';
import { runRules, } from './lint.ts';
import {
  report,
  type FileReport,
  type ReporterName,
} from './reporters.ts';
import { rules, } from './rule/index.ts';
import type {
  Diagnostic,
  Rule,
} from './types.ts';

/**
 Synthetic rule ID for a file that could not be processed. Reporting it as a
 diagnostic lets one bad file fail the run without aborting sibling writes.
 */
const PROCESSING_ERROR_RULE_ID = 'markdown-lint-error';

/**
 Synthetic rule ID for safety checks that block a risky autofix write.
 */
const SAFETY_RULE_ID = 'markdown-lint-safety';

/**
 Parameters for {@link fileStartDiagnostic}.
 */
type FileStartDiagnosticParams = {
  /**
   Synthetic rule identifier.
   */
  readonly ruleId: string;
  /**
   Diagnostic message.
   */
  readonly message: string;
};

/**
 Order diagnostics by source position so the report reads top-to-bottom even
 though rules run in their own order.
 
 @param diagnostics - diagnostics for one file
 
 @returns diagnostics sorted by line then column
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
 Create a synthetic diagnostic at the start of a file.
 
 @param ruleId - synthetic rule identifier
 
 @param message - diagnostic message
 
 @returns diagnostic anchored at line 1, column 1
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
 Diagnostic for a file-processing failure.
 
 @param error - value caught from file processing
 
 @returns synthetic diagnostic for the report
 
 @example
 ```ts
 processingErrorDiagnostic(new Error('EACCES')); // { ruleId: 'markdown-lint-error', line: 1, column: 1, ... }
 ```
 
 @mutates error - `caughtValueText` may invoke string-conversion hooks.
 */
export function processingErrorDiagnostic(error: unknown,): Diagnostic {
  /**
   Error text preserving empty-message class names from existing CLI output.
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
 Diagnostic for a fixpoint result that would erase a non-empty file.
 
 @returns synthetic diagnostic for the report
 */
function emptyRewriteDiagnostic(): Diagnostic {
  return fileStartDiagnostic({
    ruleId: SAFETY_RULE_ID,
    message: 'Autofix would replace non-empty file with empty output; leaving file unchanged.',
  },);
}

/**
 Rules selected by id; every rule when `ruleIds` is empty.

 @param ruleIds - rule ids to keep

 @returns rules in registry order

 @example
 ```ts
 selectRules(['lfs-image-url']); // just that rule
 selectRules([]); // every rule
 ```
 */
export function selectRules(ruleIds: readonly string[],): readonly Rule[] {
  if (ruleIds.length === 0) {
    return rules;
  }
  return rules.filter(function selected(rule: Rule,): boolean {
    return ruleIds.includes(rule.id,);
  },);
}

/**
 Parameters for {@link lfsContextsFor}.
 */
type LfsContextsForParams = {
  /**
   Zero or one repository descriptions from discovery.
   */
  readonly repos: readonly LfsImageRepo[];
  /**
   Absolute path of the file under lint.
   */
  readonly filePath: string;
  /**
   Source of the file under lint.
   */
  readonly source: string;
  /**
   Whether the source is MDX.
   */
  readonly mdx: boolean;
};

/**
 Per-file LFS context as a one-element list, or empty when the run found no
 repository or the file is excluded.

 @param repos - zero or one repository descriptions from discovery

 @param filePath - absolute path of the file under lint

 @param source - source of the file under lint

 @param mdx - whether the source is MDX

 @returns zero or one contexts
 */
async function lfsContextsFor({
  repos,
  filePath,
  source,
  mdx,
}: LfsContextsForParams,): Promise<readonly LfsImageContext[]> {
  return await Promise.all(repos
    .filter(function includesFile(repo: LfsImageRepo,): boolean {
      return !repo.isExcluded(filePath,);
    },)
    .map(async function contextOf(repo: LfsImageRepo,): Promise<LfsImageContext> {
      return await prepareLfsImageContext({
        repo,
        filePath,
        source,
        mdx,
      },);
    },),);
}

/**
 Parameters for {@link processSource}.
 */
export type ProcessSourceParams = {
  /**
   Source under lint.
   */
  readonly source: string;
  /**
   Absolute path the source lives at (or is treated as living at).
   */
  readonly filePath: string;
  /**
   Path shown in the report.
   */
  readonly displayPath: string;
  /**
   Whether the source is MDX.
   */
  readonly mdx: boolean;
  /**
   Whether to run the fixpoint loop.
   */
  readonly fix: boolean;
  /**
   Rules to run.
   */
  readonly selectedRules: readonly Rule[];
  /**
   Zero or one repository descriptions for the `lfs-image-url` rule.
   */
  readonly lfsRepos: readonly LfsImageRepo[];
};

/**
 One source after linting or fixing.
 */
export type ProcessedSource = {
  /**
   Per-file report.
   */
  readonly report: FileReport;
  /**
   Source after fixes; the input when nothing changed or `fix` was off.
   */
  readonly fixedSource: string;
};

/**
 Lint one source, or run it through the fixpoint loop. A fix that would
 erase a non-empty source is refused and reported instead.

 @param source - source under lint

 @param filePath - absolute path the source lives at

 @param displayPath - path shown in the report

 @param mdx - whether the source is MDX

 @param fix - whether to run the fixpoint loop

 @param selectedRules - rules to run

 @param lfsRepos - zero or one repository descriptions for the `lfs-image-url` rule

 @returns report and the (possibly fixed) source

 @example
 ```ts
 await processSource({ source, filePath, displayPath: 'README.md', mdx: false, fix: true, selectedRules: rules, lfsRepos: [] });
 ```
 */
export async function processSource({
  source,
  filePath,
  displayPath,
  mdx,
  fix,
  selectedRules,
  lfsRepos,
}: ProcessSourceParams,): Promise<ProcessedSource> {
  /**
   Per-file LFS context, when the rule applies to this file.
   */
  const [lfs,] = await lfsContextsFor({
    repos: lfsRepos,
    filePath,
    source,
    mdx,
  },);
  /**
   Context spread for the rule runs below.
   */
  const lfsSpread = lfs === undefined ? {} : { lfs, };
  if (!fix) {
    return {
      report: {
        path: displayPath,
        diagnostics: byPosition(runRules({
          rules: selectedRules,
          source,
          mdx,
          ...lfsSpread,
        },),),
      },
      fixedSource: source,
    };
  }
  /**
   Source and remaining diagnostics after the fixpoint loop.
   */
  const fixed = fixSource({
    rules: selectedRules,
    source,
    mdx,
    ...lfsSpread,
  },);
  if ((source !== '') && (fixed.source === '')) {
    return {
      report: {
        path: displayPath,
        diagnostics: [emptyRewriteDiagnostic(),],
      },
      fixedSource: source,
    };
  }
  return {
    report: {
      path: displayPath,
      diagnostics: byPosition(fixed.diagnostics,),
    },
    fixedSource: fixed.source,
  };
}

/**
 Render per-file reports that carry diagnostics, sorted by path.

 @param reporter - reporter for the rendered output

 @param fileReports - every per-file report

 @returns rendered output and whether any diagnostics remain

 @example
 ```ts
 renderReports({ reporter: 'json', fileReports }); // { output: '[...]', hadViolations: true }
 ```
 */
export function renderReports({
  reporter,
  fileReports,
}: {
  readonly reporter: ReporterName;
  readonly fileReports: readonly FileReport[];
},): {
  readonly output: string;
  readonly hadViolations: boolean
} {
  /**
   Reports that actually carry diagnostics, sorted by path.
   */
  const reports = fileReports
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
  };
}
