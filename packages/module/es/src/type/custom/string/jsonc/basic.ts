export type jsonc = string & { __brand: 'jsonc'; };

//region Type Definitions -- Define all TypeScript types for the parsed JSONC structure

/**
 * Comment attached to a JSONC value
 */
export type JsoncComment = {
  /** Type of comment */
  type: 'inline' | 'block' | 'mixed';
  /** Comment content without delimiters */
  commentValue: string;
};

/**
 * Base structure for all parsed JSONC values
 */
export type JsoncValueBase = {
  /** Optional comment attached to this value */
  comment?: JsoncComment;
};

/**
 * Parsed JSONC string value
 */
export type JsoncString = JsoncValueBase & {
  type: 'string';
  value: string;
};

/**
 * Parsed JSONC number value
 */
export type JsoncNumber = JsoncValueBase & {
  type: 'number';
  value: number;
};

/**
 * Parsed JSONC boolean value
 */
export type JsoncBoolean = JsoncValueBase & {
  type: 'boolean';
  value: boolean;
};

/**
 * Parsed JSONC null value
 */
export type JsoncNull = JsoncValueBase & {
  type: 'null';
  value: null;
};

/**
 * Parsed JSONC array value
 */
export type JsoncArray = JsoncValueBase & {
  type: 'array';
  value: JsoncValue[];
};

/**
 * Record entry in a parsed JSONC object
 */
export type JsoncRecordEntry = {
  recordKey: JsoncString;
  recordValue: JsoncValue;
};

/**
 * Parsed JSONC object/record value
 */
export type JsoncRecord = JsoncValueBase & {
  type: 'record';
  value: JsoncRecordEntry[];
};

/**
 * Union of all possible parsed JSONC values
 */
export type JsoncValue = JsoncString | JsoncNumber | JsoncBoolean | JsoncNull | JsoncArray
  | JsoncRecord;

//endregion Type Definitions

//region Parser -- Simplified recursive parser using native JSON.parse() for terminals

/**
 * Common string traversal utilities
 */

/**
 * Skip a quoted string and return the new position
 * @param params - Parameters object
 * @param params.input - Input string
 * @param params.position - Current position (should be at opening quote)
 * @returns New position after the closing quote
 */
function skipQuotedString(
  { input, position, }: { input: string; position: number; },
): number {
  if (input[position] !== '"')
    return position;

  position++; // Skip opening quote
  let escaped = false;

  while (position < input.length) {
    const char = input[position];

    if (escaped)
      escaped = false;
    else if (char === '\\')
      escaped = true;
    else if (char === '"') {
      position++; // Skip closing quote
      break;
    }

    position++;
  }

  return position;
}

/**
 * Check if position is inside a quoted string by scanning backwards
 * @param params - Parameters object
 * @param params.input - Input string
 * @param params.position - Position to check
 * @returns True if inside a string
 */
function isInsideString(
  { input, position, }: { input: string; position: number; },
): boolean {
  let quoteCount = 0;
  let escaped = false;

  for (let i = 0; i < position; i++) {
    const char = input[i];

    if (escaped)
      escaped = false;
    else if (char === '\\')
      escaped = true;
    else if (char === '"')
      quoteCount++;
  }

  return quoteCount % 2 === 1;
}

/**
 * Check if a JSON string contains JSONC-specific features (comments or trailing commas)
 * @param params - Parameters object
 * @param params.input - Input string
 * @param params.start - Start position
 * @param params.end - End position
 * @returns True if JSONC features are present, false for clean JSON
 */
function containsJsoncFeatures(
  { input, start, end, }: { input: string; start: number; end: number; },
): boolean {
  const content = input.substring(start, end,);

  // Check for comments
  if (content.includes('//',) || content.includes('/*',))
    return true;

  // Check for trailing commas (simplified check)
  if (/,\s*[}\]]/.test(content,))
    return true;

  return false;
}

/**
 * Convert native JSON value to JsoncValue structure
 * @param params - Parameters object
 * @param params.value - Native JSON value
 * @param params.comment - Optional comment to attach
 * @returns JsoncValue representation
 */
function convertNativeValue(
  { value, comment, }: { value: unknown; comment?: JsoncComment; },
): JsoncValue {
  if (typeof value === 'string')
    return { type: 'string', value, comment, };
  else if (typeof value === 'number')
    return { type: 'number', value, comment, };
  else if (typeof value === 'boolean')
    return { type: 'boolean', value, comment, };
  else if (value === null)
    return { type: 'null', value: null, comment, };
  else if (Array.isArray(value,)) {
    return {
      type: 'array',
      value: value.map(item => convertNativeValue({ value: item, },)),
      comment,
    };
  }
  else if (typeof value === 'object' && value !== null) {
    const entries: JsoncRecordEntry[] = Object.entries(value,).map(([key, val,],) => ({
      recordKey: { type: 'string', value: key, },
      recordValue: convertNativeValue({ value: val, },),
    }));
    return { type: 'record', value: entries, comment, };
  }

  throw new Error(`Unexpected value type: ${typeof value}`,);
}

