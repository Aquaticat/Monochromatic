import type { Root, } from 'mdast';

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
import { maskHtmlComments, } from './mask-html-comments.ts';
import { maskInvisibleLines, } from './mask-invisible-lines.ts';
import {
  MdxParseError,
  parseMarkdownBody,
  parseMdxBody,
} from './parse-mdx.ts';
import { flattenContainers, } from './unwrap-container.ts';

//region Document parsing
// Composition of the deterministic core: front matter split, tolerant parse
// (invisible-line masking, comment masking, then strict MDX, then plain-markdown
// fallback), node construction, footnote graph. Pure over its input; every later
// stage anchors claims against the result and its hashes. Tolerance is never
// silent: every blanked line, every skipped comment and every grammar downgrade
// surfaces as a parse finding.

/**
 * One tolerance event from parsing:
 * a blanked invisible-only line, a masked HTML comment, or a whole-document
 * grammar downgrade.
 * Findings are the trigger surface for any later repair-the-input stage
 * (deterministic or model-driven).
 *
 * @example
 * ```ts
 * const finding: ParseFinding = {
 *   kind: 'html-comment-skipped',
 *   startOffset: 42,
 *   endOffset: 60,
 *   detail: 'terminated HTML comment masked before parsing',
 * };
 * ```
 */
export type ParseFinding = {
  /**
   * Tolerance class:
   * masked comment, comment that never closed, blanked invisible-only line, or
   * MDX-to-markdown downgrade.
   */
  readonly kind:
    | 'html-comment-skipped'
    | 'unterminated-html-comment'
    | 'invisible-line-masked'
    | 'mdx-downgraded';

  /**
   * Absolute start offset of the affected region in the full document text.
   */
  readonly startOffset: number;

  /**
   * Absolute exclusive end offset of the affected region.
   */
  readonly endOffset: number;

  /**
   * Human-readable cause; downgrade findings carry the strict parser's reason.
   */
  readonly detail: string;
};

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

  /**
   * Tolerance events from parsing, in source order;
   * empty when the document parsed strictly with nothing masked.
   */
  readonly parseFindings: readonly ParseFinding[];
};

/**
 * Parses body text tolerantly:
 * strict MDX first, plain markdown on grammar failure.
 * The downgrade is never silent; the finding carries the strict reason.
 *
 * @param body - body text, comments already masked
 *
 * @param bodyOffset - absolute offset of body within the full document
 *
 * @returns mdast root plus downgrade findings when the strict grammar failed
 *
 * @example
 * ```ts
 * const { root, findings, } = parseBodyTolerant({ body: masked, bodyOffset: 0, },);
 * ```
 */
function parseBodyTolerant(
  {
    body,
    bodyOffset,
  }: {
    readonly body: string;
    readonly bodyOffset: number;
  },
): {
  readonly root: Root;
  readonly findings: readonly ParseFinding[];
} {
  try {
    return {
      root: parseMdxBody({ body, },),
      findings: [],
    };
  }
  catch (error) {
    // Only the strict grammar's own rejection downgrades; anything else
    // is an unexpected state that must keep propagating.
    if (!(error instanceof MdxParseError))
      throw error;
    return {
      root: parseMarkdownBody({ body, },),
      findings: [{
        kind: 'mdx-downgraded',
        startOffset: bodyOffset,
        endOffset: bodyOffset + body.length,
        detail: `strict MDX parse failed, fell back to plain markdown: ${
          String(error.cause,)
        }`,
      },],
    };
  }
}

