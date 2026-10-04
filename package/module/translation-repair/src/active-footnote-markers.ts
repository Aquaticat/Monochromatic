import type { RootContent, } from 'mdast';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import { splitFrontMatter, } from './front-matter.ts';
import { normalizeFootnoteIdentifier, } from './footnote-identifier.ts';
import { FootnoteRewriteError, } from './footnote-rewrite-error.ts';
import {
  gfmMarkerAt,
  gfmMarkerSpans,
  type GfmMarkerSpan,
} from './gfm-marker-spans.ts';
import { maskInvisibleLines, } from './mask-invisible-lines.ts';
import {
  parseMdxBody,
  requireMdxRefusal,
} from './parse-mdx.ts';
import { maskHtmlComments, } from './mask-html-comments.ts';
import type { DeepReadonlyData, } from './readonly-data.ts';

//region Syntax-authorized footnote markers
// AST nodes supply context; masked raw text supplies unresolved references and exact encoded spans.

/**
 One active marker in the original document coordinate space.

 @example
 ```ts
 const references = activeFootnoteMarkers({ text }).filter(marker => marker.kind === 'reference');
 ```
 */
export type ActiveFootnoteMarker = GfmMarkerSpan & {
  /**
   Definition opener or reference, never code or metadata.
   */
  readonly kind: 'definition' | 'reference';
  /**
   Parser-equivalent key for comparison, separate from raw replacement syntax.
   */
  readonly identifier: string;
};

/**
 Reads raw and normalized identities from a positioned syntax node.

 @param node - parser-authorized footnote node

 @param text - exact masked body supplied to the parser

 @param bodyOffset - body origin in the complete document

 @returns Matching raw marker in document coordinates

 @throws FootnoteRewriteError when raw syntax reads no marker where the parser
 placed one, or reads a different identity

 @example
 ```ts
 const marker = positionedFootnote({ node, text, bodyOffset });
 ```
 */
function positionedFootnote(
  {
    node,
    text,
    bodyOffset,
  }: {
    readonly node: DeepReadonlyData<Extract<RootContent, { type: 'footnoteDefinition' | 'footnoteReference'; }>>;
    readonly text: string;
    readonly bodyOffset: number;
  },
): ActiveFootnoteMarker {
  /**
   Parser-authorized opening position, always present: both footnote node
   types are built through `mdast-util-from-markdown`'s `enter`
   (`mdast-util-gfm-footnote`), which sets every node's start from its token,
   and no transform the grammar runs builds a footnote node.
   */
  const offset = nonNullishOrThrow(node.position
    ?.start
    .offset,);
  /**
   Exact lexical end, independent of decoded label length.
   */
  const marker = gfmMarkerAt({
    text,
    offset,
  },);
  // NO MARKER WHERE THE PARSER PLACED ONE is the disagreement an input reaches:
  // micromark also forms a call from an image label (`![^a ]`, its
  // `tokenizePotentialGfmFootnoteCall`), whose label may hold the whitespace
  // the raw grammar refuses. The colon and end checks guard the parser
  // boundary against a grammar change: `gfmMarkerAt` reads the label as the
  // installed `micromark-extension-gfm-footnote` does, and no input found
  // either disagreeing (ledger T8).
  if (((typeof marker) === 'symbol') || ((node.type === 'footnoteDefinition') && (text[marker.endOffset] !== ':'))
    || ((node.type === 'footnoteReference') && (node.position
      ?.end
      .offset
      !== marker.endOffset)))
    throw new FootnoteRewriteError({ kind: 'position', },);
  /**
   Normalized raw spelling must agree with the parser's association.
   */
  const identifier = normalizeFootnoteIdentifier({ identifier: marker.rawLabel, },);
  if (identifier !== normalizeFootnoteIdentifier({ identifier: node.identifier, },))
    throw new FootnoteRewriteError({ kind: 'position', },);
  return {
    ...marker,
    identifier,
    kind: node.type === 'footnoteDefinition' ? 'definition' : 'reference',
    startOffset: bodyOffset + marker.startOffset,
    endOffset: bodyOffset + marker.endOffset,
  };
}

/**
 This node carries no raw bounds, distinct from bounds that read zero.

 @example
 ```ts
 if (nodeBounds(node,) === NO_NODE_BOUNDS) joinUnpositionedRun();
 ```
 */
const NO_NODE_BOUNDS: unique symbol = Symbol('no raw bounds on a node MDAST rebuilt unpositioned',);

