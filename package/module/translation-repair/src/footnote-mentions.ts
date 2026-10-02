import {
  scanFullwidthMarkers,
  scanGfmReferenceLiterals,
} from './footnote-graph.ts';
import { normalizeFootnoteIdentifier, } from './footnote-identifier.ts';

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
 How many identifiers a scan may report before the text is refused as
 pathological rather than counted.

 A slice is a paragraph or two of prose. Thousands of markers in one means
 generated or adversarial text, and the guard exists to keep such text OUT of
 the document rather than to attribute it.
 */
export const MAX_SLICE_IDENTIFIERS = 4_096;

/**
 Raised when one text carries more footnote markers than the guard counts.

 AN INPUT REFUSAL, not an invariant: a page really can carry them, and the
 boundary prints this whole because it names a count and a convention only.

 @example
 ```ts
 throw new FootnoteOverflowError({ count: 5000, convention: 'gfm-reference', },);
 ```
 */
export class FootnoteOverflowError extends Error {
  /**
   Declares this message safe to print whole at a boundary: two counts and a
   convention name, nothing from the text.
   */
  readonly messageNamesOnly: true = true;

  /**
   @param count - markers found

   @param convention - which marker convention overflowed
   */
  constructor(
    {
      count,
      convention,
    }: {
      readonly count: number;
      readonly convention: string;
    },
  ) {
    super(
      `${String(count,)} ${convention} footnote markers in one text, over the ${
        String(MAX_SLICE_IDENTIFIERS,)
      } this guard counts`,
    );
    this.name = 'FootnoteOverflowError';
  }
}

/**
 Characters a GFM marker spends on punctuation: `[`, `^` and `]`.
 */
const GFM_MARKER_PUNCTUATION = 3;

/**
 Characters an archive-convention marker spends on punctuation: `〔` and `〕`.
 */
const FULLWIDTH_MARKER_PUNCTUATION = 2;

/**
 How many characters one hit's identifier occupies in its own text.

 The same for both conventions: a normalized ASCII digit and the full-width
 digit it came from are one unit each.

 @param hit - marker hit from either scanner

 @returns Characters between the marker's punctuation

 @example
 ```ts
 const width = identifierLength({ hit, },);
 ```
 */
function identifierLength(
  { hit, }: { readonly hit: { readonly identifier: string; }; },
): number {
  return hit.identifier
    .length;
}

/**
 Whether a marker at an offset opens a DEFINITION rather than referring to
 one: a label followed by its separator, with only whitespace before it on its
 own line.

 @param text - text the marker sits in

 @param offset - offset the marker starts at

 @param markerLength - length of the marker itself

 @param separator - character a definition puts after its label

 @returns True when this mention defines the footnote

 @example
 ```ts
 const defines = opensDefinition({ text, offset, markerLength, separator: ':', },);
 ```
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
   Offset just past this marker, where a definition puts its separator.
   */
  const afterMarker = offset + markerLength;
  if (text.slice(
    afterMarker,
    afterMarker + separator.length,
  ) !== separator)
    return false;

  /**
   Everything between the start of this line and the marker.
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
 One footnote mention a text makes.

 FIELDS, NOT A KEY STRING (ledger B35): readers that wanted the identifier or
 the role used to split `footnoteIdentifiers`' `role convention identifier`
 keys back apart, three different ways, each with a fallback for a part the
 key always has.
 */
export type FootnoteMention = {
  /**
   Whether the mention defines the footnote or points at it.
   */
  readonly role: 'definition' | 'reference';

  /**
   Marker convention, since the two conventions number independently.
   */
  readonly convention: 'gfm' | 'fullwidth-bracket';

  /**
   Identifier folded to the parser's spelling, because a finding looked up by
   it names the footnote as mdast keys it. Scanning gives the source spelling,
   and the two differ on any label carrying a letter.
   */
  readonly identifier: string;
};

/**
 Every footnote mention a text makes, with its ROLE.

 Role matters for attribution: a slice that turns `[^1]: the note` into prose
 saying `see[^1]` mentions the identifier exactly as often as before, and only
 the role says it changed. Every mention is listed, including a definition's
 own label, so a slice that stops mentioning an identifier in either role is
 a suspect.

 @param text - slice text or whole document

 @returns Mentions, the GFM convention's first, each convention's in text
 order

 @throws {@link FootnoteOverflowError} when a text mentions more identifiers
 than {@link MAX_SLICE_IDENTIFIERS} in one convention, which no prose slice does

 @example
 ```ts
 const mentions = footnoteMentions({ text: 'A nap[^1].', },);
 ```
 */
export function footnoteMentions(
  { text, }: { readonly text: string; },
): readonly FootnoteMention[] {
  /**
   Mentions across both conventions.
   */
  const mentions: FootnoteMention[] = [];
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
    if (hits.length > MAX_SLICE_IDENTIFIERS)
      throw new FootnoteOverflowError({
        count: hits.length,
        convention,
      },);
    for (const hit of hits) {
      mentions.push({
        role: opensDefinition({
          text,
          offset: hit.localOffset,
          markerLength: markerLength + identifierLength({ hit, },),
          separator,
        },)
          ? 'definition'
          : 'reference',
        convention,
        identifier: normalizeFootnoteIdentifier({ identifier: hit.identifier, },),
      },);
    }
  }
  return mentions;
}

/**
 Counts every footnote mention a text makes, by role, convention and
 identifier, for comparing one text's mentions with another's.

 @param text - slice text or whole document

 @returns Mention counts keyed as `role convention identifier`

 @throws {@link FootnoteOverflowError} when a text mentions more identifiers
 than {@link MAX_SLICE_IDENTIFIERS} in one convention, which no prose slice does

 @example
 ```ts
 const counts = footnoteIdentifiers({ text: 'A nap[^1].', },);
 ```
 */
export function footnoteIdentifiers(
  { text, }: { readonly text: string; },
): ReadonlyMap<string, number> {
  /**
   Mentions counted so far, by key.
   */
  const counts = new Map<string, number>();
  for (const mention of footnoteMentions({ text, },)) {
    /**
     Key naming role, convention and identifier: the roles are what a defect
     is about, and the conventions number independently.
     */
    const key = `${mention.role} ${mention.convention} ${mention.identifier}`;
    counts.set(
      key,
      (counts.get(key,) ?? 0) + 1,
    );
  }
  return counts;
}

//endregion Footnote mentions
