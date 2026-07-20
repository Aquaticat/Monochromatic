/**
 * Redacted forbidden-strings scanner output parser.
 *
 * @module
 */
import type {
  CandidateFile,
  PolicyFinding,
} from '@monochromatic-dev/git-policy-api/ts';
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
   * Opaque rule identity token: a tail-format section name over `[a-z0-9.-]`,
   * or a numeric index for legacy unnamed rules (digits sit inside that same
   * alphabet). Relayed verbatim; rule text never appears here.
   */
  rule: string;
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
 * Validates a rule identity token against the scanner's name alphabet.
 *
 * Accepts a tail-format section name (`[a-z0-9.-]`, non-empty) or a legacy
 * numeric index, which the same alphabet covers; anything else means the
 * scanner output drifted and the gate must fail closed rather than relay it.
 *
 * @param value - scanner rule field
 *
 * @param line - complete scanner line for diagnostic
 *
 * @returns validated token
 */
function parseRuleToken({
  value,
  line,
}: Readonly<{
  value: string;
  line: string;
}>): string {
  if (value.length === 0)
    throw new ForbiddenStringsPluginError(`Malformed forbidden-strings scanner output: ${line}`,);
  // Indexed UTF-16 walk instead of string spread: the alphabet is pure ASCII,
  // so any surrogate half fails the range checks and rejects correctly.
  for (let index = 0; index < value.length; index += 1) {
    /**
     * Single UTF-16 unit under the cursor.
     */
    const ch = value.charAt(index,);
    /**
     * Whether the unit sits inside the strict section-name alphabet.
     */
    const isNameChar = ((ch >= 'a') && (ch <= 'z'))
      || ((ch >= '0') && (ch <= '9'))
      || (ch === '.')
      || (ch === '-');
    if (!isNameChar)
      throw new ForbiddenStringsPluginError(`Malformed forbidden-strings scanner output: ${line}`,);
  }
  return value;
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
    rule: parseRuleToken({
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
        message: `Forbidden string matched at line ${String(hit.line)} (rule ${hit.rule}).`,
        path: candidate.path,
      };
    },);
}