/**
 * Skip whitespace characters in the input
 * @param params - Parameters object
 * @param params.input - Input string
 * @param params.position - Current position
 * @returns New position after skipping whitespace
 */
function skipWhitespace(
  { input, position, }: { input: string; position: number; },
): number {
  while (position < input.length && /\s/.test(input[position],))
    position++;
  return position;
}

/**
 * Extract comments from the current position
 * @param params - Parameters object
 * @param params.input - Input string
 * @param params.position - Current position
 * @returns Tuple of [comment, newPosition]
 */
function extractComments(
  { input, position, }: { input: string; position: number; },
): [JsoncComment | undefined, number,] {
  const comments: string[] = [];
  let hasInline = false;
  let hasBlock = false;

  position = skipWhitespace({ input, position, },);

  while (position < input.length) {
    if (input[position] === '/' && position + 1 < input.length) {
      if (input[position + 1] === '/') {
        // Inline comment
        position += 2;
        let comment = '';
        while (position < input.length && input[position] !== '\n') {
          comment += input[position];
          position++;
        }
        if (position < input.length)
          position++; // Skip newline
        comments.push(comment,);
        hasInline = true;
        position = skipWhitespace({ input, position, },);
        continue;
      }
      else if (input[position + 1] === '*') {
        // Block comment
        position += 2;
        let comment = '';
        while (position < input.length - 1) {
          if (input[position] === '*' && input[position + 1] === '/') {
            position += 2;
            break;
          }
          comment += input[position];
          position++;
        }
        comments.push(comment,);
        hasBlock = true;
        position = skipWhitespace({ input, position, },);
        continue;
      }
    }
    break;
  }

  if (comments.length === 0)
    return [undefined, position,];

  const commentType = hasInline && hasBlock ? 'mixed' : hasInline ? 'inline' : 'block';
  return [{
    type: commentType,
    commentValue: comments.join('\n',),
  }, position,];
}

/**
 * Find the end position of the current JSON node (simplified - just boundary detection)
 * @param params - Parameters object
 * @param params.input - Input string
 * @param params.position - Current position
 * @returns End position of the JSON node
 */
function findNodeEnd(
  { input, position, }: { input: string; position: number; },
): number {
  const char = input[position];

  // Handle quoted strings
  if (char === '"')
    return skipQuotedString({ input, position, },);

  // Handle container structures
  if (char === '{' || char === '[') {
    const closeChar = char === '{' ? '}' : ']';
    const bracketStack = [char,];
    position++;

    while (position < input.length && bracketStack.length > 0) {
      if (input[position] === '"') {
        position = skipQuotedString({ input, position, },);
        continue;
      }

      if (input[position] === char || input[position] === (char === '{' ? '[' : '{'))
        bracketStack.push(input[position],);
      else if (input[position] === closeChar
        || input[position] === (closeChar === '}' ? ']' : '}'))
      {
        const expectedOpening = input[position] === '}' ? '{' : '[';
        const lastOpening = bracketStack[bracketStack.length - 1];

        if (lastOpening !== expectedOpening)
          throw new Error(`Mismatched brackets at position ${position}`,);

        bracketStack.pop();
      }

      position++;
    }

    return position;
  }

  // Handle JSON primitives with proper boundary detection
  const startPosition = position;

  // Handle numbers: -?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?
  if (char === '-' || /[0-9]/.test(char,)) {
    if (char === '-')
      position++;

    // Integer part
    if (position < input.length && input[position] === '0')
      position++;
    else if (position < input.length && /[1-9]/.test(input[position],)) {
      position++;
      while (position < input.length && /[0-9]/.test(input[position],))
        position++;
    }
    else {
      throw new Error(`Invalid number format at position ${startPosition}`,);
    }

    // Fractional part
    if (position < input.length && input[position] === '.') {
      position++;
      if (position >= input.length || !/[0-9]/.test(input[position],)) {
        throw new Error(
          `Invalid number format: missing digits after decimal at position ${position}`,
        );
      }
      while (position < input.length && /[0-9]/.test(input[position],))
        position++;
    }

    // Exponent part
    if (position < input.length && /[eE]/.test(input[position],)) {
      position++;
      if (position < input.length && /[+-]/.test(input[position],))
        position++;
      if (position >= input.length || !/[0-9]/.test(input[position],)) {
        throw new Error(
          `Invalid number format: missing digits in exponent at position ${position}`,
        );
      }
      while (position < input.length && /[0-9]/.test(input[position],))
        position++;
    }

    return position;
  }

  // Handle boolean and null keywords
  if (/[a-z]/.test(char,)) {
    if (input.substring(position, position + 4,) === 'true')
      return position + 4;
    else if (input.substring(position, position + 5,) === 'false')
      return position + 5;
    else if (input.substring(position, position + 4,) === 'null')
      return position + 4;

    throw new Error(`Invalid keyword at position ${position}`,);
  }

  throw new Error(`Unexpected character '${char}' at position ${position}`,);
}

