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
  if (ruleSeparator === (-1))
    throw new ForbiddenStringsPluginError(`Malformed forbidden-strings scanner output: ${line}`,);
  /**
   * Line-number separator; the last colon before the rule suffix keeps
   * candidate paths that themselves embed colons out of the numeric field.
   */
  const lineSeparator = line.lastIndexOf(
    ':',
    ruleSeparator,
  );
  if (lineSeparator === (-1))
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
        ruleSeparator,
      ),
      line,
    },),
    rule: parsePositiveInteger({
      value: line.slice(ruleSeparator + ' rule='.length,),
      line,
    },),
  };
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
 * parseScannerOutput({ stderr: '/tmp/candidate:1 rule=3', candidateForPath: () => candidate });
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
        message: `Forbidden string matched at line ${String(hit.line)} (rule ${String(hit.rule)}).`,
        path: candidate.path,
      };
    },);
}
