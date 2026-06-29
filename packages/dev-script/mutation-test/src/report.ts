/**
 * Stryker JSON report aggregation by raw mutant counts.
 *
 * @example
 * ```ts
 * await aggregateReports(['/tmp/mutation.json']);
 * ```
 */

import { readFile, } from 'node:fs/promises';

import { caughtErrorMessage, } from './error-format.ts';
import {
  addStatus,
  mutantsFromReport,
  mutationScore,
  parseStatus,
  ZERO_TOTALS,
  type ParsedMutant,
} from './report-parse.ts';
import type {
  MutantFinding,
  MutationAggregate,
  MutationTotals,
} from './types.ts';

export {
  addStatus,
  mutationScore,
  parseStatus,
  ZERO_TOTALS,
} from './report-parse.ts';

/**
 * Parsed report pair used by aggregation tests and disk readers.
 */
export type ParsedReport = {
  readonly path: string;
  readonly json: unknown;
};

/**
 * Parsed mutant paired with its source file.
 */
type FileMutant = {
  readonly file: string;
  readonly mutant: ParsedMutant;
};

/**
 * Report read success.
 */
type ReportReadSuccess = {
  readonly ok: true;
  readonly report: ParsedReport;
};

/**
 * Report read failure.
 */
type ReportReadFailure = {
  readonly ok: false;
  readonly path: string;
};

/**
 * Report read result.
 */
type ReportReadResult = ReportReadSuccess | ReportReadFailure;

/**
 * Converts one file mutant pair to a finding.
 *
 * @param fileMutant - Parsed mutant with owning file.
 *
 * @returns User-facing finding.
 *
 * @example
 * ```ts
 * findingFromFileMutant({ file: 'src/a.ts', mutant });
 * ```
 */
function findingFromFileMutant(fileMutant: FileMutant,): MutantFinding {
  /**
   * Parsed mutant reported by Stryker.
   */
  const { mutant, } = fileMutant;
  return {
    file: fileMutant.file,
    id: mutant.id,
    mutatorName: mutant.mutatorName,
    replacement: mutant.replacement,
    status: mutant.status,
    location: mutant.location,
    description: mutant.description,
  };
}

/**
 * Extracts file-mutant pairs from parsed reports.
 *
 * @param reports - Parsed Stryker reports.
 *
 * @returns Flat file-mutant list.
 *
 * @example
 * ```ts
 * fileMutantsFromReports([{ path: 'x.json', json: { files: {} } }]);
 * ```
 */
function fileMutantsFromReports(reports: readonly ParsedReport[],): readonly FileMutant[] {
  return reports.flatMap(function fileMutantsForReport(report,): readonly FileMutant[] {
    return mutantsFromReport(report.json,)
      .map(function toFileMutant(pair,): FileMutant {
        return {
          file: pair[0],
          mutant: pair[1],
        };
      },);
  },);
}

/**
 * Aggregates already parsed reports.
 *
 * @param reports - Report path and parsed JSON pairs.
 *
 * @returns Weighted aggregate result.
 *
 * @example
 * ```ts
 * aggregateParsedReports([{ path: 'x.json', json: { files: {} } }]);
 * ```
 */
export function aggregateParsedReports(reports: readonly ParsedReport[],): MutationAggregate {
  /**
   * Flat list of every parsed mutant with its file path.
   */
  const fileMutants = fileMutantsFromReports(reports,);
  /**
   * Raw mutant totals accumulated across all reports.
   */
  const totals: MutationTotals = fileMutants.reduce(
    function addMutantStatus(
      currentTotals,
      fileMutant,
    ): MutationTotals {
      return addStatus({
        totals: currentTotals,
        status: fileMutant.mutant
          .status,
      },);
    },
    ZERO_TOTALS,
  );
  /**
   * Survived and timed-out mutants requiring user review.
   */
  const findings = fileMutants
    .filter(function isFinding(fileMutant,): boolean {
      /**
       * Mutant status used to decide whether finding needs review.
       */
      const { status, } = fileMutant.mutant;
      return (status === 'Survived')
        || (status === 'Timeout');
    },)
    .map(function toFinding(fileMutant,): MutantFinding {
      return findingFromFileMutant(fileMutant,);
    },);

  return {
    totals,
    score: mutationScore(totals,),
    findings,
    reportFiles: reports.map(function reportPath(report,): string {
      return report.path;
    },),
    failedReports: [],
  };
}

/**
 * Reads one Stryker JSON report from disk.
 *
 * @param reportFile - JSON report path.
 *
 * @returns Parsed report pair.
 *
 * @example
 * ```ts
 * await readReport('/tmp/mutation.json');
 * ```
 */
async function readReport(reportFile: string,): Promise<ParsedReport> {
  /**
   * Raw Stryker JSON report text.
   */
  const reportJson = await readFile(
    reportFile,
    'utf8',
  );
  return {
    path: reportFile,
    json: JSON.parse(reportJson,) as unknown,
  };
}

/**
 * Reads one report and captures failures as data.
 *
 * @param reportFile - JSON report path.
 *
 * @returns Report read result.
 *
 * @example
 * ```ts
 * await readReportResult('/tmp/mutation.json');
 * ```
 */
async function readReportResult(reportFile: string,): Promise<ReportReadResult> {
  try {
    return {
      ok: true,
      report: await readReport(reportFile,),
    };
  }
  catch (error) {
    console.warn(
      `[mutation-test] report read failed for ${reportFile}: ${caughtErrorMessage(error,)}`,
    );
    return {
      ok: false,
      path: reportFile,
    };
  }
}

/**
 * Reads and aggregates Stryker JSON reports from disk.
 *
 * @param reportFiles - JSON report paths.
 *
 * @returns Weighted aggregate result. Unreadable reports are listed separately.
 *
 * @example
 * ```ts
 * await aggregateReports(['/tmp/mutation.json']);
 * ```
 */
export async function aggregateReports(reportFiles: readonly string[],): Promise<MutationAggregate> {
  /**
   * Per-report read results preserving failures as values.
   */
  const readResults = await Promise.all(reportFiles.map(function readOneReport(reportFile,): Promise<ReportReadResult> {
    return readReportResult(reportFile,);
  },),);
  /**
   * Successfully parsed reports.
   */
  const parsedReports = readResults
    .filter(function isSuccess(result,): result is ReportReadSuccess {
      return result.ok;
    },)
    .map(function report(result,): ParsedReport {
      return result.report;
    },);
  /**
   * Report paths that could not be read or parsed.
   */
  const failedReports = readResults
    .filter(function isFailure(result,): result is ReportReadFailure {
      return !result.ok;
    },)
    .map(function failedPath(result,): string {
      return result.path;
    },);
  /**
   * Aggregate over every successfully parsed report.
   */
  const aggregate = aggregateParsedReports(parsedReports,);
  return {
    ...aggregate,
    failedReports,
  };
}
