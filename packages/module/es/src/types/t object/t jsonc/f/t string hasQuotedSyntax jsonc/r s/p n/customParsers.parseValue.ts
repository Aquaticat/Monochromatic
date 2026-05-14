/**
 * JSONC value dispatcher: the entry point for parsing a single JSONC value.
 *
 * MUTUALLY RECURSIVE with array and record core parsers via the dispatch module.
 * Registers itself with {@link registerParseValue} at module load.
 */

import type {
  $ as StringJsonc,
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import type * as Jsonc from '../../../../t/index.ts';
import { customParserForArray, } from './customParsers.arrayCore.ts';
import { registerParseValue, } from './customParsers.dispatch.ts';
import { customParserForRecord, } from './customParsers.recordCore.ts';
import { scanQuotedString, } from './customParsers.scanQuotedString.ts';
import {
  parseLiteralToken,
  parseNumberToken,
} from './customParsers.tokenizers.ts';

//region Value dispatcher: Single entry to parse one value from the start (MUTUALLY RECURSIVE)
/**
 * Parse a single JSONC value from the current position, delegating to container parsers and propagating `context.comment`.
 *
 * @remarks
 * Follows category-first symbol narrowing for results of {@link parseLiteralToken}; propagates `context.comment` onto produced nodes.
 * MUTUALLY RECURSIVE with customParserForArray and customParserForRecord.
 *
 * @param value - Input fragment to parse from the start
 *
 * @param context - Optional value base whose `comment` is attached to the produced node
 *
 * @returns Parsed value node and remaining fragment starting at the next token
 *
 * @throws Error - When no valid JSONC value start token is present
 *
 * @example
 * ```ts
 * parseValueFromStart({ value: '"x" ,', }) // → parsed string, remaining ' ,'
 * parseValueFromStart({ value: '[1]', }) // → parsed array, remaining ''
 * ```
 */
export function parseValueFromStart(
  {
    value,
    context,
  }: {
    value: FragmentStringJsonc | StringJsonc;
    context?: Jsonc.ValueBase;
  },
): {
  parsed: Jsonc.Value;
  remaining: FragmentStringJsonc;
} {
  if (value.startsWith('"',)) {
    /** Result of scanning the leading quoted string, with parsed node and tail. */
    const out = scanQuotedString({ value, },);
    /** Final value node for string branch after optional comment propagation. */
    const parsed: Jsonc.Value = context?.comment
      ? {
        ...out.parsed,
        comment: context.comment,
      }
      : out.parsed;
    return {
      parsed,
      remaining: out.remaining,
    };
  }

  /** Literal token attempt, or a sentinel symbol when the input is not a literal. */
  const literal = parseLiteralToken({ value, },);
  if ((typeof literal) !== 'symbol') {
    /** Matched literal node and remaining fragment extracted from tokenizer result. */
    const {
      parsed: litParsed,
      remaining,
    } = literal;
    /** Final value node for literal branch with optional comment propagation. */
    const parsed: Jsonc.Value = context?.comment
      ? {
        ...litParsed,
        comment: context.comment,
      }
      : litParsed;
    return {
      parsed,
      remaining,
    };
  }

  if (value.startsWith('[',)) {
    /** Delegated array parse preserving comments; context provides array-level comment. */
    const out = context
      ? customParserForArray({
        value,
        context,
      },)
      : customParserForArray({ value, },);
    /** Strip `remainingContent` to produce standard Value shape for the caller. */
    const {
      remainingContent,
      ...parsed
    } = out;
    return {
      parsed: parsed as Jsonc.Value,
      remaining: remainingContent,
    };
  }

  if (value.startsWith('{',)) {
    /** Delegated object parse preserving comments; context comment applies to record node. */
    const out = context
      ? customParserForRecord({
        value,
        context,
      },)
      : customParserForRecord({ value, },);
    /** Strip `remainingContent` to produce standard Value shape for the caller. */
    const {
      remainingContent,
      ...parsed
    } = out;
    return {
      parsed: parsed as Jsonc.Value,
      remaining: remainingContent,
    };
  }

  if ([
    '-',
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
  ]
    .some(
      function startsWithDigit(m,) {
        return value.startsWith(m,);
      },
    ))
  {
    /** Delegated number token parse; ensures JSON numeric semantics. */
    const out = parseNumberToken({ value, },);
    /** Final value node for number branch with optional comment propagation. */
    const parsed: Jsonc.Value = context?.comment
      ? {
        ...out.parsed,
        comment: context.comment,
      }
      : out.parsed;
    return {
      parsed,
      remaining: out.remaining,
    };
  }

  throw new Error('invalid jsonc value start',);
}

/** Register with dispatch so array/record cores can call back without circular imports. */
registerParseValue(parseValueFromStart,);
//endregion Value dispatcher
