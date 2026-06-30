import type { JsoncComment, } from './comment.ts';
import { JsoncParseError, } from './errors.ts';
import {
  appendComment,
  captureTrailing,
  prependComment,
  skipTrivia,
} from './parse-trivia.ts';
import {
  matchKeyword,
  scanNumber,
  scanString,
} from './scan.ts';
import type {
  JsoncKey,
  JsoncValue,
} from './value.ts';

//region Constants

/**
 * Maximum container nesting depth. Structural recursion is bounded so a
 * deeply-nested attacker-controlled document cannot overflow the call stack;
 * beyond this the parser throws rather than crashing.
 */
const MAX_DEPTH = 512;

/**
 * `true` literal keyword.
 */
const KEYWORD_TRUE = 'true';

/**
 * `false` literal keyword.
 */
const KEYWORD_FALSE = 'false';

/**
 * `null` literal keyword.
 */
const KEYWORD_NULL = 'null';

/**
 * Digits that may begin a number (a leading `-` is handled separately).
 */
const DIGITS = new Set([
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
],);

//endregion Constants

//region Value scan result

/**
 * A parsed node paired with the offset just past it.
 */
export type ValueScan = {
  node: JsoncValue;
  end: number;
};

//endregion Value scan result

//region Parser

/**
 * Parses one JSONC value starting at `index`, recursing into containers. The
 * leading and trailing comments around the value are attached by the caller
 * (containers) or by {@link parseDocument}; this function attaches only comments
 * found strictly inside the value.
 *
 * @param source - Full JSONC source.
 *
 * @param index - Offset of the value's first character.
 *
 * @param depth - Current nesting depth, guarded against overflow.
 *
 * @returns Parsed node and end offset.
 *
 * @throws {@link JsoncParseError} on malformed input or excessive nesting.
 *
 * @example
 * ```ts
 * parseValue({ source: 'true', index: 0, depth: 0 });
 * // => { node: { kind: 'boolean', value: true }, end: 4 }
 * ```
 */
export function parseValue({
  source,
  index,
  depth,
}: {
  source: string;
  index: number;
  depth: number;
},): ValueScan {
  if (depth > MAX_DEPTH)
    throw new JsoncParseError({
      message: 'nesting too deep',
      offset: index,
    },);

  /**
   * First character of the value, selecting which production to parse.
   */
  const char = source[index];
  if (char === '{')
    return parseRecord({
      source,
      index,
      depth,
    },);
  if (char === '[')
    return parseArray({
      source,
      index,
      depth,
    },);
  if (char === '"') {
    /**
     * Scanned string token.
     */
    const scan = scanString({
      source,
      index,
    },);
    return {
      node: {
        kind: 'string',
        value: scan.value,
        raw: scan.raw,
      },
      end: scan.end,
    };
  }
  if (matchKeyword({
    source,
    index,
    keyword: KEYWORD_TRUE,
  },))
    return {
      node: {
        kind: 'boolean',
        value: true,
      },
      end: index + KEYWORD_TRUE.length,
    };
  if (matchKeyword({
    source,
    index,
    keyword: KEYWORD_FALSE,
  },))
    return {
      node: {
        kind: 'boolean',
        value: false,
      },
      end: index + KEYWORD_FALSE.length,
    };
  if (matchKeyword({
    source,
    index,
    keyword: KEYWORD_NULL,
  },))
    return {
      node: { kind: 'null', },
      end: index + KEYWORD_NULL.length,
    };
  if ((char === '-') || ((char !== undefined) && DIGITS.has(char,))) {
    /**
     * Scanned number token.
     */
    const scan = scanNumber({
      source,
      index,
    },);
    return {
      node: {
        kind: 'number',
        value: scan.value,
        raw: scan.raw,
      },
      end: scan.end,
    };
  }
  throw new JsoncParseError({
    message: `unexpected character ${JSON.stringify(char ?? '<eof>',)}`,
    offset: index,
  },);
}

/**
 * Parses an array body starting at the `[`. Elements carry their leading and
 * trailing comments; a comment sitting before the closing `]` attaches to the
 * last element, or to the array itself when the array is empty. A trailing comma
 * before the close is tolerated.
 *
 * @param source - Full JSONC source.
 *
 * @param index - Offset of the opening bracket.
 *
 * @param depth - Current nesting depth.
 *
 * @returns Parsed array node and end offset.
 *
 * @throws {@link JsoncParseError} when the array is malformed or unterminated.
 *
 * @example
 * ```ts
 * parseArray({ source: '[1, 2,]', index: 0, depth: 0 });
 * // => { node: { kind: 'array', elements: [...] }, end: 7 }
 * ```
 */
