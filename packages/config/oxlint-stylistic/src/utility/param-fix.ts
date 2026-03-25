// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-argument -- oxlint plugin API is untyped
import type {
  Context,
  Fixer,
  Span,
} from '@oxlint/plugins';

import { lineAt, } from './line-at.ts';
import {
  at,
  rangeOf,
} from './range.ts';

/**
 * Checks whether function params need per-line reformatting.
 *
 * @param sourceText - full file source text
 *
 * @param openParen - byte offset of opening `(`
 *
 * @param closeParen - byte offset of closing `)`
 *
 * @param params - array of parameter AST nodes
 *
 * @returns whether any params share a line
 */
export function paramsNeedFix(
  sourceText: string,
  openParen: number,
  closeParen: number,
  params: Span[],
): boolean {
  const firstRange = rangeOf(at(
    params,
    0,
  ),);
  if (lineAt(
    sourceText,
    openParen,
  ) === lineAt(
    sourceText,
    firstRange[0],
  )) {
    return true;
  }

  const lastRange = rangeOf(at(
    params,
    params.length - 1,
  ),);
  if (lineAt(
    sourceText,
    lastRange[1],
  ) === lineAt(
    sourceText,
    closeParen,
  )) {
    return true;
  }

  for (let i = 1; i < params.length; i++) {
    const prevRange = rangeOf(at(
      params,
      i - 1,
    ),);
    const currRange = rangeOf(at(
      params,
      i,
    ),);
    if (lineAt(
      sourceText,
      prevRange[1],
    ) === lineAt(
      sourceText,
      currRange[0],
    )) {
      return true;
    }
  }

  return false;
}

/**
 * Builds a fixer result that places each param on its own line.
 *
 * @param fixer - fixer instance
 *
 * @param sourceText - full file source text
 *
 * @param openParen - byte offset of `(`
 *
 * @param closeParen - byte offset of `)`
 *
 * @param params - parameter AST nodes
 *
 * @param context - lint context for source text access
 *
 * @returns fixer replacement result
 */
export function buildParamFix(
  fixer: Fixer,
  sourceText: string,
  openParen: number,
  closeParen: number,
  params: Span[],
  context: Context,
): ReturnType<Fixer['replaceText']> {
  /** Detect base indentation from the line containing `(`. */
  const lineStart = sourceText.lastIndexOf(
    '\n',
    openParen - 1,
  ) + 1;
  const linePrefix = sourceText.slice(
    lineStart,
    openParen,
  );
  const baseIndent = linePrefix.match(/^(\s*)/,)?.[1] ?? '';
  const childIndent = `${baseIndent}  `;

  const paramTexts = params.map(
    function getParamText(p,): string {
      return context.sourceCode.getText(p,).trim();
    },
  );

  /** Check trailing comma. */
  const lastRange = rangeOf(at(
    params,
    params.length - 1,
  ),);
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
