import {
  buildDocumentNodes,
  type DocumentNode,
  hashContent,
} from './document-node.ts';
import {
  type FrontMatterBlock,
  splitFrontMatter,
} from './front-matter.ts';
import { buildFootnoteGraph, } from './footnote-graph.ts';
import type { FootnoteGraph, } from './footnote-model.ts';
import { parseMdxBody, } from './parse-mdx.ts';

//region Document parsing
// Composition of the deterministic core: front matter split, MDX parse, node
// construction, footnote graph. Pure over its input; every later stage anchors claims
// against the result and its hashes.

/**
 * Immutable parsed form of one corpus document,
 * carrying every anchor later stages validate claims against.
 *
 * @example
 * ```ts
 * const doc = parseDocument({ text: source, },);
 * console.log(doc.nodes.length, doc.footnoteGraph.findings,);
 * ```
 */
export type RepairDocument = {
  /**
   * Full original source, byte-for-byte.
   */
  readonly text: string;

  /**
   * SHA-256 of text; patch operations carry this to reject stale bases.
   */
  readonly documentHash: string;

  /**
   * Verbatim front matter when present; never rewritten by repairs.
   */
  readonly frontMatter?: FrontMatterBlock;

  /**
   * Block-level nodes in source order with absolute offsets and hashes.
   */
  readonly nodes: readonly DocumentNode[];

  /**
   * Reference-to-definition graph across both footnote conventions,
   * with integrity findings for human checkpoints.
   */
  readonly footnoteGraph: FootnoteGraph;
};

/**
 * Parses one corpus document into its immutable anchor-ready form.
 *
 * @param text - full document source, front matter included when present
 *
 * @returns Parsed document with nodes, hashes, and footnote graph
 *
 * @throws {@link import('./front-matter.ts').FrontMatterParseError} when fenced YAML refuses to parse
 *
 * @throws {@link import('./parse-mdx.ts').MdxParseError} when body refuses to parse as MDX
 *
 * @example
 * ```ts
 * const doc = parseDocument({ text: '---\nname: n\n---\n\n## 简介\n\n正文[^1]\n\n[^1]: 注\n', },);
 * ```
 */
export function parseDocument({ text, }: { readonly text: string; },): RepairDocument {
  /**
   * Front matter split with body offset for absolute anchoring.
   */
  const split = splitFrontMatter({ text, },);

  /**
   * mdast tree of body with body-relative positions on every node.
   */
  const root = parseMdxBody({ body: split.body, },);

  return {
    text,
    documentHash: hashContent({ content: text, },),
    // Conditional spread keeps frontMatter absent (not explicitly undefined)
    // under exactOptionalPropertyTypes.
    ...(split.frontMatter === undefined
      ? {}
      : { frontMatter: split.frontMatter, }),
    nodes: buildDocumentNodes({
      children: root.children,
      bodyText: split.body,
      bodyOffset: split.bodyOffset,
    },),
    footnoteGraph: buildFootnoteGraph({
      children: root.children,
      bodyText: split.body,
      bodyOffset: split.bodyOffset,
    },),
  };
}

//endregion Document parsing
