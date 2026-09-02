//region Work-title scan
// The works an original names, read off its 《…》 marks, and the query each
// becomes. Split from `work-title-lookup.ts` at its line budget and along a
// seam: this is pure text, the rest is the web and the disk.

/**
 * Opening title mark.
 */
const TITLE_OPEN = '《';

/**
 * Closing title mark.
 */
const TITLE_CLOSE = '》';

/**
 * What `indexOf` answers when a mark is not found.
 */
const NOT_FOUND = -1;

/**
 * Every 《…》 span in a text, once each, in order of first appearance, marks
 * included.
 *
 * ONE LINEAR PASS with `indexOf`: each opening mark is found from the previous
 * closing one. Measured over the pinned corpus on 2026-09-02: 32 of 92 entries
 * carry one or more, 118 spans, at most 13 in one entry (XingZ60).
 *
 * @param text - original document
 *
 * @returns Titles as the original writes them
 *
 * @example
 * ```ts
 * workTitlesOf({ text: '她读《活着》，又读《活着》。', },);
 * // => ['《活着》']
 * ```
 */
export function workTitlesOf(
  { text, }: { readonly text: string; },
): readonly string[] {
  /**
   * Titles seen so far, in order.
   */
  const titles: string[] = [];
  /**
   * Position to search from, advanced past each closing mark.
   */
  const cursor = { from: 0, };
  for (
    let open = text.indexOf(
      TITLE_OPEN,
      cursor.from,
    );
    open !== NOT_FOUND;
    open = text.indexOf(
      TITLE_OPEN,
      cursor.from,
    )
  ) {
    /**
     * Closing mark after this opening one.
     */
    const close = text.indexOf(
      TITLE_CLOSE,
      open + TITLE_OPEN.length,
    );
    if (close === NOT_FOUND)
      break;
    /**
     * Title with its marks.
     */
    const title = text.slice(
      open,
      close + TITLE_CLOSE.length,
    );
    if (!titles.includes(title,))
      titles.push(title,);
    cursor.from = close + TITLE_CLOSE.length;
  }
  return titles;
}

/**
 * Query sent for one title, which is also the cache key.
 *
 * @param title - title with its marks
 *
 * @returns Search string asking for the official English title
 *
 * @example
 * ```ts
 * lookupQueryFor({ title: '《活着》', },);
 * // => '《活着》 official English title'
 * ```
 */
export function lookupQueryFor(
  { title, }: { readonly title: string; },
): string {
  return `${title} official English title`;
}

//endregion Work-title scan
