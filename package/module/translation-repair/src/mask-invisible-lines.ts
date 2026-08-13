//region Invisible line masking
// Turns a line that shows nothing into a line that IS nothing, before the
// Markdown parser reads it.
//
// The corpus case: `people/Toka_ls/page.en.md` carries lines holding U+FEFF and
// nothing else, sitting between two ordinary sentences with no blank line
// anywhere near them. A line carrying a byte-order mark is not blank, so
// CommonMark reads it as a CONTINUATION and merges the paragraphs either side
// of it into one block. That translation therefore parses to 29 blocks against
// the original's 33, they track one-to-one until the first such line, and from
// there every English block pairs with the WRONG Chinese one.
//
// The damage is invisible to every later stage. Handed a source paragraph
// beside the wrong target paragraph, the editor rewrote a correct rendering of
// 期盼中，她看见光穿透暗影 into a faithful rendering of 尽管前路漫布荆棘, a
// sentence two blocks away. Both texts are fluent, both translate something the
// original really says, and the critics, checkers and probe all compare against
// whatever paragraph the misalignment handed them.
//
// Masking preserves LENGTH, exactly as `maskHtmlComments` does, because node
// text, quotes, hashes and every claim anchor are sliced from the original body
// by absolute offset. Replacing the character rather than removing the line is
// what lets the paragraph break come back without moving anything.

/**
 * Characters that occupy a line while showing a reader nothing.
 *
 * The byte-order mark is the one that occurred. Its siblings are listed because
 * they fail identically: each is invisible, each keeps a line from being blank,
 * and each therefore welds two paragraphs together.
 */
const INVISIBLE_CHARACTERS: ReadonlySet<string> = new Set([
  '\u{FEFF}',
  '\u{200B}',
  '\u{200C}',
  '\u{200D}',
  '\u{2060}',
],);

/**
 * Whether a line would be blank if its invisible characters were not there.
 *
 * Requires at least one invisible character, so an ordinary blank line is left
 * exactly as it is rather than rebuilt into an identical one.
 *
 * @param line - one line without its terminator
 *
 * @returns Whether the line shows nothing yet is not blank
 *
 * @example
 * ```ts
 * const welds = isInvisibleOnly({ line: '\u{FEFF}', },);
 * ```
 */
function isInvisibleOnly({ line, }: { readonly line: string; },): boolean {
  /**
   * Whether any invisible character was seen, which is what distinguishes this
   * line from an ordinary blank one.
   */
  let sawInvisible = false;
  for (const character of line) {
    // Invisibility is tested BEFORE whitespace, and the order is load-bearing.
    // ECMAScript counts U+FEFF as whitespace, so `trim()` reports it empty and
    // a whitespace-first check skips the very character being looked for. The
    // first draft of this function did exactly that and blanked nothing.
    if (INVISIBLE_CHARACTERS.has(character,)) {
      sawInvisible = true;
      continue;
    }
    if (character.trim() !== '')
      return false;
  }
  return sawInvisible;
}

/**
 * Replaces every invisible-only line with spaces of the same length.
 *
 * Written as a scan over lines rather than a pattern: the rule is one predicate
 * per line with no carried state, and it must not backtrack over a document
 * built to be pathological.
 *
 * @param text - body text as written
 *
 * @returns Same text, same length, with invisible-only lines blanked
 *
 * @example
 * ```ts
 * const masked = maskInvisibleLines({ text: body, },);
 * ```
 */
export function maskInvisibleLines(
  { text, }: { readonly text: string; },
): string {
  return text
    .split('\n',)
    .map(function blankInvisible(line,) {
      if (!isInvisibleOnly({ line, },))
        return line;

      // Spaces rather than removal: a line of spaces is blank to CommonMark, so
      // the paragraph break returns. Repeating over the line's own UTF-16
      // length keeps the replacement exactly as long as what it replaces, which
      // is what every absolute offset downstream depends on, and it sidesteps
      // the question of how a code point maps to units entirely.
      return ' '.repeat(line.length,);
    },)
    .join('\n',);
}

//endregion Invisible line masking
