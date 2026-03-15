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

import { extractTypeFromAttributes, extractTypeFromOptions, getStringLiteralValue, } from './ast-extract.ts';
import { ATTR_QUERY_KEY, } from './patterns.ts';
import { collectStaticReplacements, type Replacement, } from './transform-helpers.ts';

/**
 * Rewrites import/export statements that use `with { type: '...' }` attributes.
 * Parses the source with oxc, walks the AST to find import attributes,
 * and applies precise span-based replacements.
 *
 * @param code - source code to transform
 *
 * @param id - module ID (filename) for the parser
 *
 * @returns transformed code object, or `null` if no attributes were found
 */
export function transformImportAttributes(
  code: string,
  id: string,
): { code: string; } | null {
  if (!code.includes(' with ',) && !code.includes(' with{',))
    return null;

  const result = parseSync(id, code,);
  const replacements: Replacement[] = [];

  const visitor = new Visitor({
    ImportDeclaration(node: ESTree.ImportDeclaration,): void {
      if (node.attributes.length === 0)
        return;
      const attrType = extractTypeFromAttributes(node.attributes,);
      if (attrType === undefined)
        return;
      collectStaticReplacements(node.source, node.attributes, attrType, code, replacements,);
    },

    ExportNamedDeclaration(node: ESTree.ExportNamedDeclaration,): void {
      if (node.source === null || node.attributes.length === 0)
        return;
      const attrType = extractTypeFromAttributes(node.attributes,);
      if (attrType === undefined)
        return;
      collectStaticReplacements(node.source, node.attributes, attrType, code, replacements,);
    },

    ExportAllDeclaration(node: ESTree.ExportAllDeclaration,): void {
      if (node.attributes.length === 0)
        return;
      const attrType = extractTypeFromAttributes(node.attributes,);
      if (attrType === undefined)
        return;
      collectStaticReplacements(node.source, node.attributes, attrType, code, replacements,);
    },

    ImportExpression(node: ESTree.ImportExpression,): void {
      if (node.options === null)
        return;
      const attrType = extractTypeFromOptions(node.options,);
      if (attrType === undefined)
        return;
      const sourceValue = getStringLiteralValue(node.source,);
      if (sourceValue === undefined)
        return;

      const quote = code[node.source.start];
      replacements.push({
        start: node.source.start,
        end: node.source.end,
        text: `${quote}${sourceValue}?${ATTR_QUERY_KEY}=${attrType}${quote}`,
      },);

      // Remove the options argument: find the comma after source, remove through options end
      let commaPos = node.source.end;
      while (commaPos < node.options.start && code[commaPos] !== ',')
        commaPos++;
      replacements.push({ start: commaPos, end: node.options.end, text: '', },);
    },
  },);

  visitor.visit(result.program,);

  if (replacements.length === 0)
    return null;

  // Apply replacements in reverse order to preserve byte offsets
  replacements.sort(function byStartDesc(a, b,) {
    return b.start - a.start;
  },);

  let transformed = code;
  for (const r of replacements) {
    transformed = transformed.slice(0, r.start,) + r.text + transformed.slice(r.end,);
  }

  return { code: transformed, };
}
