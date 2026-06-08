import { fromMarkdown, } from 'mdast-util-from-markdown';
import { frontmatterFromMarkdown, } from 'mdast-util-frontmatter';
import { gfmFromMarkdown, } from 'mdast-util-gfm';
import { mdxFromMarkdown, } from 'mdast-util-mdx';
import { frontmatter, } from 'micromark-extension-frontmatter';
import { gfm, } from 'micromark-extension-gfm';
import { mdxjs, } from 'micromark-extension-mdxjs';
import type { Root, } from 'mdast';

/**
 * Frontmatter kind recognized before any rule runs. Only YAML (`---`) appears
 * in this corpus, configured explicitly so a leading block is skipped rather
 * than misparsed as a thematic break plus paragraph.
 */
const FRONTMATTER_MATTER = 'yaml';

/**
 * Parameters for {@link parse}.
 */
export type ParseParams = {
  /**
   * On-disk Markdown or MDX source, read verbatim (frontmatter included).
   */
  readonly source: string;
  /**
   * Whether to enable the MDX extensions, so `import`, JSX, and `{expr}` parse
   * as first-class MDX nodes instead of being misread as paragraphs or HTML.
   */
  readonly mdx: boolean;
};

/**
 * Parse Markdown or MDX source into an mdast tree, the single representation
 * every rule reads. GFM is always on (tables for `no-pipe-tables`, autolink
 * literals for MD034); frontmatter is always recognized and skipped before
 * rules run; MDX extensions are added only for `.mdx` so standard `.md` is not
 * burdened with JSX parsing.
 *
 * @param source - on-disk source, frontmatter included, never pre-stripped
 *
 * @param mdx - whether to enable the MDX extensions
 *
 * @returns mdast root node
 *
 * @example
 * ```ts
 * parse({ source: '# Title\n', mdx: false }); // { type: 'root', children: [...] }
 * ```
 */
export function parse({
  source,
  mdx,
}: ParseParams,): Root {
  /**
   * micromark (syntax-level) extensions. MDX is appended only when requested.
   */
  const extensions = [
    gfm(),
    frontmatter(FRONTMATTER_MATTER,),
  ];
  /**
   * mdast (tree-construction) extensions, paired one-to-one with `extensions`.
   */
  const mdastExtensions = [
    gfmFromMarkdown(),
    frontmatterFromMarkdown(FRONTMATTER_MATTER,),
  ];
  if (mdx) {
    extensions.push(mdxjs(),);
    mdastExtensions.push(...mdxFromMarkdown(),);
  }
  return fromMarkdown(
    source,
    {
    extensions,
    mdastExtensions,
  },
  );
}
