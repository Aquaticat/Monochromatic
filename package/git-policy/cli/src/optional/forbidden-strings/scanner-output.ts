// Generated from `package/git-policy/forbidden-strings/src/scanner-output.ts` by file-enforcer; edit canonical source owner.
/**
 * Redacted forbidden-strings scanner output parser.
 *
 * @module
 */
import type {
  CandidateFile,
  PolicyFinding,
} from '../../api/index.ts';
import { ForbiddenStringsPluginError, } from './errors.ts';

/**
 * Parsed redacted scanner hit.
 */
type ScannerHit = Readonly<{
  /**
   * Inclusive byte column within reported line.
   */
  columnEnd: number;
  /**
   * Inclusive byte column within reported line.
   */
  columnStart: number;
  /**
   * One-based line number.
   */
  line: number;
  /**
   * Opaque scanner rule index.
   */
  rule: number;
  /**
   * Plugin-owned materialized path.
   */
  scannerPath: string;
}>;

/**
 * Parses positive decimal integer without accepting suffixes.
 *
 * @param value - scanner field
 *
 * @param line - complete scanner line for diagnostic
 *
 * @returns parsed positive integer
 */
function parsePositiveInteger({
  value,
  line,
}: Readonly<{
  value: string;
  line: string;
}>): number {
  /**
   * Parsed numeric field.
   */
  const parsed = Number(value,);
  if ((!Number.isSafeInteger(parsed,)) || (parsed < 1)
    || (String(parsed,) !== value))
    throw new ForbiddenStringsPluginError(`Malformed forbidden-strings scanner output: ${line}`,);
  return parsed;
}

/**
 * Parses one redacted hit line without interpreting candidate paths as syntax.
 *
 * @param line - complete scanner stderr line
 *
 * @returns parsed scanner hit
 */
function parseHit(line: string,): ScannerHit {
  /**
   * Rule suffix separator.
   */
  const ruleSeparator = line.lastIndexOf(' rule=',);
  /**
   * Column range separator.
   */
  const columnSeparator = line.lastIndexOf(
    ':',
    ruleSeparator,
  );
  /**
   * Line-number separator.
   */
  const lineSeparator = line.lastIndexOf(
    ':',
    columnSeparator - 1,
  );
  if ((ruleSeparator === (-1)) || (columnSeparator === (-1))
    || (lineSeparator === (-1)))
    throw new ForbiddenStringsPluginError(`Malformed forbidden-strings scanner output: ${line}`,);
  /**
   * Column range text.
   */
  const columnRange = line.slice(
    columnSeparator + 1,
    ruleSeparator,
  );
  /**
   * Inclusive range delimiter.
   */
  const rangeSeparator = columnRange.indexOf('..',);
  if (rangeSeparator === (-1))
    throw new ForbiddenStringsPluginError(`Malformed forbidden-strings scanner output: ${line}`,);
  /**
   * Complete parsed hit.
   */
  const hit: ScannerHit = {
    scannerPath: line.slice(
      0,
      lineSeparator,
    ),
    line: parsePositiveInteger({
      value: line.slice(
        lineSeparator + 1,
        columnSeparator,
      ),
      line,
    },),
    columnStart: parsePositiveInteger({
      value: columnRange.slice(
        0,
        rangeSeparator,
      ),
      line,
    },),
    columnEnd: parsePositiveInteger({
      value: columnRange.slice(rangeSeparator + 2,),
      line,
    },),
    rule: parsePositiveInteger({
      value: line.slice(ruleSeparator + ' rule='.length,),
      line,
    },),
  };
  if (hit.columnEnd < hit.columnStart)
    throw new ForbiddenStringsPluginError(`Malformed forbidden-strings scanner output: ${line}`,);
  return hit;
}

/**
 * Parses scanner findings and rejects scanner-owned infrastructure diagnostics.
 *
 * @param stderr - redacted scanner stderr
 *
 * @param candidateForPath - materialized path lookup
 *
 * @returns policy findings mapped to original candidates
 *
 * @example
 * ```ts
 * parseScannerOutput({ stderr: '/tmp/candidate:1:1..2 rule=3', candidateForPath: () => candidate });
 * ```
 */
export function parseScannerOutput({
  stderr,
  candidateForPath,
}: {
  readonly stderr: string;
  readonly candidateForPath: (path: string) => CandidateFile;
}): readonly PolicyFinding[] {
  return stderr.split('\n',)
    .filter(function isOutputLine(line,): boolean {
      return line.length > 0;
    },)
    .map(function toFinding(line,): PolicyFinding {
      if (line.includes(': read error:',) || line.includes(' engine error',))
        throw new ForbiddenStringsPluginError(`Forbidden-strings scanner infrastructure failure: ${line}`,);
      /**
       * Parsed redacted scanner hit.
       */
      const hit = parseHit(line,);
      /**
       * Exact candidate owning scanner path.
       */
      const candidate = candidateForPath(hit.scannerPath,);
      return {
        code: 'forbidden-string',
        message: `Forbidden string matched at line ${String(hit.line)}, columns ${String(hit.columnStart)} to ${String(hit.columnEnd)} (rule ${String(hit.rule)}).`,
        path: candidate.path,
      };
    },);
}
