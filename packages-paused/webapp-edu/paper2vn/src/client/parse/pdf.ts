/**
 * PDF text extractor backed by pdfjs-dist.
 *
 * Runs without a worker so the bundle stays single-file. Worker mode
 * would require shipping `pdf.worker.mjs` as a separate asset or
 * inlining it as a Blob URL; both add bundle weight without a clear
 * benefit for the typical paper size.
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Extracted PDF text-item shape we care about.
 */
type TextItem = {
  /**
   * Raw glyph string.
   */
  str: string;

  /**
   * Whether the item ends a line (heuristic).
   */
  hasEOL?: boolean;
};

/**
 * Extracts plain text from a PDF file.
 *
 * @param file - browser `File` / `Blob` containing the PDF
 *
 * @returns concatenated page text separated by blank lines
 *
 * @throws when pdfjs cannot parse the document
 *
 * @example
 * ```ts
 * const file = inputEl.files[0];
 * const text = await extractPdf(file);
 * // text is the concatenated plain-text of each page, blank-line separated
 * ```
 */
export async function extractPdf(file: File | Blob,): Promise<string> {
  /**
   * PDF bytes pulled into memory before pdfjs takes a typed-array view.
   */
  const buf = await file.arrayBuffer();
  // pdfjs has no documented `disableWorker` flag; setting `workerPort`
  // to a stub is the supported escape, but for the legacy build the
  // simplest reliable single-file path is to leave the worker
  // unconfigured; pdfjs falls back to a fake worker that runs on
  // the main thread when nothing is registered.
  /**
   * Parsed pdfjs document handle, source of per-page text content.
   */
  const doc = await pdfjs
    .getDocument({
      data: new Uint8Array(buf,),
    },)
    .promise;
  /**
   * 1-based page numbers materialised so per-page extraction can run via map.
   */
  const pageNumbers = Array.from(
    { length: doc.numPages, },
    function indexToPageNo(
      _unused: unknown,
      i: number,
    ): number {
      return i + 1;
    },
  );
  /**
   * Trimmed per-page text strings, joined on return.
   */
  const pages = await Promise.all(pageNumbers.map(async function pageText(
    pageNo: number,
  ): Promise<string> {
    /**
     * Single pdfjs page proxy for the current page number.
     */
    const page = await doc.getPage(pageNo,);
    /**
     * Raw text content payload for the current page.
     */
    const content = await page.getTextContent();
    /*
     * pdfjs's `TextContent.items` is typed as `(TextItem | TextMarkedContent)[]`
     * via the wider build types; the legacy build only emits text items
     * for our consumption pattern. Treat as the narrow type and read
     * defensively (`hasEOL` is optional in our local type).
     */
    /* oxlint-disable typescript-eslint/no-unsafe-type-assertion -- narrowing widened pdfjs union to the legacy-only shape */
    /**
     * Narrow view of the text-item array used by the join logic below.
     */
    const items = content.items as readonly TextItem[];
    /* oxlint-enable typescript-eslint/no-unsafe-type-assertion */
    /* oxlint-disable no-restricted-syntax/no-regex -- Two replaceAll passes normalize whitespace in joined PDF page text: collapse horizontal-whitespace runs to a single space, then cap consecutive newlines at two. Character-class and quantifier regex are the clearest forms; PDF input is bounded so no backtracking surface. */
    return items
      .map(function pickStr(it: Readonly<TextItem>,): string {
        return it.hasEOL
          === true ? `${it.str}\n` : `${it.str} `;
      },)
      .join('',)
      .replaceAll(
        /[ \t]+/gu,
        ' ',
      )
      .replaceAll(
        /\n{3,}/gu,
        '\n\n',
      )
      .trim();
    /* oxlint-enable no-restricted-syntax/no-regex */
  },),);
  return pages.join('\n\n',);
}
