/**
 * Client-side entry point for the SSG.
 *
 * Currently handles syntax highlighting via the CSS Custom Highlight API.
 * Finds all `<pre><code class="language-xxx">` blocks on the page,
 * parses their text with the appropriate Lezer parser, and registers
 * highlight ranges via `CSS.highlights` for styling with `::highlight()`
 * pseudo-elements.
 *
 * Degrades gracefully: if the CSS Custom Highlight API is unavailable
 * or a language has no parser, code blocks remain unstyled plain text.
 *
 * @example
 * ```html
 * <script type="module" src="/client/index.js"></script>
 * ```
 */

import type { Parser, } from '@lezer/common';
import { highlightTree, } from '@lezer/highlight';

import {
  HIGHLIGHT_GROUPS,
  ssgHighlighter,
} from './tags.ts';

//region Language-to-parser mapping

/** Language name prefix used in `class="language-xxx"` attributes. */
const LANGUAGE_PREFIX = 'language-';

/**
 * Lazily imported Lezer parsers keyed by language name.
 *
 * Dynamic imports keep the initial bundle small -- parsers are only
 * loaded for languages actually present on the page.
 */
const PARSER_LOADERS: Record<string, () => Promise<Parser>> = {
  js: async function loadJs() {
    const { parser, } = await import('@lezer/javascript');
    return parser;
  },
  javascript: async function loadJavascript() {
    const { parser, } = await import('@lezer/javascript');
    return parser;
  },
  ts: async function loadTs() {
    const { parser, } = await import('@lezer/javascript');
    return parser.configure({ dialect: 'ts', },);
  },
  typescript: async function loadTypescript() {
    const { parser, } = await import('@lezer/javascript');
    return parser.configure({ dialect: 'ts', },);
  },
  jsx: async function loadJsx() {
    const { parser, } = await import('@lezer/javascript');
    return parser.configure({ dialect: 'jsx', },);
  },
  tsx: async function loadTsx() {
    const { parser, } = await import('@lezer/javascript');
    return parser.configure({ dialect: 'ts jsx', },);
  },
  html: async function loadHtml() {
    const { parser, } = await import('@lezer/html');
    return parser;
  },
  css: async function loadCss() {
    const { parser, } = await import('@lezer/css');
    return parser;
  },
  md: async function loadMd() {
    const { parser, } = await import('@lezer/markdown');
    return parser;
  },
  markdown: async function loadMarkdown() {
    const { parser, } = await import('@lezer/markdown');
    return parser;
  },
  mdx: async function loadMdx() {
    const { parser, } = await import('@lezer/markdown');
    return parser;
  },
  xml: async function loadXml() {
    const { parser, } = await import('@lezer/xml');
    return parser;
  },
  svg: async function loadSvg() {
    const { parser, } = await import('@lezer/xml');
    return parser;
  },
  yaml: async function loadYaml() {
    const { parser, } = await import('@lezer/yaml');
    return parser;
  },
  yml: async function loadYml() {
    const { parser, } = await import('@lezer/yaml');
    return parser;
  },
  json: async function loadJson() {
    const { parser, } = await import('@lezer/javascript');
    return parser;
  },
  rust: async function loadRust() {
    const { parser, } = await import('@lezer/rust');
    return parser;
  },
  rs: async function loadRs() {
    const { parser, } = await import('@lezer/rust');
    return parser;
  },
};

/** Resolved parser cache to avoid re-importing. */
const parserCache = new Map<string, Parser>();

/**
 * Resolves a Lezer parser for a language name.
 *
 * @param lang - language identifier from the code block's class attribute
 *
 * @returns parser instance, or null when the language is unsupported
 */
async function getParser(lang: string,): Promise<Parser | null> {
  const cached = parserCache.get(lang,);
  if (cached !== undefined) {
    return cached;
  }

  const loader = PARSER_LOADERS[lang];
  if (loader === undefined) {
    return null;
  }

  const parser = await loader();
  parserCache.set(
    lang,
    parser,
  );
  return parser;
}

//endregion Language-to-parser mapping

//region Highlight application

/**
 * Extracts the language name from a `<code>` element's class list.
 *
 * @param codeElement - the `<code>` element inside a `<pre>` block
 *
 * @returns language name, or null when no `language-*` class is present
 */
