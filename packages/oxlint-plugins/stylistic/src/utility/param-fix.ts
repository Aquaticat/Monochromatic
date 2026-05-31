import type {
  Context,
  Fixer,
  Span,
} from '@oxlint/plugins';

import { baseIndentAt, } from './indent.ts';
import { lineAt, } from './line-at.ts';
import {
  at,
  rangeOf,
} from './range.ts';

/**
 * Parameters for {@link paramsNeedFix}.
 */
export type ParamsNeedFixParams = {
  /**
   * Full file source text.
   */
  readonly sourceText: string;
  /**
   * Byte offset of opening `(`.
   */
  readonly openParen: number;
  /**
   * Byte offset of closing `)`.
   */
  readonly closeParen: number;
  /**
   * Array of parameter AST nodes.
   */
  readonly params: readonly Span[];
};

/**
 * Checks whether function params need per-line reformatting.
 *
 * @returns whether any params share a line
 *
 * @example
 * ```ts
 * if (paramsNeedFix({ sourceText, openParen, closeParen, params })) { /* report *\/ }
 * ```
 */
export function paramsNeedFix({
  sourceText,
  openParen,
  closeParen,
  params,
}: ParamsNeedFixParams,): boolean {
  /**
   * First param's range; used to test whether it shares a line with the opening paren.
   */
  const firstRange = rangeOf(at({
    arr: params,
    index: 0,
  },),);
  if (lineAt({
    sourceText,
    offset: openParen,
  },)
    === lineAt({
    sourceText,
    offset: firstRange[0],
  },)) {
    return true;
  }

  /**
   * Last param's range; used to test whether it shares a line with the closing paren.
   */
  const lastRange = rangeOf(at({
    arr: params,
    index: params.length
      - 1,
  },),);
  if (lineAt({
    sourceText,
    offset: lastRange[1],
  },)
    === lineAt({
    sourceText,
    offset: closeParen,
  },)) {
    return true;
  }

  for (let i = 1; i < params
    .length; i++) {
    /**
     * Range of the previous param; its end offset is compared with the current param's start line.
     */
    const prevRange = rangeOf(at({
      arr: params,
      index: i - 1,
    },),);
    /**
     * Range of the current param; its start offset is the other side of the line-equality check.
     */
    const currRange = rangeOf(at({
      arr: params,
      index: i,
    },),);
    if (lineAt({
      sourceText,
      offset: prevRange[1],
    },)
      === lineAt({
      sourceText,
      offset: currRange[0],
    },)) {
      return true;
    }
  }

  return false;
}

/**
 * Parameters for {@link buildParamFix}.
 */
export type BuildParamFixParams = {
  /**
   * Fixer instance.
   */
  readonly fixer: Fixer;
  /**
   * Full file source text.
   */
  readonly sourceText: string;
  /**
   * Byte offset of `(`.
   */
  readonly openParen: number;
  /**
   * Byte offset of `)`.
   */
  readonly closeParen: number;
  /**
   * Parameter AST nodes.
   */
  readonly params: readonly Span[];
  /**
   * Lint context for source text access.
   */
  readonly context: Context;
};

/**
 * Builds a fixer result that places each param on its own line.
 *
 * @returns fixer replacement result
 *
 * @example
 * ```ts
 * return buildParamFix({ fixer, sourceText, openParen, closeParen, params, context });
 * ```
 */
export function buildParamFix({
  fixer,
  sourceText,
  openParen,
  closeParen,
  params,
  context,
}: BuildParamFixParams,): ReturnType<Fixer['replaceText']> {
  /**
   * Detect base indentation from the line containing `(`.
   */
  const baseIndent = baseIndentAt({
    sourceText,
    offset: openParen,
  },);
  /**
   * Two-space continuation indent for params placed inside the parens.
   */
  const childIndent = `${baseIndent}  `;

  /**
   * Trimmed source text for each param; trailing delimiters are re-added uniformly below.
   */
  const paramTexts = params.map(
    function getParamText(p,): string {
      return context.sourceCode
        .getText(p,)
        .trim();
    },
  );

  /**
   * Check trailing comma.
   */
  const lastRange = rangeOf(at({
    arr: params,
    index: params.length
      - 1,
  },),);
  /**
   * Source slice between the last param and the close paren; inspected for an existing trailing comma.
   */
  const between = sourceText.slice(
    lastRange[1],
    closeParen,
  );
  /**
   * Whether the original source had a trailing comma; preserved verbatim in the rewrite.
   */
  const hasTrailing = between.includes(',',);

  /**
   * Params rendered one per line with `childIndent` and the appropriate comma suffix.
   */
  const formatted = paramTexts
    .map(function fmt(
      text,
      idx,
    ): string {
      /**
       * Whether this is the last param; combined with `hasTrailing` to decide whether to emit a comma.
       */
      const isLast = idx === (paramTexts.length
        - 1);
      /**
       * Comma suffix or empty string for the last param without an original trailing comma.
       */
      const comma = (isLast && (!hasTrailing)) ? '' : ',';
      return `${childIndent}${text}${comma}`;
    },)
    .join('\n',);

  /**
   * Replace from `(` through `)` inclusive.
   */
  const replacement = `(\n${formatted}\n${baseIndent})`;

  return fixer.replaceTextRange(
    [
      openParen,
      closeParen + 1,
    ],
    replacement,
  );
}