/**
 Raw bounds of a syntax node, where the parser kept them.

 @param node - any node the walk holds

 @returns The node's raw offsets in the masked parser input, or
 {@link NO_NODE_BOUNDS} where a transform rebuilt the node without
 positions

 @example
 ```ts
 const bounds = nodeBounds(node,);
 ```
 */
function nodeBounds(
  node: DeepReadonlyData<RootContent>,
): {
  readonly start: number;
  readonly end: number;
} | typeof NO_NODE_BOUNDS {
  /**
   Node's raw start and exclusive end.
   */
  const start = node.position
    ?.start
    .offset;
  /**
   Exclusive end of this node's raw span.
   */
  const end = node.position
    ?.end
    .offset;
  return ((start === undefined) || (end === undefined)) ? NO_NODE_BOUNDS : {
    start,
    end,
  };
}

/**
 Literal-looking references recovered from one syntax-authorized raw region.

 @param regionStart - region origin in the masked parser input

 @param region - raw text of the region, plain text or the source an
 autolink literal stands in for

 @param bodyOffset - body origin in the complete document

 @returns Marker spans in document coordinates, source order

 @example
 ```ts
 const recovered = recoveredReferences({ regionStart: 0, region: 'Missing[^9].', bodyOffset: 0, });
 ```
 */
function recoveredReferences(
  {
    regionStart,
    region,
    bodyOffset,
  }: {
    readonly regionStart: number;
    readonly region: string;
    readonly bodyOffset: number;
  },
): ActiveFootnoteMarker[] {
  return gfmMarkerSpans({ text: region, },)
    .map(function place(marker,): ActiveFootnoteMarker {
      return {
        ...marker,
        kind: 'reference',
        identifier: normalizeFootnoteIdentifier({ identifier: marker.rawLabel, },),
        startOffset: bodyOffset + regionStart
          + marker.startOffset,
        endOffset: bodyOffset + regionStart
          + marker.endOffset,
      };
    },);
}

/**
 Inventories active markers under strict document grammar without hiding unmatched container tags.
 Literal-looking references are recovered only from text nodes in the masked parser input.

 @param text - whole document or structural slice with canonical offsets

 @returns Active references and definition openers in source order

 @throws FootnoteRewriteError when syntax or positioned marker identity cannot be established

 @example
 ```ts
 const markers = activeFootnoteMarkers({ text: 'Real[^1].\n\n[^1]: Note.' });
 ```
 */
