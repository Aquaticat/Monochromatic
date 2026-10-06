/**
 The JSON Lines report monochromatic-lint writes to stderr in stdin fix mode,
 one finding record per line.

 @module
 */

import * as v from 'valibot';

import { MarkdownLintPluginError, } from './errors.ts';

/**
 Longest stderr excerpt quoted when the report cannot be parsed.
 */
const REPORT_EXCERPT_LENGTH = 200;

/**
 One finding record; extra fields such as `severity`, `causes`, and `related`
 are accepted and ignored.
 */
const reportedDiagnosticSchema = v.object({
  code: v.string(),
  message: v.string(),
  labels: v.array(v.object({
    span: v.object({
      line: v.number(),
      column: v.number(),
    },),
  },),),
},);

/**
 One finding monochromatic-lint reported, with the position of each label.
 */
export type ReportedDiagnostic = Readonly<{
  /**
   Rule or core finding id, such as `markdown/heading-increment` or `core/processing-failure`.
   */
  code: string;
  /**
   Human-readable finding text.
   */
  message: string;
  /**
   Labelled positions; the first is the finding's location.
   */
  labels: readonly Readonly<{
    /**
     One-based line and column of the label.
     */
    span: Readonly<{
      line: number;
      column: number;
    }>;
  }>[];
}>;

/**
 Parse the JSON Lines report.

 @param stderr - subprocess stderr

 @returns reported diagnostics, empty when stderr carries none

 @throws {@link MarkdownLintPluginError} when a line is not a finding record

 @example
 ```ts
 parseReport('{"code":"markdown/no-bare-urls","message":"Bare URL","labels":[{"span":{"line":1,"column":5}}]}\n');
 ```
 */
export function parseReport(stderr: string,): readonly ReportedDiagnostic[] {
  return stderr
    .split('\n',)
    .filter(function nonEmpty(line: string,): boolean {
      return line.trim() !== '';
    },)
    .map(function parseLine(line: string,): ReportedDiagnostic {
      /**
       Parsed JSON value, whatever its shape.
       */
      const parsed: unknown = (function parseJson(): unknown {
        try {
          return JSON.parse(line,);
        }
        catch (error) {
          throw new MarkdownLintPluginError(
            `monochromatic-lint report could not be parsed: ${stderr.slice(
              0,
              REPORT_EXCERPT_LENGTH,
            )}`,
            { cause: error, },
          );
        }
      })();
      /**
       Shape check against the finding record.
       */
      const checked = v.safeParse(
        reportedDiagnosticSchema,
        parsed,
      );
      if (!checked.success) {
        throw new MarkdownLintPluginError(
          `monochromatic-lint report has an unexpected shape: ${checked.issues
            .map(function issueMessage(issue,): string {
              return issue.message;
            },)
            .join('; ',)}`,
        );
      }
      return checked.output;
    },);
}

/**
 Whether stderr is a JSON Lines report rather than the plain-text message of a
 usage or configuration error.

 @param stderr - subprocess stderr

 @returns `true` when stderr holds at least one line and every non-empty line is a finding record

 @example
 ```ts
 isReport('monochromatic-lint: Configuration x: Unknown built-in rule y.\n'); // false
 ```
 */
export function isReport(stderr: string,): boolean {
  try {
    parseReport(stderr,);
    return stderr.trim() !== '';
  }
  catch (error) {
    if (error instanceof MarkdownLintPluginError) {
      return false;
    }
    throw error;
  }
}
