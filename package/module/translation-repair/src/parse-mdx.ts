import type { Root, } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified, } from 'unified';

import { NAMED_POSITION_UNSTATED, } from './refusal-text.ts';

//region MDX parsing
// Corpus pages compile as MDX upstream (@mdx-js/mdx with a Vue pragma), so this module
// parses with the same grammar family. GFM is enabled here even though upstream omits
// it: footnote reference/definition nodes carry the semantic graph this library
// validates, while emitted repairs preserve the literal textual convention.

/**
 * Signals MDX source that refuses to parse;
 * corpus documents compile upstream, so failure indicates corruption
 * or a construct outside the mirrored grammar.
 *
 * @example
 * ```ts
 * throw new MdxParseError({ cause: error, },);
 * ```
 */
/**
 * Describes where an MDX refusal stopped, quoting nothing it read.
 *
 * MOSTLY SAFE ALREADY, and that is why this is narrow rather than absent. Four
 * of five measured failure shapes report a position and an expectation. The
 * fifth, an unclosed tag, embeds the tag NAME from the source, which is enough
 * to carry a page's own markup into a stored finding.
 *
 * @param cause - caught value, of unknown type by construction
 *
 * @returns Phrase naming position and rule
 *
 * @example
 * ```ts
 * `refused to parse ${mdxRefusalSite({ cause, },)}`;
 * ```
 */
function mdxRefusalSite({ cause, }: { readonly cause: unknown; },): string {
  if (!Error.isError(cause,))
    return `at ${NAMED_POSITION_UNSTATED}`;

  /**
   * Package that raised it, prefixed so two rules sharing a name stay apart.
   */
  const from = (('source' in cause) && ((typeof cause.source) === 'string'))
    ? `${cause.source}/`
    : '';

  /**
   * Rule the grammar names, falling back to the class that raised it.
   */
  const rule = (('ruleId' in cause) && ((typeof cause.ruleId) === 'string'))
    ? `${from}${cause.ruleId}`
    : cause.name;

  // `VFileMessage` sets `name` to "line:column". Any other Error's name is its
  // class, and neither spelling repeats the source.
  return `at ${cause.name} (${rule})`;
}

/**
 * Signals MDX source that refuses to parse.
 *
 * Corpus documents compile upstream, so a refusal indicates corruption or a
 * construct outside the mirrored grammar.
 *
 * @example
 * ```ts
 * throw new MdxParseError({ cause: error, },);
 * ```
 */
export class MdxParseError extends Error {
  /**
   * Declares this message safe to forward: it states where the grammar stopped
   * and which rule it broke, and repeats no document text.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Builds failure stating where the grammar stopped, never what it read.
   *
   * DOES NOT CARRY THE PARSER ERROR AS `cause`, for the reason
   * `FrontMatterParseError` records: a cause chain is rendered by Node's
   * uncaught-exception reporter, and `parse-document.ts` used to stringify this
   * one straight into a stored finding.
   *
   * @param cause - underlying micromark/remark error, read for position and rule
   *
   * @example
   * ```ts
   * new MdxParseError({ cause: error, },);
   * ```
   */
  public constructor({ cause, }: { readonly cause: unknown; },) {
    super(
      `MDX body refused to parse ${mdxRefusalSite({ cause, },)}; corpus documents`
        + ' compile as MDX upstream, so failure signals corruption or an'
        + ' unsupported construct.',
    );
    this.name = 'MdxParseError';
  }
}

/**
 * Parses MDX body text into an mdast tree with positions on every node.
 *
 * @param body - MDX source with front matter already split away
 *
 * @returns mdast root whose node positions are body-relative character offsets
 *
 * @throws {@link MdxParseError} when source refuses to parse as MDX
 *
 * @example
 * ```ts
 * const root = parseMdxBody({ body: '# Title\n\nParagraph with[^1]\n\n[^1]: note\n', },);
 * ```
 */
export function parseMdxBody({ body, }: { readonly body: string; },): Root {
  try {
    return unified()
      .use(remarkParse,)
      .use(remarkMdx,)
      .use(remarkGfm,)
      .parse(body,);
  }
  catch (error) {
    throw new MdxParseError({ cause: error, },);
  }
}

/**
 * Parses body text as plain markdown (GFM, no MDX extensions).
 * Tolerant fallback grammar: markdown parsing is total,
 * so constructs the MDX grammar rejects (raw HTML, brace expressions)
 * survive as literal `html` and text nodes instead of failing the document.
 *
 * @param body - markdown source with front matter already split away
 *
 * @returns mdast root whose node positions are body-relative character offsets
 *
 * @example
 * ```ts
 * const root = parseMarkdownBody({ body: '<!-- note -->\n\nParagraph.\n', },);
 * ```
 */
export function parseMarkdownBody({ body, }: { readonly body: string; },): Root {
  return unified()
    .use(remarkParse,)
    .use(remarkGfm,)
    .parse(body,);
}

//endregion MDX parsing
