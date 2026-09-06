import { headingWords, } from '../entry-notes.ts';
import { parseDocument, } from '../parse-document.ts';

//region Heading distinctness
// TWO DIFFERENT SOURCE HEADINGS RENDERED AS ONE is a defect no slice floor can
// see, because a slice holds one heading. The assembled page holds them all.
//
// On 2026-09-06 the yulianNyanner page carried "## Dysphoria" twice for two
// different source headings, after a translator note about "this title" was
// carried into every slice without its position. Measured at pin a41fc607: no
// source among the 92 repeats a heading, and no archive renders two distinct
// source headings identically, so this floor refuses nothing the archives
// would ship. Where the original itself repeats a heading, identical renderings
// are allowed, and where the heading counts differ the block-structure floors
// own the question and this one says nothing rather than pair by position.

/**
 * Node kind the parser gives a heading.
 */
const HEADING_KIND = 'heading';

/**
 * Refusal when a would-ship page renders distinct source headings as one.
 *
 * @example
 * ```ts
 * throw new CollapsedHeadingError({ entryId: 'Cat', sourceDistinct: 2, pageDistinct: 1, },);
 * ```
 */
export class CollapsedHeadingError extends Error {
  /**
   * Message contains operation names and counts only.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Entry whose page failed the invariant.
   */
  readonly entryId: string;

  /**
   * Distinct headings the source carries.
   */
  readonly sourceDistinct: number;

  /**
   * Distinct headings the would-ship page carries.
   */
  readonly pageDistinct: number;

  /**
   * @param entryId - affected entry
   *
   * @param sourceDistinct - distinct heading count in the source
   *
   * @param pageDistinct - distinct heading count on the page
   */
  public constructor(
    {
      entryId,
      sourceDistinct,
      pageDistinct,
    }: {
      readonly entryId: string;
      readonly sourceDistinct: number;
      readonly pageDistinct: number;
    },
  ) {
    super(
      `entry ${entryId} would render ${String(sourceDistinct,)} distinct source heading(s) as `
        + `${String(pageDistinct,)} distinct page heading(s)`,
    );
    this.name = 'CollapsedHeadingError';
    this.entryId = entryId;
    this.sourceDistinct = sourceDistinct;
    this.pageDistinct = pageDistinct;
  }
}

/**
 * Words of every heading in one document, in document order.
 *
 * @param text - whole document, front matter included
 *
 * @returns Heading words, marks stripped
 *
 * @example
 * ```ts
 * headingWordsOf({ text: '## 简介\n\n正文。\n', },);
 * // => ['简介']
 * ```
 */
function headingWordsOf(
  { text, }: { readonly text: string; },
): readonly string[] {
  return parseDocument({ text, },)
    .nodes
    .filter(function isHeading(node,): boolean {
      return node.kind === HEADING_KIND;
    },)
    .map(function toWords(node,): string {
      return headingWords({ text: node.text, },);
    },);
}

/**
 * Refuses a would-ship page on which two different source headings read the
 * same.
 *
 * @param entryId - entry about to publish
 *
 * @param sourceText - whole original
 *
 * @param pageText - whole would-ship page
 *
 * @throws {@link CollapsedHeadingError} when two headings that differ in the
 * source are identical on the page
 *
 * @example
 * ```ts
 * assertHeadingsStayDistinct({ entryId: 'Cat', sourceText, pageText, },);
 * ```
 */
export function assertHeadingsStayDistinct(
  {
    entryId,
    sourceText,
    pageText,
  }: {
    readonly entryId: string;
    readonly sourceText: string;
    readonly pageText: string;
  },
): void {
  /**
   * Source headings by position.
   */
  const source = headingWordsOf({ text: sourceText, },);

  /**
   * Page headings by position.
   */
  const page = headingWordsOf({ text: pageText, },);

  if (source.length !== page.length)
    return;

  /**
   * Whether some later page heading repeats an earlier one whose source differed.
   */
  const collapsed = page.some(function repeatsAnother(
    words,
    index,
  ): boolean {
    return page.some(function earlierSameWordsOtherSource(
      other,
      otherIndex,
    ): boolean {
      return (otherIndex < index)
        && (other === words)
        && (source[otherIndex] !== source[index]);
    },);
  },);
  if (!collapsed)
    return;

  throw new CollapsedHeadingError({
    entryId,
    sourceDistinct: new Set(source,).size,
    pageDistinct: new Set(page,).size,
  },);
}

//endregion Heading distinctness
