/*
  Custom JSONC parsers for arrays and objects.
  These are the careful, comment-preserving "service road" paths that handle comments, whitespace,
  and trailing commas when the fast-path cannot use JSON.parse safely.
  Region markers outline imports, function phases, and known pitfalls to aid maintainability.
*/

//region Imports and helpers -- Core types, utilities, and comment skipper used by the parsers
import type * as Jsonc from '../../../../t/index.ts';
import { mergeComments, } from './mergeComments.ts';
import { scanQuotedString, } from './scanQuotedString.ts';

import type {
  $ as StringJsonc,
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import { startsWithComment, } from './startsWithComment.ts';
/**
 * Alias for intrinsic freeze to emphasize immutability when capturing values.
 * @remarks Present for parity with modules that capture intrinsics; avoids repeated lookups.
 */
const f = Object.freeze;
//endregion Imports and helpers

//region Value tokenizers -- Pure helpers for literals and numbers with explicit contracts
/**
 * Sentinel indicating no JSON literal was matched at the current start position.
 *
 * @remarks
 * Narrow by category first using `typeof out === 'symbol'` before identity comparison to avoid incorrect
 * narrowing with symbol unions. See {@link parseLiteralToken}.
 *
 * @example
 * ```ts
 * const out = parseLiteralToken({ value: 'x' as FragmentStringJsonc });
 * if (typeof out !== 'symbol') {
 *   // literal branch
 * } else if (out === NO_LITERAL) {
 *   // non-match sentinel
 * } else {
 *   throw new Error('unexpected symbol sentinel');
 * }
 * ```
 */
export const NO_LITERAL: symbol = Symbol('jsonc:parseLiteralToken:no-match',);
/**
 * Parse JSON literal at the current position.
 * Supports: `null`, `true`, `false`.
 *
 * @remarks
 * Returns {@link NO_LITERAL} when no literal matched; handle using category-first symbol narrowing.
 *
 * @param value - Input fragment to parse from the start
 * @returns Parsed literal token with remaining fragment, or {@link NO_LITERAL} when no literal matched
 * @example
 * ```ts
 * parseLiteralToken({ value: 'null,1' as FragmentStringJsonc })
 * // → { consumed: 'null', parsed: { value: null }, remaining: ',1' }
 * ```
 */
export function parseLiteralToken(
  { value, }: { value: FragmentStringJsonc | StringJsonc; },
):
  | { consumed: FragmentStringJsonc; parsed: Jsonc.Boolean | Jsonc.Null;
    remaining: FragmentStringJsonc; }
  | typeof NO_LITERAL
{
  if (value.startsWith('null',)) {
    return { consumed: 'null' as FragmentStringJsonc, parsed: { value: null, },
      remaining: value.slice(4,) as FragmentStringJsonc, };
  }
  if (value.startsWith('true',)) {
    return { consumed: 'true' as FragmentStringJsonc, parsed: { value: true, },
      remaining: value.slice(4,) as FragmentStringJsonc, };
  }
  if (value.startsWith('false',)) {
    return { consumed: 'false' as FragmentStringJsonc, parsed: { value: false, },
      remaining: value.slice(5,) as FragmentStringJsonc, };
  }
  return NO_LITERAL;
}

/**
 * Parse a JSON number token from the start using a single-pass regex and JSON numeric semantics.
 * The regex matches the JSON number grammar and returns the longest valid numeric prefix.
 *
 * @param value - Input fragment starting at a potential number token
 * @returns Consumed span, parsed number node, and remaining fragment after the number
 * @throws Error - When the start does not match a valid JSON number grammar
 * @example
 * ```ts
 * parseNumberToken({ value: '-12.3e+4, x' as FragmentStringJsonc })
 * // → { consumed: '-12.3e+4', parsed: { value: -123000 }, remaining: ', x' }
 * ```
 */
export function parseNumberToken(
  { value, }: { value: FragmentStringJsonc | StringJsonc; },
): { consumed: FragmentStringJsonc; parsed: Jsonc.Number;
  remaining: FragmentStringJsonc; }
{
  /**
   * JSON number grammar (no leading +, leading 0 rules, optional fraction and exponent).
   * Matches the longest valid numeric prefix at position 0.
   */
  const NUMBER_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[Ee][+-]?\d+)?/;
  /** Regex match result for numeric token anchored at start. */
  const match = NUMBER_RE.exec(value,);
  if (!match || match.index !== 0)
    throw new Error('malformed jsonc, non-number after number marker',);
  /** Span consumed for the number token (kept as fragment for immutability). */
  const consumed = match[0] as FragmentStringJsonc;
  /** Exact numeric semantics via JSON.parse; avoids manual float/exp handling. */
  const parsedValue = JSON.parse(consumed,) as number;
  return { consumed, parsed: { value: parsedValue, },
    remaining: value.slice(consumed.length,) as FragmentStringJsonc, };
}
//endregion Value tokenizers

