import type { Dirent, } from 'node:fs';
import {
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import {
  join,
  relative,
  sep,
} from 'node:path';

import { ZipWriter, } from '../../module/zip-writer/src/index.ts';

/**
 * Output plugin archive path relative to package root.
 *
 * @example
 * ```ts
 * await writeFile(JAR_PATH, zipWriter.build(),);
 * ```
 */
const JAR_PATH = 'islands-black.jar';

/**
 * Plugin directories included in installable archive.
 *
 * @example
 * ```ts
 * const entries = (await Promise.all(ARCHIVE_ROOTS.map(listRoot,),)).flat();
 * ```
 */
const ARCHIVE_ROOTS = [
  'META-INF',
  'theme',
  'scheme',
] as const;

/**
 * Fixed modification time for byte-for-byte reproducible builds.
 *
 * @example
 * ```ts
 * const zipWriter = new ZipWriter({ modifiedAt: REPRODUCIBLE_MODIFIED_AT, },);
 * ```
 */
const REPRODUCIBLE_MODIFIED_AT = new Date('2024-01-01T00:00:00Z',);

/**
 * File queued for inclusion in plugin archive.
 *
 * @example
 * ```ts
 * const entry: ArchiveEntry = { archivePath: 'META-INF/plugin.xml', diskPath: 'META-INF/plugin.xml', };
 * ```
 */
type ArchiveEntry = Readonly<{
  archivePath: string;
  diskPath: string;
}>;

/**
 * Sort directory entries by name for deterministic archive entry order.
 *
 * @param left - Left directory entry supplied by array sort comparison
 * @param right - Right directory entry supplied by array sort comparison
 * @returns Negative, zero, or positive comparison value
 *
 * @example
 * ```ts
 * directoryEntries.toSorted(compareDirentNames,);
 * ```
 */
function compareDirentNames(
  left: Dirent,
  right: Dirent,
): number {
  return left.name.localeCompare(right.name,);
}

/**
 * Convert platform-native package path to ZIP-standard forward-slash path.
 *
 * @param args.diskPath - Package-relative path on local filesystem
 * @returns Archive entry path with forward slash separators
 *
 * @example
 * ```ts
 * toArchivePath({ diskPath: join('META-INF', 'plugin.xml',), });
 * ```
 */
function toArchivePath({ diskPath, }: Readonly<{ diskPath: string; }>,): string {
  return relative(
    '.',
    diskPath,
  )
    .split(sep,)
    .join('/',);
}

/**
 * Recursively list regular files under root directory for archive inclusion.
 *
 * @param args.root - Directory path to scan
 * @returns Archive entries sorted by package-relative path
 *
 * @throws When input tree contains unsupported special files
 *
 * @example
 * ```ts
 * const entries = await listArchiveEntries({ root: 'META-INF', },);
 * ```
 */
async function listArchiveEntries({ root, }: Readonly<{ root: string; }>,): Promise<readonly ArchiveEntry[]> {
  /**
   * Directory entries found immediately under current root.
   */
  const directoryEntries = await readdir(
    root,
    { withFileTypes: true, },
  );
  /**
   * Directory entries sorted before traversal to keep archive deterministic.
   */
  const sortedDirectoryEntries = directoryEntries.toSorted(compareDirentNames,);
  /**
   * Per-entry archive fragments, flattened before returning.
   */
  const archiveEntryGroups = await Promise.all(
    sortedDirectoryEntries.map(async function archiveEntriesForDirent(
      dirent: Dirent,
    ): Promise<readonly ArchiveEntry[]> {
      /**
       * Package-relative disk path for current directory entry.
       */
      const diskPath = join(
        root,
        dirent.name,
      );
      if (dirent.isDirectory())
        return listArchiveEntries({ root: diskPath, },);
      if (dirent.isFile()) {
        return [
          {
            archivePath: toArchivePath({ diskPath, },),
            diskPath,
          },
        ];
      }
      throw new Error(`Unsupported plugin archive input: ${diskPath}`,);
    },),
  );
  return archiveEntryGroups.flat();
}

/**
 * Archive entries for all plugin roots in deterministic root order.
 */
const archiveEntries = (await Promise.all(
  ARCHIVE_ROOTS.map(async function archiveEntriesForRoot(root: string,): Promise<readonly ArchiveEntry[]> {
    return listArchiveEntries({ root, },);
  },),
)).flat();

/**
 * ZIP writer used to create installable JetBrains plugin JAR.
 */
const zipWriter = new ZipWriter({ modifiedAt: REPRODUCIBLE_MODIFIED_AT, },);

for (const archiveEntry of archiveEntries) {
  /**
   * File bytes copied verbatim into archive entry.
   */
  const content = await readFile(archiveEntry.diskPath,);
  zipWriter.add(
    archiveEntry.archivePath,
    content,
  );
}

await writeFile(
  JAR_PATH,
  zipWriter.build(),
);

console.info(`Built ${JAR_PATH} with ${archiveEntries.length} files.`,);
