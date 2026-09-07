import { parseDocument, } from '../parse-document.ts';

//region Page grammar
// A PAGE THE GRAMMAR REFUSES cannot ship, whatever every slice floor said of
// its slices. Every slice is read under the strict MDX grammar before it is
// admitted, but the would-ship reading runs AFTER those floors, so a rewrite
// applied there reaches the page unread. On 2026-09-06 the yulianNyanner page
// carried a JSX string literal in curly quotes, `{[“…”]}`, because the
// typography restoration at the would-ship reading treated the quotes of a
// component line as prose; the page compiled nowhere, and nothing refused it.
//
// The floor reads the assembled page the way every document is read,
// `parseDocument`, whose strict parse falls back to plain markdown and records
// the fall as an `mdx-downgraded` finding. One such finding on a would-ship
// page is a page the site cannot build.

/**
 * Refusal when a would-ship page does not parse under the MDX grammar.
 *
 * @example
 * ```ts
 * throw new UnparseablePageError({ entryId: 'Cat', refusal: 'at 3:12 (mdx-jsx)', },);
 * ```
 */
export class UnparseablePageError extends Error {
  /**
   * Message contains the entry id and the strict parser's refusal site, which
   * `MdxParseError` builds from positions and rule names alone.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Entry whose page failed the invariant.
   */
  readonly entryId: string;

  /**
   * Where the grammar stopped, as the strict parser reported it.
   */
  readonly refusal: string;

  /**
   * @param entryId - affected entry
   *
   * @param refusal - strict parser's refusal site, positions and rule names only
   */
  public constructor(
    {
      entryId,
      refusal,
    }: {
      readonly entryId: string;
      readonly refusal: string;
    },
  ) {
    super(
      `entry ${entryId} would ship a page the MDX grammar refuses to parse; ${refusal}`,
    );
    this.name = 'UnparseablePageError';
    this.entryId = entryId;
    this.refusal = refusal;
  }
}

/**
 * Refuses a would-ship page the strict MDX grammar cannot parse.
 *
 * @param entryId - entry about to publish
 *
 * @param pageText - whole would-ship page, front matter included
 *
 * @throws {@link UnparseablePageError} when the strict parse of the page fell
 * back to plain markdown
 *
 * @example
 * ```ts
 * assertPageParses({ entryId: 'Cat', pageText, },);
 * ```
 */
export function assertPageParses(
  {
    entryId,
    pageText,
  }: {
    readonly entryId: string;
    readonly pageText: string;
  },
): void {
  /**
   * First fall from the strict grammar, if the page took one.
   */
  const downgrade = parseDocument({ text: pageText, },)
    .parseFindings
    .find(function isDowngrade(finding,): boolean {
      return finding.kind === 'mdx-downgraded';
    },);
  if (downgrade === undefined)
    return;

  throw new UnparseablePageError({
    entryId,
    refusal: downgrade.detail,
  },);
}

//endregion Page grammar
