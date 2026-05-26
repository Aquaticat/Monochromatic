/**
 * Transform hook implementation that rewrites import attributes
 * into query-parameter-tagged specifiers using AST parsing.
 *
 * Uses rolldown's built-in `parseSync` (backed by oxc) to parse source code
 * and walk the AST, replacing fragile regex with proper syntax analysis.
 *
 * @module
 */

import {
  type ESTree,
  parseSync,
  Visitor,
} from 'rolldown/utils';

import {
  extractTypeFromAttributes,
  extractTypeFromOptions,
  getStringLiteralValue,
} from './ast-extract.ts';
import {
  ABSENT,
  type Maybe,
} from './maybe.ts';
import { ATTR_QUERY_KEY, } from './patterns.ts';
import {
  collectStaticReplacements,
  type Replacement,
} from './transform-helpers.ts';

/**
 * Rewrites import/export statements that use `with { type: '...' }` attributes.
 * Parses the source with oxc, walks the AST to find import attributes,
 * and applies precise span-based replacements.
 *
 * @param code - source code to transform
 *
 * @param id - module ID (filename) for the parser
 *
 * @returns transformed code object, or {@link ABSENT} if no attributes were found
 *
 * @example
 * ```ts
 * const result = transformImportAttributes(
 *   "import x from './file.sql' with { type: 'text' }",
 *   'main.ts',
 * );
 * // result.code: "import x from './file.sql?attr=text'"
 * ```
 */
export function transformImportAttributes({
  code,
  id,
}: {
  readonly code: string;
  readonly id: string;
},): Maybe<{ code: string; }> {
  if ((!code.includes(' with ',)) && (!code.includes(' with{',)))
    return ABSENT;

  /** Parsed AST root walked to collect attribute replacements. */
  const result = parseSync(
    id,
    code,
  );
  /** Accumulator of span replacements that the reducer below applies to the source code. */
  const replacements: Replacement[] = [];

  /** AST visitor that records replacements for each kind of attribute-bearing declaration. */
  const visitor = new Visitor({
    ImportDeclaration(node: ESTree.ImportDeclaration,): void {
      if (node.attributes
        .length
        === 0)
        return;
      /** Attribute type on this static import; gates whether to emit a replacement. */
      const attrType = extractTypeFromAttributes(node.attributes,);
      if (attrType === ABSENT)
        return;
      replacements.push(...collectStaticReplacements({
        source: node.source,
        attributes: node.attributes,
        attrType,
        code,
      },),);
    },

    ExportNamedDeclaration(node: ESTree.ExportNamedDeclaration,): void {
      if ((node.source
        === null) || (node.attributes
          .length
          === 0))
        return;
      /** Attribute type on this re-export with source; gates whether to emit a replacement. */
      const attrType = extractTypeFromAttributes(node.attributes,);
      if (attrType === ABSENT)
        return;
      replacements.push(...collectStaticReplacements({
        source: node.source,
        attributes: node.attributes,
        attrType,
        code,
      },),);
    },

    ExportAllDeclaration(node: ESTree.ExportAllDeclaration,): void {
      if (node.attributes
        .length
        === 0)
        return;
      /** Attribute type on this wildcard re-export; gates whether to emit a replacement. */
      const attrType = extractTypeFromAttributes(node.attributes,);
      if (attrType === ABSENT)
        return;
      replacements.push(...collectStaticReplacements({
        source: node.source,
        attributes: node.attributes,
        attrType,
        code,
      },),);
    },

    ImportExpression(node: ESTree.ImportExpression,): void {
      if (node.options
        === null)
        return;
      /** Attribute type extracted from the dynamic-import options object. */
      const attrType = extractTypeFromOptions(node.options,);
      if (attrType === ABSENT)
        return;
      /** Literal specifier text; computed sources are skipped because their bytes cannot be rewritten safely. */
      const sourceValue = getStringLiteralValue(node.source,);
      if (sourceValue === ABSENT)
        return;

      /** Quote character preserved so the rewritten specifier matches the source's quoting style. */
      const quote = code[node.source
        .start];
      replacements.push({
        start: node.source
          .start,
        end: node.source
          .end,
        text: `${quote}${sourceValue}?${ATTR_QUERY_KEY}=${attrType}${quote}`,
      },);

      // Remove the options argument: find the first comma between source and options
      /** Slice between source end and options start, scanned to locate the separating comma. */
      const between = code.slice(
        node.source
          .end,
        node.options
          .start,
      );
      /** Position of the comma within `between`; -1 means no comma was found. */
      const relCommaIndex = between.indexOf(',',);
      /** Absolute offset where the options-argument removal span begins. */
      const commaPos = relCommaIndex === (-1)
        ? node.options
          .start
        : node.source
          .end
          + relCommaIndex;
      replacements.push({
        start: commaPos,
        end: node.options
          .end,
        text: '',
      },);
    },
  },);

  visitor.visit(result.program,);

  if (replacements.length
    === 0)
    return ABSENT;

  // Apply replacements in reverse order to preserve byte offsets
  replacements.sort(function byStartDesc(
    a,
    b,
  ) {
    return b.start
      - a
      .start;
  },);

  /** Final source after every replacement has been applied in descending start order. */
  const transformed = replacements.reduce(
    function applyReplacement(
      acc,
      r,
    ): string {
      return acc.slice(
        0,
        r.start,
      )
        + r
        .text
        + acc
        .slice(r.end,);
    },
    code,
  );

  return { code: transformed, };
}