/**
 * Parses one corpus document into its immutable anchor-ready form.
 * HTML comments are masked to whitespace before parsing (the dominant
 * real-corpus failure class), and a document the MDX grammar still rejects
 * reparses as plain markdown;
 * both tolerances surface as parse findings, never as thrown errors.
 *
 * @param text - full document source, front matter included when present
 *
 * @returns Parsed document with nodes, hashes, footnote graph, and findings
 *
 * @throws {@link import('./front-matter.ts').FrontMatterParseError} when fenced YAML refuses to parse
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
   * Body with every invisible-only line blanked, plus each line blanked.
   *
   * Runs FIRST, because such a line is not blank to CommonMark and therefore
   * welds the paragraphs either side of it into one block. One corpus
   * translation parses to 29 blocks that way against the original's 33, and
   * every block after the first weld pairs with the wrong original. Length is
   * preserved, so every offset still indexes the same character.
   */
  const {
    masked: unwelded,
    regions: invisibleRegions,
  } = maskInvisibleLines({ text: split.body, },);

  /**
   * Body with HTML comments blanked, plus each masked region;
   * masking preserves length, so masked-parse positions index the original.
   */
  const {
    masked,
    regions,
  } = maskHtmlComments({ text: unwelded, },);

  /**
   * Findings for every blanked invisible-only line, in absolute offsets.
   *
   * Emitted so the tolerance is never silent. Both parser defects this pipeline
   * has hit were found by accident rather than from an artifact, and a line
   * that vanishes with nothing recording it is exactly the shape that hides the
   * third one.
   */
  const invisibleFindings = invisibleRegions.map(
    function toFinding(region,): ParseFinding {
      /**
       * Code points the line carried, named so the detail can be read.
       */
      const { codePoints, } = region;

      return {
        kind: 'invisible-line-masked',
        startOffset: split.bodyOffset + region.startOffset,
        endOffset: split.bodyOffset + region.endOffset,
        detail: `line showing nothing yet not blank to CommonMark, welding the paragraphs either side of it; masked to spaces before parsing (${
          codePoints.join(', ',)
        })`,
      };
    },
  );

  /**
   * Findings for every masked comment, in absolute document offsets.
   */
  const commentFindings = regions.map(function toFinding(region,): ParseFinding {
    return {
      kind: region.terminated
        ? 'html-comment-skipped'
        : 'unterminated-html-comment',
      startOffset: split.bodyOffset + region.startOffset,
      endOffset: split.bodyOffset + region.endOffset,
      detail: region.terminated
        ? 'HTML comment masked to whitespace before parsing'
        : 'unterminated HTML comment swallowed the rest of the body; masked to whitespace before parsing',
    };
  },);

  /**
   * Tolerantly parsed body tree plus any grammar-downgrade finding.
   */
  const parsed = parseBodyTolerant({
    body: masked,
    bodyOffset: split.bodyOffset,
  },);

  /**
   * Top-level blocks once disclosure containers are unwrapped.
   *
   * Computed ONCE and shared, because the node list and the footnote graph have
   * to agree both about what counts as a top-level block and about what
   * `block/N` names. They did not agree: the graph walked the RAW children, so
   * a footnote definition sitting inside a container was invisible to it while
   * being promoted for the node list, and every `nodeId` it emitted counted
   * containers the node list had already unwrapped.
   *
   * One corpus translation reported all ten of its references unresolved while
   * carrying all ten definitions, because every definition sat inside one.
   */
  const blocks = flattenContainers({
    children: parsed
      .root
      .children,
  },);

  return {
    text,
    documentHash: hashContent({ content: text, },),
    // Conditional spread keeps frontMatter absent (not explicitly undefined)
    // under exactOptionalPropertyTypes.
    ...(split.frontMatter === undefined
      ? {}
      : { frontMatter: split.frontMatter, }),
    // Node text stays sliced from the ORIGINAL body, keeping every quote,
    // hash, and anchor consistent with the document's canonical text.
    // Disclosure containers flatten first so a page nesting blocks exposes the
    // same top-level structure as a counterpart that does not; chunking and
    // alignment walk top-level blocks only.
    nodes: buildDocumentNodes({
      children: blocks,
      bodyText: split.body,
      bodyOffset: split.bodyOffset,
    },),
    // The footnote graph scans the MASKED body so commented-out marker
    // look-alikes never become phantom references or definitions.
    footnoteGraph: buildFootnoteGraph({
      children: blocks,
      bodyText: masked,
      bodyOffset: split.bodyOffset,
    },),
    // Sorted, because `parseFindings` promises source order and the three
    // sources are built in processing order instead: a downgrade finding starts
    // at the body offset, so it would otherwise sort ahead of comments that
    // appear much later in the text.
    parseFindings: [
      ...invisibleFindings,
      ...commentFindings,
      ...parsed.findings,
    ].toSorted(function byOffset(
      left,
      right,
    ) {
      return left.startOffset - right.startOffset;
    },),
  };
}

//endregion Document parsing
