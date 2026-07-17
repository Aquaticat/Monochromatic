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
import {
  MdxParseError,
  parseMarkdownBody,
  parseMdxBody,
} from './parse-mdx.ts';

//region Document parsing
// Composition of the deterministic core: front matter split, tolerant parse
// (comment masking, then strict MDX, then plain-markdown fallback), node
// construction, footnote graph. Pure over its input; every later stage anchors claims
// against the result and its hashes. Tolerance is never silent: every skipped
// comment and every grammar downgrade surfaces as a parse finding.

/**
 * One tolerance event from parsing:
 * a masked HTML comment or a whole-document grammar downgrade.
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
   * masked comment, comment that never closed, or MDX-to-markdown downgrade.
   */
  readonly kind:
    | 'html-comment-skipped'
    | 'unterminated-html-comment'
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
   * Body with HTML comments blanked, plus each masked region;
   * masking preserves length, so masked-parse positions index the original.
   */
  const {
    masked,
    regions,
  } = maskHtmlComments({ text: split.body, },);

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
    nodes: buildDocumentNodes({
      children: parsed
        .root
        .children,
      bodyText: split.body,
      bodyOffset: split.bodyOffset,
    },),
    // The footnote graph scans the MASKED body so commented-out marker
    // look-alikes never become phantom references or definitions.
    footnoteGraph: buildFootnoteGraph({
      children: parsed
        .root
        .children,
      bodyText: masked,
      bodyOffset: split.bodyOffset,
    },),
    parseFindings: [
      ...commentFindings,
      ...parsed.findings,
    ],
  };
}

//endregion Document parsing