/**
 * Generic container parser for arrays and objects
 * @param params - Parameters object with container-specific logic
 * @returns Tuple of [parsedContainer, newPosition]
 */
function parseContainer<T,>({
  input,
  position,
  comment,
  openChar,
  closeChar,
  parseItem,
  createResult,
}: {
  input: string;
  position: number;
  comment?: JsoncComment;
  openChar: string;
  closeChar: string;
  parseItem: (input: string, position: number,) => [unknown, number,];
  createResult: (items: unknown[], comment?: JsoncComment,) => T;
},): [T, number,] {
  position++; // Skip opening bracket
  position = skipWhitespace({ input, position, },);

  const items: unknown[] = [];

  while (position < input.length && input[position] !== closeChar) {
    const [item, itemPosition,] = parseItem(input, position,);
    items.push(item,);
    position = itemPosition;

    position = skipWhitespace({ input, position, },);

    if (input[position] === ',') {
      position++;
      position = skipWhitespace({ input, position, },);
    }
    else if (input[position] === closeChar)
      break;
    else
      throw new Error(`Expected ',' or '${closeChar}' at position ${position}`,);
  }

  if (input[position] !== closeChar)
    throw new Error(`Expected '${closeChar}' at position ${position}`,);
  position++;

  return [createResult(items, comment,), position,];
}

/**
 * Parse individual record entry (key-value pair) with fast path optimization
 * @param params - Parameters object
 * @param params.input - Input string
 * @param params.position - Current position
 * @returns Tuple of [recordEntry, newPosition]
 */
function parseRecordEntry(
  { input, position, }: { input: string; position: number; },
): [JsoncRecordEntry, number,] {
  // Parse key with potential fast path
  const [keyComment, keyCommentPosition,] = extractComments({ input, position, },);
  position = keyCommentPosition;

  if (input[position] !== '"')
    throw new Error(`Expected string key at position ${position}`,);

  // Fast path for key (always a simple string)
  const keyStart = position;
  const keyEnd = findNodeEnd({ input, position, },);
  const keyString = input.substring(keyStart, keyEnd,);
  const keyValue = JSON.parse(keyString,);

  const recordKey: JsoncString = { type: 'string', value: keyValue,
    comment: keyComment, };

  position = skipWhitespace({ input, position: keyEnd, },);

  if (input[position] !== ':')
    throw new Error(`Expected ':' at position ${position}`,);
  position++;

  // Parse value with full hierarchical fast path recursion
  const [recordValue, valuePosition,] = parseValue({ input, position, },);

  return [{ recordKey, recordValue, }, valuePosition,];
}

/**
 * Parse a JSONC value recursively with hierarchical fast path optimization
 * @param params - Parameters object
 * @param params.input - Input string
 * @param params.position - Current position
 * @returns Tuple of [parsedValue, newPosition]
 */
