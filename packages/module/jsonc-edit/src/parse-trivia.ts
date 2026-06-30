import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import type { JsoncComment, } from './comment.ts';
import { mergeComments, } from './merge-comments.ts';
import {
  isJsonWhitespace,
  scanBlockComment,
  scanLineComment,
} from './scan.ts';

//region Leading trivia

/**
 * Result of skipping leading trivia: the merged leading comment (if any) and the
 * offset of the next significant character.
 */
export type TriviaScan = {
  comment: JsoncComment | undefined;
  end: number;
};

/**
 * Skips whitespace and comments before a token, merging every comment it crosses
 * into a single leading comment. This is how a comment that precedes a key or
 * value becomes attached to it.
 *
 * @param source - Full JSONC source.
 *
 * @param index - Offset to start skipping from.
 *
 * @returns Merged leading comment and the next significant offset.
 *
 * @example
 * ```ts
 * skipTrivia({ source: ' // a\n{', index: 0 });
 * // => { comment: { type: 'inline', text: ' a' }, end: 6 }
 * ```
 */
export function skipTrivia({
  source,
  index,
}: {
  source: string;
  index: number;
},): TriviaScan {
  // Cursor walk over whitespace and comments, accumulating comments.
  let comment: JsoncComment | undefined;
  let cursor = index;
  while (cursor < source.length) {
    /**
     * Character under the cursor.
     */
    const char = source[cursor];
    if (char === undefined)
      break;
    if (isJsonWhitespace(char,)) {
      cursor += 1;
      continue;
    }
    if ((char === '/') && (source[cursor + 1] === '/')) {
      /**
       * Scanned line comment body and end offset.
       */
      const scan = scanLineComment({
        source,
        index: cursor,
      },);
      comment = mergeComments({
        first: comment,
        second: {
          type: 'inline',
          text: scan.text,
        },
      },);
      cursor = scan.end;
      continue;
    }
    if ((char === '/') && (source[cursor + 1] === '*')) {
      /**
       * Scanned block comment body and end offset.
       */
      const scan = scanBlockComment({
        source,
        index: cursor,
      },);
      comment = mergeComments({
        first: comment,
        second: {
          type: 'block',
          text: scan.text,
        },
      },);
      cursor = scan.end;
      continue;
    }
    break;
  }
  return {
    comment,
    end: cursor,
  };
}

//endregion Leading trivia

//region Trailing trivia

/**
 * Whitespace characters that stay on the current line. A newline ends a
 * trailing-comment capture, so it is excluded here.
 */
const INLINE_WHITESPACE = new Set([
  ' ',
  '\t',
  '\r',
],);

/**
 * Result of capturing trailing trivia after a value: any same-line comment,
 * whether a separating comma was consumed, and the next offset.
 */
export type TrailingScan = {
  comment: JsoncComment | undefined;
  commaSeen: boolean;
  end: number;
};

/**
 * Captures what follows a value on the same line: at most one separating comma
 * and any same-line comment, in either order, stopping at a newline, a closing
 * bracket, or the next value. A comment captured here is the value's trailing
 * comment.
 *
 * @param source - Full JSONC source.
 *
 * @param index - Offset just past the parsed value.
 *
 * @returns Trailing comment, whether a comma was seen, and the next offset.
 *
 * @example
 * ```ts
 * captureTrailing({ source: ', // note\n', index: 0 });
 * // => { comment: { type: 'inline', text: ' note' }, commaSeen: true, end: 9 }
 * ```
 */
export function captureTrailing({
  source,
  index,
}: {
  source: string;
  index: number;
},): TrailingScan {
  // Cursor walk across the rest of the line, taking one comma and any comment.
  let comment: JsoncComment | undefined;
  let commaSeen = false;
  let cursor = index;
  while (cursor < source.length) {
    /**
     * Character under the cursor.
     */
    const char = source[cursor];
    if (char === undefined)
      break;
    if (char === '\n')
      break;
    if (INLINE_WHITESPACE.has(char,)) {
      cursor += 1;
      continue;
    }
    if ((char === ',') && !commaSeen) {
      commaSeen = true;
      cursor += 1;
      continue;
    }
    if ((char === '/') && (source[cursor + 1] === '/')) {
      /**
       * Scanned line comment body and end offset.
       */
      const scan = scanLineComment({
        source,
        index: cursor,
      },);
      comment = mergeComments({
        first: comment,
        second: {
          type: 'inline',
          text: scan.text,
        },
      },);
      cursor = scan.end;
      continue;
    }
    if ((char === '/') && (source[cursor + 1] === '*')) {
      /**
       * Scanned block comment body and end offset.
       */
      const scan = scanBlockComment({
        source,
        index: cursor,
      },);
      comment = mergeComments({
        first: comment,
        second: {
          type: 'block',
          text: scan.text,
        },
      },);
      cursor = scan.end;
      continue;
    }
    break;
  }
  return {
    comment,
    commaSeen,
    end: cursor,
  };
}

//endregion Trailing trivia

//region Comment attachment

/**
 * Returns a copy of a comment-bearing node with `comment` merged before its
 * existing comment, or the node unchanged when there is nothing to merge.
 *
 * @param node - Node or key carrying an optional comment.
 *
 * @param comment - Comment to place ahead of the node's current comment.
 *
 * @returns Node with the leading comment merged in.
 *
 * @example
 * ```ts
 * prependComment({ node: { kind: 'null' }, comment: { type: 'inline', text: 'x' } });
 * // => { kind: 'null', comment: { type: 'inline', text: 'x' } }
 * ```
 */
export function prependComment<const N extends { comment?: JsoncComment | undefined; },>({
  node,
  comment,
}: {
  node: N;
  comment: JsoncComment | undefined;
},): N {
  if (comment === undefined)
    return node;
  return {
    ...node,
    comment: nonNullishOrThrow(mergeComments({
      first: comment,
      second: node.comment,
    },),),
  };
}

/**
 * Returns a copy of a comment-bearing node with `comment` merged after its
 * existing comment, or the node unchanged when there is nothing to merge.
 *
 * @param node - Node or key carrying an optional comment.
 *
 * @param comment - Comment to place after the node's current comment.
 *
 * @returns Node with the trailing comment merged in.
 *
 * @example
 * ```ts
 * appendComment({ node: { kind: 'null' }, comment: { type: 'inline', text: 'x' } });
 * // => { kind: 'null', comment: { type: 'inline', text: 'x' } }
 * ```
 */
export function appendComment<const N extends { comment?: JsoncComment | undefined; },>({
  node,
  comment,
}: {
  node: N;
  comment: JsoncComment | undefined;
},): N {
  if (comment === undefined)
    return node;
  return {
    ...node,
    comment: nonNullishOrThrow(mergeComments({
      first: node.comment,
      second: comment,
    },),),
  };
}

//endregion Comment attachment
