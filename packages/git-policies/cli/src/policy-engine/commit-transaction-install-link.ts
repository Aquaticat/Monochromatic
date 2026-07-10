/**
 * Owner-preserving hard-link installation for real Git indexes.
 *
 * @module
 */
import {
  link,
  lstat,
  rm,
} from 'node:fs/promises';

/**
 * Creates private hard link and proves it names exact owned file inode.
 *
 * @param sourcePath - current owned file path
 *
 * @param linkedPath - private same-filesystem stable name
 *
 * @param expectedDevice - original device identity
 *
 * @param expectedInode - original inode identity
 *
 * @example
 * ```ts
 * await createOwnedFileLink({ sourcePath, linkedPath, expectedDevice, expectedInode });
 * ```
 */
export async function createOwnedFileLink({
  sourcePath,
  linkedPath,
  expectedDevice,
  expectedInode,
}: Readonly<{
  sourcePath: string;
  linkedPath: string;
  expectedDevice: string;
  expectedInode: string;
}>,): Promise<void> {
  await rm(
    linkedPath,
    { force: true, },
  );
  await link(
    sourcePath,
    linkedPath,
  );
  /**
   * Non-followed metadata for exact private stable name.
   */
  const metadata = await lstat(
    linkedPath,
    { bigint: true, },
  );
  if ((!metadata.isFile())
    || metadata.isSymbolicLink()
    || (String(metadata.dev,) !== expectedDevice)
    || (String(metadata.ino,) !== expectedInode)) {
    await rm(
      linkedPath,
      { force: true, },
    );
    throw new TypeError(`Commit transaction file link identity changed: ${linkedPath}`,);
  }
}
