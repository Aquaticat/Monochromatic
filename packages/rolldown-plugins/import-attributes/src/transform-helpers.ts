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
 *
 * @example
 * ```ts
 * const r: Replacement = { start: 10, end: 20, text: "'./file.sql?attr=text'" };
 * ```
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
function findWithClauseStart({
  code,
  fromPos,
}: {
  code: string;
  fromPos: number;
},): number {
  /** Detects whether the trailing slot begins with a `with`/`assert` keyword. */
  const match = /^[ \t\n\r]*(?:with|assert)/.exec(code.slice(fromPos,),);
  return match === null ? -1 : fromPos;
}

/**
 * Finds the closing brace `}` of the `with`/`assert` clause after the
 * last import attribute entry.
 *
 * @param code - full source code
 *
 * @param afterLastAttr - position after the last attribute node's span
 *
 * @returns position after the closing `}` (or `code.length + 1` if not found)
 */
function findWithClauseEnd({
  code,
  afterLastAttr,
}: {
  code: string;
  afterLastAttr: number;
},): number {
  /** Offset of the brace that ends the attributes object; falls through when absent. */
  const closingBrace = code.indexOf(
    '}',
    afterLastAttr,
  );
  return (closingBrace === (-1) ? code.length : closingBrace) + 1;
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
 *
 * @example
 * ```ts
 * const replacements: Replacement[] = [];
 * collectStaticReplacements(node.source, node.attributes, 'text', code, replacements);
 * ```
 */
export function collectStaticReplacements({
  source,
  attributes,
  attrType,
  code,
  replacements,
}: {
  source: ESTree.StringLiteral;
  attributes: readonly ESTree.ImportAttribute[];
  attrType: string;
  code: string;
  replacements: Replacement[];
},): void {
  /** Quote character preserved so the rewritten specifier matches the source's quoting style. */
  const quote = code[source.start];
  replacements.push({
    start: source.start,
    end: source.end,
    text: `${quote}${source.value}?${ATTR_QUERY_KEY}=${attrType}${quote}`,
  },);

  /** Start of the `with`/`assert` clause to elide; -1 if no clause is present. */
  const withStart = findWithClauseStart({
    code,
    fromPos: source.end,
  },);
  if (withStart === (-1))
    return;
  /** Last attribute entry, used to anchor the end-of-clause scan. */
  const lastAttr = attributes.at(-1,);
  if (lastAttr === undefined)
    return;
  /** End offset that completes the elision span past the closing brace. */
  const withEnd = findWithClauseEnd({
    code,
    afterLastAttr: lastAttr.end,
  },);
  replacements.push({
    start: withStart,
    end: withEnd,
    text: '',
  },);
}
