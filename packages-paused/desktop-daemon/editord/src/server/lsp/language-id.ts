/**
 * Maps file extensions to LSP language identifiers.
 *
 * Used when sending `textDocument/didOpen` to LSP servers,
 * which require a `languageId` string for each document.
 */

import { extname, } from 'node:path';

/**
 * Extension-to-language-ID mapping for supported file types.
 */
const EXTENSION_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescriptreact',
  '.js': 'javascript',
  '.jsx': 'javascriptreact',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.json': 'json',
  '.jsonc': 'jsonc',
  '.css': 'css',
  '.html': 'html',
  '.md': 'markdown',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',
  '.svg': 'xml',
  '.rs': 'rust',
};

/**
 * Returns the LSP language identifier for a file path.
 *
 * @param path - absolute or relative file path
 *
 * @returns language ID string, or "plaintext" for unrecognized extensions
 *
 * @example
 * ```ts
 * const result = getLanguageId({ path: '/home/user/project/src/main.ts', });
 * ```
 */
export function getLanguageId({ path, }: { readonly path: string; },): string {
  /**
   * Lowercase extension (including the leading dot) used to look up the LSP language id.
   */
  const ext = extname(path,)
    .toLowerCase();
  return EXTENSION_MAP[ext]
    ?? 'plaintext';
}

/**
 * Language IDs that oxlint and tsc handle (JavaScript/TypeScript family).
 */
export const JS_TS_LANGUAGE_IDS: ReadonlySet<string> = new Set([
  'javascript',
  'javascriptreact',
  'typescript',
  'typescriptreact',
],);