function getLanguage(codeElement: HTMLElement,): string | null {
  for (const cls of codeElement.classList) {
    if (cls.startsWith(LANGUAGE_PREFIX,)) {
      return cls.slice(LANGUAGE_PREFIX.length,);
    }
  }
  return null;
}

/**
 * Collects DOM Range objects from a Lezer parse tree, grouped by highlight category.
 *
 * Walks the code element's text nodes and maps token offsets from
 * `highlightTree` to Range objects inside those nodes.
 *
 * @param tree - Lezer parse tree of the code text
 *
 * @param codeElement - the `<code>` element containing the text
 *
 * @param text - the full text content of the code element
 *
 * @returns map from highlight group name to DOM Range array
 */
function collectRanges(
  tree: import('@lezer/common').Tree,
  codeElement: HTMLElement,
  text: string,
): Map<string, Range[]> {
  /** Flattened text nodes with their start offsets within the full text. */
  const textNodes: Array<{ node: Text; start: number }> = [];
  const walker = document.createTreeWalker(
    codeElement,
    NodeFilter.SHOW_TEXT,
  );
  let offset = 0;
  let current = walker.nextNode();
  while (current !== null) {
    const textNode = current as Text;
    textNodes.push({
      node: textNode,
      start: offset,
    },);
    offset += textNode.length;
    current = walker.nextNode();
  }

  const rangesByGroup = new Map<string, Range[]>();

  highlightTree(
    tree,
    ssgHighlighter,
    function collectRange(
      from,
      to,
      group,
    ) {
      /** Create Range objects that may span multiple text nodes. */
      for (const entry of textNodes) {
        const nodeEnd = entry.start + entry.node.length;

        if (entry.start >= to || nodeEnd <= from) {
          continue;
        }

        const rangeStart = Math.max(
          0,
          from - entry.start,
        );
        const rangeEnd = Math.min(
          entry.node.length,
          to - entry.start,
        );

        const range = new Range();
        range.setStart(
          entry.node,
          rangeStart,
        );
        range.setEnd(
          entry.node,
          rangeEnd,
        );

        let groupRanges = rangesByGroup.get(group,);
        if (groupRanges === undefined) {
          groupRanges = [];
          rangesByGroup.set(
            group,
            groupRanges,
          );
        }
        groupRanges.push(range,);
      }
    },
  );

  return rangesByGroup;
}

/**
 * Highlights all code blocks on the page.
 *
 * Finds `<pre><code class="language-*">` elements, parses their content
 * with the matching Lezer parser, and registers highlight ranges via
 * the CSS Custom Highlight API.
 *
 * Ranges from all code blocks are merged into shared per-group highlights
 * so a single `::highlight(hl-keyword)` rule styles all keywords site-wide.
 */
async function highlightAllCodeBlocks(): Promise<void> {
  if (typeof CSS === 'undefined' || !('highlights' in CSS)) {
    return;
  }

  const codeBlocks = document.querySelectorAll('pre > code[class*="language-"]',);

  /** Accumulated ranges across all code blocks, keyed by highlight group. */
  const allRanges = new Map<string, Range[]>();

  await Promise.all(
    [...codeBlocks,].map(async function processBlock(codeElement,) {
      const lang = getLanguage(codeElement as HTMLElement,);
      if (lang === null) {
        return;
      }

      const parser = await getParser(lang,);
      if (parser === null) {
        return;
      }

      const text = codeElement.textContent ?? '';
      if (text.length === 0) {
        return;
      }

      const tree = parser.parse(text,);
      const blockRanges = collectRanges(
        tree,
        codeElement as HTMLElement,
        text,
      );

      for (const [group, ranges,] of blockRanges) {
        let existing = allRanges.get(group,);
        if (existing === undefined) {
          existing = [];
          allRanges.set(
            group,
            existing,
          );
        }
        existing.push(...ranges,);
      }
    },),
  );

  for (const group of HIGHLIGHT_GROUPS) {
    const name = `hl-${group}`;
    const ranges = allRanges.get(group,);
    if (ranges !== undefined && ranges.length > 0) {
      CSS.highlights.set(
        name,
        new Highlight(...ranges,),
      );
    }
  }
}

//endregion Highlight application

highlightAllCodeBlocks();
