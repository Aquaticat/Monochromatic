/**
 * Scans importer source files to discover import attribute types
 * for dynamic imports that rolldown's Rust scanner processes
 * before `transform` runs.
 *
 * Uses AST parsing via rolldown's `parseSync` instead of regex
 * for robust, formatting-independent matching.
 *
 * @module
 */

import { readFileSync, } from 'node:fs';

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

/**
 * Scans an importer file's source code to find the import attribute type
 * associated with a given specifier.
 *
 * This is used for dynamic imports where rolldown's Rust scanner discovers
 * dependencies before the `transform` hook can rewrite them.
 *
 * @param specifier - import specifier to look for (e.g. `./sample.sql`)
 *
 * @param importerPath - absolute path to the importing file
 *
 * @param importerSourceCache - cache to avoid re-reading the same file
 *
 * @returns attribute type string if found and supported, `undefined` otherwise
 *
 * @example
 * ```ts
 * const cache = new Map<string, string>();
 * scanImporterForAttribute('./sample.sql', '/project/src/main.ts', cache);
 * // 'text' if main.ts contains: import x from './sample.sql' with { type: 'text' }
 * ```
 */
export function scanImporterForAttribute({
  specifier,
  importerPath,
  importerSourceCache,
}: {
  specifier: string;
  importerPath: string;
  importerSourceCache: Map<string, string>;
},): string | undefined {
  /** Importer source text; lazily read from disk on cache miss and stored back. */
  let source = importerSourceCache.get(importerPath,);
  if (source === undefined) {
    try {
      source = readFileSync(
        importerPath,
        'utf8',
      );
      importerSourceCache.set(
        importerPath,
        source,
      );
    }
    catch {
      return undefined;
    }
  }

  if (!source.includes(specifier,))
    return undefined;

  /** Parsed AST root produced by rolldown's parser. */
  const result = parseSync(
    importerPath,
    source,
  );
  /** Mutable accumulator written by the visitor when a matching specifier is encountered. */
  let found: string | undefined = undefined;

  /** AST visitor that records the attribute type on the first matching specifier. */
  const visitor = new Visitor({
    ImportDeclaration(node: ESTree.ImportDeclaration,): void {
      if (found !== undefined)
        return;
      if (node.source.value !== specifier || node.attributes.length === 0)
        return;
      found = extractTypeFromAttributes(node.attributes,);
    },

    ExportNamedDeclaration(node: ESTree.ExportNamedDeclaration,): void {
      if (found !== undefined)
        return;
      if (node.source === null
        || node.source.value !== specifier
        || node.attributes.length === 0)
      {
        return;
      }
      found = extractTypeFromAttributes(node.attributes,);
    },

    ExportAllDeclaration(node: ESTree.ExportAllDeclaration,): void {
      if (found !== undefined)
        return;
      if (node.source.value !== specifier || node.attributes.length === 0)
        return;
      found = extractTypeFromAttributes(node.attributes,);
    },

    ImportExpression(node: ESTree.ImportExpression,): void {
      if (found !== undefined)
        return;
      if (node.options === null)
        return;
      /** Literal specifier text; computed sources are skipped. */
      const sourceValue = getStringLiteralValue(node.source,);
      if (sourceValue !== specifier)
        return;
      found = extractTypeFromOptions(node.options,);
    },
  },);

  visitor.visit(result.program,);
  return found;
}
