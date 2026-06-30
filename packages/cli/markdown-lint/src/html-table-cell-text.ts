import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

/**
 * Prefix used by Markdown backslash escapes.
 */
const MARKDOWN_ESCAPE_PREFIX = '\\';

/**
 * HTML text characters whose Markdown escape marker must not survive into raw HTML.
 */
const MARKDOWN_HTML_TEXT_ESCAPE_TARGETS: ReadonlySet<string> = new Set([
  '|',
  '&',
  '<',
  '>',
  '"',
  "'",
],);

/**
 * Whether one character is meaningful after a Markdown escape marker when cell
 * text is moved into raw HTML.
 *
 * @param character - character being checked because only HTML-sensitive Markdown escapes need normalization
 *
 * @returns whether Markdown escape marker should be consumed before HTML escaping
 *
 * @example
 * ```ts
 * isMarkdownHtmlTextEscapeTarget('<'); // true
 * ```
 */
function isMarkdownHtmlTextEscapeTarget(character: string,): boolean {
  return MARKDOWN_HTML_TEXT_ESCAPE_TARGETS.has(character,);
}

/**
 * Markdown cell text with HTML-sensitive backslash escapes converted to their
 * intended literal characters. Browsers do not treat Markdown backslashes as
 * escapes inside raw HTML, so the marker must be consumed before HTML escaping.
 *
 * @param markdownCellText - source cell text because micromark leaves Markdown escapes in place
 *
 * @returns Markdown cell text ready for HTML text escaping
 *
 * @example
 * ```ts
 * normalizeMarkdownEscapes(String.raw`\<img>`); // '<img>'
 * ```
 */
function normalizeMarkdownEscapes(markdownCellText: string,): string {
  /**
   * Source text scanned by UTF-16 index; only ASCII escape sentinels matter.
   */
  const characters = markdownCellText;
  /**
   * Text after Markdown escape markers have been consumed.
   */
  const normalized: string[] = [];

  for (let loopIndex = 0; loopIndex < characters.length; loopIndex += 1) {
    /**
     * Current character under the cursor.
     */
    const character = nonNullishOrThrow(characters[loopIndex],);
    /**
     * Next character, used to decide whether a backslash is an escape marker.
     */
    const nextCharacter = characters[loopIndex + 1];

    if (character !== MARKDOWN_ESCAPE_PREFIX) {
      normalized.push(character,);
      continue;
    }

    if (nextCharacter === undefined) {
      normalized.push(character,);
      continue;
    }

    if (!isMarkdownHtmlTextEscapeTarget(nextCharacter,)) {
      normalized.push(character,);
      continue;
    }

    normalized.push(nextCharacter,);
    loopIndex += 1;
  }

  return normalized.join('',);
}

/**
 * HTML text entity for one character.
 *
 * @param character - character being emitted because raw HTML text context treats markup characters specially
 *
 * @returns escaped HTML text for that character
 *
 * @example
 * ```ts
 * htmlTextCharacter('&'); // '&amp;'
 * ```
 */
function htmlTextCharacter(character: string,): string {
  if (character === '&') {
    return '&amp;';
  }
  if (character === '<') {
    return '&lt;';
  }
  if (character === '>') {
    return '&gt;';
  }
  if (character === '"') {
    return '&quot;';
  }
  if (character === "'") {
    return '&#39;';
  }
  return character;
}

/**
 * Escape text for an HTML text node.
 *
 * @param text - normalized text because raw HTML cells must not receive markup directly
 *
 * @returns text safe for interpolation between `<th>` or `<td>` tags
 *
 * @example
 * ```ts
 * escapeHtmlText('<img>'); // '&lt;img&gt;'
 * ```
 */
function escapeHtmlText(text: string,): string {
  /**
   * Characters escaped for HTML text context.
   */
  const escaped: string[] = [];
  for (const character of text) {
    escaped.push(
      htmlTextCharacter(character,),
    );
  }
  return escaped.join('',);
}

/**
 * Convert Markdown table cell source to safe HTML table cell text. Normalizes
 * escapes with {@link normalizeMarkdownEscapes}, then escapes the result with
 * {@link escapeHtmlText}.
 *
 * @param markdownCellText - source cell text because autofix persists it inside raw HTML
 *
 * @returns safe HTML cell text, preserving literal pipes while neutralizing HTML markup
 *
 * @example
 * ```ts
 * htmlTableCellText(String.raw`a \| \<img>`); // 'a | &lt;img&gt;'
 * ```
 */
export function htmlTableCellText(markdownCellText: string,): string {
  return escapeHtmlText(
    normalizeMarkdownEscapes(markdownCellText,)
      .trim(),
  );
}
