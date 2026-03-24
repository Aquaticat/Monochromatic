/**
 * Language parser registry for syntax highlighting.
 *
 * Maps file extensions to configured Lezer parser instances.
 * Supports JavaScript, TypeScript, JSON, CSS, HTML, Markdown, YAML, TOML,
 * Rust, XML, and SVG.
 *
 * @example
 * ```ts
 * const parser = getParserForPath({ path: '/src/app.tsx' });
 * // returns TypeScript + JSX parser
 * ```
 */

import type { Parser, } from '@lezer/common';

import { PARSERS, } from './language-parsers.ts';

/**
 * Resolves a Lezer parser for a given file path based on its extension.
 *
 * @param path - absolute or relative file path
 *
 * @returns parser instance, or null when the file type is not supported
 *
 * @example
 * ```ts
 * const parser = getParserForPath({ path: 'app.ts' });
 * // parser !== null — TypeScript is supported
 *
 * const noParser = getParserForPath({ path: 'data.csv' });
 * // noParser === null — CSV is not supported
 * ```
 */
export function getParserForPath({ path, }: { path: string; },): Parser | null {
  const dotIndex = path.lastIndexOf('.',);
  if (dotIndex === -1)
    return null;

  const extension = path.slice(dotIndex,);
  return PARSERS[extension] ?? null;
}
