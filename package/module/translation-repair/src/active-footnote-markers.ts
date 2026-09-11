import type { RootContent, } from 'mdast';
import { splitFrontMatter, } from './front-matter.ts';
import { normalizeFootnoteIdentifier, } from './footnote-identifier.ts';
import { FootnoteRewriteError, } from './footnote-rewrite-error.ts';
import { gfmMarkerAt, gfmMarkerSpans, type GfmMarkerSpan, } from './gfm-marker-spans.ts';
import { maskInvisibleLines, } from './mask-invisible-lines.ts';
import { MdxParseError, } from './parse-mdx.ts';
import { parseSliceBody, } from './parse-slice-body.ts';
import type { DeepReadonlyData, } from './readonly-data.ts';

//region Syntax-authorized footnote markers
// AST nodes supply context; masked raw text supplies unresolved references and exact encoded spans.

/**
 * One active marker in the original document coordinate space.
 *
 * @example
 * ```ts
 * const references = activeFootnoteMarkers({ text }).filter(marker => marker.kind === 'reference');
 * ```
 */
export type ActiveFootnoteMarker = GfmMarkerSpan & {
  /** Definition opener or reference, never code or metadata. */
  readonly kind: 'definition' | 'reference';
  /** Parser-equivalent key for comparison, separate from raw replacement syntax. */
  readonly identifier: string;
};

/**
 * Reads raw and normalized identities from a positioned syntax node.
 *
 * @param node - parser-authorized footnote node
 * @param text - exact masked body supplied to the parser
 * @param bodyOffset - body origin in the complete document
 * @returns Matching raw marker in document coordinates
 * @throws FootnoteRewriteError when raw syntax disagrees with parser positions or identity
 * @example
 * ```ts
 * const marker = positionedFootnote({ node, text, bodyOffset });
 * ```
 */
function positionedFootnote(
  { node, text, bodyOffset, }: {
    readonly node: DeepReadonlyData<Extract<RootContent, { type: 'footnoteDefinition' | 'footnoteReference'; }>>;
    readonly text: string;
    readonly bodyOffset: number;
  },
): ActiveFootnoteMarker {
  /** Parser-authorized opening position. */
  const offset = node.position?.start.offset;
  if (offset === undefined)
    throw new FootnoteRewriteError({ kind: 'position', },);
  /** Exact lexical end, independent of decoded label length. */
  const marker = gfmMarkerAt({ text, offset, },);
  if (marker === undefined || (node.type === 'footnoteDefinition' && text[marker.endOffset] !== ':')
    || (node.type === 'footnoteReference' && node.position?.end.offset !== marker.endOffset))
    throw new FootnoteRewriteError({ kind: 'position', },);
  /** Normalized raw spelling must agree with the parser's association. */
  const identifier = normalizeFootnoteIdentifier({ identifier: marker.rawLabel, },);
  if (identifier !== normalizeFootnoteIdentifier({ identifier: node.identifier, },))
    throw new FootnoteRewriteError({ kind: 'position', },);
  return { ...marker, identifier, kind: node.type === 'footnoteDefinition' ? 'definition' : 'reference',
    startOffset: bodyOffset + marker.startOffset, endOffset: bodyOffset + marker.endOffset, };
}

/**
 * Inventories active markers using the same strict slice grammar as structural admission.
 * Literal-looking references are recovered only from text nodes in the masked parser input.
 *
 * @param text - whole document or structural slice with canonical offsets
 * @returns Active references and definition openers in source order
 * @throws FootnoteRewriteError when syntax or positioned marker identity cannot be established
 * @example
 * ```ts
 * const markers = activeFootnoteMarkers({ text: 'Real[^1].\n\n[^1]: Note.' });
 * ```
 */
export function activeFootnoteMarkers({ text, }: { readonly text: string; },): readonly ActiveFootnoteMarker[] {
  if (!text.includes('[^',))
    return [];
  /** Front matter is not Markdown content and cannot supply active markers. */
  const { body, bodyOffset, } = splitFrontMatter({ text, },);
  /** Match document preparation's invisible-line boundaries without changing offsets. */
  const { masked, } = maskInvisibleLines({ text: body, },);
  try {
    /** Reuse exact masked parser input rather than rescanning comments in canonical text. */
    const { root, parsedText, } = parseSliceBody({ text: masked, },);
    /** Owned structural work-stack, avoiding recursion through container spines. */
    const work: DeepReadonlyData<RootContent>[] = root.children.toReversed();
    /** Positioned markers collected in source-order preorder. */
    const markers: ActiveFootnoteMarker[] = [];
    while (work.length > 0) {
      /** Next syntax node. */
      const node = work.pop();
      if (node === undefined)
        throw new FootnoteRewriteError({ kind: 'position', },);
      if (node.type === 'footnoteDefinition' || node.type === 'footnoteReference')
        markers.push(positionedFootnote({ node, text: parsedText, bodyOffset, },),);
      if (node.type === 'text') {
        /** Text-node bounds remain raw despite decoded node values. */
        const start = node.position?.start.offset;
        /** Exclusive end of this syntax-authorized text span. */
        const end = node.position?.end.offset;
        if (start === undefined || end === undefined)
          throw new FootnoteRewriteError({ kind: 'position', },);
        for (const marker of gfmMarkerSpans({ text: parsedText.slice(start, end,), },))
          markers.push({ ...marker, kind: 'reference', identifier: normalizeFootnoteIdentifier({ identifier: marker.rawLabel, },),
            startOffset: bodyOffset + start + marker.startOffset, endOffset: bodyOffset + start + marker.endOffset, },);
      }
      if ('children' in node) {
        for (const child of node.children.toReversed())
          work.push(child,);
      }
    }
    return markers;
  }
  catch (error) {
    if (error instanceof MdxParseError)
      throw new FootnoteRewriteError({ kind: 'syntax', cause: error, },);
    throw error;
  }
}

/**
 * Keeps the first raw spelling of each logical marker identity.
 *
 * @param markers - positioned markers already restricted to the desired roles
 * @returns Distinct raw labels in encounter order
 * @example
 * ```ts
 * const labels = footnoteMarkerLabels({ markers: activeFootnoteMarkers({ text }) });
 * ```
 */
export function footnoteMarkerLabels({ markers, }: { readonly markers: readonly ActiveFootnoteMarker[]; },): readonly string[] {
  /** First spelling per logical identifier. */
  const labels = new Map<string, string>();
  for (const marker of markers) {
    if (!labels.has(marker.identifier,))
      labels.set(marker.identifier, marker.rawLabel,);
  }
  return [...labels.values(),];
}

//endregion Syntax-authorized footnote markers
