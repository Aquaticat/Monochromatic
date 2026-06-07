/**
 * Low-level Stryker JSON parsing helpers.
 *
 * @example
 * ```ts
 * parseStatus('Killed');
 * ```
 */

import type {
  MutantStatus,
  MutationTotals,
} from './types.ts';

/**
 * Empty aggregate counts.
 */
export const ZERO_TOTALS: MutationTotals = {
  killed: 0,
  survived: 0,
  timeout: 0,
  compileError: 0,
  runtimeError: 0,
  noCoverage: 0,
  ignored: 0,
};

/**
 * JSON object shape used during report parsing.
 */
type JsonRecord = Readonly<Record<string, unknown>>;

/**
 * Parsed mutant object fields this aggregator understands.
 */
export type ParsedMutant = {
  readonly id: string;
  readonly status: MutantStatus;
  readonly mutatorName: string;
  readonly replacement: string;
  readonly description: string;
  readonly location: string;
};

/**
 * Sentinel returned when a JSON value is not a mutant record.
 */
const NO_MUTANT = Symbol('no mutant');

/**
 * Parsed mutant or sentinel for invalid JSON shapes.
 */
type ParsedMutantResult = ParsedMutant | typeof NO_MUTANT;

/**
 * Returns whether a value is a non-null object record.
 *
 * @param value - Candidate value.
 *
 * @returns Whether value is a JSON-like record.
 *
 * @example
 * ```ts
 * isRecord({});
 * // true
 * ```
 */
function isRecord(value: unknown,): value is JsonRecord {
  return (value !== null) && ((typeof value) === 'object')
    && (!Array.isArray(value,));
}

/**
 * Reads string property from a record.
 *
 * @param options - Record, key, and fallback.
 *
 * @returns String property or fallback.
 *
 * @example
 * ```ts
 * stringProperty({ record: { a: 'x' }, key: 'a', fallback: '' });
 * // 'x'
 * ```
 */
function stringProperty(options: {
  readonly record: JsonRecord;
  readonly key: string;
  readonly fallback: string;
},): string {
  /**
   * Raw record property value before string validation.
   */
  const value = options.record[options.key];
  return (typeof value) === 'string' ? value : options.fallback;
}

/**
 * Converts Stryker status text to an aggregated status.
 *
 * @param status - Raw Stryker status.
 *
 * @returns Known mutant status, defaulting to RuntimeError for unknown failures.
 *
 * @example
 * ```ts
 * parseStatus('Survived');
 * // 'Survived'
 * ```
 */
export function parseStatus(status: string,): MutantStatus {
  if (status === 'Killed')
    return 'Killed';

  if (status === 'Survived')
    return 'Survived';

  if (status === 'Timeout')
    return 'Timeout';

  if (status === 'CompileError')
    return 'CompileError';

  if (status === 'RuntimeError')
    return 'RuntimeError';

  if (status === 'NoCoverage')
    return 'NoCoverage';

  if (status === 'Ignored')
    return 'Ignored';

  return 'RuntimeError';
}

/**
 * Adds one mutant status to aggregate totals.
 *
 * @param options - Existing totals and status.
 *
 * @returns New totals object.
 *
 * @example
 * ```ts
 * addStatus({ totals: ZERO_TOTALS, status: 'Killed' }).killed;
 * // 1
 * ```
 */
export function addStatus(options: {
  readonly totals: MutationTotals;
  readonly status: MutantStatus;
},): MutationTotals {
  return {
    killed: options.totals
      .killed
      + (options.status === 'Killed' ? 1 : 0),
    survived: options.totals
      .survived
      + (options.status === 'Survived' ? 1 : 0),
    timeout: options.totals
      .timeout
      + (options.status === 'Timeout' ? 1 : 0),
    compileError: options.totals
      .compileError
      + (options.status === 'CompileError' ? 1 : 0),
    runtimeError: options.totals
      .runtimeError
      + (options.status === 'RuntimeError' ? 1 : 0),
    noCoverage: options.totals
      .noCoverage
      + (options.status === 'NoCoverage' ? 1 : 0),
    ignored: options.totals
      .ignored
      + (options.status === 'Ignored' ? 1 : 0),
  };
}

