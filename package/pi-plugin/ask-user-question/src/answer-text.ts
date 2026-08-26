//region Answer normalization

/**
 * Removes one editor-added final line ending while preserving every other character.
 *
 * @param text - raw UTF-8 editor text
 *
 * @returns text without at most one final LF or CRLF
 *
 * @example
 * ```ts
 * normalizeEditorAnswer({ text: 'first\nsecond\n' });
 * ```
 */
export function normalizeEditorAnswer(
  { text, }: { readonly text: string; },
): string {
  if (text.endsWith('\r\n',))
    return text.slice(
      0,
      -2,
    );
  if (text.endsWith('\n',))
    return text.slice(
      0,
      -1,
    );
  return text;
}

/**
 * Determines whether normalized editor content carries no visible answer.
 *
 * @param text - normalized editor text
 *
 * @returns whether text contains only whitespace
 *
 * @example
 * ```ts
 * isBlankAnswer({ text: '  \n' });
 * ```
 */
export function isBlankAnswer(
  { text, }: { readonly text: string; },
): boolean {
  return text.trim()
    .length
    === 0;
}

//endregion Answer normalization