export function activeFootnoteMarkers({ text, }: { readonly text: string; },): readonly ActiveFootnoteMarker[] {
  if (!text.includes('[^',))
    return [];
  /**
   Front matter is not Markdown content and cannot supply active markers.
   */
  const {
    body,
    bodyOffset,
  } = splitFrontMatter({ text, },);
  /**
   Match document preparation's invisible-line boundaries without changing offsets.
   */
  const { masked, } = maskInvisibleLines({ text: body, },);
  try {
    /**
     Exact parser input, without rescuing unmatched or malformed JSX as a slice atom.
     */
    const { masked: parsedText, } = maskHtmlComments({ text: masked, },);
    /**
     A whole-document syntax failure cannot authorize raw-text marker edits.
     */
    const root = parseMdxBody({ body: parsedText, },);
    /**
     Raw bounds of each unpositioned run, keyed by the run's first node.
     The autolink-literal transform rebuilds text and link nodes without
     positions wherever its pattern finds a literal micromark did not
     tokenize (ledger B123), so a run's raw is the source between its
     positioned neighbours, or the parent's own bounds at either end.
     */
    const unpositionedRuns = new Map<DeepReadonlyData<RootContent>, {
      readonly start: number;
      readonly end: number;
    }>();
    /**
     Child lists left to bound, each with the raw bounds it may not cross.
     Only the autolink-literal transform leaves nodes unpositioned, as text
     and link siblings replacing one text node, so no unpositioned subtree
     holds structure this walk descends into.
     */
    const lists: {
      readonly children: DeepReadonlyData<RootContent>[];
      readonly parentStart: number;
      readonly parentEnd: number;
    }[] = [{
      children: root.children,
      parentStart: 0,
      parentEnd: parsedText.length,
    },];
    for (let list = lists.pop(); list !== undefined; list = lists.pop()) {
      /**
       This list's children and the raw bounds it may not cross.
       */
      const {
        children,
        parentStart,
        parentEnd,
      } = list;
      for (let index = 0; index < children.length; index += 1) {
        /**
         This child.
         */
        const child = nonNullishOrThrow(children[index],);
        /**
         Bounds of this child where the parser kept them.
         */
        const bounds = nodeBounds(child,);
        if (bounds !== NO_NODE_BOUNDS) {
          if ('children' in child) {
            /**
             This child's own children, carried one by one into the list
             shape, as the main walk's stack carries them.
             */
            const nested: DeepReadonlyData<RootContent>[] = [];
            for (const nestedChild of child.children)
              nested.push(nestedChild,);
            lists.push({
              children: nested,
              parentStart: bounds.start,
              parentEnd: bounds.end,
            },);
          }
          continue;
        }
        /**
         Bounds of the previous positioned sibling, absent at the head of
         the list where the parent's own start bounds the run.
         */
        const previous = (index === 0)
          ? NO_NODE_BOUNDS
          : nodeBounds(nonNullishOrThrow(children[index - 1],),);
        /**
         Raw start of this run.
         */
        const start = (previous === NO_NODE_BOUNDS)
          ? parentStart
          : previous.end;
        /**
         Index after the run's last unpositioned member.
         */
        let after = index;
        while ((after < children.length) && (nodeBounds(nonNullishOrThrow(children[after],),) === NO_NODE_BOUNDS))
          after += 1;
        /**
         Bounds of the next positioned sibling, absent at the tail of the
         list where the parent's own end bounds the run.
         */
        const next = (after === children.length)
          ? NO_NODE_BOUNDS
          : nodeBounds(nonNullishOrThrow(children[after],),);
        /**
         Raw end of this run.
         */
        const end = (next === NO_NODE_BOUNDS)
          ? parentEnd
          : next.start;
        unpositionedRuns.set(
          child,
          {
            start,
            end,
          },
        );
        index = after - 1;
      }
    }
    /**
     Owned structural work-stack, avoiding recursion through container spines.
     */
    const work: DeepReadonlyData<RootContent>[] = root.children
      .toReversed();
    /**
     Positioned markers collected in source-order preorder.
     */
    const markers: ActiveFootnoteMarker[] = [];
    for (let node = work.pop(); node !== undefined; node = work.pop()) {
      if ((node.type === 'footnoteDefinition') || (node.type === 'footnoteReference'))
        markers.push(positionedFootnote({
          node,
          text: parsedText,
          bodyOffset,
        },),);
      else {
        /**
         Raw region this node's literal-looking references live in: its own
         positioned span, or the unpositioned run it opens (ledger B123).
         */
        const bounds = nodeBounds(node,);
        if (bounds !== NO_NODE_BOUNDS) {
          if (node.type === 'text')
            markers.push(...recoveredReferences({
              regionStart: bounds.start,
              region: parsedText.slice(
                bounds.start,
                bounds.end,
              ),
              bodyOffset,
            },),);
        }
        else {
          /**
           Unpositioned run this node opens, scanned once at its first
           member for the references its raw may hold.
           */
          const run = unpositionedRuns.get(node,);
          if (run !== undefined)
            markers.push(...recoveredReferences({
              regionStart: run.start,
              region: parsedText.slice(
                run.start,
                run.end,
              ),
              bodyOffset,
            },),);
        }
      }
      if ('children' in node) {
        for (const child of node.children
          .toReversed())
          work.push(child,);
      }
    }
    return markers;
  }
  catch (error) {
    // A refusal of the grammar becomes a syntax rewrite error; anything
    // else, the position refusal thrown in the walk among it, propagates.
    throw new FootnoteRewriteError({
      kind: 'syntax',
      cause: requireMdxRefusal({ error, },),
    },);
  }
}

/**
 Keeps the first raw spelling of each logical marker identity.

 @param markers - positioned markers already restricted to the desired roles

 @returns Distinct raw labels in encounter order

 @example
 ```ts
 const labels = footnoteMarkerLabels({ markers: activeFootnoteMarkers({ text }) });
 ```
 */
export function footnoteMarkerLabels({ markers, }: { readonly markers: readonly ActiveFootnoteMarker[]; },): readonly string[] {
  /**
   First spelling per logical identifier.
   */
  const labels = new Map<string, string>();
  for (const marker of markers) {
    if (!labels.has(marker.identifier,))
      labels.set(
        marker.identifier,
        marker.rawLabel,
      );
  }
  return [...labels.values(),];
}

//endregion Syntax-authorized footnote markers
