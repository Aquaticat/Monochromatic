/**
 * Plain-text and Markdown extractor.
 *
 * Reads a `File` or `Blob` as UTF-8. Markdown is treated as plain
 * text; no rendering, just text extraction for the LLM.
 */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- `file` is a Web `File`/`Blob` from the browser file picker; these are external SDK objects with mutating read methods (`.text()`, `.arrayBuffer()` consume the stream), so a readonly type would misdescribe the API contract. */
/**
 * Reads `file` as UTF-8 text.
 *
 * @param file - browser `File` from a file input or paste
 *
 * @returns full text contents
 *
 * @example
 * ```ts
 * const file = new File(['# Title\n\nbody'], 'note.md', { type: 'text/markdown' });
 * const text = await extractText(file);
 * // text === '# Title\n\nbody'
 * ```
 */
export async function extractText(file: File | Blob,): Promise<string> {
  return await file.text();
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
