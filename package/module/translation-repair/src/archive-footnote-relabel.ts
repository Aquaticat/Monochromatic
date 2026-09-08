import type { ChunkPair, } from './chunk-document.ts';
import { isInsertionChunk, } from './chunk-placement.ts';
import {
  scanGfmReferenceLiterals,
  type TextMarkerHit,
} from './footnote-graph.ts';

//region Archive footnote relabel
// THE ARCHIVE'S FOOTNOTE LABELS FOLLOW THE ORIGINAL'S, decided after the
// yuki418330012 page of 2026-09-08 shipped its two markers pointing at each
// other's notes. The original writes 洲洲[^2] and 真理[^1]; the archive had
// renumbered them by first appearance, Zhouzhou[^1] and Zhenli[^2], with its
// definitions numbered to match. Every lane judged the body against the
// original, so the body followed the original's labels, while the archive's
// two definitions were left standing as they were (the roster paired neither,
// and the original's definitions, rendered as an insertion, were withdrawn as
// duplicates). The page carried `Zhenli[^1]` above `[^1]: Yuki's substitute
// parent`. THE NINETEENTH CLASS: a footnote is a relation between slices,
// and two slices that each followed a different numbering agree with
// themselves and not with each other.
//
// THE FIX IS UPSTREAM OF EVERY LANE. Once the archive's labels are rewritten
// to the original's, label equality IS the correspondence: a definition
// pairs with the definition of the same label, the body's markers agree with
// the incumbent's, and a definition that renders the wrong note is a fidelity
// defect the lanes see and repair like any other.
//
// READ OFF THE PAIRED SLICES, positionally. Within one slice the original and
// the archive carry the same passage, so the k-th distinct marker on one side
// is the k-th on the other. A slice whose two sides carry different counts of
// distinct markers says nothing about the labels (the archive dropped or added
// a note there, which the lanes see as the fidelity defect it is; hakureico's
// archive carries no [^2] at all) and is left out of the reading, named. Two
// slices that disagree about one label leave the archive as it is with a
// warning: a wrong relabel would be the defect this exists to stop.

/**
 * One label the archive carries and the original's label for the same note.
 *
 * @example
 * ```ts
 * const relabel: FootnoteRelabel = { from: '1', to: '2', };
 * ```
 */
export type FootnoteRelabel = {
  /**
   * Label as the archive spells it.
   */
  readonly from: string;

  /**
   * Label the original gives the same note.
   */
  readonly to: string;
};

/**
 * What the paired slices say about the archive's labels.
 *
 * @example
 * ```ts
 * const reading: FootnoteRelabelReading = { kind: 'unchanged', };
 * ```
 */
export type FootnoteRelabelReading = {
  /**
   * The archive's labels differ from the original's and every one maps.
   */
  readonly kind: 'relabel';

  /**
   * Labels to rewrite, only the ones that change.
   */
  readonly map: readonly FootnoteRelabel[];

  /**
   * Slices left out of the reading, each with why.
   */
  readonly skipped: readonly string[];
} | {
  /**
   * The labels already agree, or no slice carries a marker on both sides.
   */
  readonly kind: 'unchanged';

  /**
   * Slices left out of the reading, each with why.
   */
  readonly skipped: readonly string[];
} | {
  /**
   * The slices disagree, so the archive stands as it is.
   */
  readonly kind: 'ambiguous';

  /**
   * Which slice, and what each side carried.
   */
  readonly detail: string;
};

/**
 * Output pieces so far and where the last one ended, in the forward pass the
 * rewrite makes over the text.
 */
type RelabelWalk = {
  /**
   * Text emitted so far, in order.
   */
  readonly pieces: readonly string[];

  /**
   * Offset in the input just past what the pieces cover.
   */
  readonly cursor: number;
};

/**
 * Opening literal of a GFM marker.
 */
const GFM_OPEN = '[^';

/**
 * Closing literal of a GFM marker.
 */
const GFM_CLOSE = ']';

/**
 * What follows a marker that opens a definition.
 */
const DEFINITION_SEPARATOR = ':';

/**
 * Length of one marker literal, opening and closing brackets included.
 *
 * @param identifier - the marker's label
 *
 * @returns Characters the literal spans
 *
 * @example
 * ```ts
 * markerLength({ identifier: '12', },);
 * // => 5
 * ```
 */
function markerLength({ identifier, }: { readonly identifier: string; },): number {
  return GFM_OPEN.length
    + identifier.length
    + GFM_CLOSE.length;
}

/**
 * Whether a marker at one offset opens a definition rather than referencing a
 * note: it sits at the start of its line and a colon follows it.
 *
 * @param text - text the marker sits in
 *
 * @param offset - where the marker's `[^` starts
 *
 * @param identifier - the marker's label
 *
 * @returns Whether it is a definition opener
 *
 * @example
 * ```ts
 * opensDefinition({ text: '[^1]: note', offset: 0, identifier: '1', },);
 * // => true
 * ```
 */
function opensDefinition(
  {
    text,
    offset,
    identifier,
  }: {
    readonly text: string;
    readonly offset: number;
    readonly identifier: string;
  },
): boolean {
  /**
   * Offset just past the closing bracket.
   */
  const after = offset + markerLength({ identifier, },);
  if (text.slice(
    after,
    after + DEFINITION_SEPARATOR.length,
  ) !== DEFINITION_SEPARATOR)
    return false;
  return (offset === 0) || (text[offset - 1] === '\n');
}

/**
 * Distinct labels one text references, in order of first appearance,
 * definition openers left out.
 *
 * @param text - one side of a slice
 *
 * @returns Labels, each once
 *
 * @example
 * ```ts
 * referenceLabels({ text: 'A[^2] and B[^1].', },);
 * // => ['2', '1']
 * ```
 */
