import type {
  DocumentSide,
  SpanAnchor,
} from './issue-model.ts';
import {
  collapseLineBreaks,
  normalizePunctuation,
} from './quote-normalize.ts';
import type { AnchorTarget, } from './validate-issue.ts';

//region Quote location
// Deterministic evidence anchoring: find a critic's quote in the document,
// reject absence and ambiguity, and bind the located region to block nodes.
// Block-crossing regions split into one span per touched block, because models
// quote across paragraph boundaries no matter what the prompt demands.
//
// ONE SEARCH OVER THE BROADEST ACCEPTED FORM, rather than a chain of passes
// from strict to loose. Both normalizations replace one UTF-16 unit with one,
// so offsets found in the normalized text index the stored document unchanged.
//
// WHY IT IS NOT A CHAIN, which is what it was until a review found the hole.
// Each pass used to check ambiguity WITHIN ITS OWN CLASS and return on its
// first hit, so a document holding `bad\nword` early and `bad word` late
// answered the quote `bad word` with the late one: unique among byte-exact
// matches, and the earlier occurrence just as valid under the wrapping rule the
// next pass would have applied. Whitespace and punctuation in a model's quote
// are not evidence of WHICH occurrence it meant, since a model normalizes both
// when it copies, so uniqueness has to be judged over every form treated as
// equal. Measured before changing it, over three corpus passes and 16,479
// anchored quotes checked against the slice each was anchored in: NOT ONE would
// be refused by the stricter rule. The same count against whole pages, which is
// the wrong scope but proves the probe can see ambiguity, reports 566.

/**
 * Located-quote outcome: anchors, or the failure reason.
 *
 * @example
 * ```ts
 * const location: QuoteLocation = { located: false, reason: 'quote-not-found (target)', };
 * ```
 */
export type QuoteLocation =
  | {
    readonly located: true;

    /**
     * One anchor per block the quoted region touches;
     * block-crossing quotes split into per-node spans.
     */
    readonly anchors: readonly SpanAnchor[];
  }
  | {
    readonly located: false;

    /**
     * Which check refused, in scorecard-stable wording.
     */
    readonly reason: string;
  };

/**
 * Binds one located region to its blocks.
 * A region inside one block yields one anchor;
 * a region crossing blocks splits into one anchor per touched block,
 * each carrying the document's own bytes for its intersection
 * (inter-block gaps are simply not covered by any span).
 *
 * @param document - side being anchored
 *
 * @param side - which side the anchors belong to
 *
 * @param at - region start in document offsets
 *
 * @param end - exclusive region end
 *
 * @returns Anchors, or the outside-blocks failure
 *
 * @example
 * ```ts
 * const bound = bindQuoteRegion({ document, side: 'target', at, end, },);
 * ```
 */
function bindQuoteRegion(
  {
    document,
    side,
    at,
    end,
  }: {
    readonly document: AnchorTarget;
    readonly side: DocumentSide;
    readonly at: number;
    readonly end: number;
  },
): QuoteLocation {
  /**
   * Blocks the region touches, in document order.
   */
  const touched = document
    .nodes
    .filter(function overlapping(candidate,) {
      return (candidate.startOffset < end) && (candidate.endOffset > at);
    },);
  if (touched.length === 0) {
    return {
      located: false,
      reason: `quote-outside-blocks (${side})`,
    };
  }

  return {
    located: true,
    anchors: touched.map(function toAnchor(node,): SpanAnchor {
      /**
       * Start of this block's share of the region.
       */
      const spanStart = Math.max(
        at,
        node.startOffset,
      );

      /**
       * Exclusive end of this block's share.
       */
      const spanEnd = Math.min(
        end,
        node.endOffset,
      );
      return {
        side,
        nodeId: node.id,
        nodeHash: node.contentHash,
        startOffset: spanStart,
        endOffset: spanEnd,
        quotedText: document.text
          .slice(
          spanStart,
          spanEnd,
        ),
      };
    },),
  };
}

/**
 * Longest needle prefix a failure finding carries.
 * Bounded because a finding is a scorecard line rather than a log record, and
 * critics quote whole paragraphs.
 */
const NEEDLE_PREVIEW_CHARS = 60;

/**
 * Renders the missed quote into the failure finding, so a miss can be
 * diagnosed rather than only counted.
 *
 * Without this the pipeline records THAT a quote failed and discards WHICH,
 * which stalled every attempt to explain why one entry missed at ten times the
 * corpus rate. Line breaks are collapsed so the preview stays one line, and it
 * is truncated so a paragraph-length quote cannot swamp the finding.
 *
 * @param needle - punctuation-normalized quote that was not found
 *
 * @returns Quoted preview prefixed with a space, ready to append to a reason
 *
 * @example
 * ```ts
 * needlePreview({ needle: 'a quote that missed', },);
 * ```
 */
function needlePreview(
  {
    needle,
  }: {
    readonly needle: string;
  },
): string {
  /**
   * Needle flattened to one line, since a finding is a single line.
   */
  const flat = collapseLineBreaks({ text: needle, },);
  if (flat.length <= NEEDLE_PREVIEW_CHARS)
    return ` needle=${JSON.stringify(flat,)}`;
  return ` needle=${
    JSON.stringify(`${flat.slice(
      0,
      NEEDLE_PREVIEW_CHARS,
    )}…`,)
  }`;
}

/**
 * Locates one quote inside one document and binds it to its blocks.
 *
 * Searches the document and the quote in one canonical form, where curly and
 * ASCII punctuation are the same character and a soft line break is a space, so
 * a quote copied out of a wrapped paragraph still anchors. Refuses a quote that
 * occurs more than once in THAT form, whatever the stored punctuation and
 * wrapping happen to be, because a model's own punctuation and line breaks do
 * not say which occurrence it read.
 *
 * @param document - side being searched
 *
 * @param side - which side the anchors belong to
 *
 * @param quote - substring the critic claims
 *
 * @returns Anchors, or the failure reason
 *
 * @example
 * ```ts
 * const located = locateQuote({ document, side: 'target', quote, },);
 * ```
 */
export function locateQuote(
  {
    document,
    side,
    quote,
  }: {
    readonly document: AnchorTarget;
    readonly side: DocumentSide;
    readonly quote: string;
  },
): QuoteLocation {
  if (quote === '') {
    return {
      located: false,
      reason: `empty-quote (${side})`,
    };
  }

  /**
   * Document read in the broadest form this function accepts: punctuation
   * variants canonical, soft line breaks read as spaces. Both maps replace one
   * UTF-16 unit with one, so every offset here indexes the stored document and
   * anchors still carry its own characters.
   */
  const haystack = collapseLineBreaks({ text: normalizePunctuation({ text: document.text, },), },);

  /**
   * Quote read the same way.
   */
  const needle = collapseLineBreaks({ text: normalizePunctuation({ text: quote, },), },);

  /**
   * Where the quote sits once both are read that way.
   */
  const at = haystack.indexOf(needle,);
  if (at === (-1)) {
    return {
      located: false,
      reason: `quote-not-found (${side})${needlePreview({ needle, },)}`,
    };
  }
  if (haystack.includes(
    needle,
    at + 1,
  ))
  {
    return {
      located: false,
      reason: `ambiguous-quote (${side})`,
    };
  }
  return bindQuoteRegion({
    document,
    side,
    at,
    end: at + needle.length,
  },);
}

//endregion Quote location
