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

import { readFileSync, } from 'node:fs';
import { readFile, } from 'node:fs/promises';
import { dirname, resolve, } from 'node:path';
import type { Plugin, } from 'rolldown';

import {
  ATTR_QUERY_KEY,
  DYNAMIC_IMPORT_WITH_RE,
  STATIC_IMPORT_WITH_RE,
  extractAttrType,
  stripAttrQuery,
} from './patterns.ts';

export { importAttributesPlugin, };

//region Types

/**
 * Handler that transforms raw file content into a JavaScript module source string.
 *
 * @param content - Raw file content as a string
 *
 * @param id - Resolved file path (without query parameters)
 *
 * @returns JavaScript module source code
 */
type AttributeTypeHandler = (content: string, id: string) => string;

//endregion Types

//region Built-in handlers

/**
 * Built-in handler for `type: 'text'` attributes.
 * Exports the raw file content as a default string export.
 *
 * @param content - Raw file content
 *
 * @returns JavaScript module that default-exports the content string
 */
function textHandler(content: string): string {
  return `export default ${JSON.stringify(content)};`;
}

/**
 * Map of supported attribute type names to their handlers.
 * To add a new type, add a handler function and register it here.
 */
const HANDLERS: Record<string, AttributeTypeHandler> = {
  text: textHandler,
};

//endregion Built-in handlers

//region Importer scanning

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
function scanImporterForAttribute(
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

//endregion Importer scanning

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
     * Rewrites import/export statements that use `with { type: '...' }` attributes.
     * Strips the `with` clause and appends `?__importattr=<type>` to the specifier
     * so that `resolveId` and `load` can intercept it.
     *
     * This handles static imports reliably because rolldown scans the
     * transformed code for static dependencies.
     * Dynamic imports are handled by the `resolveId` hook instead,
     * because rolldown's Rust scanner discovers them from the original AST.
     */
    transform(code) {
      if (!code.includes(' with ') && !code.includes(' with{')) {
        return null;
      }

      let transformed = code;
      let didTransform = false;

      //region Static imports/exports
      transformed = transformed.replace(
        STATIC_IMPORT_WITH_RE,
        function staticReplacer(_match: string, prefix: string, quote: string, specifier: string, _withClause: string, attrType: string) {
          if (HANDLERS[attrType] === undefined) {
            return _match;
          }
          didTransform = true;
          return `${prefix}${quote}${specifier}?${ATTR_QUERY_KEY}=${attrType}${quote}`;
        },
      );
      //endregion Static imports/exports

      //region Dynamic imports
      transformed = transformed.replace(
        DYNAMIC_IMPORT_WITH_RE,
        function dynamicReplacer(_match: string, prefix: string, quote: string, specifier: string, _withClause: string, attrType: string) {
          if (HANDLERS[attrType] === undefined) {
            return _match;
          }
          didTransform = true;
          return `${prefix}${quote}${specifier}?${ATTR_QUERY_KEY}=${attrType}${quote}`;
        },
      );
      //endregion Dynamic imports

      // oxlint-disable-next-line typescript/no-unnecessary-condition -- didTransform is mutated inside replace callbacks; linter cannot follow callback side effects
      if (!didTransform) {
        return null;
      }
      return { code: transformed, };
    },

    /**
     * Resolves specifiers tagged with `?__importattr=<type>` (from transform rewriting)
     * or specifiers discovered by rolldown's scanner before transform ran
     * (for dynamic imports where the scanner processes the original AST).
     *
     * For untagged specifiers, scans the importer's source to check whether
     * the import had a `with { type: '...' }` clause.
     */
    async resolveId(source, importer, options) {
      /** Check for query-param-tagged specifiers (from static imports after transform). */
      const queryAttrType = extractAttrType(source);
      if (queryAttrType !== undefined) {
        const cleanSource = stripAttrQuery(source);

        const resolved = await this.resolve(cleanSource, importer, {
          ...options,
          skipSelf: true,
        });

        if (resolved !== null) {
          return {
            id: `${resolved.id}?${ATTR_QUERY_KEY}=${queryAttrType}`,
            external: false,
          };
        }

        if (importer !== undefined && cleanSource.startsWith('.')) {
          const importerDir = dirname(importer.split('?')[0] ?? importer);
          const absolutePath = resolve(importerDir, cleanSource);
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
        const cleanImporter = importer.split('?')[0] ?? importer;
        const attrType = scanImporterForAttribute(
          source,
          cleanImporter,
          importerSourceCache,
        );

        if (attrType !== undefined) {
          const resolved = await this.resolve(source, importer, {
            ...options,
            skipSelf: true,
          });

          if (resolved !== null) {
            return {
              id: `${resolved.id}?${ATTR_QUERY_KEY}=${attrType}`,
              external: false,
            };
          }

          if (source.startsWith('.')) {
            const importerDir = dirname(cleanImporter);
            const absolutePath = resolve(importerDir, source);
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
    async load(id) {
      const attrType = extractAttrType(id);
      if (attrType === undefined) {
        return null;
      }

      const handler = HANDLERS[attrType];
      if (handler === undefined) {
        return null;
      }

      const filePath = stripAttrQuery(id);
      const content = await readFile(filePath, 'utf8');
      const moduleCode = handler(content, filePath);

      return { code: moduleCode, };
    },
  };
}

//endregion Plugin factory