//region Value dispatcher -- Single entry to parse one value from the start
/**
 * Parse a single JSONC value from the current position, delegating to container parsers and propagating `context.comment`.
 *
 * @remarks
 * Follows category-first symbol narrowing for results of {@link parseLiteralToken}; propagates `context.comment` onto produced nodes.
 *
 * @param value - Input fragment to parse from the start
 * @param context - Optional value base whose `comment` is attached to the produced node
 * @returns Parsed value node and remaining fragment starting at the next token
 * @throws Error - When no valid JSONC value start token is present
 * @example
 * ```ts
 * parseValueFromStart({ value: '"x" ,', }) // → parsed string, remaining ' ,'
 * parseValueFromStart({ value: '[1]', }) // → parsed array, remaining ''
 * ```
 */
export function parseValueFromStart(
  { value, context, }: { value: FragmentStringJsonc | StringJsonc;
    context?: Jsonc.ValueBase; },
): { parsed: Jsonc.Value; remaining: FragmentStringJsonc; } {
  if (value.startsWith('"',)) {
    /** Result of scanning the leading quoted string, with parsed node and tail. */
    const out = scanQuotedString({ value, },);
    /** Final value node for string branch after optional comment propagation. */
    const parsed: Jsonc.Value = context?.comment
      ? { ...out.parsed, comment: context.comment, }
      : out.parsed;
    return { parsed, remaining: out.remaining, };
  }

  const literal = parseLiteralToken({ value, },);
  if (typeof literal !== 'symbol') {
    /** Matched literal node and remaining fragment extracted from tokenizer result. */
    const { parsed: litParsed, remaining, } = literal;
    /** Final value node for literal branch with optional comment propagation. */
    const parsed: Jsonc.Value = context?.comment
      ? { ...litParsed, comment: context.comment, }
      : litParsed;
    return { parsed, remaining, };
  }

  if (value.startsWith('[',)) {
    /** Delegated array parse preserving comments; context provides array-level comment. */
    const out = context
      ? customParserForArray({ value, context, },)
      : customParserForArray({ value, },);
    /** Strip `remainingContent` to produce standard Value shape for the caller. */
    const { remainingContent, ...parsed } = out;
    return { parsed: parsed as Jsonc.Value, remaining: remainingContent, };
  }

  if (value.startsWith('{',)) {
    /** Delegated object parse preserving comments; context comment applies to record node. */
    const out = context
      ? customParserForRecord({ value, context, },)
      : customParserForRecord({ value, },);
    /** Strip `remainingContent` to produce standard Value shape for the caller. */
    const { remainingContent, ...parsed } = out;
    return { parsed: parsed as Jsonc.Value, remaining: remainingContent, };
  }

  if (['-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',].some(m =>
    value.startsWith(m,)
  )) {
    /** Delegated number token parse; ensures JSON numeric semantics. */
    const out = parseNumberToken({ value, },);
    /** Final value node for number branch with optional comment propagation. */
    const parsed: Jsonc.Value = context?.comment
      ? { ...out.parsed, comment: context.comment, }
      : out.parsed;
    return { parsed, remaining: out.remaining, };
  }

  throw new Error('invalid jsonc value start',);
}
//endregion Value dispatcher