export function referenceLabels(
  { text, }: { readonly text: string; },
): readonly string[] {
  /**
   * Labels seen so far, in order.
   */
  const seen: string[] = [];
  for (const hit of scanGfmReferenceLiterals({ slice: text, },)) {
    if (opensDefinition({
      text,
      offset: hit.localOffset,
      identifier: hit.identifier,
    },))
      continue;
    if (!seen.includes(hit.identifier,))
      seen.push(hit.identifier,);
  }
  return seen;
}

/**
 * Reads, off the paired slices, how the archive's labels map to the
 * original's.
 *
 * @param slices - preparation's slices, both sides' texts included
 *
 * @returns The map, that nothing changes, or why the archive must stand
 *
 * @example
 * ```ts
 * const reading = footnoteRelabelOf({ slices: prepared.slices, },);
 * if (reading.kind === 'relabel') archiveText = applyFootnoteRelabel({ text: archiveText, map: reading.map, },);
 * ```
 */
export function footnoteRelabelOf(
  { slices, }: { readonly slices: readonly ChunkPair[]; },
): FootnoteRelabelReading {
  /**
   * Archive label to the original's, as the slices agree so far.
   */
  const forward = new Map<string, string>();

  /**
   * Original label to the archive's, so two archive labels cannot claim one.
   */
  const backward = new Map<string, string>();

  /**
   * Slices that said nothing about the labels, each with why.
   */
  const skipped: string[] = [];
  for (const slice of slices) {
    if (isInsertionChunk(slice.target,))
      continue;
    /**
     * Labels the original references in this slice.
     */
    const original = referenceLabels({
      text: slice.source
        .text,
    },);
    /**
     * Labels the archive references in this slice.
     */
    const archive = referenceLabels({
      text: slice.target
        .text,
    },);
    /**
     * Which slice, for the detail.
     */
    const sliceIndex = String(
      slice.target
        .sliceIndex,
    );
    if ((original.length === 0) && (archive.length === 0))
      continue;
    if (original.length !== archive.length) {
      skipped.push(
        `slice ${sliceIndex} references ${String(original.length,)} distinct notes in the original and ${
          String(archive.length,)
        } in the archive`,
      );
      continue;
    }
    for (const [at, from,] of archive.entries()) {
      /**
       * The original's label at the same position.
       */
      const to = original[at];
      if (to === undefined)
        throw new Error('unreachable: the two label lists have one length',);
      /**
       * Where an earlier slice mapped this archive label, when it did.
       */
      const forwardSeen = forward.get(from,);
      /**
       * Which archive label an earlier slice mapped onto this original label,
       * when one did.
       */
      const backwardSeen = backward.get(to,);
      if (((forwardSeen !== undefined) && (forwardSeen !== to))
        || ((backwardSeen !== undefined) && (backwardSeen !== from)))
        return {
          kind: 'ambiguous',
          detail: `slice ${sliceIndex} maps archive [^${from}] to original [^${to}] where an earlier slice mapped [^${
            forwardSeen
              ?? backwardSeen
              ?? ''
          }]`,
        };
      forward.set(
        from,
        to,
      );
      backward.set(
        to,
        from,
      );
    }
  }
  /**
   * The labels that change.
   */
  const map = [ ...forward.entries(), ]
    .filter(function changes([
      from,
      to,
    ],): boolean {
      return from !== to;
    },)
    .map(function toRelabel([
      from,
      to,
    ],): FootnoteRelabel {
      return {
        from,
        to,
      };
    },);
  if (map.length === 0)
    return {
      kind: 'unchanged',
      skipped,
    };
  return {
    kind: 'relabel',
    map,
    skipped,
  };
}

/**
 * Rewrites every GFM marker of the mapped labels, references and definition
 * openers alike, in one pass over the text so swapped labels cannot collide.
 *
 * @param text - archive text as it stands
 *
 * @param map - labels to rewrite
 *
 * @returns Archive text under the original's labels
 *
 * @example
 * ```ts
 * applyFootnoteRelabel({ text: 'A[^1].\n\n[^1]: note\n', map: [ { from: '1', to: '2', }, ], },);
 * // => 'A[^2].\n\n[^2]: note\n'
 * ```
 */
export function applyFootnoteRelabel(
  {
    text,
    map,
  }: {
    readonly text: string;
    readonly map: readonly FootnoteRelabel[];
  },
): string {
  /**
   * Map as a lookup.
   */
  const lookup = new Map(map.map(function toEntry(relabel,): readonly [
    string,
    string,
  ] {
    return [
      relabel.from,
      relabel.to,
    ];
  },),);

  /**
   * The walk over every marker, mapped ones rewritten, the rest passed
   * through inside the pieces around them.
   */
  const walked = scanGfmReferenceLiterals({ slice: text, },)
    .reduce(
      function step(
        state: RelabelWalk,
        hit: TextMarkerHit,
      ): RelabelWalk {
        /**
         * Label the original gives this note, absent when it stays.
         */
        const to = lookup.get(hit.identifier,);
        if (to === undefined)
          return state;
        return {
          pieces: [
            ...state.pieces,
            text.slice(
              state.cursor,
              hit.localOffset,
            ),
            `${GFM_OPEN}${to}${GFM_CLOSE}`,
          ],
          cursor: hit.localOffset + markerLength({ identifier: hit.identifier, },),
        };
      },
      {
        pieces: [],
        cursor: 0,
      },
    );
  return [
    ...walked.pieces,
    text.slice(walked.cursor,),
  ]
    .join('',);
}

//endregion Archive footnote relabel