function parseArray({
  source,
  index,
  depth,
}: {
  source: string;
  index: number;
  depth: number;
},): ValueScan {
  /**
   * Accumulated element nodes, built in place during the scan.
   */
  const elements: JsoncValue[] = [];
  /**
   * Cursor advanced past the opening bracket.
   */
  let cursor = index + 1;
  for (;;) {
    /**
     * Leading comment and next significant offset.
     */
    const lead = skipTrivia({
      source,
      index: cursor,
    },);
    cursor = lead.end;
    if (cursor >= source.length)
      throw new JsoncParseError({
        message: 'unterminated array',
        offset: index,
      },);
    if (source[cursor] === ']') {
      cursor += 1;
      return {
        node: closeArray({
          elements,
          dangling: lead.comment,
        },),
        end: cursor,
      };
    }
    /**
     * Element value scanned at the cursor.
     */
    const valueScan = parseValue({
      source,
      index: cursor,
      depth: depth + 1,
    },);
    cursor = valueScan.end;
    /**
     * Trailing same-line comment and comma after the element.
     */
    const trailing = captureTrailing({
      source,
      index: cursor,
    },);
    cursor = trailing.end;
    elements.push(
      appendComment({
        node: prependComment({
          node: valueScan.node,
          comment: lead.comment,
        },),
        comment: trailing.comment,
      },),
    );
    if (!trailing.commaSeen) {
      /**
       * Lookahead confirming only a close may follow when no comma was seen.
       */
      const peek = skipTrivia({
        source,
        index: cursor,
      },);
      if (source[peek.end] !== ']')
        throw new JsoncParseError({
          message: 'expected , or ] in array',
          offset: peek.end,
        },);
    }
  }
}

/**
 * Attaches a comment found before an array's closing bracket: to the last
 * element when present, otherwise to the empty array node.
 *
 * @param elements - Parsed elements (mutated in place when a dangling comment
 * attaches to the last one).
 *
 * @param dangling - Comment found before the close, if any.
 *
 * @returns Array node.
 *
 * @example
 * ```ts
 * closeArray({ elements: [], dangling: { type: 'block', text: ' x ' } });
 * // => { kind: 'array', elements: [], comment: { type: 'block', text: ' x ' } }
 * ```
 */
function closeArray({
  elements,
  dangling,
}: {
  elements: JsoncValue[];
  dangling: JsoncComment | undefined;
},): JsoncValue {
  if ((dangling !== undefined) && (elements.length > 0)) {
    /**
     * Last element, receiving the comment found before the close.
     */
    const last = elements[elements.length - 1];
    if (last !== undefined)
      elements[elements.length - 1] = appendComment({
        node: last,
        comment: dangling,
      },);
  }
  /**
   * Comment owned by the array node itself (only when it has no elements).
   */
  const ownComment = (elements.length === 0)
    ? dangling
    : undefined;
  /**
   * Array node before any own-comment attachment.
   */
  const arrayNode: JsoncValue = {
    kind: 'array',
    elements,
  };
  return appendComment({
    node: arrayNode,
    comment: ownComment,
  },);
}

/**
 * Parses an object body starting at the `{`. Each key carries the comment that
 * precedes it (and any comment between key and colon); each value carries the
 * comment between colon and value plus its trailing comment. Duplicate keys are
 * preserved as separate entries. A trailing comma before the close is tolerated.
 *
 * @param source - Full JSONC source.
 *
 * @param index - Offset of the opening brace.
 *
 * @param depth - Current nesting depth.
 *
 * @returns Parsed record node and end offset.
 *
 * @throws {@link JsoncParseError} when the object is malformed or unterminated.
 *
 * @example
 * ```ts
 * parseRecord({ source: '{"a":1,}', index: 0, depth: 0 });
 * // => { node: { kind: 'record', entries: [...] }, end: 8 }
 * ```
 */
function parseRecord({
  source,
  index,
  depth,
}: {
  source: string;
  index: number;
  depth: number;
},): ValueScan {
  /**
   * Accumulated key-to-value entries.
   */
  const entries: { key: JsoncKey; value: JsoncValue; }[] = [];
  /**
   * Cursor advanced past the opening brace.
   */
  let cursor = index + 1;
  for (;;) {
    /**
     * Leading comment before the key, and next significant offset.
     */
    const lead = skipTrivia({
      source,
      index: cursor,
    },);
    cursor = lead.end;
    if (cursor >= source.length)
      throw new JsoncParseError({
        message: 'unterminated object',
        offset: index,
      },);
    if (source[cursor] === '}') {
      cursor += 1;
      return {
        node: closeRecord({
          entries,
          dangling: lead.comment,
        },),
        end: cursor,
      };
    }
    if (source[cursor] !== '"')
      throw new JsoncParseError({
        message: 'expected string key or } in object',
        offset: cursor,
      },);
    /**
     * Parsed key with its leading comment, advancing the cursor past the value.
     */
    const entry = parseEntry({
      source,
      index: cursor,
      depth,
      leadComment: lead.comment,
    },);
    cursor = entry.end;
    entries.push({
      key: entry.key,
      value: entry.value,
    },);
    if (!entry.commaSeen) {
      /**
       * Lookahead confirming only a close may follow when no comma was seen.
       */
      const peek = skipTrivia({
        source,
        index: cursor,
      },);
      if (source[peek.end] !== '}')
        throw new JsoncParseError({
          message: 'expected , or } in object',
          offset: peek.end,
        },);
    }
  }
}