//region Array header -- Consume '[' then leading comments to capture array-level comment
/**
 * After the opening '[', compute the array-level comment (if any) and return the tail at the first element or ']'.
 *
 * @param valueAfterBracket - Substring immediately following '['
 * @param context - Optional value whose `comment` represents the array-level comment
 * @returns Array-level comment (when present) and the unparsed tail within the array
 * @example
 * ```ts
 * parseArrayHeader('[ /* c *\/ 1,2]TAIL'.slice(1) as FragmentStringJsonc)
 * // → { arrayComment: { /* ... *\/ }, tail: ' 1,2]TAIL' as FragmentStringJsonc }
 * ```
 */
export function parseArrayHeader(
  valueAfterBracket: FragmentStringJsonc | StringJsonc,
  context?: Jsonc.ValueBase,
): { arrayComment?: Jsonc.Comment; tail: FragmentStringJsonc; } {
  // Array-level comment comes from outside the '[' via context; do not consume inside comments here.
  return {
    ...(context?.comment ? { arrayComment: context.comment, } : {}),
    tail: valueAfterBracket as FragmentStringJsonc,
  };
}
//endregion Array header

//region Array separators -- Determine end of array or next element start
/**
 * Given the raw tail after an element, consume comments/whitespace once and decide next action.
 *
 * @param value - Tail beginning after an element value
 * @returns Discriminated union: `'end'` with tail after ']' or `'next'` with the next element's start
 * @throws Error - When neither ',' nor ']' is found in a valid position
 */
export function expectArraySeparatorOrEnd(
  value: FragmentStringJsonc,
): { kind: 'end'; tail: FragmentStringJsonc; } | { kind: 'next';
  tailStart: FragmentStringJsonc; }
{
  /** Leading comments/whitespace after previous element value. */
  const after = startsWithComment({ value, },);
  /** Tail trimmed to detect ',' or ']' token. */
  const rc = after.remainingContent.trimStart() as FragmentStringJsonc;

  if (rc.startsWith(']',))
    return { kind: 'end', tail: rc.slice(1,) as FragmentStringJsonc, };

  if (rc.startsWith(',',)) {
    /** Tail after the element separator comma. */
    const afterComma = rc.slice(1,) as FragmentStringJsonc;
    /** Comments/whitespace before the next potential element. */
    const next = startsWithComment({ value: afterComma, },);
    /** Start of the next token inside the array. */
    const nextToken = next.remainingContent.trimStart() as FragmentStringJsonc;
    if (nextToken.startsWith(']',))
      return { kind: 'end', tail: nextToken.slice(1,) as FragmentStringJsonc, };
    return { kind: 'next', tailStart: nextToken, };
  }

  /** Preview snippet used for error reporting context. */
  const preview = rc.slice(0, 32,);
  throw new Error(`malformed jsonc array: expected ',' or ']' near: ${preview}`,);
}
//endregion Array separators

//region Array elements -- Recursive, immutable element parsing for arrays
/**
 * Parse one or more array elements starting from a tail, returning accumulated items and the tail after ']'.
 *
 * @param tail - Input tail positioned at the start of the next element or closing bracket
 * @param items - Collected items so far; treated immutably during recursion
 * @returns Items parsed up to ']' and the remaining tail after the closing bracket
 */
export function parseArrayElements(
  tail: FragmentStringJsonc,
  items: readonly Jsonc.Value[] = [],
): { items: readonly Jsonc.Value[]; tail: FragmentStringJsonc; } {
  /** Leading comments at element start; carries per-element comment. */
  const lead = startsWithComment({ value: tail, },);
  /** Start positioned at element value or closing bracket. */
  const start = lead.remainingContent;

  if (start.startsWith(']',))
    return { items, tail: start.slice(1,) as FragmentStringJsonc, };

  /** Parsed value from current element with propagated comment. */
  const { parsed, remaining, } = parseValueFromStart({ value: start, context: lead, },);
  /** Separator decision following the element. */
  const decision = expectArraySeparatorOrEnd(remaining,);
  if (decision.kind === 'end')
    return { items: [...items, parsed,], tail: decision.tail, };
  return parseArrayElements(decision.tailStart, [...items, parsed,],);
}
//endregion Array elements

