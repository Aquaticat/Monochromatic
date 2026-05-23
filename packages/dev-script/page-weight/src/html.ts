/**
 * HTML asset reference extraction.
 *
 * Parses an HTML document with rehype-parse and walks the resulting hast tree
 * to collect every local asset URL the page would cause a browser to fetch.
 */
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw';

import type {
  Element,
  Node,
  Parent,
  Root,
  Text,
} from 'hast';
import rehypeParse from 'rehype-parse';
import { unified, } from 'unified';
import { startsWithUriScheme, } from './url-detect.ts';

/** Reusable unified parser configured for full HTML documents. */
const parser = unified().use(rehypeParse,);

/**
 * Parses an HTML source string into a hast root node.
 *
 * @param source - raw HTML text
 *
 * @returns hast root node
 */
function parseHtml(source: string,): Root {
  return parser.parse(source,) as Root;
}

/**
 * Type-guards a generic hast node as an `Element` (has `tagName` and children).
 *
 * @param node - hast node to test
 *
 * @returns whether the node is an element
 */
function isElement(node: Node,): node is Element {
  return node.type === 'element';
}

/**
 * Type-guards a generic hast node as a `Text` node.
 *
 * @param node - hast node to test
 *
 * @returns whether the node is a text node
 */
function isText(node: Node,): node is Text {
  return node.type === 'text';
}

/**
 * Reads a string attribute from a hast element.
 *
 * Returns `null` for missing attributes, non-string values, or the empty string,
 * simplifying caller logic that would otherwise have to narrow the return type
 * and separately reject empty strings.
 *
 * @param element - source element
 *
 * @param name - attribute name
 *
 * @returns trimmed string value, or `null`
 */
