// oxlint-disable max-lines -- parser registry with dialect configuration, JSON5 style tag patching, and extension mapping; splitting fractures the registry

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
import { parser as cssParser, } from '@lezer/css';
import {
  styleTags,
  tags,
} from '@lezer/highlight';
import { parser as htmlParser, } from '@lezer/html';
import { parser as jsParser, } from '@lezer/javascript';
import { parser as markdownParser, } from '@lezer/markdown';
import { parser as rustParser, } from '@lezer/rust';
import { parser as xmlParser, } from '@lezer/xml';
import { parser as yamlParser, } from '@lezer/yaml';
// oxlint-disable-next-line typescript-eslint/no-unsafe-assignment -- community package lacks proper type exports; runtime value is a valid LRParser
import { parser as json5BaseParser, } from 'lezer-json5';
// oxlint-disable-next-line typescript-eslint/no-unsafe-assignment -- community package lacks proper type exports; runtime value is a valid LRParser
import { parser as tomlParser, } from 'lezer-toml';

//region JavaScript and TypeScript dialect configuration

/** TypeScript parser (JavaScript parser configured with TypeScript dialect). */
const tsParser = jsParser.configure({ dialect: 'ts', },);

/** TypeScript + JSX parser. */
const tsxParser = jsParser.configure({ dialect: 'ts jsx', },);

/** JavaScript + JSX parser. */
const jsxParser = jsParser.configure({ dialect: 'jsx', },);

//endregion JavaScript and TypeScript dialect configuration

//region JSON5 highlight tag patching

/**
 * JSON5 parser configured with highlight tags.
 *
 * The `lezer-json5` community package ships without `styleTags`,
 * so `highlightTree` produces zero ranges by default.
 * This adds tag mappings for the node types defined in its grammar:
 * `LineComment`, `BlockComment`, `Number`, `String`, `PropertyName`,
 * `Null`, `True`, `False`.
 */
// oxlint-disable-next-line typescript-eslint/no-unsafe-member-access, typescript-eslint/no-unsafe-call, typescript-eslint/no-unsafe-assignment -- community package; runtime type is LRParser with a valid configure method
const json5Parser: Parser = json5BaseParser.configure({
  props: [
    styleTags({
      LineComment: tags.lineComment,
      BlockComment: tags.blockComment,
      Number: tags.number,
      String: tags.string,
      PropertyName: tags.propertyName,
      Null: tags.null,
      True: tags.bool,
      False: tags.bool,
    },),
  ],
},);

//endregion JSON5 highlight tag patching

//region Extension-to-parser mapping

/**
 * Extension-to-parser lookup table.
 * Keyed by file extension including the leading dot.
 *
 * JSON files use `lezer-json5` instead of `@lezer/json` because many `.json`
 * files are actually JSONC (JSON with comments, e.g. `.oxlintrc.json`,
 * `tsconfig.json`). The strict JSON parser misparses comments as tokens —
 * `null` inside a comment like "nullable" gets highlighted as a keyword.
 * JSON5 is a superset of JSON, so valid JSON highlights identically.
 */
const PARSERS: Record<string, Parser> = {
  '.js': jsParser,
  '.mjs': jsParser,
  '.cjs': jsParser,
  '.jsx': jsxParser,
  '.ts': tsParser,
  '.mts': tsParser,
  '.cts': tsParser,
  '.tsx': tsxParser,
  '.json': json5Parser,
  '.jsonc': json5Parser,
  '.jsonl': json5Parser,
  '.css': cssParser,
  '.html': htmlParser,
  '.htm': htmlParser,
  '.svg': xmlParser,
  '.xml': xmlParser,
  '.md': markdownParser,
  '.mdx': markdownParser,
  '.markdown': markdownParser,
  '.rs': rustParser,
  // oxlint-disable-next-line typescript-eslint/no-unsafe-assignment -- community package lacks proper type exports; runtime value is a valid LRParser
  '.toml': tomlParser,
  '.yaml': yamlParser,
  '.yml': yamlParser,
};

//endregion Extension-to-parser mapping

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
export function getParserForPath({ path, }: { path: string }): Parser | null {
  const dotIndex = path.lastIndexOf('.',);
  if (dotIndex === -1)
    return null;

  const extension = path.slice(dotIndex,);
  return PARSERS[extension] ?? null;
}
