import type { Root, } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified, } from 'unified';

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
export class MdxParseError extends Error {
  /**
   * Builds failure carrying original parser error for diagnosis.
   *
   * @param cause - underlying micromark/remark parser error
   *
   * @example
   * ```ts
   * new MdxParseError({ cause: error, },);
   * ```
   */
  public constructor({ cause, }: { readonly cause: unknown; },) {
    super(
      'MDX body refused to parse; corpus documents compile as MDX upstream,'
        + ' so failure signals corruption or an unsupported construct.',
      { cause, },
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
