/**
 * Plain-text and Markdown extractor.
 *
 * Reads a `File` or `Blob` as UTF-8. Markdown is treated as plain
 * text; no rendering, just text extraction for the LLM.
 */

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
