import type { ChunkPair, } from '../chunk-document.ts';
import { headingWords, } from '../entry-notes.ts';
import { parseDocument, } from '../parse-document.ts';
import type { SliceReplacement, } from '../splice-slices.ts';

//region Heading collision restore
// CLASS FORTY-FIVE (hulicaijia6, 2026-09-17). The repair lane rendered the
// 相遇 heading as "Meeting", which is the archive's heading for 初识 two
// sections earlier, every slice floor passed it (a slice holds one heading),
// and the publish guard refused the page after 205 minutes for rendering 13
// distinct source headings as 12. The re-attempt resumed the same cached
// texts and would have died the same way.
//
// THE ARCHIVE'S HEADING IS THE FALLBACK. Measured at pin a41fc607 no archive
// renders two distinct source headings identically, so where a page heading
// collides with another section's and differs from the archive's rendering at
// its position, the archive's rendering is restored into that slice's text
// here, at the one place that sees every heading, and recorded as a page
// assembly override the way a trimmed slice is. The publish guard keeps the
// last word for whatever this cannot resolve.

/**
 Node kind the parser gives a heading.
 */
const HEADING_KIND = 'heading';

/**
 One heading as written and as compared.
 */
type HeadingLine = {
  /**
   Heading text with its marks, as the document carries it.
   */
  readonly text: string;

  /**
   Words the distinctness rule compares.
   */
  readonly words: string;
};

/**
 One page heading with the slice that carries it.
 */
type PageHeading = HeadingLine & {
  /**
   Slice whose text the heading sits in.
   */
  readonly sliceIndex: number;
};

/**
 Headings of one document in order.

 @param text - document or slice text

 @returns Heading lines in document order

 @example
 ```ts
 const lines = headingLinesOf({ text: '## 小猫\n\n它睡了。', },);
 ```
 */
function headingLinesOf({ text, }: { readonly text: string; },): readonly HeadingLine[] {
  return parseDocument({ text, },)
    .nodes
    .filter(function isHeading(node,): boolean {
      return node.kind === HEADING_KIND;
    },)
    .map(function toLine(node,): HeadingLine {
      return {
        text: node.text,
        words: headingWords({ text: node.text, },),
      };
    },);
}

/**
 Restores the archive's heading into every slice whose rendered heading
 repeats another section's while the original's headings differ.

 @param sourceText - the original document

 @param targetText - the archive document the replacements address

 @param slices - prepared pairs defining each slice's archive span

 @param replacements - what the page would write per slice

 @returns Replacements with the restored headings, the restored rows alone,
 and one finding per restoration

 @example
 ```ts
 const restoration = restoreCollidingHeadings({ sourceText, targetText, slices, replacements, },);
 ```
 */
export function restoreCollidingHeadings(
  {
    sourceText,
    targetText,
    slices,
    replacements,
  }: {
    readonly sourceText: string;
    readonly targetText: string;
    readonly slices: readonly ChunkPair[];
    readonly replacements: readonly SliceReplacement[];
  },
): {
  readonly replacements: readonly SliceReplacement[];
  readonly restored: readonly SliceReplacement[];
  readonly findings: readonly string[];
} {
  /**
   Nothing to restore.
   */
  const unchanged = {
    replacements,
    restored: [],
    findings: [],
  };
  /**
   Original's headings by position.
   */
  const source = headingLinesOf({ text: sourceText, },);
  /**
   Archive's headings by position.
   */
  const archive = headingLinesOf({ text: targetText, },);
  if (source.length !== archive.length)
    return unchanged;
  /**
   Text the page would carry per slice index.
   */
  const textBySlice = new Map(replacements.map(function toEntry(replacement,) {
    return [
      replacement.sliceIndex,
      replacement.replacementText,
    ] as const;
  },),);
  /**
   Page headings in document order, each with its slice.
   */
  const page: readonly PageHeading[] = slices
    .toSorted(function byIndex(
      left,
      right,
    ): number {
      /**
       Left slice index.
       */
      const leftIndex = left.target
        .sliceIndex;
      /**
       Right slice index.
       */
      const rightIndex = right.target
        .sliceIndex;
      return leftIndex - rightIndex;
    },)
    .flatMap(function headingsOf(slice,): readonly PageHeading[] {
      /**
       Index of this slice.
       */
      const { sliceIndex, } = slice.target;
      /**
       Archive text of this slice.
       */
      const incumbent = slice.target
        .text;
      /**
       What the page carries for this slice.
       */
      const text = textBySlice.get(sliceIndex,) ?? incumbent;
      return headingLinesOf({ text, },)
        .map(function withSlice(line,): PageHeading {
          return {
            ...line,
            sliceIndex,
          };
        },);
    },);
  if (page.length !== source.length)
    return unchanged;
  /**
   Compared words of the original's headings by position.
   */
  const sourceWords = source.map(function wordsOf(line,): string {
    return line.words;
  },);
  /**
   Compared words of the archive's headings by position.
   */
  const archiveWords = archive.map(function wordsOf(line,): string {
    return line.words;
  },);
  /**
   Positions whose page heading repeats another section's heading while the
   original's differ, and whose rendering is not the archive's own.
   */
  const colliding = page
    .map(function collidesAt(
      heading,
      index,
    ): number {
      /**
       Whether another section reads the same while the original differs.
       */
      const collides = page.some(function otherSectionSameWords(
        other,
        otherIndex,
      ): boolean {
        return (otherIndex !== index)
          && (other.words === heading.words)
          && (sourceWords[otherIndex] !== sourceWords[index]);
      },);
      return (collides && (heading.words !== archiveWords[index])) ? index : NOT_COLLIDING;
    },)
    .filter(function isPosition(index,): boolean {
      return index !== NOT_COLLIDING;
    },);
  if (colliding.length === 0)
    return unchanged;
  /**
   Restored text per slice, built one collision at a time so two headings in
   one slice both restore.
   */
  const restoredText = new Map<number, string>();
  /**
   Finding per restoration.
   */
  const findings: string[] = [];
  for (const index of colliding) {
    /**
     Heading being restored.
     */
    const heading = page[index];
    /**
     Archive heading at the same position.
     */
    const replacement = archive[index];
    if ((heading === undefined) || (replacement === undefined))
      continue;
    /**
     Slice text as it stands after earlier restorations.
     */
    const current = restoredText.get(heading.sliceIndex,)
      ?? textBySlice.get(heading.sliceIndex,)
      ?? '';
    restoredText.set(
      heading.sliceIndex,
      current.replace(
        heading.text,
        function literal(): string {
          return replacement.text;
        },
      ),
    );
    findings.push(
      `slice ${String(heading.sliceIndex,)}: heading "${heading.words}" repeats another section's heading `
        + `where the original's differ; the archive's "${replacement.words}" restored (class forty-five)`,
    );
  }
  /**
   Replacements with the restored slices' text.
   */
  const withRestored = replacements.map(function restore(replacement,): SliceReplacement {
    /**
     Restored text for this slice, if any.
     */
    const text = restoredText.get(replacement.sliceIndex,);
    return (text === undefined)
      ? replacement
      : {
        sliceIndex: replacement.sliceIndex,
        replacementText: text,
      };
  },);
  return {
    replacements: withRestored,
    restored: [...restoredText.entries(),].map(function toRow([
      sliceIndex,
      replacementText,
    ],): SliceReplacement {
      return {
        sliceIndex,
        replacementText,
      };
    },),
    findings,
  };
}

/**
 Position marker for a heading that collides with none.
 */
const NOT_COLLIDING = -1;

//endregion Heading collision restore
