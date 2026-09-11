import type { ChunkPair, } from './chunk-document.ts';
import type { DefinitionLabelPair, } from './pair-definition-order.ts';
import {
  activeFootnoteMarkers,
  footnoteMarkerLabels,
} from './active-footnote-markers.ts';
import { normalizeFootnoteIdentifier, } from './footnote-identifier.ts';
import { isInsertionChunk, } from './chunk-placement.ts';

export { applyFootnoteRelabel, } from './apply-footnote-relabel.ts';

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
 * const reading: FootnoteRelabelReading = { kind: 'unchanged', correspondences: [], skipped: [], };
 * ```
 */
export type FootnoteRelabelReading = {
  /**
   * The archive's labels differ from the original's and every one maps.
   */
  readonly kind: 'relabel';

  /**
   * Complete supplied relations, including identities that establish original-label coverage.
   */
  readonly correspondences: readonly FootnoteRelabel[];

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
   * Positive relations, distinct from the absence of any correspondence evidence.
   */
  readonly correspondences: readonly FootnoteRelabel[];

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
  return footnoteMarkerLabels({ markers: activeFootnoteMarkers({ text, },)
    .filter(function reference(marker,): boolean {
    return marker.kind === 'reference';
  },), },);
}

/**
 * One claim that an archive label is an original label, and where it was
 * read.
 */
type LabelCorrespondence = {
  /**
   * Label as the archive spells it.
   */
  readonly from: string;

  /**
   * Label the original gives the same note.
   */
  readonly to: string;

  /**
   * Where the claim was read, for the detail.
   */
  readonly where: string;

  /**
   * What kind of place that is, for the detail's grammar.
   */
  readonly unit: 'slice' | 'pair';
};

/**
 * Folds correspondences into one map, refusing as ambiguous the first that
 * contradicts an earlier one on either side.
 *
 * @param correspondences - claims in reading order
 *
 * @param skipped - places that said nothing, carried into the reading
 *
 * @returns The reading
 *
 * @example
 * ```ts
 * mapLabels({ correspondences: [ { from: '1', to: '2', where: 'slice 3', unit: 'slice', }, ], skipped: [], },);
 * ```
 */
function mapLabels(
  {
    correspondences,
    skipped,
  }: {
    readonly correspondences: readonly LabelCorrespondence[];
    readonly skipped: readonly string[];
  },
): FootnoteRelabelReading {
  /**
   * Archive label to the original's, as the claims agree so far.
   */
  const forward = new Map<string, string>();

  /**
   * Original label to the archive's, so two archive labels cannot claim one.
   */
  const backward = new Map<string, string>();
  /**
   * First supplied spelling of each distinct logical relation, including identities.
   */
  const distinct: FootnoteRelabel[] = [];
  for (const claim of correspondences) {
    /**
     * Parser-equivalent archive identifier.
     */
    const from = normalizeFootnoteIdentifier({ identifier: claim.from, },);
    /**
     * Parser-equivalent original identifier.
     */
    const to = normalizeFootnoteIdentifier({ identifier: claim.to, },);
    /**
     * Where an earlier claim mapped this archive label, when one did.
     */
    const forwardSeen = forward.get(from,);
    /**
     * Which archive label an earlier claim mapped onto this original label,
     * when one did.
     */
    const backwardSeen = backward.get(to,);
    if (((forwardSeen !== undefined) && (forwardSeen !== to))
      || ((backwardSeen !== undefined) && (backwardSeen !== from)))
      return {
        kind: 'ambiguous',
        detail: `${claim.where} maps archive [^${claim.from}] to original [^${claim.to}] where an earlier ${
          claim.unit
        } mapped [^${
          forwardSeen
            ?? backwardSeen
            ?? ''
        }]`,
      };
    if (forwardSeen === undefined)
      distinct.push({
        from: claim.from,
        to: claim.to,
      },);
    forward.set(
      from,
      to,
    );
    backward.set(
      to,
      from,
    );
  }
  /**
   * Only changes of logical identity need rewriting; positive identity evidence remains separate.
   */
  const map = distinct.filter(function changes(relation,): boolean {
    return normalizeFootnoteIdentifier({ identifier: relation.from, },)
      !== normalizeFootnoteIdentifier({ identifier: relation.to, },);
  },);
  if (map.length === 0)
    return {
      kind: 'unchanged',
      correspondences: distinct,
      skipped,
    };
  return {
    kind: 'relabel',
    map,
    correspondences: distinct,
    skipped,
  };
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
   * Correspondences the slices give, positionally.
   */
  const correspondences: LabelCorrespondence[] = [];

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
      correspondences.push({
        from,
        to,
        where: `slice ${sliceIndex}`,
        unit: 'slice',
      },);
    }
  }
  return mapLabels({
    correspondences,
    skipped,
  },);
}

/**
 * Reads the map off the definitions the roster paired by content, the exact
 * evidence: the archive's definition of a note carries the archive's label
 * for it, and the original's carries the original's.
 *
 * @param pairs - definition pairs, by label
 *
 * @returns The map, that nothing changes, or why the archive must stand
 *
 * @example
 * ```ts
 * footnoteRelabelOfDefinitions({ pairs: [ { sourceLabel: '2', targetLabel: '1', }, { sourceLabel: '1', targetLabel: '2', }, ], },);
 * // => { kind: 'relabel', map: [ { from: '1', to: '2', }, { from: '2', to: '1', }, ], skipped: [], }
 * ```
 */
export function footnoteRelabelOfDefinitions(
  { pairs, }: { readonly pairs: readonly DefinitionLabelPair[]; },
): FootnoteRelabelReading {
  return mapLabels({
    correspondences: pairs.map(function toCorrespondence(
      pair,
      at,
    ): LabelCorrespondence {
      return {
        from: pair.targetLabel,
        to: pair.sourceLabel,
        where: `definition pair ${String(at,)}`,
        unit: 'pair',
      };
    },),
    skipped: [],
  },);
}

//endregion Archive footnote relabel
