/**
 * TSDoc type annotation disallow rule.
 *
 * Extracted from `tag-types.ts` to keep files under 100 countable lines.
 *
 * @module
 */

import type {
  Context,
  CreateOnceRule,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  createTsdocVisitor,
  stripCommentLineMarker,
} from './tsdoc-visitors.ts';

/**
 * Returns true when `c` is an ASCII word character (alphanumeric or `_`).
 *
 * @param c - candidate character
 *
 * @returns true when the character qualifies as `\w` in regex semantics
 */
function isWordChar(c: string,): boolean {
  return ((c >= '0') && (c <= '9'))
    || ((c >= 'a') && (c <= 'z'))
    || ((c >= 'A') && (c <= 'Z'))
    || (c === '_');
}

/**
 * Returns true when `c` is ASCII horizontal or vertical whitespace.
 *
 * @param c - candidate character
 *
 * @returns true when the character is whitespace
 */
function isWhitespaceChar(c: string,): boolean {
  return (c === ' ') || (c === '\t') || (c === '\n')
    || (c === '\r') || (c === '\f') || (c === '\v');
}

/**
 * Collects every JSDoc-style `{Type}` body that follows a `@word` and at
 * least one whitespace char in `s`. Mirrors `/@\w+\s+\{([^}]+)\}/g`.
 *
 * Strictly linear: each `@` candidate is found by `indexOf`, surrounding
 * checks are constant-time, and the cursor advances past every consumed
 * span so the total work is bounded by the length of `s`.
 *
 * @param s - line content (already stripped of comment markers and trim)
 *
 * @returns ordered list of captured type bodies (without the braces)
 */
function findTypeAnnotations(s: string,): readonly string[] {
  /**
   * Recursive scan accumulating each `{Type}` body following a `@tag`.
   *
   * @param from - cursor index for the next `indexOf` call
   *
   * @param acc - bodies collected so far, in source order
   *
   * @returns final list of captured type bodies
   */
  function scan({
    from,
    acc,
  }: {
    from: number;
    acc: readonly string[];
  },): readonly string[] {
    /** Position of the next at-sign; -1 ends the scan. */
    const atIdx = s.indexOf(
      '@',
      from,
    );
    if (atIdx === (-1))
      return acc;
    /**
     * Walks the run of word characters following the `@`.
     *
     * @param idx - cursor into `s`
     *
     * @returns exclusive end of the tag-name run
     */
    function scanTag(idx: number,): number {
      if (idx >= s.length)
        return idx;
      if (!isWordChar(s.charAt(idx,),))
        return idx;
      return scanTag(idx + 1,);
    }
    /** Exclusive end of the tag-name run; cursor starts at `atIdx + 1` to skip the at-sign. */
    const tagEnd = scanTag(atIdx + 1,);
    if (tagEnd === (atIdx + 1)) {
      return scan({
        from: atIdx + 1,
        acc,
      },);
    }
    /**
     * Walks the run of whitespace characters following the tag.
     *
     * @param idx - cursor into `s`
     *
     * @returns first non-whitespace position
     */
    function scanWs(idx: number,): number {
      if (idx >= s.length)
        return idx;
      if (!isWhitespaceChar(s.charAt(idx,),))
        return idx;
      return scanWs(idx + 1,);
    }
    /** First index past the inter-token whitespace; `{` must live here for a match. */
    const afterWs = scanWs(tagEnd,);
    if ((afterWs === tagEnd) || (s.charAt(afterWs,) !== '{')) {
      return scan({
        from: tagEnd,
        acc,
      },);
    }
    /** Position of the matching `}`; -1 means the type body is unterminated. */
    const closeIdx = s.indexOf(
      '}',
      afterWs + 1,
    );
    if (closeIdx === (-1))
      return acc;
    /** Captured body between `{` and `}` exclusive; must be non-empty per `[^}]+`. */
    const body = s.slice(
      afterWs + 1,
      closeIdx,
    );
    if (body.length === 0) {
      return scan({
        from: closeIdx + 1,
        acc,
      },);
    }
    return scan({
      from: closeIdx + 1,
      acc: [
        ...acc,
        body,
      ],
    },);
  }
  return scan({
    from: 0,
    acc: [],
  },);
}

/**
 * Disallows type annotations in TSDoc tags.
 *
 * In TypeScript projects, types are expressed via type annotations, not JSDoc-style
 * `{Type}` syntax. Reports param/returns with `{Type}` syntax.
 */
export const noTypes: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow JSDoc-style type annotations in TSDoc comments.',
      recommended: true,
    },
    messages: {
      noType:
        'Type annotations in TSDoc are not allowed in TypeScript. Remove the "{{{type}}}" type.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return createTsdocVisitor({
      context,
      handler: function noTypesHandler(
        _node,
        comment,
      ): void {
        /**
         * Comment body split into lines; each is scanned for the disallowed JSDoc-style
         * curly-braced type annotation that follows a tag.
         */
        const lines = comment.value.split('\n',);
        lines.forEach(function checkLine(
          line,
          index,
        ): void {
          /** Line stripped of indent and leading `*` so the scan matches at the start of the content. */
          const trimmed = stripCommentLineMarker(line.trimStart(),).trimStart();
          for (const body of findTypeAnnotations(trimmed,)) {
            context.report({
              loc: {
                start: {
                  line: comment.loc.start.line + index,
                  column: 0,
                },
              },
              messageId: 'noType',
              data: { type: body, },
            },);
          }
        },);
      },
    },);
  },
};