/**
 * Parse a JSONC array fragment starting at '[' while preserving comments and returning the unconsumed tail.
 *
 * Why: Global regex edits are unsafe in the presence of quotes and comments; advancing token-by-token preserves intent.
 *
 * @param value - Input fragment beginning with '['
 * @param context - Optional value base whose `comment` becomes the array-level comment
 * @returns Parsed array node and `remainingContent` positioned after the closing ']'
 * @example
 * ```ts
 * customParserForArray({ value: '[1, /* c *\/ 2]X' as FragmentStringJsonc })
 * // → { value: [{value:1},{value:2}], remainingContent: 'X' as FragmentStringJsonc }
 * ```
 */
export function customParserForArray(
  { value, context, }: { value: FragmentStringJsonc | StringJsonc;
    context?: Jsonc.ValueBase; },
): Jsonc.Array & { remainingContent: FragmentStringJsonc; } {
  //region Entry and comment skip -- Drop the opening '[' then consume leading comments/space
  /** Tail after stripping the opening '[' to keep pointer immutable. */
  const woOpening = value.slice('['.length,) as FragmentStringJsonc;
  /** Array-level comment from context and header tail inside brackets. */
  const { arrayComment, tail: headerTail, } = parseArrayHeader(woOpening, context,);
  //endregion Entry and comment skip

  //region Empty array fast-exit -- Handle immediate closing bracket
  // Peek for closing bracket after consuming only inside-the-bracket comments;
  // if empty, merge inside comments into array-level comment.
  /** Leading comments/spaces directly inside '[' before first element or ']'. */
  const insideLead = startsWithComment({ value: headerTail, },);
  if (insideLead.remainingContent.startsWith(']',)) {
    /** Combined array-level comment when header and inside comments are present. */
    let finalComment: Jsonc.Comment | undefined;
    if (arrayComment && insideLead.comment)
      finalComment = mergeComments({ value: arrayComment, value2: insideLead.comment, },);
    else if (arrayComment)
      finalComment = mergeComments({ value: arrayComment, },);
    else if (insideLead.comment)
      finalComment = mergeComments({ value2: insideLead.comment, },);
    return {
      value: [] as Jsonc.Value[],
      ...(finalComment ? { comment: finalComment, } : {}),
      remainingContent: insideLead.remainingContent.slice(
        ']'.length,
      ) as FragmentStringJsonc,
    };
  }
  //endregion Empty array fast-exit

  //region Element recursion -- Delegate to exported pure helper
  /** Parsed items and tail after the terminating ']'. */
  const { items, tail, } = parseArrayElements(headerTail, [],);
  return {
    value: items as Jsonc.Value[],
    ...(arrayComment ? { comment: arrayComment, } : {}),
    remainingContent: tail,
  };
  //endregion Element recursion
}

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

//region Record value parsing -- Parse value with leading comment after colon
/**
 * Parse a record value with its leading comment after the colon.
 *
 * @param tail - Tail after the ':' token
 * @returns Value node with optional comment, and remaining tail after the value
 */
export function parseRecordValue(
  tail: FragmentStringJsonc,
): { valueNode: Jsonc.Value; remaining: FragmentStringJsonc; } {
  /** Comments/whitespace after colon before the value. */
  const valueLead = startsWithComment({ value: tail, },);
  /** Parsed value node with propagated comment and the remaining tail. */
  const { parsed: valueNode, remaining, } = parseValueFromStart(
    valueLead.comment
      ? { value: valueLead.remainingContent, context: { comment: valueLead.comment, }, }
      : { value: valueLead.remainingContent, },
  );
  return { valueNode, remaining, };
}
//endregion Record value parsing

//region One record member -- Compose key + colon + value for a single member
/**
 * Parse one complete record member (key:value pair) from the current position.
 *
 * @param tail - Tail at the start of a member (may have leading comment)
 * @returns Entry tuple [key, value] and remaining tail after the value
 */