function parseValue(
  { input, position, }: { input: string; position: number; },
): [JsoncValue, number,] {
  const [comment, newPosition,] = extractComments({ input, position, },);
  position = newPosition;

  if (position >= input.length)
    throw new Error('Unexpected end of input',);

  const char = input[position];

  // Handle container nodes with hierarchical optimization
  if (char === '{') {
    const start = position;
    const end = findNodeEnd({ input, position, },);

    // Fast path: if entire container is clean, use native parser
    if (!containsJsoncFeatures({ input, start, end, },)) {
      const jsonString = input.substring(start, end,);
      const nativeValue = JSON.parse(jsonString,);
      return [convertNativeValue({ value: nativeValue, comment, },), end,];
    }

    // Hierarchical path: parse each entry individually with fast path attempts
    return parseContainer({
      input,
      position,
      comment,
      openChar: '{',
      closeChar: '}',
      parseItem: parseRecordEntry,
      createResult: (items: JsoncRecordEntry[],
        comment?: JsoncComment,): JsoncRecord => ({
          type: 'record',
          value: items,
          comment,
        }),
    },);
  }
  else if (char === '[') {
    const start = position;
    const end = findNodeEnd({ input, position, },);

    // Fast path: if entire array is clean, use native parser
    if (!containsJsoncFeatures({ input, start, end, },)) {
      const jsonString = input.substring(start, end,);
      const nativeValue = JSON.parse(jsonString,);
      return [convertNativeValue({ value: nativeValue, comment, },), end,];
    }

    // Hierarchical path: parse each item individually with fast path attempts
    return parseContainer({
      input,
      position,
      comment,
      openChar: '[',
      closeChar: ']',
      parseItem: (input: string, itemPosition: number,) =>
        parseValue({ input, position: itemPosition, },),
      createResult: (items: JsoncValue[], comment?: JsoncComment,): JsoncArray => ({
        type: 'array',
        value: items,
        comment,
      }),
    },);
  }

  // Handle terminal nodes - check for individual value fast path
  const start = position;
  const end = findNodeEnd({ input, position, },);

  // If no comment, this is a pure terminal - maximum fast path
  if (!comment) {
    const jsonString = input.substring(start, end,);
    const value = JSON.parse(jsonString,);
    return [convertNativeValue({ value, },), end,];
  }

  // Terminal with comment - still use native parser for the value part
  const jsonString = input.substring(start, end,);

  try {
    const value = JSON.parse(jsonString,);

    if (typeof value === 'string')
      return [{ type: 'string', value, comment, }, end,];
    else if (typeof value === 'number')
      return [{ type: 'number', value, comment, }, end,];
    else if (typeof value === 'boolean')
      return [{ type: 'boolean', value, comment, }, end,];
    else if (value === null)
      return [{ type: 'null', value: null, comment, }, end,];

    throw new Error(`Unexpected value type: ${typeof value}`,);
  }
  catch (error) {
    throw new Error(
      `Failed to parse JSON value "${jsonString}": ${
        error instanceof Error
          ? error.message
          : String(error,)
      }`,
    );
  }
}

//endregion Parser

//region Public API -- Main functions for parsing and serializing JSONC

/**
 * Parse JSONC string into structured representation
 * @param input - JSONC string to parse
 * @returns Parsed JSONC structure with preserved comments
 * @example
 * ```ts
 * const result = jsoncToParsedJsonc('{"a": 1 /* comment *\/}' as jsonc);
 * ```
 */
export function jsoncToParsedJsonc(input: jsonc,): JsoncValue {
  const [result, finalPosition,] = parseValue({ input, position: 0, },);

  const endPosition = skipWhitespace({ input, position: finalPosition, },);
  if (endPosition < input.length)
    throw new Error(`Unexpected content after end of JSON at position ${endPosition}`,);

  return result;
}

//endregion Public API

// Try not to use any in-package function because other functions are bad at this time. You're on your own.

// const myJsonc
// ```jsonc
// // comment1
// // more comment 1
// {
//   // comment2
//   "a": /*comment3*/ 1,
//   "b": 2,
//   "c": [
//     1,
//     2,
//     // comment4
//     /* comment4 mixed */
//     3,
//     // comment5 trailing comma ignored
//     'd',
//   ]
// }
// ```
//
// const myParsedJsonc = jsoncToParsedJsonc({myJsonc})
// {
//   type: 'record'
//   comment: {type: 'inline', commentValue: ' comment1\n more comment 1'},
//   value: [
//      {
//         recordKey: {
//           comment: {type: 'inline', commentValue: ' comment2'},
//           type: 'string'
//           value: 'a',
//         },
//         recordValue: {
//           comment: {type: 'block', commentValue: 'comment3'},
//           type: 'number'
//           value: 1,
//         }
//      },
//      {
//        recordKey: {
//          type: 'string',
//          value: 'b'
//        },
//        recordValue: {
//          type: 'number'
//          value: 2
//        }
//      },
//      {
//        recordKey: {
//          type: 'string',
//          value: 'c'
//        },
//        recordValue: {
//          type: 'array',
//          value: [
//            {
//              type: 'number',
//              value: 1
//            },
//            {
//              type: 'number',
//              value: 2
//            },
//            {
//              type: 'number',
//              comment: {type: 'mixed', commentValue: ' comment4\n comment4 mixed '},
//              value: 3
//            },
//            {
//              type: 'string',
//              value: 'd'
//            },
//          ]
//        }
//      }
//   ]
// }
//
// const reserializedJsonc = parsedJsoncToJsonc({myParsedJsonc})
// ```jsonc
// // comment1
// // more comment1
// {
//   // comment2
//   "a": /*comment3*/ 1,
//   "b": 2,
//   "c": [
//     1,
//     2,
//     // comment4
//     // comment4 mixed
//     3,
//     // comment5 trailing comma ignored
//     'd'
//   ]
// }
// ```
