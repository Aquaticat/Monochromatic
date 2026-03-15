/**
 * Rolldown plugin that transforms import attributes (`with { type: '...' }`)
 * into bundler-compatible module loads.
 *
 * Rolldown parses import attributes and preserves them in ESM output,
 * but does not use them to influence module loading (rolldown#2758).
 * This plugin bridges the gap by:
 *
 * 1. Rewriting static import specifiers to encode the attribute as a query parameter
 * 2. Intercepting dynamic import resolution by scanning the importer's source
 * 3. Loading matched files with the appropriate transform (e.g. text -> default string export)
 *
 * Static imports are handled via `transform` (rewriting specifiers before rolldown scans them).
 * Dynamic imports require special handling because rolldown's Rust scanner discovers
 * dependencies from the original AST before `transform` runs on the importing file.
 *
 * @example
 * ```ts
 * // tsdown.node.config.ts
 * import { importAttributesPlugin } from '@monochromatic-dev/rolldown-plugin-import-attributes/ts';
 *
 * export default defineConfig({
 *   plugins: [importAttributesPlugin()],
 * });
 * ```
 *
 * @module
 */

import { readFile, } from 'node:fs/promises';
import {
  dirname,
  resolve,
} from 'node:path';
import type { Plugin, } from 'rolldown';

import { HANDLERS, } from './handlers.ts';
import {
  ATTR_QUERY_KEY,
  extractAttrType,
  stripAttrQuery,
} from './patterns.ts';
import { scanImporterForAttribute, } from './scan-importer.ts';
import { transformImportAttributes, } from './transform.ts';

export { importAttributesPlugin, };

//region Plugin factory

/**
 * Creates a rolldown plugin that transforms import attributes into bundler-compatible loads.
 * Handles all supported attribute types (`text`).
 *
 * @returns Rolldown plugin instance
 *
 * @example
 * ```ts
 * import { importAttributesPlugin } from '\@monochromatic-dev/rolldown-plugin-import-attributes/ts';
 * import { defineConfig } from 'tsdown';
 *
 * export default defineConfig({
 *   plugins: [importAttributesPlugin()],
 * });
 * ```
 */
function importAttributesPlugin(): Plugin {
  /**
   * Cache of importer file sources, keyed by absolute path.
   * Prevents re-reading the same file when multiple imports from it
   * trigger `resolveId` before `transform` has run.
   */
  const importerSourceCache = new Map<string, string>();

  return {
    name: 'import-attributes',

    /**
     * Delegates to {@link transformImportAttributes} to rewrite
     * `with { type: '...' }` clauses into query-parameter-tagged specifiers.
     */
    transform(code, id,) {
      return transformImportAttributes(code, id,);
    },

    /**
     * Resolves specifiers tagged with `?__importattr=<type>` (from transform rewriting)
     * or specifiers discovered by rolldown's scanner before transform ran
     * (for dynamic imports where the scanner processes the original AST).
     *
     * For untagged specifiers, scans the importer's source to check whether
     * the import had a `with { type: '...' }` clause.
     */
    async resolveId(source, importer, options,) {
      /** Check for query-param-tagged specifiers (from static imports after transform). */
      const queryAttrType = extractAttrType(source,);
      if (queryAttrType !== undefined) {
        const cleanSource = stripAttrQuery(source,);

        const resolved = await this.resolve(cleanSource, importer, {
          ...options,
          skipSelf: true,
        },);

        if (resolved !== null) {
          return {
            id: `${resolved.id}?${ATTR_QUERY_KEY}=${queryAttrType}`,
            external: false,
          };
        }

        if (importer !== undefined && cleanSource.startsWith('.',)) {
          const importerDir = dirname(importer.split('?',)[0] ?? importer,);
          const absolutePath = resolve(importerDir, cleanSource,);
          return {
            id: `${absolutePath}?${ATTR_QUERY_KEY}=${queryAttrType}`,
            external: false,
          };
        }

        return null;
      }

      /**
       * For untagged specifiers from an importer, scan the importer's source
       * to check if this import has an attribute clause.
       * This catches dynamic imports that rolldown's scanner discovered
       * from the original AST before `transform` could rewrite them.
       */
      if (importer !== undefined) {
        const cleanImporter = importer.split('?',)[0] ?? importer;
        const attrType = scanImporterForAttribute(
          source,
          cleanImporter,
          importerSourceCache,
        );

        if (attrType !== undefined) {
          const resolved = await this.resolve(source, importer, {
            ...options,
            skipSelf: true,
          },);

          if (resolved !== null) {
            return {
              id: `${resolved.id}?${ATTR_QUERY_KEY}=${attrType}`,
              external: false,
            };
          }

          if (source.startsWith('.',)) {
            const importerDir = dirname(cleanImporter,);
            const absolutePath = resolve(importerDir, source,);
            return {
              id: `${absolutePath}?${ATTR_QUERY_KEY}=${attrType}`,
              external: false,
            };
          }
        }
      }

      return null;
    },

    /**
     * Loads modules tagged with `?__importattr=<type>` by reading the file
     * and passing its content through the registered handler.
     */
    async load(id,) {
      const attrType = extractAttrType(id,);
      if (attrType === undefined)
        return null;

      const handler = HANDLERS[attrType];
      if (handler === undefined)
        return null;

      const filePath = stripAttrQuery(id,);
      const content = await readFile(filePath, 'utf8',);
      const moduleCode = handler(content, filePath,);

      return { code: moduleCode, };
    },
  };
}

//endregion Plugin factory
