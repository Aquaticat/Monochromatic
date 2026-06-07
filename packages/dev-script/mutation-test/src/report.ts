/**
 * Stryker JSON report aggregation by raw mutant counts.
 *
 * @example
 * ```ts
 * await aggregateReports(['/tmp/mutation.json']);
 * ```
 */

import { readFile, } from 'node:fs/promises';

import {
  addStatus,
  mutantsFromReport,
  mutationScore,
  parseStatus,
  ZERO_TOTALS,
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
 * Records a survivor or timeout finding when status deserves user attention.
 *
 * @param options - Current finding list and mutant pair.
 *
 * @returns Nothing.
 *
 * @example
 * ```ts
 * pushFinding({ findings: [], file: 'src/a.ts', mutant });
 * ```
 */
function pushFinding(options: {
  readonly findings: MutantFinding[];
  readonly file: string;
  readonly mutant: ReturnType<typeof mutantsFromReport>[number][1];
},): void {
  if (options.mutant.status !== 'Survived' && options.mutant.status !== 'Timeout')
    return;

  options.findings.push({
    file: options.file,
    id: options.mutant.id,
    mutatorName: options.mutant.mutatorName,
    replacement: options.mutant.replacement,
    status: options.mutant.status,
    location: options.mutant.location,
    description: options.mutant.description,
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
  let totals: MutationTotals = ZERO_TOTALS;
  const findings: MutantFinding[] = [];

  for (const report of reports) {
    for (const [file, mutant,] of mutantsFromReport(report.json,)) {
      totals = addStatus({ totals, status: mutant.status, },);
      pushFinding({
        findings,
        file,
        mutant,
      },);
    }
  }

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
  return {
    path: reportFile,
    json: JSON.parse(await readFile(reportFile, 'utf8',),) as unknown,
  };
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
  const parsedReports: ParsedReport[] = [];
  const failedReports: string[] = [];

  for (const reportFile of reportFiles) {
    try {
      parsedReports.push(await readReport(reportFile,),);
    }
    catch {
      failedReports.push(reportFile,);
    }
  }

  const aggregate = aggregateParsedReports(parsedReports,);
  return {
    ...aggregate,
    failedReports,
  };
}
