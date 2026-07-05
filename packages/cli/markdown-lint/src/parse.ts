import type { Root, } from 'mdast';
import {
  markdownToMdast,
  mdxToMdast,
} from 'satteri';

import {
  correctAstralOffsets,
  hasAstralCodePoints,
} from './correct-astral-offsets.ts';

/**
 * Sätteri feature flags matching the previous parser: GFM (tables for
 * `no-pipe-tables`, autolink literals for MD034) and frontmatter (YAML/TOML)
 * both on. Both default to on; set explicitly so a future default change does
 * not silently alter what the rules see. MDX is selected by the entry point,
 * not a flag.
 */
const FEATURES = {
  gfm: true,
  frontmatter: true,
};

/**
 * Parameters for {@link parse}.
 */
export type ParseParams = {
  /**
   * On-disk Markdown or MDX source, read verbatim (frontmatter included).
   */
  readonly source: string;
  /**
   * Whether to parse as MDX, so `import`, JSX, and `{expr}` parse as
   * first-class MDX nodes instead of being misread as paragraphs or HTML.
   */
  readonly mdx: boolean;
};

/**
 * Parse Markdown or MDX source into an mdast tree, the single representation
 * every rule reads. Sätteri parses in Rust and materializes a standard
 * `mdast.Root`; its node offsets are code points, so they are corrected to
 * UTF-16 code units (what the source-offset fixer and remark expect) whenever
 * the source holds an astral character. GFM and frontmatter are always on; MDX
 * uses the MDX entry point so standard `.md` is not burdened with JSX parsing.
 *
 * @param source - on-disk source, frontmatter included, never pre-stripped
 *
 * @param mdx - whether to parse as MDX
 *
 * @returns mdast root node with UTF-16 offsets
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
   * Materialized tree from Sätteri, with code-point offsets. Typed as the
   * mdast node union until narrowed to the root below.
   */
  const node = mdx
    ? mdxToMdast(
      source,
      { features: FEATURES, },
    )
    : markdownToMdast(
      source,
      { features: FEATURES, },
    );
  if (node.type !== 'root') {
    throw new Error(`Expected a root node from the parser, got "${node.type}".`,);
  }
  return hasAstralCodePoints(source,)
    ? correctAstralOffsets({
      tree: node,
      source,
    },)
    : node;
}
