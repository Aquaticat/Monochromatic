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
 * Parser state for tracking position and extracting comments
 */
class JsoncParser {
  private input: string;
  private position = 0;

  constructor(input: string) {
    this.input = input;
  }

  private skipWhitespace(): void {
    while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
      this.position++;
    }
  }

  private extractComments(): JsoncComment | undefined {
    const comments: string[] = [];
    let hasInline = false;
    let hasBlock = false;

    this.skipWhitespace();

    while (this.position < this.input.length) {
      if (this.input[this.position] === '/' && this.position + 1 < this.input.length) {
        if (this.input[this.position + 1] === '/') {
          // Inline comment
          this.position += 2;
          let comment = '';
          while (this.position < this.input.length && this.input[this.position] !== '\n') {
            comment += this.input[this.position];
            this.position++;
          }
          if (this.position < this.input.length) {
            this.position++; // Skip newline
          }
          comments.push(comment);
          hasInline = true;
          this.skipWhitespace();
          continue;
        } else if (this.input[this.position + 1] === '*') {
          // Block comment
          this.position += 2;
          let comment = '';
          while (this.position < this.input.length - 1) {
            if (this.input[this.position] === '*' && this.input[this.position + 1] === '/') {
              this.position += 2;
              break;
            }
            comment += this.input[this.position];
            this.position++;
          }
          comments.push(comment);
          hasBlock = true;
          this.skipWhitespace();
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

  private findNodeEnd(): number {
    const start = this.position;
    let depth = 0;
    let inString = false;
    let escaped = false;

    while (this.position < this.input.length) {
      const char = this.input[this.position];

      if (escaped) {
        escaped = false;
        this.position++;
        continue;
      }

      if (char === '\\' && inString) {
        escaped = true;
        this.position++;
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
            this.position++;
            break;
          }
        } else if (depth === 0 && /[\s,}\]]/.test(char)) {
          break;
        }
      }

      this.position++;
    }

    return this.position;
  }

  private parseValue(): JsoncValue {
    const comment = this.extractComments();

    if (this.position >= this.input.length) {
      throw new Error('Unexpected end of input');
    }

    const char = this.input[this.position];

    // Handle container nodes (objects and arrays)
    if (char === '{') {
      return this.parseRecord(comment);
    } else if (char === '[') {
      return this.parseArray(comment);
    }

    // Handle terminal nodes with native JSON.parse()
    const start = this.position;
    const end = this.findNodeEnd();
    const jsonString = this.input.substring(start, end);

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

  private parseRecord(comment?: JsoncComment): JsoncRecord {
    this.position++; // Skip '{'
    this.skipWhitespace();

    const entries: JsoncRecordEntry[] = [];

    while (this.position < this.input.length && this.input[this.position] !== '}') {
      // Parse key
      const keyComment = this.extractComments();

      if (this.input[this.position] !== '"') {
        throw new Error(`Expected string key at position ${this.position}`);
      }

      const keyStart = this.position;
      const keyEnd = this.findNodeEnd();
      const keyString = this.input.substring(keyStart, keyEnd);
      const keyValue = JSON.parse(keyString);

      const recordKey: JsoncString = { type: 'string', value: keyValue, comment: keyComment };

      this.skipWhitespace();

      if (this.input[this.position] !== ':') {
        throw new Error(`Expected ':' at position ${this.position}`);
      }
      this.position++;

      // Parse value
      const recordValue = this.parseValue();

      entries.push({ recordKey, recordValue });

      this.skipWhitespace();

      if (this.input[this.position] === ',') {
        this.position++;
        this.skipWhitespace();
      } else if (this.input[this.position] === '}') {
        break;
      } else {
        throw new Error(`Expected ',' or '}' at position ${this.position}`);
      }
    }

    if (this.input[this.position] !== '}') {
      throw new Error(`Expected '}' at position ${this.position}`);
    }
    this.position++;

    return { type: 'record', value: entries, comment };
  }

  private parseArray(comment?: JsoncComment): JsoncArray {
    this.position++; // Skip '['
    this.skipWhitespace();

    const items: JsoncValue[] = [];

    while (this.position < this.input.length && this.input[this.position] !== ']') {
      const item = this.parseValue();
      items.push(item);

      this.skipWhitespace();

      if (this.input[this.position] === ',') {
        this.position++;
        this.skipWhitespace();
      } else if (this.input[this.position] === ']') {
        break;
      } else {
        throw new Error(`Expected ',' or ']' at position ${this.position}`);
      }
    }

    if (this.input[this.position] !== ']') {
      throw new Error(`Expected ']' at position ${this.position}`);
    }
    this.position++;

    return { type: 'array', value: items, comment };
  }

  parse(): JsoncValue {
    const result = this.parseValue();

    this.skipWhitespace();
    if (this.position < this.input.length) {
      throw new Error(`Unexpected content after end of JSON at position ${this.position}`);
    }

    return result;
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
export function jsoncToParsedJsonc(input: jsonc): JsoncValue {
  const parser = new JsoncParser(input);
  return parser.parse();
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
//              comment: {type: 'mixed', commentValue: ' comment4\n comment4 mixed '},
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
