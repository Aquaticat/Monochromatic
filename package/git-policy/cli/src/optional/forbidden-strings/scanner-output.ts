// Generated from `package/git-policy/forbidden-strings/src/scanner-output.ts` by file-enforcer; edit canonical source owner.
/**
 Redacted forbidden-strings scanner output parser.

 @module
 */
import type { PolicyFinding, } from '../../api/index.ts';
import { parseCacheWarning, } from './cache-warning.ts';
import { ForbiddenStringsPluginError, } from './errors.ts';

//region Finding fields

/**
 Parsed scanner finding with opaque operand identity.
 */
type ScannerHit = Readonly<{
  /**
   Fully masked logical pathname, never temporary content location.
   */
  displayPath: string;
  /**
   Zero-based index into candidate operands.
   */
  input: number;
  /**
   Name component or content line.
   */
  kind: 'name' | 'content';
  /**
   One-based segment or line number.
   */
  position: number;
  /**
   Validated opaque rule identity.
   */
  rule: string;
}>;

/**
 Fails closed without relaying untrusted scanner text that could contain a secret.

 @returns infrastructure error without scanner-provided bytes
 */
function malformedOutput(): ForbiddenStringsPluginError {
  return new ForbiddenStringsPluginError('Malformed forbidden-strings scanner output.',);
}

/**
 Parses a canonical integer field without admitting suffixes or leading zeros.

 @param value - scanner field, treated as untrusted text
 @param allowZero - whether operand index zero is valid
 @returns parsed integer
 */
function parseInteger({
  value,
  allowZero,
}: Readonly<{
  value: string;
  allowZero: boolean;
}>,): number {
  /**
   Parsed numeric field.
   */
  const parsed = Number(value,);
  if ((!Number.isSafeInteger(parsed,)) || (parsed < (allowZero ? 0 : 1))
    || (String(parsed,) !== value))
    throw malformedOutput();
  return parsed;
}

/**
 Validates a rule token against the strict section-name alphabet.

 @param value - scanner rule field
 @returns validated token
 */
function parseRuleToken(value: string,): string {
  if (value.length === 0)
    throw malformedOutput();
  for (let index = 0; index < value.length; index += 1) {
    /**
     Single ASCII unit under the cursor.
     */
    const ch = value.charAt(index,);
    /**
     Whether this byte fits named rules or unnamed numeric IDs.
     */
    const valid = ((ch >= 'a') && (ch <= 'z'))
      || ((ch >= '0') && (ch <= '9'))
      || (ch === '.')
      || (ch === '-');
    if (!valid)
      throw malformedOutput();
  }
  return value;
}

//endregion Finding fields

//region Finding protocol

/**
 Parses a finding framed by its trailing operand index and rule token.

 Every literal colon in the display path is escaped by the scanner, so a
 `:name:` marker cannot be confused with a pathname. The operand index
 maps even identical masked names to distinct historical candidate states.

 @param line - untrusted scanner line
 @returns parsed masked finding
 */
function parseHit(line: string,): ScannerHit {
  /**
   Opaque input field always present when adapter supplies logical names.
   */
  const inputSeparator = line.lastIndexOf(' input=',);
  if (inputSeparator === (-1))
    throw malformedOutput();
  /**
   Canonical zero-based operand index.
   */
  const input = parseInteger({
    value: line.slice(inputSeparator + ' input='.length,),
    allowZero: true,
  },);
  /**
   Last rule marker before the operand field.
   */
  const ruleSeparator = line.lastIndexOf(' rule=', inputSeparator,);
  if (ruleSeparator === (-1))
    throw malformedOutput();
  /**
   Opaque rule id, never the matched text.
   */
  const rule = parseRuleToken(line.slice(ruleSeparator + ' rule='.length, inputSeparator,),);
  /**
   Data preceding rule identity holds display path and position.
   */
  const locator = line.slice(0, ruleSeparator,);
  /**
   Reserved name marker cannot occur in an escaped display path.
   */
  const nameSeparator = locator.lastIndexOf(':name:',);
  /**
   Whether this finding names a path component instead of a content line.
   */
  const kind = nameSeparator === (-1) ? 'content' : 'name';
  /**
   Last content colon, or explicit pathname-kind marker.
   */
  const positionSeparator = kind === 'name'
    ? nameSeparator
    : locator.lastIndexOf(':',);
  if (positionSeparator <= 0)
    throw malformedOutput();
  /**
   Matched segment position or content line number.
   */
  const position = parseInteger({
    value: locator.slice(positionSeparator + (kind === 'name' ? ':name:'.length : 1),),
    allowZero: false,
  },);
  /**
   Masked logical path supplied by scanner after it checks every component.
   */
  const displayPath = locator.slice(0, positionSeparator,);
  if ((kind === 'name') && (!displayPath.split('/',).includes('[REDACTED]',)))
    throw malformedOutput();
  return {
    displayPath,
    input,
    kind,
    position,
    rule,
  };
}

