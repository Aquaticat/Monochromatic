/**
 * Span-based string replacement helpers for AST-driven import attribute transforms.
 *
 * @module
 */

import type { ESTree, } from 'rolldown/utils';

import { ATTR_QUERY_KEY, } from './patterns.ts';

//region Types

/**
 * Source string replacement with start/end byte offsets.
 */
export type Replacement = {
  readonly start: number;
  readonly end: number;
  readonly text: string;
};

//endregion Types

//region Clause scanning

/**
 * Finds the start of the `with`/`assert` clause after a source literal
 * by scanning whitespace then checking for the keyword.
 *
 * @param code - full source code
 *
 * @param fromPos - position to start scanning (typically `source.end`)
 *
 * @returns position of the clause start (including leading whitespace), or -1
 */
function findWithClauseStart(
  code: string,
  fromPos: number,
): number {
  let pos = fromPos;
  const saved = pos;
  while (pos < code.length && ' \t\n\r'.includes(code.at(pos,) ?? '',))
    pos++;
  if (code.startsWith(
    'with',
    pos,
  ) || code.startsWith(
    'assert',
    pos,
  )) {
    return saved;
  }
  return -1;
}

/**
 * Finds the closing brace `}` of the `with`/`assert` clause after the
 * last import attribute entry.
 *
 * @param code - full source code
 *
 * @param afterLastAttr - position after the last attribute node's span
 *
 * @returns position after the closing `}`
 */
function findWithClauseEnd(
  code: string,
  afterLastAttr: number,
): number {
  let pos = afterLastAttr;
  while (pos < code.length && code[pos] !== '}')
    pos++;
  // Include the closing brace
  return pos + 1;
}

//endregion Clause scanning

/**
 * Collects replacements for a static import/export declaration with attributes.
 *
 * @param source - source literal AST node
 *
 * @param attributes - import attribute AST nodes
 *
 * @param attrType - resolved attribute type string
 *
 * @param code - full source code
 *
 * @param replacements - mutable array to push replacements into
 */
export function collectStaticReplacements(
  source: ESTree.StringLiteral,
  attributes: readonly ESTree.ImportAttribute[],
  attrType: string,
  code: string,
  replacements: Replacement[],
): void {
  const quote = code[source.start];
  replacements.push({
    start: source.start,
    end: source.end,
    text: `${quote}${source.value}?${ATTR_QUERY_KEY}=${attrType}${quote}`,
  },);

  const withStart = findWithClauseStart(
    code,
    source.end,
  );
  if (withStart === -1)
    return;
  const lastAttr = attributes.at(-1,);
  if (lastAttr === undefined)
    return;
  const withEnd = findWithClauseEnd(
    code,
    lastAttr.end,
  );
  replacements.push({
    start: withStart,
    end: withEnd,
    text: '',
  },);
}
