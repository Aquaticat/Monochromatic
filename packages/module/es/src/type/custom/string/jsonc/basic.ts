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
export type JsoncValue = JsoncString | JsoncNumber | JsoncBoolean | JsoncNull | JsoncArray | JsoncRecord;

//endregion Type Definitions

//region Parser -- Simplified recursive parser using native JSON.parse() for terminals

/**
 * Parser context for tracking position during parsing
 */
type ParserContext = {
  input: string;
  position: number;
};

/**
 * Skip whitespace characters in the input
 */
function skipWhitespace(ctx: ParserContext): void {
  while (ctx.position < ctx.input.length && /\s/.test(ctx.input[ctx.position])) {
    ctx.position++;
  }
}

/**
 * Extract comments from the current position
 */
function extractComments(ctx: ParserContext): JsoncComment | undefined {
  const comments: string[] = [];
  let hasInline = false;
  let hasBlock = false;

  skipWhitespace(ctx);

  while (ctx.position < ctx.input.length) {
    if (ctx.input[ctx.position] === '/' && ctx.position + 1 < ctx.input.length) {
      if (ctx.input[ctx.position + 1] === '/') {
        // Inline comment
        ctx.position += 2;
        let comment = '';
        while (ctx.position < ctx.input.length && ctx.input[ctx.position] !== '\n') {
          comment += ctx.input[ctx.position];
          ctx.position++;
        }
        if (ctx.position < ctx.input.length) {
          ctx.position++; // Skip newline
        }
        comments.push(comment);
        hasInline = true;
        skipWhitespace(ctx);
        continue;
      } else if (ctx.input[ctx.position + 1] === '*') {
        // Block comment
        ctx.position += 2;
        let comment = '';
        while (ctx.position < ctx.input.length - 1) {
          if (ctx.input[ctx.position] === '*' && ctx.input[ctx.position + 1] === '/') {
            ctx.position += 2;
            break;
          }
          comment += ctx.input[ctx.position];
          ctx.position++;
        }
        comments.push(comment);
        hasBlock = true;
        skipWhitespace(ctx);
        continue;
      }
    }
    break;
  }

  if (comments.length === 0) {
    return undefined;
  }

  const commentType = hasInline && hasBlock ? 'mixed' : hasInline ? 'inline' : 'block';
  return {
    type: commentType,
    commentValue: comments.join('\n')
  };
}

/**
 * Find the end position of the current JSON node
 */
function findNodeEnd(ctx: ParserContext): number {
  const start = ctx.position;
  let depth = 0;
  let inString = false;
  let escaped = false;

  while (ctx.position < ctx.input.length) {
    const char = ctx.input[ctx.position];

    if (escaped) {
      escaped = false;
      ctx.position++;
      continue;
    }

    if (char === '\\' && inString) {
      escaped = true;
      ctx.position++;
      continue;
    }

    if (char === '"' && !inString) {
      inString = true;
    } else if (char === '"' && inString) {
      inString = false;
    }

    if (!inString) {
      if (char === '{' || char === '[') {
        depth++;
      } else if (char === '}' || char === ']') {
        depth--;
        if (depth === 0) {
          ctx.position++;
          break;
        }
      } else if (depth === 0 && /[\s,}\]]/.test(char)) {
        break;
      }
    }

    ctx.position++;
  }

  return ctx.position;
}

/**
 * Parse a JSONC value recursively
 */
