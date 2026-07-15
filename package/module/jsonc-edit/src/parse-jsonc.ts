import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { JsonValue, } from 'type-fest';
import type { StringJsonc, } from './brand.ts';
import { JsoncParseError, } from './errors.ts';
import { parseValue, } from './parse.ts';
import {
  appendComments,
  prependComments,
  skipTrivia,
} from './parse-trivia.ts';
import type { JsoncValue, } from './value.ts';

/**
 * Module logger for the parse entry point.
 */
const l = tagged({ tag: 'parse-jsonc', },);

//region Fast-path

/**
 * Sentinel returned when the fast-path does not apply, distinct from any parsed
 * value. A `Symbol` rather than `undefined` so the miss is an explicit value the
 * caller branches on.
 */
const FASTPATH_MISS = Symbol('jsonc fast-path miss',);

/**
 * Runs `JSON.parse`, returning FASTPATH_MISS instead of throwing when the
 * source is not clean JSON (it has comments or trailing commas).
 *
 * @param source - Full JSONC source.
 *
 * @returns Parsed value, or FASTPATH_MISS on a parse error.
 *
 * @example
 * ```ts
 * parseJsonOrMiss('{"a":1}'); // => { a: 1 }
 * parseJsonOrMiss('{"a":1,}'); // => FASTPATH_MISS
 * ```
 */
function parseJsonOrMiss(source: string,): unknown {
  try {
    return JSON.parse(source,);
  }
  catch (error: unknown) {
    tagged({
      tag: parseJsonOrMiss.name,
      l,
    },)
      .trace(`fast-path miss, falling back to structured parse: ${String(error,)}`,);
    return FASTPATH_MISS;
  }
}

/**
 * Tries the comment-free fast-path: a clean document parses with native
 * `JSON.parse` into a single `plainJson` leaf. Misses when the source has
 * comments or trailing commas, or parses to a bare scalar (which the structured
 * path rejects as an invalid top level).
 *
 * @param source - Full JSONC source.
 *
 * @returns A `plainJson` node for a clean object or array, else FASTPATH_MISS.
 *
 * @example
 * ```ts
 * fastPath('{"a":1}'); // => { kind: 'plainJson', json: { a: 1 } }
 * fastPath('42'); // => FASTPATH_MISS
 * ```
 */
function fastPath(source: string,): JsoncValue | typeof FASTPATH_MISS {
  /**
   * Native parse result, or the miss sentinel.
   */
  const parsed = parseJsonOrMiss(source,);
  if ((parsed === FASTPATH_MISS) || (parsed === null)
    || ((typeof parsed) !== 'object'))
    return FASTPATH_MISS;
  /* oxlint-disable typescript/no-unsafe-type-assertion -- JSON.parse output is JSON-shaped by construction */
  /**
   * Parsed value narrowed to the JSON value type.
   */
  const json = parsed as JsonValue;
  /* oxlint-enable typescript/no-unsafe-type-assertion */
  return {
    kind: 'plainJson',
    json,
  };
}

//endregion Fast-path

//region Entry

/**
 * Parses a JSONC document into a structured, comment-preserving value.
 *
 * A clean (comment-free, comma-correct) document takes the native `JSON.parse`
 * fast-path and returns a `plainJson` leaf. Otherwise the structured parser runs,
 * attaching comments to keys and values and tolerating trailing commas. The
 * document must be an object or array at the top level; a bare scalar is
 * rejected.
 *
 * @param source - Branded JSONC source string.
 *
 * @returns Parsed value, with comments preserved.
 *
 * @throws JsoncParseError on malformed input or a non-container top level.
 *
 * @example
 * ```ts
 * parseJsonc({ source: '{ "a": 1 } // note' as StringJsonc });
 * // => { kind: 'record', entries: [...], comment: { type: 'inline', text: ' note' } }
 * ```
 */
export function parseJsonc({
  source,
}: {
  readonly source: StringJsonc;
},): JsoncValue {
  /**
   * Fast-path result for a clean document, or the miss sentinel.
   */
  const fast = fastPath(source,);
  if (fast !== FASTPATH_MISS)
    return fast;

  /**
   * Leading document comments and the offset of the top-level value.
   */
  const lead = skipTrivia({
    source,
    index: 0,
  },);
  /**
   * First significant character; only a container may open the document.
   */
  const first = source[lead.end];
  if ((first !== '[') && (first !== '{'))
    throw new JsoncParseError({
      message: 'a JSONC document must be an object or array at the top level',
      offset: lead.end,
    },);

  /**
   * Parsed top-level value and the offset just past it.
   */
  const valueScan = parseValue({
    source,
    index: lead.end,
    depth: 0,
  },);
  /**
   * Trailing document comments and the offset past all trailing trivia.
   */
  const trailing = skipTrivia({
    source,
    index: valueScan.end,
  },);
  if (trailing.end !== source.length)
    throw new JsoncParseError({
      message: 'unexpected trailing content after top-level value',
      offset: trailing.end,
    },);

  return appendComments({
    node: prependComments({
      node: valueScan.node,
      comments: lead.comments,
    },),
    comments: trailing.comments,
  },);
}

//endregion Entry
