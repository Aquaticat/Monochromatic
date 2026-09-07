//region Prose mask
// Which characters of a replacement are prose a typography rule may rewrite.
//
// A straight quote inside a backtick span is code. A straight quote inside a
// tag, `<PhotoScroll photos={["…"]} />` or `<p style="…">`, is markup: the
// site compiles the page as MDX, and a JSX string literal in typographic quotes
// compiles nowhere. On 2026-09-06 the yulianNyanner page shipped exactly that,
// after the typography restoration reached a blockquoted component line for
// the first time; measured at pin a41fc607, 19 of the 92 sources carry a tag
// with a double-quoted attribute, so the shape is common rather than rare.
//
// The mask is computed once per replacement and read by every rule, so the
// rules agree on what prose is instead of each carrying its own scanner.

/**
 * Spaces a blockquote marker may sit behind and still be a marker.
 */
const BLOCKQUOTE_INDENT_MAX = 3;

/**
 * Whether the character after `<` makes it open a tag.
 *
 * Letters open an element or component, `/` a closing tag. Anything else,
 * a comment's `!`, a space, a digit, leaves `<` as prose.
 *
 * @param next - character after the angle bracket, empty at a text boundary
 *
 * @returns Whether a tag opens here
 *
 * @example
 * ```ts
 * opensTag({ next: 'P', },);
 * ```
 */
function opensTag({ next, }: { readonly next: string; },): boolean {
  /**
   * Whether it is an ASCII lower-case letter.
   */
  const lower = (next >= 'a') && (next <= 'z');

  /**
   * Whether it is an ASCII upper-case letter.
   */
  const upper = (next >= 'A') && (next <= 'Z');

  return lower
    || upper
    || (next === '/');
}

/**
 * Whether a `>` is a blockquote marker rather than the end of a tag.
 *
 * A marker sits at the start of its line behind at most three spaces; a tag
 * ends where its attributes end, never at a line start in this corpus's markup.
 * Read so a tag spanning the lines of a blockquote stays one tag.
 *
 * @param text - whole replacement
 *
 * @param index - position of the angle bracket
 *
 * @returns Whether the line starts here
 *
 * @example
 * ```ts
 * isBlockquoteMark({ text: '> <p>', index: 0, },);
 * ```
 */
function isBlockquoteMark(
  {
    text,
    index,
  }: {
    readonly text: string;
    readonly index: number;
  },
): boolean {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    /**
     * Character behind the bracket.
     */
    const character = text.charAt(cursor,);
    if (character === '\n')
      return true;
    if ((character !== ' ') || ((index - cursor) > BLOCKQUOTE_INDENT_MAX))
      return false;
  }
  return true;
}

/**
 * Marks each character of a replacement as prose or not.
 *
 * Backtick spans and tags are not prose; everything else is. The mask has one
 * entry per UTF-16 unit of the text, so it indexes exactly as `charAt` does.
 *
 * @param text - replacement to mask
 *
 * @returns One flag per unit, true where a typography rule may write
 *
 * @example
 * ```ts
 * proseMask({ text: 'a <b c="d"> e', },);
 * ```
 */
export function proseMask({ text, }: { readonly text: string; },): readonly boolean[] {
  return (function scan(): readonly boolean[] {
    /**
     * Flags emitted so far.
     */
    const mask: boolean[] = [];

    /**
     * Whether the scan sits inside a backtick span.
     */
    let inCode = false;

    /**
     * Whether the scan sits inside a tag.
     */
    let inTag = false;
    for (let index = 0; index < text.length; index += 1) {
      /**
       * Character under the cursor.
       */
      const character = text.charAt(index,);
      if (inCode) {
        mask.push(false,);
        inCode = character !== '`';
        continue;
      }
      if (inTag) {
        mask.push(false,);
        inTag = (character !== '>')
          || isBlockquoteMark({
            text,
            index,
          },);
        continue;
      }
      if (character === '`') {
        mask.push(false,);
        inCode = true;
        continue;
      }
      if ((character === '<') && opensTag({ next: text.charAt(index + 1,), },)) {
        mask.push(false,);
        inTag = true;
        continue;
      }
      mask.push(true,);
    }
    return mask;
  })();
}

//endregion Prose mask