export function parseOneRecordMember(
  tail: FragmentStringJsonc,
): { entry: [Jsonc.RecordKey, Jsonc.Value,]; remaining: FragmentStringJsonc; } {
  const { keyNode, remaining: afterKey, } = parseRecordKey(tail,);
  const afterColon = expectColonAfterKey(afterKey,);
  const { valueNode, remaining, } = parseRecordValue(afterColon,);
  return { entry: [keyNode, valueNode,], remaining, };
}
//endregion One record member

//region Record members -- Recursive, immutable member parsing for records
/**
 * Parse key:value members immutably, propagating comments on keys/values, and return tail after '}'.
 *
 * @param tail - Input positioned at the next member or closing brace
 * @param entries - Accumulated entries; treated immutably during recursion
 * @returns Entries parsed up to '}' and the remaining tail after the closing brace
 */
export function parseRecordMembers(
  tail: FragmentStringJsonc,
  entries: readonly [Jsonc.RecordKey, Jsonc.Value,][] = [],
): { entries: readonly [Jsonc.RecordKey, Jsonc.Value,][]; tail: FragmentStringJsonc; } {
  /** Leading comments at member start; check for closing brace. */
  const lead = startsWithComment({ value: tail, },);
  /** Start positioned at quoted key or closing brace. */
  const start = lead.remainingContent;

  if (start.startsWith('}',))
    return { entries, tail: start.slice('}'.length,) as FragmentStringJsonc, };

  /** Parse one member from current position. */
  const { entry, remaining, } = parseOneRecordMember(tail,);
  /** Separator/end decision for subsequent member parsing. */
  const decision = expectRecordSeparatorOrEnd(remaining,);
  /** Immutable accumulation of parsed entries. */
  const nextEntries = [...entries, entry,];
  return decision.kind === 'end'
    ? { entries: nextEntries, tail: decision.tail, }
    : parseRecordMembers(decision.tailStart, nextEntries,);
}
//endregion Record members

/**
 * Parse a JSONC object fragment starting at '{' while preserving comments.
 *
 * Parses quoted keys and their values with comments tolerated around keys, colons, and values.
 * Accepts a trailing comma before the closing '}' and returns `remainingContent` after the '}'.
 *
 * @param value - Input fragment beginning with '{'
 * @param context - Optional value base used for comment propagation
 * @returns Parsed record node and `remainingContent` after the closing '}'
 */
export function customParserForRecord(
  { value, context, }: { value: FragmentStringJsonc | StringJsonc;
    context?: Jsonc.ValueBase; },
): Jsonc.Record & { remainingContent: FragmentStringJsonc; } {
  //region Entry and empty-object fast-exit
  /** Tail after stripping the opening '{' to keep pointer immutable. */
  const woOpening = value.slice('{'.length,) as FragmentStringJsonc;
  /** Leading comments/spaces directly inside '{' before first member or '}'. */
  const insideLead = startsWithComment({ value: woOpening, },);
  if (insideLead.remainingContent.startsWith('}',)) {
    /** Combined record-level comment when context and inside comments are present. */
    let finalComment: Jsonc.Comment | undefined;
    if (context?.comment && insideLead.comment) {
      finalComment = mergeComments({ value: context.comment, value2: insideLead
        .comment, },);
    }
    else if (context?.comment)
      finalComment = mergeComments({ value: context.comment, },);
    else if (insideLead.comment)
      finalComment = mergeComments({ value2: insideLead.comment, },);

    return {
      value: new Map(),
      ...(finalComment ? { comment: finalComment, } : {}),
      remainingContent: insideLead.remainingContent.slice(
        '}'.length,
      ) as FragmentStringJsonc,
    };
  }
  //endregion Entry and empty-object fast-exit

  //region Members recursion
  /** Parsed entries and tail after the terminating '}'. */
  const { entries, tail, } = parseRecordMembers(woOpening, [],);
  return {
    value: new Map(entries,),
    ...(context?.comment ? { comment: context.comment, } : {}),
    remainingContent: tail,
  };
  //endregion Members recursion
}