/**
 * Scans importer source files to discover import attribute types
 * for dynamic imports that rolldown's Rust scanner processes
 * before `transform` runs.
 *
 * @module
 */

import { readFileSync, } from 'node:fs';

import { HANDLERS, } from './handlers.ts';

/**
 * Scans an importer file's source code to find the import attribute type
 * associated with a given specifier.
 *
 * This is used for dynamic imports where rolldown's Rust scanner discovers
 * dependencies before the `transform` hook can rewrite them.
 *
 * @param specifier - Import specifier to look for (e.g. `./sample.sql`)
 *
 * @param importerPath - Absolute path to the importing file
 *
 * @param importerSourceCache - Cache to avoid re-reading the same file
 *
 * @returns Attribute type string if found and supported, `undefined` otherwise
 */
export function scanImporterForAttribute(
  specifier: string,
  importerPath: string,
  importerSourceCache: Map<string, string>,
): string | undefined {
  let source = importerSourceCache.get(importerPath);
  if (source === undefined) {
    try {
      source = readFileSync(importerPath, 'utf8');
      importerSourceCache.set(importerPath, source);
    } catch {
      return undefined;
    }
  }

  if (!source.includes(specifier)) {
    return undefined;
  }

  /**
   * Build a regex that matches the specific specifier with a `with { type: '...' }` clause.
   * Handles both static (`with { type: '...' }`) and dynamic (`{ with: { type: '...' } }`) forms.
   */
  const escapedSpecifier = specifier.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const specificAttrRe = new RegExp(
    `['"]${escapedSpecifier}['"]`
    + `(?:`
    + `\\s+with\\s*\\{\\s*type\\s*:\\s*['"]`
    + `(\\w+)`
    + `['"]\\s*\\}`
    + `|`
    + `\\s*,\\s*\\{\\s*with\\s*:\\s*\\{\\s*type\\s*:\\s*['"]`
    + `(\\w+)`
    + `['"]\\s*\\}\\s*\\}`
    + `)`,
  );

  const match = specificAttrRe.exec(source);
  if (match === null) {
    return undefined;
  }

  const attrType = match[1] ?? match[2];
  if (attrType === undefined || HANDLERS[attrType] === undefined) {
    return undefined;
  }

  return attrType;
}
