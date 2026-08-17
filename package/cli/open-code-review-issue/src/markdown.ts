/**
 * GitHub Flavored Markdown boundary encoding.
 *
 * @module
 */

/**
 * Markdown inline characters requiring escaping in source path text.
 */
const MARKDOWN_INLINE_SPECIALS: ReadonlySet<string> = new Set([
  '\\',
  '`',
  '*',
  '_',
  '[',
  ']',
  '<',
  '>',
],);

/**
 * Escapes path text at final GitHub Markdown interpolation boundary.
 *
 * @param text - Untrusted source path displayed as ordinary inline text.
 *
 * @returns Markdown text that renders path characters literally.
 *
 * @example
 * ```ts
 * escapeMarkdownInline('src/[id].ts'); // 'src/\\[id\\].ts'
 * ```
 */
export function escapeMarkdownInline(text: string,): string {
  return [...text,]
    .flatMap(function escapeCharacter(character,): readonly string[] {
      return MARKDOWN_INLINE_SPECIALS.has(character,)
        ? ['\\', character,]
        : [character,];
    },)
    .join('',);
}

/**
 * Adds four spaces to every source line for GFM indented code blocks.
 *
 * @param code - OCR source text retained byte-for-byte after line prefixing.
 *
 * @returns Indented code block content including terminal blank source line.
 *
 * @example
 * ```ts
 * indentCode('a\nb'); // '    a\n    b'
 * ```
 */
export function indentCode(code: string,): string {
  return code.split('\n',)
    .map(function indentLine(line,): string {
      return `    ${line}`;
    },)
    .join('\n',);
}