/**
 * Formats Stryker source location.
 *
 * @param location - Raw location object.
 *
 * @returns Human-readable line and column range.
 *
 * @example
 * ```ts
 * formatLocation({ start: { line: 1, column: 0 } });
 * // '1:0'
 * ```
 */
function formatLocation(location: unknown,): string {
  if (!isRecord(location,))
    return 'unknown';

  /**
   * Raw start and end locations from Stryker JSON.
   */
  const {
    start,
    end,
  } = location;

  if (!isRecord(start,))
    return 'unknown';

  /**
   * One-based start line reported by Stryker.
   */
  const startLine = Number(start.line ?? 0,);
  /**
   * Zero-based start column reported by Stryker.
   */
  const startColumn = Number(start.column ?? 0,);

  if (!isRecord(end,))
    return `${String(startLine,)}:${String(startColumn,)}`;

  return `${String(startLine,)}:${String(startColumn,)}-${String(Number(end.line ?? 0,),)}:${String(Number(end.column ?? 0,),)}`;
}

/**
 * Parses one mutant from Stryker JSON.
 *
 * @param mutant - Raw mutant value.
 *
 * @returns Parsed mutant, or sentinel when shape is not a mutant.
 */
function parseMutant(mutant: unknown,): ParsedMutantResult {
  if (!isRecord(mutant,))
    return NO_MUTANT;

  return {
    id: stringProperty({
      record: mutant,
      key: 'id',
      fallback: 'unknown',
    },),
    status: parseStatus(stringProperty({
      record: mutant,
      key: 'status',
      fallback: 'RuntimeError',
    },),),
    mutatorName: stringProperty({
      record: mutant,
      key: 'mutatorName',
      fallback: 'unknown mutator',
    },),
    replacement: stringProperty({
      record: mutant,
      key: 'replacement',
      fallback: '',
    },),
    description: stringProperty({
      record: mutant,
      key: 'description',
      fallback: '',
    },),
    location: formatLocation(mutant.location,),
  };
}

/**
 * Extracts mutants grouped by file from one parsed report.
 *
 * @param report - Parsed Stryker report.
 *
 * @returns File and mutant pairs.
 *
 * @example
 * ```ts
 * mutantsFromReport({ files: {} });
 * ```
 */
export function mutantsFromReport(report: unknown,): readonly (readonly [
  string,
  ParsedMutant,
])[] {
  if ((!isRecord(report,)) || (!isRecord(report.files,)))
    return [];

  return Object.entries(report.files,)
    .flatMap(function mutantsForFile(entry,): readonly (readonly [
      string,
      ParsedMutant,
    ])[] {
    /**
     * File path and per-file report payload from Stryker JSON files record.
     */
    const [
      file,
      fileReport,
    ] = entry;

    if ((!isRecord(fileReport,)) || (!Array.isArray(fileReport.mutants,)))
      return [];

    return fileReport.mutants
      .map(function parse(mutant,): ParsedMutantResult {
        return parseMutant(mutant,);
      },)
      .filter(function keep(parsed,): parsed is ParsedMutant {
        return parsed !== NO_MUTANT;
      },)
      .map(function pair(mutant,): readonly [
        string,
        ParsedMutant,
      ] {
        return [
          file,
          mutant,
        ];
      },);
  },);
}

/**
 * Computes weighted mutation score from raw totals.
 *
 * @param totals - Raw aggregate totals.
 *
 * @returns Score from zero to one hundred.
 *
 * @example
 * ```ts
 * mutationScore({ ...ZERO_TOTALS, killed: 1, survived: 1 });
 * // 50
 * ```
 */
export function mutationScore(totals: MutationTotals,): number {
  /**
   * Mutants counted in Stryker mutation score denominator.
   */
  const denominator = totals.killed
    + totals.survived
    + totals.timeout
    + totals.noCoverage
    + totals.runtimeError;

  if (denominator === 0)
    return 100;

  return (totals.killed / denominator) * 100;
}