/**
 * Parses one `"key": value` entry, attaching the comment before the key, any
 * comment between key and colon, the comment between colon and value, and the
 * value's trailing comment.
 *
 * @param source - Full JSONC source.
 *
 * @param index - Offset of the key's opening quote.
 *
 * @param depth - Current nesting depth.
 *
 * @param leadComment - Comment that preceded the key.
 *
 * @returns Key, value, whether a comma followed, and the end offset.
 *
 * @throws {@link JsoncParseError} when the colon is missing.
 *
 * @example
 * ```ts
 * parseEntry({ source: '"a": 1', index: 0, depth: 0, leadComment: undefined });
 * // => { key: { value: 'a', ... }, value: { kind: 'number', value: 1, ... }, commaSeen: false, end: 6 }
 * ```
 */
function parseEntry({
  source,
  index,
  depth,
  leadComment,
}: {
  source: string;
  index: number;
  depth: number;
  leadComment: JsoncComment | undefined;
},): {
  key: JsoncKey;
  value: JsoncValue;
  commaSeen: boolean;
  end: number;
} {
  /**
   * Scanned key string token.
   */
  const keyScan = scanString({
    source,
    index,
  },);
  /**
   * Comment sitting between the key and its colon.
   */
  const beforeColon = skipTrivia({
    source,
    index: keyScan.end,
  },);
  if (source[beforeColon.end] !== ':')
    throw new JsoncParseError({
      message: 'expected : after object key',
      offset: beforeColon.end,
    },);
  /**
   * Comment sitting between the colon and the value.
   */
  const beforeValue = skipTrivia({
    source,
    index: beforeColon.end + 1,
  },);
  /**
   * Value scanned after the colon.
   */
  const valueScan = parseValue({
    source,
    index: beforeValue.end,
    depth: depth + 1,
  },);
  /**
   * Trailing same-line comment and comma after the value.
   */
  const trailing = captureTrailing({
    source,
    index: valueScan.end,
  },);
  /**
   * Bare key node before its leading and inter-colon comments attach.
   */
  const baseKey: JsoncKey = {
    value: keyScan.value,
    raw: keyScan.raw,
  };
  return {
    key: appendComment({
      node: prependComment({
        node: baseKey,
        comment: leadComment,
      },),
      comment: beforeColon.comment,
    },),
    value: appendComment({
      node: prependComment({
        node: valueScan.node,
        comment: beforeValue.comment,
      },),
      comment: trailing.comment,
    },),
    commaSeen: trailing.commaSeen,
    end: trailing.end,
  };
}

/**
 * Attaches a comment found before an object's closing brace: to the last entry's
 * value when present, otherwise to the empty record node.
 *
 * @param entries - Parsed entries (mutated in place when a dangling comment
 * attaches to the last value).
 *
 * @param dangling - Comment found before the close, if any.
 *
 * @returns Record node.
 *
 * @example
 * ```ts
 * closeRecord({ entries: [], dangling: undefined });
 * // => { kind: 'record', entries: [] }
 * ```
 */
function closeRecord({
  entries,
  dangling,
}: {
  entries: { key: JsoncKey; value: JsoncValue; }[];
  dangling: JsoncComment | undefined;
},): JsoncValue {
  if ((dangling !== undefined) && (entries.length > 0)) {
    /**
     * Last entry, whose value receives the dangling comment.
     */
    const last = entries[entries.length - 1];
    if (last !== undefined)
      entries[entries.length - 1] = {
        key: last.key,
        value: appendComment({
          node: last.value,
          comment: dangling,
        },),
      };
  }
  /**
   * Comment owned by the record node itself (only when it has no entries).
   */
  const ownComment = (entries.length === 0)
    ? dangling
    : undefined;
  /**
   * Record node before any own-comment attachment.
   */
  const recordNode: JsoncValue = {
    kind: 'record',
    entries,
  };
  return appendComment({
    node: recordNode,
    comment: ownComment,
  },);
}

//endregion Parser
