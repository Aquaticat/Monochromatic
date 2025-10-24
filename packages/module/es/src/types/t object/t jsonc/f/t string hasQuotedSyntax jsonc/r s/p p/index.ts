// TODO: Make this a thin wrapper around `p n` (param positional)

import type {
  $ as StringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import { z, } from 'zod/v4-mini';

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

/**
 * Parse JSONC string into structured representation with comment preservation and hierarchical optimization.
 *
 * This advanced parser handles JSONC (JSON with Comments) format, preserving comments alongside data
 * while providing performance optimizations through hierarchical fast-path parsing. Uses native JSON.parse
 * for clean sections and custom parsing only where JSONC-specific features are present.
 *
 * @param input - JSONC string to parse with comment support
 * @returns Parsed JSONC structure with preserved comments and type information
 *
 * @example
 * Basic JSONC parsing with comments:
 * ```ts
 * const jsonc = `{
 *   "name": "example", // This is a name
 *   "version": "1.0.0" /* Version info *\/,
 *   "active": true
 * }`;
 *
 * const result = $(jsonc);
 * console.log(result.type); // 'record'
 * console.log(result.value[0].recordValue.comment); // Comment info
 * ```
 *
 * @example
 * Handling different comment types:
 * ```ts
 * const jsoncWithMixedComments = `{
 *   // Single line comment
 *   "data": [
 *     1, 2, 3 /* Block comment *\/
 *   ],
 *   "config": {
 *     "enabled": true // Another inline comment
 *   }
 * }`;
 *
 * const parsed = $(jsoncWithMixedComments);
 * // Comments are preserved in the structure
 * ```
 *
 * @example
 * Performance optimization with clean JSON:
 * ```ts
 * // Clean JSON without comments gets fast-path treatment
 * const cleanJson = '{"fast": true, "optimized": [1, 2, 3]}';
 * const result = $(cleanJson);
 * // Uses native JSON.parse internally for performance
 * ```
 *
 * @example
 * Trailing comma support:
 * ```ts
 * const jsoncWithTrailingCommas = `{
 *   "items": [
 *     "first",
 *     "second",
 *   ],
 *   "config": {
 *     "debug": true,
 *   },
 * }`;
 *
 * const parsed = $(jsoncWithTrailingCommas);
 * // Trailing commas are handled correctly
 * ```
 *
 * @example
 * Complex nested structures with comments:
 * ```ts
 * const complexJsonc = `{
 *   // Application configuration
 *   "app": {
 *     "name": "MyApp", /* Application name *\/
 *     "settings": {
 *       "theme": "dark", // UI theme
 *       "features": [
 *         "auth", // Authentication
 *         "api"   // API integration
 *       ]
 *     }
 *   }
 * }`;
 *
 * const result = $(complexJsonc);
 * // All comments preserved with proper type information
 * ```
 *
 * Features:
 * - Preserves inline (//) and block (/* *\/) comments
 * - Supports trailing commas in objects and arrays
 * - Hierarchical optimization: uses native JSON.parse for clean sections
 * - Type-safe parsing with Zod validation for primitives
 * - Detailed error messages with position information
 * - Memory-efficient parsing with comment extraction
 */
export function $(input: string,): JsoncValue {
  // TODO: Switch to a more shortcuts-heavy implementation

  // Schema for validating JSON primitives
  const jsonNumberSchema = z.coerce.number();
  const jsonKeywordSchema = z.enum(['true', 'false', 'null',],);

  // Internal utility functions
  function skipWhitespace(
    { input, position, }: { input: string; position: number; },
  ): number {
    const remaining = input.substring(position,);
    const nonWhitespaceIndex = remaining.search(/\S/,);
    return nonWhitespaceIndex === -1 ? input.length : position + nonWhitespaceIndex;
  }

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

  function extractComments(
    { input, position, }: { input: string; position: number; },
  ): { comment: JsoncComment | undefined; newPosition: number; } {
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
      return { comment: undefined, newPosition: position, };

    const commentType = hasInline && hasBlock ? 'mixed' : hasInline ? 'inline' : 'block';
    return {
      comment: {
        type: commentType,
        commentValue: comments.join('\n',),
      },
      newPosition: position,
    };
  }

  function containsJsoncFeatures(
    { input, start, end, }: { input: string; start: number; end: number; },
  ): boolean {
    const content = input.substring(start, end,);

    // Check for comments
    if (content.includes('//',) || content.includes('/*',))
      return true;

    // Check for trailing commas
    if (/,\s*[}\]]/.test(content,))
      return true;

    return false;
  }

  function parseValue(
    { input, position, }: { input: string; position: number; },
  ): { value: JsoncValue; newPosition: number; } {
    const { comment, newPosition, } = extractComments({ input, position, },);
    position = newPosition;

    if (position >= input.length)
      throw new Error('Unexpected end of input',);

    const char = input[position];

    // Handle containers with hierarchical optimization
    if (char === '{' || char === '[') {
      const start = position;
      const end = findNodeEnd({ input, position, },);

      // Fast path: if entire container is clean, use native parser
      if (!containsJsoncFeatures({ input, start, end, },)) {
        const jsonString = input.substring(start, end,);
        const nativeValue = JSON.parse(jsonString,);
        return { value: convertNativeValue({ value: nativeValue, comment, },),
          newPosition: end, };
      }

      // Custom parsing for JSONC features
      return char === '{'
        ? parseObject({ input, position, comment, },)
        : parseArray({ input, position, comment, },);
    }

    // Handle primitives
    return parsePrimitive({ input, position, comment, },);
  }

  function findNodeEnd(
    { input, position, }: { input: string; position: number; },
  ): number {
    const char = input[position];

    if (char === '"')
      return skipQuotedString({ input, position, },);

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

    // Handle primitives
    const startPosition = position;

    if (char === '-' || /[0-9]/.test(char,)) {
      // Number parsing logic
      if (char === '-')
        position++;

      if (position < input.length && input[position] === '0')
        position++;
      else if (position < input.length && /[1-9]/.test(input[position],)) {
        position++;
        while (position < input.length && /[0-9]/.test(input[position],))
          position++;
      }

      if (position < input.length && input[position] === '.') {
        position++;
        while (position < input.length && /[0-9]/.test(input[position],))
          position++;
      }

      if (position < input.length && /[eE]/.test(input[position],)) {
        position++;
        if (position < input.length && /[+-]/.test(input[position],))
          position++;
        while (position < input.length && /[0-9]/.test(input[position],))
          position++;
      }

      return position;
    }

    if (/[a-z]/.test(char,)) {
      if (input.substring(position, position + 4,) === 'true')
        return position + 4;
      if (input.substring(position, position + 5,) === 'false')
        return position + 5;
      if (input.substring(position, position + 4,) === 'null')
        return position + 4;
    }

    throw new Error(`Unexpected character '${char}' at position ${position}`,);
  }

  function convertNativeValue(
    { value, comment, }: { value: unknown; comment?: JsoncComment; },
  ): JsoncValue {
    if (typeof value === 'string')
      return comment ? { type: 'string', value, comment, } : { type: 'string', value, };
    else if (typeof value === 'number')
      return comment ? { type: 'number', value, comment, } : { type: 'number', value, };
    else if (typeof value === 'boolean')
      return comment ? { type: 'boolean', value, comment, } : { type: 'boolean', value, };
    else if (value === null) {
      return comment
        ? { type: 'null', value: null, comment, }
        : { type: 'null', value: null, };
    }
    else if (Array.isArray(value,)) {
      return comment
        ? { type: 'array', value: value
          .map(item => convertNativeValue({ value: item, },)), comment, }
        : { type: 'array', value: value
          .map(item => convertNativeValue({ value: item, },)), };
    }
    else if (typeof value === 'object' && value !== null) {
      const entries: JsoncRecordEntry[] = Object.entries(value,).map(([key, val,],) => ({
        recordKey: { type: 'string', value: key, },
        recordValue: convertNativeValue({ value: val, },),
      }));
      return comment
        ? { type: 'record', value: entries, comment, }
        : { type: 'record', value: entries, };
    }

    throw new Error(`Unexpected value type: ${typeof value}`,);
  }

  function parseObject(
    { input, position, comment, }: { input: string; position: number;
      comment?: JsoncComment; },
  ): { value: JsoncRecord; newPosition: number; } {
    position++; // Skip opening brace
    position = skipWhitespace({ input, position, },);

    const entries: JsoncRecordEntry[] = [];

    while (position < input.length && input[position] !== '}') {
      // Parse key
      const { comment: keyComment, newPosition: keyCommentPosition, } = extractComments({
        input,
        position,
      },);
      position = keyCommentPosition;

      if (input[position] !== '"')
        throw new Error(`Expected string key at position ${position}`,);

      const keyEndPosition = skipQuotedString({ input, position, },);
      const keyValue = JSON.parse(input.substring(position, keyEndPosition,),);
      const recordKey: JsoncString = keyComment
        ? { type: 'string', value: keyValue, comment: keyComment, }
        : { type: 'string', value: keyValue, };

      position = skipWhitespace({ input, position: keyEndPosition, },);

      if (input[position] !== ':')
        throw new Error(`Expected ':' after key at position ${position}`,);
      position++; // Skip colon

      // Parse value
      const { value: recordValue, newPosition: valueEndPosition, } = parseValue({ input,
        position, },);
      position = valueEndPosition;

      entries.push({ recordKey, recordValue, },);

      position = skipWhitespace({ input, position, },);

      if (input[position] === ',') {
        position++;
        position = skipWhitespace({ input, position, },);
      }
      else if (input[position] === '}')
        break;
      else
        throw new Error(`Expected ',' or '}' at position ${position}`,);
    }

    if (input[position] !== '}')
      throw new Error(`Expected '}' at position ${position}`,);
    position++;

    return {
      value: comment
        ? { type: 'record', value: entries, comment, }
        : { type: 'record', value: entries, },
      newPosition: position,
    };
  }

  function parseArray(
    { input, position, comment, }: { input: string; position: number;
      comment?: JsoncComment; },
  ): { value: JsoncArray; newPosition: number; } {
    position++; // Skip opening bracket
    position = skipWhitespace({ input, position, },);

    const items: JsoncValue[] = [];

    while (position < input.length && input[position] !== ']') {
      const { value: item, newPosition: itemPosition, } = parseValue({ input,
        position, },);
      items.push(item,);
      position = itemPosition;

      position = skipWhitespace({ input, position, },);

      if (input[position] === ',') {
        position++;
        position = skipWhitespace({ input, position, },);
      }
      else if (input[position] === ']')
        break;
      else
        throw new Error(`Expected ',' or ']' at position ${position}`,);
    }

    if (input[position] !== ']')
      throw new Error(`Expected ']' at position ${position}`,);
    position++;

    return {
      value: comment
        ? { type: 'array', value: items, comment, }
        : { type: 'array', value: items, },
      newPosition: position,
    };
  }

  function parsePrimitive(
    { input, position, comment, }: { input: string; position: number;
      comment?: JsoncComment; },
  ): { value: JsoncValue; newPosition: number; } {
    const char = input[position];

    if (char === '"') {
      const endPosition = skipQuotedString({ input, position, },);
      const stringContent = input.substring(position, endPosition,);
      const parsedValue = JSON.parse(stringContent,);
      return {
        value: comment
          ? { type: 'string', value: parsedValue, comment, }
          : { type: 'string', value: parsedValue, },
        newPosition: endPosition,
      };
    }

    if (char === '-' || /[0-9]/.test(char,)) {
      const endPosition = findNodeEnd({ input, position, },);
      const numberString = input.substring(position, endPosition,);
      const numberValidation = jsonNumberSchema.safeParse(numberString,);

      if (!numberValidation.success) {
        throw new Error(
          `Invalid number format '${numberString}' at position ${position}`,
        );
      }

      return {
        value: comment
          ? { type: 'number', value: numberValidation.data, comment, }
          : { type: 'number', value: numberValidation.data, },
        newPosition: endPosition,
      };
    }

    if (/[a-z]/.test(char,)) {
      let keyword: string;
      let keywordLength: number;

      if (input.substring(position, position + 4,) === 'true') {
        keyword = 'true';
        keywordLength = 4;
      }
      else if (input.substring(position, position + 5,) === 'false') {
        keyword = 'false';
        keywordLength = 5;
      }
      else if (input.substring(position, position + 4,) === 'null') {
        keyword = 'null';
        keywordLength = 4;
      }
      else {
        throw new Error(`Invalid keyword at position ${position}`,);
      }

      const keywordValidation = jsonKeywordSchema.safeParse(keyword,);
      if (!keywordValidation.success)
        throw new Error(`Invalid keyword '${keyword}' at position ${position}`,);

      const endPosition = position + keywordLength;

      if (keyword === 'true') {
        return {
          value: comment
            ? { type: 'boolean', value: true, comment, }
            : { type: 'boolean', value: true, },
          newPosition: endPosition,
        };
      }
      else if (keyword === 'false') {
        return {
          value: comment
            ? { type: 'boolean', value: false, comment, }
            : { type: 'boolean', value: false, },
          newPosition: endPosition,
        };
      }
      else {
        return {
          value: comment
            ? { type: 'null', value: null, comment, }
            : { type: 'null', value: null, },
          newPosition: endPosition,
        };
      }
    }

    throw new Error(`Unexpected character '${char}' at position ${position}`,);
  }

  // Main parsing logic
  const { value: result, newPosition: finalPosition, } = parseValue({ input,
    position: 0, },);

  const endPosition = skipWhitespace({ input, position: finalPosition, },);
  if (endPosition < input.length)
    throw new Error(`Unexpected content after end of JSON at position ${endPosition}`,);

  return result;
}