function attr(
  {
    element,
    name,
  }: {
    element: Element;
    name: string;
  },
): string | null {
  /** Attribute value as hast stores it; may be missing or non-string. */
  const raw = element.properties[name];
  if ((typeof raw) !== 'string')
    return null;
  /** Whitespace-stripped value so empty-after-trim attributes report as `null`. */
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Returns the first candidate URL from a `srcset` attribute value.
 *
 * Browsers evaluate the full candidate set before picking one, but the
 * exact pick depends on viewport and DPR; the first candidate is a
 * reasonable proxy for the "canonical" reference.
 *
 * @param srcset - raw srcset value, e.g. `"a.jpg 1x, b.jpg 2x"`
 *
 * @returns first URL, or `null` if the value is empty
 */
function firstSrcsetUrl(srcset: string,): string | null {
  /** First candidate descriptor in the srcset list; used as the canonical pick. */
  const first = srcset.split(',',)[0]?.trim();
  if ((first === undefined) || (first === ''))
    return null;
  /** Leading URL token from the candidate; descriptor like `2x` is dropped. */
  const url = firstNonWhitespaceToken(first,);
  return nonNullishOrThrow(url === '' ? undefined : url,);
}

/**
 * Whether `c` is one of the ASCII whitespace characters that bound a token:
 * space, tab, newline, carriage return, form feed, vertical tab. Matches the
 * exact set the prior recursive walkers tested (ASCII subset of regex `\s`),
 * so a non-breaking space and other Unicode spaces are deliberately not
 * treated as boundaries.
 *
 * @param c - single character under inspection
 *
 * @returns whether `c` is ASCII whitespace
 */
function isWhitespace(c: string,): boolean {
  return (c === ' ')
    || (c === '\t')
    || (c === '\n')
    || (c === '\r')
    || (c === '\f')
    || (c === '\v');
}

/**
 * Returns the leading non-whitespace token of `line`. Single linear pass:
 * skips leading whitespace, then runs to the next whitespace. Empty input or a
 * whitespace-only line returns an empty token. Exported so its edge-case
 * behavior can be covered by unit tests directly.
 *
 * @param line - input line
 *
 * @returns first non-whitespace token (possibly empty)
 *
 * @example
 * ```ts
 * firstNonWhitespaceToken('  a.jpg 2x'); // 'a.jpg'
 * firstNonWhitespaceToken('   ');        // ''
 * ```
 */
export function firstNonWhitespaceToken(line: string,): string {
  // Single linear pass over `line`: skip the leading-whitespace run, then
  // collect characters until the next whitespace. Each character is visited at
  // most once (O(n) time, O(1) stack, no recursion). Fragments are pushed and
  // joined once, mirroring the codebase's other linear string scanners.
  return (function scan(): string {
    /** Token characters collected after the leading-whitespace run ends; joined once at the end. */
    const chars: string[] = [];
    /** Whether the leading-whitespace run has ended and token capture has begun. */
    let started = false;
    for (const c of line) {
      if (isWhitespace(c,)) {
        if (started)
          break;
        continue;
      }
      started = true;
      chars.push(c,);
    }
    return chars.join('',);
  })();
}

/**
 * Adds a URL to the collected set if it is local (not external, not data:, not fragment-only).
 *
 * @param target - set receiving accepted references
 *
 * @param raw - candidate URL
 */
function addIfLocal(
  {
    target,
    raw,
  }: {
    target: Set<string>;
    raw: string | null;
  },
): void {
  if (raw === null)
    return;
  /** Whitespace-stripped form so empty and fragment-only references are filtered out. */
  const trimmed = raw.trim();
  if ((trimmed === '') || trimmed.startsWith('#',))
    return;
  if (trimmed.startsWith('//',) || startsWithUriScheme(trimmed,))
    return;
  target.add(trimmed,);
}

/**
 * Tag names whose child `<source>` / `<img>` elements are picked by the browser
 * rather than all loaded. Handled specially to avoid over-counting.
 */
const MEDIA_PARENTS = new Set([
  'picture',
  'video',
  'audio',
],);

/**
 * Appends an inline `<style>` element's text content to the accumulator.
 *
 * @param element - `<style>` element
 *
 * @param out - accumulator receiving inline stylesheet text
 */
function collectInlineStyle(
  {
    element,
    out,
  }: {
    element: Element;
    out: string[];
  },
): void {
  /** Text-node fragments collected from the `<style>` children. */
  const parts: string[] = [];
  for (const child of element.children) {
    if (isText(child,))
      parts.push(child.value,);
  }
  /** Concatenated `<style>` content; only emitted when non-blank so the accumulator stays clean. */
  const text = parts.join('',);
  if (text.trim() !== '')
    out.push(text,);
}

/**
 * Collects the URL a media-parent element (`<picture>`, `<video>`, `<audio>`)
 * would cause a browser to fetch.
 *
 * Heuristic: the first `<source>` child with a `src` or `srcset` is treated as
 * the canonical pick (browsers evaluate sources in source order and stop at
 * the first match). When no `<source>` is present, the fallback `<img>` `src`
 * is used for `<picture>`.
 *
 * @param element - the `<picture>` / `<video>` / `<audio>` element
 *
 * @param inlineCss - accumulator receiving `<style>` contents from children
 *
 * @returns single URL the media element most likely fetches, or `null`
 */
function collectMediaUrl(
  {
    element,
    inlineCss,
  }: {
    element: Element;
    inlineCss: string[];
  },
): string | null {
  for (const child of element.children) {
    if (!isElement(child,))
      continue;
    if (child.tagName === 'source') {
      /** `srcset` on the current `<source>` child, if any; preferred over `src`. */
      const srcset = attr({
        element: child,
        name: 'srcset',
      },);
      if (srcset !== null)
        return firstSrcsetUrl(srcset,);
      /** Plain `src` fallback for the current `<source>` child when no `srcset` is set. */
      const src = attr({
        element: child,
        name: 'src',
      },);
      if (src !== null)
        return src;
    }
    if (child.tagName === 'style') {
      collectInlineStyle({
        element: child,
        out: inlineCss,
      },);
    }
  }
  if (element.tagName === 'picture') {
    for (const child of element.children) {
      if (isElement(child,) && (child.tagName === 'img')) {
        /** Fallback `<img>` `src` used when no `<source>` child matched. */
        const src = attr({
          element: child,
          name: 'src',
        },);
        if (src !== null)
          return src;
      }
    }
  }
  return null;
}

/**
 * Collects a single element's own asset URL (not recursing into children).
 *
 * Returned URL maps directly to a browser fetch. Children are walked
 * separately by the main walker, except for media parents where a single
 * pick is applied instead.
 *
 * @param element - element to inspect
 *
 * @returns URL to fetch, or `null` when the element has no own asset
 */
function ownAssetUrl(element: Element,): string | null {
  if (element.tagName === 'link') {
    return attr({
      element,
      name: 'href',
    },);
  }
  if (
    (element.tagName === 'script')
    || (element.tagName === 'iframe')
    || (element.tagName === 'embed')
    || (element.tagName === 'audio')
    || (element.tagName === 'video')
  ) {
    return attr({
      element,
      name: 'src',
    },);
  }
  if (element.tagName === 'object') {
    return attr({
      element,
      name: 'data',
    },);
  }
  if (element.tagName === 'img') {
    /** `<img>` `srcset`, preferred over `src` when set. */
    const srcset = attr({
      element,
      name: 'srcset',
    },);
    if (srcset !== null)
      return firstSrcsetUrl(srcset,);
    return attr({
      element,
      name: 'src',
    },);
  }
  if (element.tagName === 'use') {
    /** `<use>` `href`, preferred over the legacy `xlink:href`. */
    const href = attr({
      element,
      name: 'href',
    },);
    if (href !== null)
      return href;
    return attr({
      element,
      name: 'xlink:href',
    },);
  }
  return null;
}

/**
 * Walk result: the local asset URLs referenced by a single HTML document
 * plus inline stylesheet text blocks (which need their own `url()` scan).
 */
export type HtmlReferences = {
  /** Relative/absolute asset URLs as written in the source HTML. */
  urls: string[];
  /** Raw CSS text from `<style>` blocks, pending `url()` extraction. */
  inlineStyles: string[];
};

/**
 * Recursively walks a hast subtree, collecting asset URLs and inline styles.
 *
 * Media-parent elements short-circuit child recursion to avoid over-counting
 * `<source>` / fallback `<img>` combinations that a browser would pick exactly
 * one of.
 *
 * @param node - current hast node
 *
 * @param urls - accumulator receiving asset URLs
 *
 * @param inlineStyles - accumulator receiving `<style>` text blocks
 */
function walk(
  {
    node,
    urls,
    inlineStyles,
  }: {
    node: Node;
    urls: Set<string>;
    inlineStyles: string[];
  },
): void {
  if (isElement(node,)) {
    if (node.tagName === 'style') {
      collectInlineStyle({
        element: node,
        out: inlineStyles,
      },);
      return;
    }
    if (MEDIA_PARENTS.has(node.tagName,)) {
      addIfLocal({
        target: urls,
        raw: collectMediaUrl({
          element: node,
          inlineCss: inlineStyles,
        },),
      },);
      return;
    }
    addIfLocal({
      target: urls,
      raw: ownAssetUrl(node,),
    },);
  }
  /** Structural view of the node so children can be visited when the node carries them. */
  const parent = node as Partial<Parent>;
  if (parent.children !== undefined) {
    for (const child of parent.children) {
      walk({
        node: child,
        urls,
        inlineStyles,
      },);
    }
  }
}

/**
 * Extracts every local asset reference from an HTML document.
 *
 * @param source - raw HTML text
 *
 * @returns asset URLs + inline stylesheet text for further scanning
 *
 * @example
 * ```ts
 * const { urls, inlineStyles } = extractHtmlRefs(html);
 * ```
 */
export function extractHtmlRefs(source: string,): HtmlReferences {
  /** Parsed hast tree the walker descends. */
  const tree = parseHtml(source,);
  /** Dedup set built up during the walk; converted to an array on return. */
  const urls = new Set<string>();
  /** `<style>` bodies pulled out for a separate `url()` scan by the caller. */
  const inlineStyles: string[] = [];

  walk({
    node: tree,
    urls,
    inlineStyles,
  },);

  return {
    urls: [...urls,],
    inlineStyles,
  };
}