function parseValue(ctx: ParserContext): JsoncValue {
  const comment = extractComments(ctx);

  if (ctx.position >= ctx.input.length) {
    throw new Error('Unexpected end of input');
  }

  const char = ctx.input[ctx.position];

  // Handle container nodes (objects and arrays)
  if (char === '{') {
    return parseRecord(ctx, comment);
  } else if (char === '[') {
    return parseArray(ctx, comment);
  }

  // Handle terminal nodes with native JSON.parse()
  const start = ctx.position;
  const end = findNodeEnd(ctx);
  const jsonString = ctx.input.substring(start, end);

  try {
    const value = JSON.parse(jsonString);

    if (typeof value === 'string') {
      return { type: 'string', value, comment };
    } else if (typeof value === 'number') {
      return { type: 'number', value, comment };
    } else if (typeof value === 'boolean') {
      return { type: 'boolean', value, comment };
    } else if (value === null) {
      return { type: 'null', value: null, comment };
    }

    throw new Error(`Unexpected value type: ${typeof value}`);
  } catch (error) {
    throw new Error(`Failed to parse JSON value "${jsonString}": ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse a JSONC record/object
 */
function parseRecord(ctx: ParserContext, comment?: JsoncComment): JsoncRecord {
  ctx.position++; // Skip '{'
  skipWhitespace(ctx);

  const entries: JsoncRecordEntry[] = [];

  while (ctx.position < ctx.input.length && ctx.input[ctx.position] !== '}') {
    // Parse key
    const keyComment = extractComments(ctx);

    if (ctx.input[ctx.position] !== '"') {
      throw new Error(`Expected string key at position ${ctx.position}`);
    }

    const keyStart = ctx.position;
    const keyEnd = findNodeEnd(ctx);
    const keyString = ctx.input.substring(keyStart, keyEnd);
    const keyValue = JSON.parse(keyString);

    const recordKey: JsoncString = { type: 'string', value: keyValue, comment: keyComment };

    skipWhitespace(ctx);

    if (ctx.input[ctx.position] !== ':') {
      throw new Error(`Expected ':' at position ${ctx.position}`);
    }
    ctx.position++;

    // Parse value
    const recordValue = parseValue(ctx);

    entries.push({ recordKey, recordValue });

    skipWhitespace(ctx);

    if (ctx.input[ctx.position] === ',') {
      ctx.position++;
      skipWhitespace(ctx);
    } else if (ctx.input[ctx.position] === '}') {
      break;
    } else {
      throw new Error(`Expected ',' or '}' at position ${ctx.position}`);
    }
  }

  if (ctx.input[ctx.position] !== '}') {
    throw new Error(`Expected '}' at position ${ctx.position}`);
  }
  ctx.position++;

  return { type: 'record', value: entries, comment };
}

/**
 * Parse a JSONC array
 */
function parseArray(ctx: ParserContext, comment?: JsoncComment): JsoncArray {
  ctx.position++; // Skip '['
  skipWhitespace(ctx);

  const items: JsoncValue[] = [];

  while (ctx.position < ctx.input.length && ctx.input[ctx.position] !== ']') {
    const item = parseValue(ctx);
    items.push(item);

    skipWhitespace(ctx);

    if (ctx.input[ctx.position] === ',') {
      ctx.position++;
      skipWhitespace(ctx);
    } else if (ctx.input[ctx.position] === ']') {
      break;
    } else {
      throw new Error(`Expected ',' or ']' at position ${ctx.position}`);
    }
  }

  if (ctx.input[ctx.position] !== ']') {
    throw new Error(`Expected ']' at position ${ctx.position}`);
  }
  ctx.position++;

  return { type: 'array', value: items, comment };
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
export function jsoncToParsedJsonc(input: jsonc): JsoncValue {
  const ctx: ParserContext = { input, position: 0 };
  const result = parseValue(ctx);

  skipWhitespace(ctx);
  if (ctx.position < ctx.input.length) {
    throw new Error(`Unexpected content after end of JSON at position ${ctx.position}`);
  }

  return result;
}

/**
 * Serialize parsed JSONC structure back to JSONC string
 * @param parsed - Parsed JSONC structure
 * @returns JSONC string with preserved comments
 * @example
 * ```ts
 * const jsonc = parsedJsoncToJsonc(parsedValue);
 * ```
 */
export function parsedJsoncToJsonc(parsed: JsoncValue): jsonc {
  function serializeValue(value: JsoncValue, indent = 0): string {
    const indentStr = '  '.repeat(indent);
    let result = '';

    // Add comment if present
    if (value.comment) {
      if (value.comment.type === 'inline') {
        const lines = value.comment.commentValue.split('\n');
        for (const line of lines) {
          result += `${indentStr}//${line}\n`;
        }
      } else if (value.comment.type === 'block') {
        result += `${indentStr}/*${value.comment.commentValue}*/ `;
      } else if (value.comment.type === 'mixed') {
        const lines = value.comment.commentValue.split('\n');
        for (const line of lines) {
          if (line.trim().startsWith('/*')) {
            result += `${indentStr}${line}\n`;
          } else {
            result += `${indentStr}//${line}\n`;
          }
        }
      }
    }

    switch (value.type) {
      case 'string':
        return result + JSON.stringify(value.value);

      case 'number':
        return result + String(value.value);

      case 'boolean':
        return result + String(value.value);

      case 'null':
        return result + 'null';

      case 'array': {
        if (value.value.length === 0) {
          return result + '[]';
        }

        let arrayResult = result + '[\n';
        for (let i = 0; i < value.value.length; i++) {
          const item = value.value[i];
          const serializedItem = serializeValue(item, indent + 1);
          arrayResult += `${indentStr}  ${serializedItem}`;
          if (i < value.value.length - 1) {
            arrayResult += ',';
          }
          arrayResult += '\n';
        }
        arrayResult += `${indentStr}]`;
        return arrayResult;
      }

      case 'record': {
        if (value.value.length === 0) {
          return result + '{}';
        }

        let recordResult = result + '{\n';
        for (let i = 0; i < value.value.length; i++) {
          const entry = value.value[i];

          // Serialize key
          let keyStr = '';
          if (entry.recordKey.comment) {
            if (entry.recordKey.comment.type === 'inline') {
              const lines = entry.recordKey.comment.commentValue.split('\n');
              for (const line of lines) {
                keyStr += `${indentStr}  //${line}\n`;
              }
            }
          }
          keyStr += `${indentStr}  ${JSON.stringify(entry.recordKey.value)}`;

          // Add value comment and serialize value
          let valueStr = '';
          if (entry.recordValue.comment?.type === 'block') {
            valueStr = `/*${entry.recordValue.comment.commentValue}*/ `;
          }

          const serializedValue = entry.recordValue.comment?.type === 'block'
            ? serializeValue({ ...entry.recordValue, comment: undefined }, 0)
            : serializeValue(entry.recordValue, indent + 1);

          recordResult += `${keyStr}: ${valueStr}${serializedValue}`;
          if (i < value.value.length - 1) {
            recordResult += ',';
          }
          recordResult += '\n';
        }
        recordResult += `${indentStr}}`;
        return recordResult;
      }

      default:
        throw new Error(`Unknown value type: ${(value as any).type}`);
    }
  }

  return serializeValue(parsed) as jsonc;
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
//           comment: {type: 'inline', value: ' comment2'},
//           type: 'string'
//           value: 'a',
//         },
//         recordValue: {
//           comment: {type: 'block', value: 'comment3'},
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
//              type: number,
//              value: 1
//            },
//            {
//              type: number,
//              value: 2
//            },
//            {
//              type: number,
//              comment: {type: 'mixed', value: ' comment4\n comment4 mixed '},
//              value: 3
//            },
//            {
//              type: string,
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
