import type { JsonValue, } from 'type-fest';
import type { StringJsonc, } from './brand.ts';
import { JsoncParseError, } from './errors.ts';
import { parseValue, } from './parse.ts';
import {
  appendComment,
  prependComment,
  skipTrivia,
} from './parse-trivia.ts';
import type { JsoncValue, } from './value.ts';

//region Fast-path

/**
 * Tries the comment-free fast-path: a clean document parses with native
 * `JSON.parse` into a single `plainJson` leaf. Returns `undefined` when the
 * source has comments or trailing commas (so `JSON.parse` throws) or parses to a
 * bare scalar (which the structured path rejects as an invalid top level).
 *
 * @param source - Full JSONC source.
 *
 * @returns A `plainJson` node for a clean object or array, else `undefined`.
 *
 * @example
 * ```ts
 * tryFastPath('{"a":1}'); // => { kind: 'plainJson', json: { a: 1 } }
 * tryFastPath('{"a":1} // c'); // => undefined
 * ```
 */
function tryFastPath(source: string,): JsoncValue | undefined {
  /**
   * Native parse result, or a thrown error captured as a miss.
   */
  let parsed: unknown;
  try {
    parsed = JSON.parse(source,);
  }
  catch {
    return undefined;
  }
  if ((parsed !== null) && (typeof parsed === 'object'))
    return {
      kind: 'plainJson',
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse output is JSON-shaped by construction
      json: parsed as JsonValue,
    };
  return undefined;
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
 * @throws {@link JsoncParseError} on malformed input or a non-container top level.
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
  source: StringJsonc;
},): JsoncValue {
  /**
   * Fast-path result for a clean document, if it qualifies.
   */
  const fast = tryFastPath(source,);
  if (fast !== undefined)
    return fast;

  /**
   * Leading document comment and the offset of the top-level value.
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
   * Trailing document comment and the offset past all trailing trivia.
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

  return appendComment({
    node: prependComment({
      node: valueScan.node,
      comment: lead.comment,
    },),
    comment: trailing.comment,
  },);
}

//endregion Entry
