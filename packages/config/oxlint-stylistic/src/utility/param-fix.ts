// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-argument -- oxlint plugin API is untyped
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
  /** Full file source text. */
  sourceText: string;
  /** Byte offset of opening `(`. */
  openParen: number;
  /** Byte offset of closing `)`. */
  closeParen: number;
  /** Array of parameter AST nodes. */
  params: Span[];
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
  /** First param's range; used to test whether it shares a line with the opening paren. */
  const firstRange = rangeOf(at({
    arr: params,
    index: 0,
  },),);
  if (lineAt({
    sourceText,
    offset: openParen,
  },) === lineAt({
    sourceText,
    offset: firstRange[0],
  },)) {
    return true;
  }

  /** Last param's range; used to test whether it shares a line with the closing paren. */
  const lastRange = rangeOf(at({
    arr: params,
    index: params.length - 1,
  },),);
  if (lineAt({
    sourceText,
    offset: lastRange[1],
  },) === lineAt({
    sourceText,
    offset: closeParen,
  },)) {
    return true;
  }

  for (let i = 1; i < params.length; i++) {
    const prevRange = rangeOf(at({
      arr: params,
      index: i - 1,
    },),);
    const currRange = rangeOf(at({
      arr: params,
      index: i,
    },),);
    if (lineAt({
      sourceText,
      offset: prevRange[1],
    },) === lineAt({
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
  /** Fixer instance. */
  fixer: Fixer;
  /** Full file source text. */
  sourceText: string;
  /** Byte offset of `(`. */
  openParen: number;
  /** Byte offset of `)`. */
  closeParen: number;
  /** Parameter AST nodes. */
  params: Span[];
  /** Lint context for source text access. */
  context: Context;
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
  /** Detect base indentation from the line containing `(`. */
  const baseIndent = baseIndentAt({
    sourceText,
    offset: openParen,
  },);
  const childIndent = `${baseIndent}  `;

  const paramTexts = params.map(
    function getParamText(p,): string {
      return context.sourceCode.getText(p,).trim();
    },
  );

  /** Check trailing comma. */
  const lastRange = rangeOf(at({
    arr: params,
    index: params.length - 1,
  },),);
  const between = sourceText.slice(
    lastRange[1],
    closeParen,
  );
  const hasTrailing = between.includes(',',);

  const formatted = paramTexts
    .map(function fmt(
      text,
      idx,
    ): string {
      const isLast = idx === paramTexts.length - 1;
      const comma = isLast && !hasTrailing ? '' : ',';
      return `${childIndent}${text}${comma}`;
    },)
    .join('\n',);

  /** Replace from `(` through `)` inclusive. */
  const replacement = `(\n${formatted}\n${baseIndent})`;

  return fixer.replaceTextRange(
    [
      openParen,
      closeParen + 1,
    ],
    replacement,
  );
}
