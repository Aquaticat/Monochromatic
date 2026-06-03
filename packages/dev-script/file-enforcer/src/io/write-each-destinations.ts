import type { GlobResults, } from './cat.ts';
import { mirrorGlobPath, } from './glob.ts';
import type { StalenessDestination, } from './staleness.ts';
import type { WriteIfChanged, } from './write-lazy.ts';

/**
 * Destination mapped from a glob result.
 */
export type GlobDestination = StalenessDestination & {
  /**
   * Source file path used in write logs.
   */
  readonly sourcePath: string;
};

/**
 * Maps glob results to concrete destination paths.
 *
 * @param destGlob - Destination glob pattern.
 *
 * @param files - Source glob results.
 *
 * @returns Concrete destinations with source paths for logging.
 *
 * @example
 * ```ts
 * const destinations = destinationsForFiles({ destGlob, files });
 * ```
 */
export function destinationsForFiles(
  {
    destGlob,
    files,
  }: {
    readonly destGlob: string;
    readonly files: GlobResults;
  },
): readonly GlobDestination[] {
  return files.map(function destinationForFile(file,): GlobDestination {
    return {
      path: mirrorGlobPath({
        sourcePattern: files.sourceGlob,
        destPattern: destGlob,
        sourcePath: file.path,
      },),
      content: file.content,
      sourcePath: file.path,
    };
  },);
}

/**
 * Reconciles concrete glob destinations.
 *
 * @param destinations - Concrete destinations with content.
 *
 * @param writeIfChanged - Reconciliation function from `write.ts`.
 *
 * @param recordStaleness - Whether each destination write should record eager staleness metadata.
 *
 * @example
 * ```ts
 * await writeGlobDestinations({ destinations, writeIfChanged });
 * ```
 */
export async function writeGlobDestinations(
  {
    destinations,
    writeIfChanged,
    recordStaleness,
  }: {
    readonly destinations: readonly GlobDestination[];
    readonly writeIfChanged: WriteIfChanged;
    readonly recordStaleness?: boolean;
  },
): Promise<void> {
  await Promise.all(
    destinations.map(async function writeOneDestination(destination,): Promise<void> {
      await writeIfChanged(recordStaleness === undefined
        ? {
          dest: destination.path,
          content: destination.content,
          sourcePath: destination.sourcePath,
        }
        : {
          dest: destination.path,
          content: destination.content,
          sourcePath: destination.sourcePath,
          recordStaleness,
        },);
    },),
  );
}
