import type { ArchiveOriginalSpan, } from '../archive-original-note.ts';

//region Archive-original publication completeness
// THE PAGE CARRIES EVERY SEALED SPAN AS THE ARCHIVE HAS IT, checked at
// publication rather than trusted from the preparation, for the same reason
// the front-matter guard recomputes its answer: a preparation that sealed a
// span and a lane that wrote over it anyway would otherwise ship the rewrite
// under a record saying it was sealed. Decided by the owner on 2026-09-08
// after the twelfth hakureico pass rewrote Hanasaka's letter in five places
// under a note saying the English was the original.
//
// BYTE FOR BYTE, since the seal's whole meaning is that no lane, no typography
// pass and no wrap touched the span. A page that carries the span's bytes at
// least once passes; it need not carry them at the recorded offsets, since
// the slices before the span may have grown or shrunk.

/**
 * Refusal when a sealed span does not reach the page as the archive has it.
 *
 * @example
 * ```ts
 * throw new ArchiveOriginalCompletenessError({ entryId: 'hakureico', spanIndex: 0, });
 * ```
 */
export class ArchiveOriginalCompletenessError extends Error {
  /**
   * Message names entry and span index only.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Builds refusal.
   *
   * @param entryId - entry refused
   *
   * @param spanIndex - which recorded span the page does not carry
   */
  public constructor(
    {
      entryId,
      spanIndex,
    }: {
      readonly entryId: string;
      readonly spanIndex: number;
    },
  ) {
    super(
      `entry ${entryId} page does not carry archive-original span ${String(spanIndex,)} as the archive has it`,
    );
    this.name = 'ArchiveOriginalCompletenessError';
  }
}

/**
 * Refuses a page that does not carry every sealed span byte for byte.
 *
 * @param entryId - entry being published
 *
 * @param archiveText - complete archive page the spans index into
 *
 * @param pageText - assembled page candidate
 *
 * @param spans - spans the preparation sealed, empty when none
 *
 * @throws {@link ArchiveOriginalCompletenessError} when a span's archive
 * bytes appear nowhere on the page
 *
 * @example
 * ```ts
 * assertArchiveOriginalComplete({ entryId, archiveText, pageText, spans: prepared.archiveOriginalSpans ?? [], },);
 * ```
 */
export function assertArchiveOriginalComplete(
  {
    entryId,
    archiveText,
    pageText,
    spans,
  }: {
    readonly entryId: string;
    readonly archiveText: string;
    readonly pageText: string;
    readonly spans: readonly ArchiveOriginalSpan[];
  },
): void {
  for (const [spanIndex, span,] of spans.entries()) {
    /**
     * The archive's bytes the seal covers.
     */
    const sealed = archiveText.slice(
      span.startOffset,
      span.endOffset,
    );
    if (!pageText.includes(sealed,))
      throw new ArchiveOriginalCompletenessError({
        entryId,
        spanIndex,
      },);
  }
}

//endregion Archive-original publication completeness
