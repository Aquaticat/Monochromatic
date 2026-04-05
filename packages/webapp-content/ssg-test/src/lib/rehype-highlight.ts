/**
 * Rehype plugin that pre-computes Lezer syntax highlight ranges at build time.
 *
 * Visits `<pre><code class="language-*">` hast nodes, parses their text content
 * with the matching Lezer parser, and embeds highlight offset ranges as
 * `data-hl-<group>` attributes. The client reads these attributes to create
 * DOM Range objects for the CSS Custom Highlight API without shipping any
 * Lezer code to the browser.
 *
 * Each highlight group gets its own attribute (e.g. `data-hl-keyword="0-5;15-21"`)
 * with semicolon-separated `from-to` offset pairs. Groups with no tokens
 * are omitted entirely.
 *
 * @example
 * ```ts
 * import rehypeHighlight from './rehype-highlight.ts';
 * unified()
 *   .use(remarkParse)
 *   .use(remarkRehype)
 *   .use(rehypeHighlight)
 *   .use(rehypeStringify);
 * ```
 */

import type { Parser, } from '@lezer/common';
import { parser as cssParser, } from '@lezer/css';
import { highlightTree, } from '@lezer/highlight';
import { parser as htmlParser, } from '@lezer/html';
import { parser as jsParser, } from '@lezer/javascript';
import { parser as markdownParser, } from '@lezer/markdown';
import { parser as rustParser, } from '@lezer/rust';
import { parser as xmlParser, } from '@lezer/xml';
import { parser as yamlParser, } from '@lezer/yaml';

import type {
  Element,
  ElementContent,
  Root,
} from 'hast';

import {
  HIGHLIGHT_GROUPS,
  ssgHighlighter,
} from '../client/tags.ts';

//region Parser configuration

/** TypeScript parser (JavaScript parser with TS dialect). */
const tsParser = jsParser.configure({ dialect: 'ts', },);

/** JSX parser (JavaScript parser with JSX dialect). */
const jsxParser = jsParser.configure({ dialect: 'jsx', },);

/** TSX parser (JavaScript parser with TS + JSX dialects). */
const tsxParser = jsParser.configure({ dialect: 'ts jsx', },);

/**
 * Language name to Lezer parser mapping.
 *
 * Covers the same language aliases as the former client-side `PARSER_LOADERS`.
 */
const PARSERS: Readonly<Record<string, Parser>> = {
  js: jsParser,
  javascript: jsParser,
  ts: tsParser,
  typescript: tsParser,
  jsx: jsxParser,
  tsx: tsxParser,
  html: htmlParser,
  css: cssParser,
  md: markdownParser,
  markdown: markdownParser,
  mdx: markdownParser,
  xml: xmlParser,
  svg: xmlParser,
  yaml: yamlParser,
  yml: yamlParser,
  json: jsParser,
  rust: rustParser,
  rs: rustParser,
};

/** Prefix on code element class names identifying the language. */
const LANGUAGE_PREFIX = 'language-';

//endregion Parser configuration

//region Hast utilities

/**
 * Recursively extracts text content from a hast node tree.
 *
 * @param node - hast content node to extract text from
 *
 * @returns concatenated text of all descendant text nodes
 */
function extractText(node: ElementContent,): string {
  if (node.type === 'text') {
    return node.value;
  }
  if ('children' in node) {
    return node.children.map(extractText,).join('',);
  }
  return '';
}

/**
 * Extracts the language name from a code element's class list.
 *
 * @param codeElement - hast `<code>` element node
 *
 * @returns language name, or `undefined` when no `language-*` class is found
 */
function getLanguage(codeElement: Element,): string | undefined {
  const { className, } = codeElement.properties;
  if (!Array.isArray(className,)) {
    return undefined;
  }
  for (const cls of className) {
    const name = String(cls,);
    if (name.startsWith(LANGUAGE_PREFIX,)) {
      return name.slice(LANGUAGE_PREFIX.length,);
    }
  }
  return undefined;
}

//endregion Hast utilities

//region Highlight computation

/**
 * Computes highlight offset pairs for a code block and sets
 * `data-hl-<group>` attributes on the code element.
 *
 * @param codeElement - hast `<code>` element to annotate
 *
 * @param parser - Lezer parser for the code block's language
 *
 * @param text - plain text content of the code block
 */
function annotateCodeBlock({
  codeElement,
  parser,
  text,
}: {
  codeElement: Element;
  parser: Parser;
  text: string;
},): void {
  const tree = parser.parse(text,);

  /** Accumulated `from-to` pairs per highlight group. */
  const pairsByGroup = new Map<string, string[]>();

  highlightTree(
    tree,
    ssgHighlighter,
    function collectPair(
      from: number,
      to: number,
      classes: string,
    ) {
      let pairs = pairsByGroup.get(classes,);
      if (pairs === undefined) {
        pairs = [];
        pairsByGroup.set(
          classes,
          pairs,
        );
      }
      pairs.push(`${from}-${to}`,);
    },
  );

  for (const group of HIGHLIGHT_GROUPS) {
    const pairs = pairsByGroup.get(group,);
    if (pairs !== undefined && pairs.length > 0) {
      codeElement.properties[`data-hl-${group}`] = pairs.join(';',);
    }
  }
}

/**
 * Recursively visits hast element nodes, processing `<pre><code>` blocks.
 *
 * @param node - hast node to visit
 */
function visitNode(node: Root | Element,): void {
  for (const child of node.children) {
    if (child.type !== 'element') {
      continue;
    }

    if (child.tagName === 'pre') {
      const [firstChild,] = child.children;
      if (
        firstChild !== undefined
        && firstChild.type === 'element'
        && firstChild.tagName === 'code'
      ) {
        const lang = getLanguage(firstChild,);
        if (lang !== undefined) {
          const parser = PARSERS[lang];
          if (parser !== undefined) {
            const text = firstChild.children.map(extractText,).join('',);
            if (text.length > 0) {
              annotateCodeBlock({
                codeElement: firstChild,
                parser,
                text,
              },);
            }
          }
        }
      }
    }

    visitNode(child,);
  }
}

//endregion Highlight computation

/**
 * Rehype plugin that pre-computes Lezer syntax highlight ranges.
 *
 * Adds `data-hl-<group>` attributes to `<code>` elements inside `<pre>` blocks,
 * encoding token offset ranges as semicolon-separated `from-to` pairs.
 *
 * @returns hast tree transformer
 *
 * @example
 * ```ts
 * import rehypeHighlight from './rehype-highlight.ts';
 * unified()
 *   .use(remarkParse)
 *   .use(remarkRehype)
 *   .use(rehypeHighlight)
 *   .use(rehypeStringify);
 * ```
 */
export default function rehypeHighlight(): (tree: Root,) => void {
  return function transform(tree: Root,): void {
    visitNode(tree,);
  };
}
