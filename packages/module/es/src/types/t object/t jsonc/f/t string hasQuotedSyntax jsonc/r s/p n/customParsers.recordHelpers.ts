import type {
  $ as StringJsonc,
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import type * as Jsonc from '../../../../t/index.ts';
import { startsWithComment, } from './customParsers.startsWithComment.ts';
import { scanQuotedString, } from './customParsers.scanQuotedString.ts';

//region Record header -- Consume '{' then extract record-level comment from context
/**
 * After the opening '{', extract the record-level comment (if any) from context.
 *
 * @param valueAfterBrace - Substring immediately following '{'
 * @param context - Optional value whose `comment` represents the record-level comment
 * @returns Record-level comment (when present) and the unparsed tail within the record
 * @example
 * ```ts
 * parseRecordHeader('{ /* c *\/ "a":1}TAIL'.slice(1) as FragmentStringJsonc)
 * // → { recordComment: undefined, tail: ' /* c *\/ "a":1}TAIL' as FragmentStringJsonc }
 * ```
 */
export function parseRecordHeader(
  valueAfterBrace: FragmentStringJsonc | StringJsonc,
  context?: Jsonc.ValueBase,
): { recordComment?: Jsonc.Comment; tail: FragmentStringJsonc; } {
  return {
    ...(context?.comment ? { recordComment: context.comment, } : {}),
    tail: valueAfterBrace as FragmentStringJsonc,
  };
}
//endregion Record header

//region Record separators -- Determine end of record or next member start
/**
 * After a record value, consume comments/whitespace once and decide next action.
 *
 * @param tail - Tail beginning after a value token
 * @returns Discriminated union: `'end'` with tail after '}' or `'next'` with the next member's start
 * @throws Error - When neither ',' nor '}' is found in a valid position
 */
export function expectRecordSeparatorOrEnd(
  tail: FragmentStringJsonc,
): { kind: 'end'; tail: FragmentStringJsonc; } | { kind: 'next';
  tailStart: FragmentStringJsonc; }
{
  /** Leading comments/whitespace after previous member. */
  const after = startsWithComment({ value: tail, },);
  /** Tail trimmed to detect ',' or '}' token. */
  const rc = after.remainingContent.trimStart() as FragmentStringJsonc;

  if (rc.startsWith('}',))
    return { kind: 'end', tail: rc.slice('}'.length,) as FragmentStringJsonc, };

  if (rc.startsWith(',',)) {
    /** Tail after the member separator comma. */
    const afterComma = rc.slice(1,) as FragmentStringJsonc;
    /** Comments/whitespace before the next potential member. */
    const next = startsWithComment({ value: afterComma, },);
    /** Start of the next token inside the record. */
    const nextToken = next.remainingContent.trimStart() as FragmentStringJsonc;
    if (nextToken.startsWith('}',))
      return { kind: 'end', tail: nextToken.slice('}'.length,) as FragmentStringJsonc, };
    return { kind: 'next', tailStart: nextToken, };
  }

  /** Preview snippet used for error reporting context. */
  const preview = rc.slice(0, 32,);
  throw new Error(`malformed jsonc object: expected ',' or '}' near: ${preview}`,);
}
//endregion Record separators

//region Record key parsing -- Parse a single key with its leading comment
/**
 * Parse a single record key with its leading comment.
 *
 * @param tail - Tail positioned at potential key start (may have leading comment/whitespace)
 * @returns Key node with optional comment, and remaining tail after the key
 * @throws Error - When the tail does not start with a quoted string
 */
export function parseRecordKey(
  tail: FragmentStringJsonc,
): { keyNode: Jsonc.RecordKey; remaining: FragmentStringJsonc; } {
  /** Leading comments at key start; carries per-key comment. */
  const lead = startsWithComment({ value: tail, },);
  /** Start positioned at quoted key. */
  const start = lead.remainingContent;

  if (!start.startsWith('"',))
    throw new Error('malformed jsonc object: expected quoted key',);

  /** Scanned quoted key with tail after closing quote. */
  const keyScan = scanQuotedString({ value: start, },);
  /** Key node with optional propagated leading comment. */
  const keyNode: Jsonc.RecordKey = lead.comment
    ? { ...keyScan.parsed, comment: lead.comment, }
    : keyScan.parsed;

  return { keyNode, remaining: keyScan.remaining, };
}
//endregion Record key parsing

//region Colon expectation -- Verify ':' after key
/**
 * Consume comments/whitespace after key and verify ':' is present.
 *
 * @param tail - Tail after the key
 * @returns Tail after the ':' token
 * @throws Error - When ':' is not found after consuming comments/whitespace
 */
export function expectColonAfterKey(
  tail: FragmentStringJsonc,
): FragmentStringJsonc {
  /** Comments/whitespace after key before the colon. */
  const afterKeyLead = startsWithComment({ value: tail, },);
  /** Tail starting at ':' or error position. */
  const rc = afterKeyLead.remainingContent.trimStart() as FragmentStringJsonc;
  if (!rc.startsWith(':',))
    throw new Error("malformed jsonc object: expected ':' after key",);
  return rc.slice(':'.length,) as FragmentStringJsonc;
}
//endregion Colon expectation
