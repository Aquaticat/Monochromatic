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
 * Flag bare URLs (and bare emails) and attach a fix wrapping them in angle
 * brackets. With GFM autolink literals on, a bare URL parses as a `link` node
 * whose written form is recovered from the source slice, which is how the bare
 * form is told apart from `<url>` and `[text](url)`.
 *
 * @param tree - mdast tree under lint
 *
 * @param source - original source, for the written form and offsets
 *
 * @returns one diagnostic per bare URL
 */
function checkNoBareUrls({
  tree,
  source,
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
      message: 'Bare URL; wrap it in angle brackets.',
      node,
      fix: {
        start,
        end,
        insertText: `<${slice}>`,
      },
    },),);
  }
  return diagnostics;
}

/**
 * MD034 no-bare-urls: a bare URL should be an autolink. Fixable: wraps the URL
 * in angle brackets.
 */
export const noBareUrls: Rule = {
  id: ID,
  fixable: true,
  check: checkNoBareUrls,
};
