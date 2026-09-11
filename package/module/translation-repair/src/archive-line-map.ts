import { ArchiveNamingEvidenceError, } from './archive-naming-error.ts';
import type { ArchiveRetainedLine, } from './corpus-run/archive-stub.ts';

//region Normalization coordinate provenance
// Identical line text never selects an origin; retained positions carry that identity.

/**
 * One normalized line's original pinned-file position.
 *
 * @example
 * ```ts
 * const mapped = lineMap.get(startOffset);
 * ```
 */
export type ArchiveMappedLine = {
  /**
   * One-based position after normalization.
   */
  readonly lineNumber: number;
  /**
   * One-based pinned position before placeholder removal.
   */
  readonly pinnedLine: number;
  /**
   * Exact normalized line used only to check the positional join.
   */
  readonly text: string;
};

/**
 * Indexes the actual normalizer's retained positions by normalized character offset.
 *
 * @param lines - ordered records emitted by the shared normalization operation
 *
 * @param archiveText - exact output of that same operation
 *
 * @param relPath - archive named for inconsistent provenance
 *
 * @returns Positional map preserving duplicate lines and removed blank-line shifts
 *
 * @throws {@link ArchiveNamingEvidenceError} for malformed normalization provenance
 *
 * @example
 * ```ts
 * const lineMap = archiveLineMap({ lines, archiveText, relPath });
 * ```
 */
export function archiveLineMap({ lines, archiveText, relPath, }: {
  readonly lines: readonly ArchiveRetainedLine[];
  readonly archiveText: string;
  readonly relPath: string;
},): ReadonlyMap<number, ArchiveMappedLine> {
  /**
   * Coordinate records must reconstruct the exact normalized archive.
   */
  const reconstructed = lines.map(function lineText(line,): string {
    return line.text;
  },).join('\n',);
  if (reconstructed !== archiveText)
    throw new ArchiveNamingEvidenceError({ kind: 'archive-mismatch', relPath, },);
  /**
   * Owned coordinate index.
   */
  const mapped = new Map<number, ArchiveMappedLine>();
  /**
   * Monotone physical and normalized positions advanced once per retained line.
   */
  const cursor = { offset: 0, pinnedLine: 0, normalizedLine: 0, };
  for (const line of lines) {
    if (!Number.isSafeInteger(line.lineNumber,) || line.lineNumber <= cursor.pinnedLine)
      throw new ArchiveNamingEvidenceError({ kind: 'archive-mismatch', relPath, },);
    cursor.normalizedLine += 1;
    mapped.set(cursor.offset, {
      lineNumber: cursor.normalizedLine,
      pinnedLine: line.lineNumber,
      text: line.text,
    },);
    cursor.offset += line.text.length + 1;
    cursor.pinnedLine = line.lineNumber;
  }
  return mapped;
}

//endregion Normalization coordinate provenance
