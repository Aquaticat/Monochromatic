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
// Byte-exact search runs first; a punctuation-normalized fallback rescues
// quotes differing only in curly-versus-ASCII punctuation, and block-crossing
// regions split into one span per touched block, because models quote across
// paragraph boundaries no matter what the prompt demands.

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
 * Names the outcome a soft-line-break collapse would have produced for a
 * quote the punctuation-normalized search missed.
 * Diagnostic only, so the caller still refuses the quote:
 * the corpus soft-wraps its prose, and a critic quoting across a wrap returns
 * a space where the document holds a line break, which this counts without
 * yet acting on it.
 *
 * @param haystack - punctuation-normalized document text
 *
 * @param needle - punctuation-normalized quote
 *
 * @returns Suffix naming the collapsed outcome, empty when it changes nothing
 *
 * @example
 * ```ts
 * lineBreakSuffix({ haystack, needle, },);
 * ```
 */
function lineBreakSuffix(
  {
    haystack,
    needle,
  }: {
    readonly haystack: string;
    readonly needle: string;
  },
): string {
  /**
   * Document text reading soft line breaks as spaces.
   */
  const collapsedHaystack = collapseLineBreaks({ text: haystack, },);

  /**
   * Quote reading soft line breaks as spaces.
   */
  const collapsedNeedle = collapseLineBreaks({ text: needle, },);

  /**
   * First collapsed occurrence.
   */
  const at = collapsedHaystack.indexOf(collapsedNeedle,);
  if (at === (-1))
    return '';
  if (collapsedHaystack.includes(
    collapsedNeedle,
    at + 1,
  ))
    return ' [line-break-ambiguous]';
  return ' [line-break-collapsible]';
}

/**
 * Locates one quote inside one document and binds it to its blocks.
 * Byte-exact search first;
 * when that misses, a punctuation-normalized search rescues quotes that
 * differ only in curly-versus-ASCII punctuation (normalization is
 * length-preserving, so normalized offsets index the original text, and
 * anchors always carry the document's canonical bytes).
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
   * First byte-exact occurrence of the quote.
   */
  const rawAt = document
    .text
    .indexOf(quote,);
  if (rawAt !== (-1)) {
    if (document
      .text
      .includes(
        quote,
        rawAt + 1,
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
      at: rawAt,
      end: rawAt + quote.length,
    },);
  }

  /**
   * Document text with punctuation variants collapsed;
   * same length as the original, so offsets transfer unchanged.
   */
  const haystack = normalizePunctuation({ text: document.text, },);

  /**
   * Quote with punctuation variants collapsed.
   */
  const needle = normalizePunctuation({ text: quote, },);

  /**
   * First normalized occurrence.
   */
  const normalizedAt = haystack.indexOf(needle,);
  if (normalizedAt === (-1)) {
    return {
      located: false,
      reason: `quote-not-found (${side})${
        lineBreakSuffix({
          haystack,
          needle,
        },)
      }`,
    };
  }
  if (haystack.includes(
    needle,
    normalizedAt + 1,
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
    at: normalizedAt,
    end: normalizedAt + needle.length,
  },);
}

//endregion Quote location
