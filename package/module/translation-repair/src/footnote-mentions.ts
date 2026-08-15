import {
  scanFullwidthMarkers,
  scanGfmReferenceLiterals,
} from './footnote-graph.ts';

//region Footnote mentions
// Attribution input for the assembly guard: how often one text mentions each
// footnote identifier, and in which ROLE.
//
// Deliberately NOT a parse. A slice is a fragment, and a fragment does not
// reliably parse as a document: one opening on a thematic break reads as front
// matter, and an HTML comment spanning a slice boundary masks differently at
// fragment scale. What is wanted here is only `did this slice change its
// relationship to this identifier`, which a scan answers without any of that.
//
// The role is not decoration: a slice that turns `[^1]: the note` into prose
// saying `see[^1]` mentions the identifier exactly as often as before, and
// only the role says anything changed.

/**
 * How many identifiers a scan may report before the text is refused as
 * pathological rather than counted.
 *
 * A slice is a paragraph or two of prose. Thousands of markers in one means
 * generated or adversarial text, and the guard exists to keep such text OUT of
 * the document rather than to attribute it.
 */
const MAX_SLICE_IDENTIFIERS = 4_096;

/**
 * Characters a GFM marker spends on punctuation: `[`, `^` and `]`.
 */
const GFM_MARKER_PUNCTUATION = 3;

/**
 * Characters an archive-convention marker spends on punctuation: `〔` and `〕`.
 */
const FULLWIDTH_MARKER_PUNCTUATION = 2;

/**
 * How many characters one hit's identifier occupies in its own text.
 *
 * The same for both conventions: a normalized ASCII digit and the full-width
 * digit it came from are one unit each.
 *
 * @param hit - marker hit from either scanner
 *
 * @returns Characters between the marker's punctuation
 *
 * @example
 * ```ts
 * const width = identifierLength({ hit, },);
 * ```
 */
function identifierLength(
  { hit, }: { readonly hit: { readonly identifier: string; }; },
): number {
  return hit.identifier
    .length;
}

/**
 * Whether a marker at an offset opens a DEFINITION rather than referring to
 * one: a label followed by its separator, with only whitespace before it on its
 * own line.
 *
 * @param text - text the marker sits in
 *
 * @param offset - offset the marker starts at
 *
 * @param markerLength - length of the marker itself
 *
 * @param separator - character a definition puts after its label
 *
 * @returns True when this mention defines the footnote
 *
 * @example
 * ```ts
 * const defines = opensDefinition({ text, offset, markerLength, separator: ':', },);
 * ```
 */
function opensDefinition(
  {
    text,
    offset,
    markerLength,
    separator,
  }: {
    readonly text: string;
    readonly offset: number;
    readonly markerLength: number;
    readonly separator: string;
  },
): boolean {
  /**
   * Offset just past this marker, where a definition puts its separator.
   */
  const afterMarker = offset + markerLength;
  if (text.slice(
    afterMarker,
    afterMarker + separator.length,
  ) !== separator)
    return false;

  /**
   * Everything between the start of this line and the marker.
   */
  const before = text.slice(
    text.lastIndexOf(
      '\n',
      offset === 0 ? 0 : (offset - 1),
    ) + 1,
    offset,
  );
  return before.trim() === '';
}

/**
 * Counts every footnote mention a text makes, by ROLE.
 *
 * Role matters for attribution: a slice that turns `[^1]: the note` into prose
 * saying `see[^1]` mentions the identifier exactly as often as before, and only
 * the role says it changed. Every mention is counted, including a definition's
 * own label, so a slice that stops mentioning an identifier in either role is
 * a suspect.
 *
 * @param text - slice text or whole document
 *
 * @returns Mentions keyed as `role convention identifier`
 *
 * @throws {@link Error} when a text mentions more identifiers than
 * {@link MAX_SLICE_IDENTIFIERS}, which no prose slice does
 *
 * @example
 * ```ts
 * const counts = footnoteIdentifiers({ text: 'A nap[^1].', },);
 * ```
 */
export function footnoteIdentifiers(
  { text, }: { readonly text: string; },
): ReadonlyMap<string, number> {
  /**
   * Mentions accumulated across both conventions.
   */
  const counts = new Map<string, number>();
  for (const [convention, hits, separator, markerLength,] of [
    [
      'gfm',
      scanGfmReferenceLiterals({ slice: text, },),
      ':',
      GFM_MARKER_PUNCTUATION,
    ],
    [
      'fullwidth-bracket',
      scanFullwidthMarkers({ slice: text, },),
      '：',
      FULLWIDTH_MARKER_PUNCTUATION,
    ],
  ] as const) {
    if (hits.length > MAX_SLICE_IDENTIFIERS) {
      throw new Error(
        `${String(hits.length,)} ${convention} footnote markers in one text, `
          + `over the ${String(MAX_SLICE_IDENTIFIERS,)} this guard counts`,
      );
    }
    for (const hit of hits) {
      /**
       * Role this mention plays, which a bare identifier cannot say.
       */
      const role = opensDefinition({
        text,
        offset: hit.localOffset,
        markerLength: markerLength + identifierLength({ hit, },),
        separator,
      },)
        ? 'definition'
        : 'reference';

      /**
       * Key naming role and convention, since the two conventions number
       * independently and the roles are what a defect is about.
       */
      const key = `${role} ${convention} ${hit.identifier}`;
      counts.set(
        key,
        (counts.get(key,) ?? 0) + 1,
      );
    }
  }
  return counts;
}

//endregion Footnote mentions
