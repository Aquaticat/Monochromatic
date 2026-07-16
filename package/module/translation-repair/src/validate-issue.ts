import type { DocumentNode, } from './document-node.ts';
import type {
  DocumentSide,
  IssueClaim,
  SpanAnchor,
} from './issue-model.ts';

//region Anchor validation
// Deterministic gate in front of adjudication. Claims from unreliable models are
// ordinary inputs, so anchor defects reject the claim as data instead of throwing;
// the pipeline records rejections for the scorecard (misquote rate is a routing
// signal). A claim enters adjudication only when every span quotes exactly what the
// current document holds at the offsets it names, under the hash it was built
// against.

/**
 * Minimal document surface anchors validate against;
 * `RepairDocument` satisfies it structurally,
 * and the narrower shape keeps validation decoupled from parsing.
 *
 * @example
 * ```ts
 * const target: AnchorTarget = parseDocument({ text, },);
 * ```
 */
export type AnchorTarget = {
  /**
   * Full document source anchors quote from.
   */
  readonly text: string;

  /**
   * Block nodes with ids, absolute offsets, and content hashes.
   */
  readonly nodes: readonly DocumentNode[];
};

/**
 * Defect class of one rejected anchor.
 * `quote-mismatch` also covers non-empty quotes on zero-width spans,
 * because a zero-width slice is always empty.
 *
 * @example
 * ```ts
 * const kind: AnchorRejectionKind = 'quote-mismatch';
 * ```
 */
export type AnchorRejectionKind =
  | 'anchorless-issue'
  | 'malformed-offset'
  | 'inverted-span'
  | 'unknown-node'
  | 'stale-node-hash'
  | 'span-outside-node'
  | 'quote-mismatch';

/**
 * One reason a claim failed deterministic validation.
 *
 * @example
 * ```ts
 * const rejection: AnchorRejection = {
 *   kind: 'quote-mismatch',
 *   spanIndex: 0,
 *   detail: 'span 0 (target) quotes "…" but document holds "…" at [42, 45)',
 * };
 * ```
 */
export type AnchorRejection = {
  /**
   * Defect class driving scorecard buckets and retry prompts.
   */
  readonly kind: AnchorRejectionKind;

  /**
   * Index into claim spans;
   * absent for claim-level defects such as anchorless issues.
   */
  readonly spanIndex?: number;

  /**
   * Plain statement naming affected span, both texts on mismatch, and offsets;
   * fed back to proposers on retry, so precision matters more than brevity.
   */
  readonly detail: string;
};

/**
 * Validates one span against current documents, first defect wins:
 * later checks presume earlier ones (range needs an existing node,
 * quotes mean nothing against a drifted base).
 *
 * @param span - anchor under validation
 *
 * @param spanIndex - position within owning claim for diagnostics
 *
 * @param documents - current pair anchors must hold against
 *
 * @returns Empty when span holds; exactly one rejection otherwise
 *
 * @example
 * ```ts
 * const rejections = validateSpanAnchor({ span, spanIndex: 0, documents, },);
 * ```
 */
function validateSpanAnchor(
  {
    span,
    spanIndex,
    documents,
  }: {
    readonly span: SpanAnchor;
    readonly spanIndex: number;
    readonly documents: Readonly<Record<DocumentSide, AnchorTarget>>;
  },
): readonly AnchorRejection[] {
  /**
   * Diagnostic prefix naming span position and side plainly.
   */
  const label = `span ${String(spanIndex,)} (${span.side})`;

  /**
   * Whether both offsets are non-negative integers;
   * anything else came from malformed model JSON.
   */
  const offsetsWellFormed = Number.isInteger(span.startOffset,)
    && Number.isInteger(span.endOffset,)
    && (span.startOffset >= 0)
    && (span.endOffset >= 0);

  if (!offsetsWellFormed) {
    return [{
      kind: 'malformed-offset',
      spanIndex,
      detail: `${label} carries non-integer or negative offsets`
        + ` [${String(span.startOffset,)}, ${String(span.endOffset,)}).`,
    },];
  }

  if (span.endOffset < span.startOffset) {
    return [{
      kind: 'inverted-span',
      spanIndex,
      detail: `${label} ends at ${String(span.endOffset,)}`
        + ` before it starts at ${String(span.startOffset,)}.`,
    },];
  }

  /**
   * Document of the pair this span claims to point into.
   */
  const document = documents[span.side];

  /**
   * Node the span claims to live in, when it exists.
   */
  const node = document
    .nodes
    .find(function byId(candidate,) {
      return candidate.id === span.nodeId;
    },);

  if (node === undefined) {
    return [{
      kind: 'unknown-node',
      spanIndex,
      detail: `${label} names node ${span.nodeId},`
        + ` which does not exist in the ${span.side} document.`,
    },];
  }

  if (node.contentHash !== span.nodeHash) {
    return [{
      kind: 'stale-node-hash',
      spanIndex,
      detail: `${label} was built against node ${span.nodeId}`
        + ` hash ${span.nodeHash}, but that node now hashes to ${node.contentHash};`
        + ' the base drifted, so offsets and quotes cannot be trusted.',
    },];
  }

  if ((span.startOffset < node.startOffset) || (span.endOffset > node.endOffset)) {
    return [{
      kind: 'span-outside-node',
      spanIndex,
      detail: `${label} covers [${String(span.startOffset,)}, ${String(span.endOffset,)})`
        + ` outside node ${span.nodeId}`
        + ` [${String(node.startOffset,)}, ${String(node.endOffset,)}).`,
    },];
  }

  /**
   * Text the current document actually holds at the claimed offsets.
   */
  const actual = document
    .text
    .slice(
      span.startOffset,
      span.endOffset,
    );

  if (actual !== span.quotedText) {
    return [{
      kind: 'quote-mismatch',
      spanIndex,
      // JSON.stringify escapes newlines and quotes, keeping diagnostics single-line
      // and unambiguous no matter what the document or the model produced.
      detail: `${label} quotes ${JSON.stringify(span.quotedText,)}`
        + ` but the ${span.side} document holds ${JSON.stringify(actual,)}`
        + ` at [${String(span.startOffset,)}, ${String(span.endOffset,)}).`,
    },];
  }

  return [];
}

/**
 * Validates one claim against current documents,
 * returning every rejection as data;
 * empty result admits the claim to adjudication.
 * Spans are checked independently so retry feedback covers all defects at once.
 *
 * @param claim - atomic claim from one critic
 *
 * @param documents - current pair anchors must hold against
 *
 * @returns Rejections in span order; empty when claim anchors hold
 *
 * @example
 * ```ts
 * const rejections = validateIssueClaim({
 *   claim,
 *   documents: { source: sourceDocument, target: targetDocument, },
 * },);
 * if (rejections.length === 0) admit(claim,);
 * ```
 */
export function validateIssueClaim(
  {
    claim,
    documents,
  }: {
    readonly claim: IssueClaim;
    readonly documents: Readonly<Record<DocumentSide, AnchorTarget>>;
  },
): readonly AnchorRejection[] {
  /**
   * Count of anchored spans; zero means the claim asserts without evidence.
   */
  const spanCount = claim
    .spans
    .length;

  if (spanCount === 0) {
    return [{
      kind: 'anchorless-issue',
      detail: `claim ${JSON.stringify(claim.summary,)} carries no spans;`
        + ' every claim must anchor to document evidence.',
    },];
  }

  return claim
    .spans
    .flatMap(function toRejections(
      span,
      spanIndex,
    ) {
      return validateSpanAnchor({
        span,
        spanIndex,
        documents,
      },);
    },);
}

//endregion Anchor validation
