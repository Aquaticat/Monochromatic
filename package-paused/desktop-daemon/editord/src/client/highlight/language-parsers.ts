/**
 * Lezer parser configuration and dialect setup.
 *
 * Imports all supported parsers, configures TypeScript/JSX dialects,
 * and patches `lezer-json5` with highlight style tags.
 */

import type { Parser, } from '@lezer/common';
import { parser as cssParser, } from '@lezer/css';
import { parser as htmlParser, } from '@lezer/html';
import { parser as jsParser, } from '@lezer/javascript';
import { parser as markdownParser, } from '@lezer/markdown';
import { parser as rustParser, } from '@lezer/rust';
import { parser as xmlParser, } from '@lezer/xml';
import { parser as yamlParser, } from '@lezer/yaml';
import { parser as tomlParser, } from 'lezer-toml';

import { json5Parser, } from './json5-parser.ts';

//region JavaScript and TypeScript dialect configuration

/**
 * TypeScript parser (JavaScript parser configured with TypeScript dialect).
 */
const tsParser = jsParser.configure({ dialect: 'ts', },);

/**
 * TypeScript + JSX parser.
 */
const tsxParser = jsParser.configure({ dialect: 'ts jsx', },);

/**
 * JavaScript + JSX parser.
 */
const jsxParser = jsParser.configure({ dialect: 'jsx', },);

//endregion JavaScript and TypeScript dialect configuration

//region Extension-to-parser mapping

/**
 * Extension-to-parser lookup table.
 * Keyed by file extension including the leading dot.
 *
 * JSON files use `lezer-json5` instead of `@lezer/json` because many `.json`
 * files are actually JSONC (JSON with comments). JSON5 is a superset of JSON.
 */
export const PARSERS: Record<string, Parser> = {
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