//endregion Finding protocol

//region Path validation

/**
 Encodes one nonmatching component exactly as the scanner's visible label does.

 @param name - candidate pathname component
 @returns protocol-safe visible spelling
 */
function visibleComponent(name: string,): string {
  return Array.from(name, function encodeCharacter(ch,): string {
    if (ch === ':')
      return '\\x3a';
    if (ch === '\\')
      return '\\\\';
    /**
     Unicode scalar for a control byte in the name.
     */
    const code = ch.codePointAt(0,);
    if (code === undefined)
      throw malformedOutput();
    if ((code < 32) || ((code >= 127) && (code <= 159)))
      return `\\u{${code.toString(16,)}}`;
    return ch;
  },).join('',);
}

/**
 Checks every displayed segment against the indexed candidate's real name.

 @param hit - parsed scanner finding
 @param name - repository-relative candidate path
 @returns safe path, with reported offending segment masked
 */
function checkedDisplayPath({
  hit,
  name,
}: Readonly<{
  hit: ScannerHit;
  name: string;
}>,): string {
  /**
   Original Git components and scanner-rendered components must align.
   */
  const original = name.split('/',);
  /**
   Displayed components, some replaced in full by scanner mask.
   */
  const displayed = hit.displayPath.split('/',);
  if (displayed.length !== original.length)
    throw malformedOutput();
  if ((hit.kind === 'name')
    && ((hit.position > original.length) || (displayed[hit.position - 1] !== '[REDACTED]')))
    throw malformedOutput();
  for (let index = 0; index < original.length; index += 1) {
    /**
     Indexed real name component from validated repository path.
     */
    const component = original[index];
    /**
     Indexed printed component from scanner output.
     */
    const shown = displayed[index];
    if ((component === undefined) || (shown === undefined))
      throw malformedOutput();
    if ((shown !== '[REDACTED]') && (shown !== visibleComponent(component,)))
      throw malformedOutput();
  }
  return hit.displayPath;
}

//endregion Path validation

/**
 Parses redacted findings and rejects scanner-owned infrastructure diagnostics.

 @param stderr - scanner stderr, containing findings and cache warnings
 @param nameForIndex - repository-relative name lookup through opaque operand position
 @returns policy findings with masked logical paths

 @example
 ```ts
 parseScannerOutput({ stderr: 'src/a.ts:1 rule=3 input=0', nameForIndex: () => 'src/a.ts' });
 ```
 */
export function parseScannerOutput({
  stderr,
  nameForIndex,
}: Readonly<{
  stderr: string;
  nameForIndex: (index: number) => string;
}>,): readonly PolicyFinding[] {
  return stderr.split('\n',)
    .filter(function isOutputLine(line,): boolean {
      return line.length > 0;
    },)
    .filter(function isFindingLine(line,): boolean {
      return !parseCacheWarning(line,);
    },)
    .map(function toFinding(line,): PolicyFinding {
      if (line.includes(': read error:',)
        || line.includes(': engine error',)
        || line.includes(': unsupported pathname line break',))
        throw new ForbiddenStringsPluginError('Forbidden-strings scanner reported an infrastructure failure.',);
      /**
       Parsed scanner hit, with safe output label and opaque operand index.
       */
      const hit = parseHit(line,);
      /**
       Verifies both opaque candidate identity and every emitted pathname segment.
       */
      const displayPath = checkedDisplayPath({
        hit,
        name: nameForIndex(hit.input,),
      },);
      return {
        code: 'forbidden-string',
        message: hit.kind === 'name'
          ? `Forbidden string matched in pathname segment ${String(hit.position,)} (rule ${hit.rule}).`
          : `Forbidden string matched at line ${String(hit.position,)} (rule ${hit.rule}).`,
        path: displayPath,
      };
    },);
}
