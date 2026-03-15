/**
 * JSONC record (object) parsing — member recursion and record container parser.
 *
 * MUTUALLY RECURSIVE with {@link parseValueFromStart} via the dispatch module.
 */

import type {
  $ as StringJsonc,
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import type * as Jsonc from '../../../../t/index.ts';
import { callParseValue, } from './customParsers.dispatch.ts';
import {
  expectColonAfterKey,
  expectRecordSeparatorOrEnd,
  parseRecordKey,
} from './customParsers.recordHelpers.ts';
import { mergeComments, } from './customParsers.startsWithComment.mergeComments.ts';
import { startsWithComment, } from './customParsers.startsWithComment.ts';

//region Record value parsing -- Parse value with leading comment after colon (MUTUALLY RECURSIVE)
/**
 * Parse a record value with its leading comment after the colon.
 *
 * @param tail - Tail after the ':' token
 *
 * @returns Value node with optional comment, and remaining tail after the value
 */
export function parseRecordValue(
  tail: FragmentStringJsonc,
): { valueNode: Jsonc.Value; remaining: FragmentStringJsonc; } {
  /** Comments/whitespace after colon before the value. */
  const valueLead = startsWithComment({ value: tail, },);
  /** Parsed value node with propagated comment and the remaining tail. */
  const { parsed: valueNode, remaining, } = callParseValue(
    valueLead.comment
      ? { value: valueLead.remainingContent, context: { comment: valueLead.comment, }, }
      : { value: valueLead.remainingContent, },
  );
  return { valueNode, remaining, };
}
//endregion Record value parsing

//region One record member -- Compose key + colon + value for a single member (MUTUALLY RECURSIVE)
/**
 * Parse one complete record member (key:value pair) from the current position.
 *
 * @param tail - Tail at the start of a member (may have leading comment)
 *
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

//region Record members -- Recursive, immutable member parsing for records (MUTUALLY RECURSIVE)
/**
 * Parse key:value members immutably, propagating comments on keys/values, and return tail after '}'.
 *
 * @param tail - Input positioned at the next member or closing brace
 *
 * @param entries - Accumulated entries; treated immutably during recursion
 *
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
 *
 * @param context - Optional value base used for comment propagation
 *
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
