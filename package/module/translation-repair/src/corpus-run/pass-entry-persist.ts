import { join, } from 'node:path';

import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { ChunkPair, } from '../chunk-document.ts';
import type { SettledArtifact, } from './artifact-two-lane-contract.ts';
import { writeFileAtomic, } from './atomic-write.ts';
import type { DestinationCheck, } from './dropped-destinations.ts';
import { assertFinalNaturalnessComplete, } from './final-naturalness-completeness.ts';
import { assertFinalSelectionSettled, } from './final-selection-completeness.ts';
import { publishFixedPage, } from './publish-fixed.ts';

//region Pass entry persistence
// Publication precedes artifact persistence so artifact remains done sentinel:
// a pass never skips an entry whose page write did not complete.

/**
 * Publishes one settled page, then persists artifact that makes entry skippable.
 *
 * @param artifact - settled evidence and chosen wordings
 *
 * @param slices - preparation spans used to splice page
 *
 * @param archiveText - English page before changes
 *
 * @param sourceText - original page used for destination check
 *
 * @param entryId - corpus entry being persisted
 *
 * @param publishDir - mirrored page root
 *
 * @param artifactsDir - settled artifact root
 *
 * @param l - entry logger
 *
 * @returns Destination comparison from published page
 *
 * @example
 * ```ts
 * const destinations = await persistSettledEntry({ artifact, slices, archiveText, sourceText, entryId, publishDir, artifactsDir, l, },);
 * ```
 */
export async function persistSettledEntry(
  {
    artifact,
    slices,
    archiveText,
    sourceText,
    entryId,
    publishDir,
    artifactsDir,
    l,
  }: ForeignBorrowed<{
    readonly artifact: SettledArtifact;
    readonly slices: readonly ChunkPair[];
    readonly archiveText: string;
    readonly sourceText: string;
    readonly entryId: string;
    readonly publishDir: string;
    readonly artifactsDir: string;
    readonly l: Logger;
  }>,
): Promise<DestinationCheck> {
  // FIRST MUTATION SITS BELOW THIS LINE. A contest decline cannot become
  // approval merely because final assembly still has archive bytes available.
  assertFinalSelectionSettled({
    entryId,
    artifact,
  },);
  assertFinalNaturalnessComplete({ artifact, },);

  /**
   * Page write and its source-destination comparison.
   */
  const published = await publishFixedPage({
    artifact,
    slices,
    archiveText,
    sourceText,
    entryId,
    publishDir,
    l,
  },);
  await writeFileAtomic({
    path: join(
      artifactsDir,
      `${entryId}.json`,
    ),
    text: `${JSON.stringify(
      artifact,
      undefined,
      2,
    )}\n`,
  },);
  return published.destinations;
}

//endregion Pass entry persistence
