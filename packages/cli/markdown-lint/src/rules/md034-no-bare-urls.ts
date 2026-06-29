import {
  diagnose,
  offsetsOf,
  sliceOf,
} from '../node-source.ts';
import type {
  Diagnostic,
  Rule,
  RuleContext,
} from '../types.ts';
import { walk, } from '../walk.ts';

/**
 * Rule id.
 */
const ID = 'MD034';

/**
 * URL scheme prefixes whose bare form can be wrapped into a valid `<...>`
 * autolink. A scheme-less `www.` autolink literal is left alone: wrapping it
 * would produce literal angle-bracketed text, not a link.
 */
const WRAPPABLE_SCHEMES: readonly string[] = [
  'http://',
  'https://',
  'ftp://',
  'ftps://',
];

/**
 * Parameters for {@link isWrappableBareUrl}.
 */
type IsWrappableParams = {
  /**
   * Source slice of the link node (its exact written form).
   */
  readonly slice: string;
  /**
   * Resolved URL of the link node.
   */
  readonly url: string;
};

/**
 * Escape literal link text for use inside an inline Markdown link label.
 *
 * @param text - visible link text to escape
 *
 * @returns text safe for `[text](...)`
 */
function escapeLinkText(text: string,): string {
  return text
    .replaceAll(
      '\\',
      String.raw`\\`,
    )
    .replaceAll(
      '[',
      String.raw`\[`,
    )
    .replaceAll(
      ']',
      String.raw`\]`,
    );
}

/**
 * Parameters for {@link fixedBareUrlText}.
 */
type FixedBareUrlTextParams = {
  /**
   * Source slice of the link node (its exact written form).
   */
  readonly slice: string;
  /**
   * Resolved URL of the link node.
   */
  readonly url: string;
  /**
   * Whether the file is parsed as MDX.
   */
  readonly mdx: boolean;
};

/**
 * Replacement text for a bare URL. Plain Markdown can use autolink syntax, but
 * MDX parses `<https://...>` as JSX and throws; MDX therefore needs an explicit
 * inline link with an angle-bracketed destination for URL safety.
 *
 * @param slice - source slice of the link node
 *
 * @param url - resolved URL of the link node
 *
 * @param mdx - whether the file is parsed as MDX
 *
 * @returns replacement text for the bare URL
 */
function fixedBareUrlText({
  slice,
  url,
  mdx,
}: FixedBareUrlTextParams,): string {
  return mdx
    ? `[${escapeLinkText(slice,)}](<${url}>)`
    : `<${slice}>`;
}

/**
 * Whether a `link` node was written as a bare URL that can be wrapped into a
 * valid autolink. A slice opening with `<` is already an autolink and one
 * opening with `[` is an inline or reference link; otherwise the slice is bare,
 * and it is wrappable when it carries a known scheme or is an email autolink.
 *
 * @param slice - source slice of the link node
 *
 * @param url - resolved URL of the link node
 *
 * @returns whether the node is a wrappable bare URL
 */
function isWrappableBareUrl({
  slice,
  url,
}: IsWrappableParams,): boolean {
  if (slice.startsWith('<',) || slice.startsWith('[',)) {
    return false;
  }
  if (url.startsWith('mailto:',)) {
    return true;
  }
  return WRAPPABLE_SCHEMES.some(function hasScheme(scheme: string,): boolean {
    return slice.startsWith(scheme,);
  },);
}

/**
 * Flag bare URLs (and bare emails) and attach a fix. Markdown files receive
 * angle-bracket autolinks; MDX files receive inline links because MDX reserves
 * angle brackets for JSX.
 *
 * @param tree - mdast tree under lint
 *
 * @param source - original source, for the written form and offsets
 *
 * @param mdx - whether the file is parsed as MDX
 *
 * @returns one diagnostic per bare URL
 */
function checkNoBareUrls({
  tree,
  source,
  mdx,
}: RuleContext,): readonly Diagnostic[] {
  /**
   * Diagnostics collected across the walk.
   */
  const diagnostics: Diagnostic[] = [];
  for (const { node, } of walk(tree,)) {
    if (node.type !== 'link') {
      continue;
    }
    /**
     * Exact written form of the link.
     */
    const slice = sliceOf({
      node,
      source,
    },);
    if (!isWrappableBareUrl({
      slice,
      url: node.url,
    },)) {
      continue;
    }
    /**
     * Link node's source offsets.
     */
    const {
      start,
      end,
    } = offsetsOf(node,);
    diagnostics.push(diagnose({
      ruleId: ID,
      message: mdx
        ? 'Bare URL; use an inline link.'
        : 'Bare URL; wrap it in angle brackets.',
      node,
      fix: {
        start,
        end,
        insertText: fixedBareUrlText({
          slice,
          url: node.url,
          mdx,
        },),
      },
    },),);
  }
  return diagnostics;
}

/**
 * MD034 no-bare-urls: a bare URL should use explicit link syntax. Fixable:
 * wraps the URL in angle brackets for Markdown, or uses an inline link for MDX.
 */
export const noBareUrls: Rule = {
  id: ID,
  fixable: true,
  check: checkNoBareUrls,
};
