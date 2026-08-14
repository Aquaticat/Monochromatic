import {
  rename,
  writeFile,
} from 'node:fs/promises';

//region Atomic write
// Writing a file that a CONCURRENT READER may list at any moment.
//
// The accumulation runs for days into a directory every rate-producing reader
// globs. A direct write is visible while it is still partial, and a partial
// artifact is worse than an unreadable one here: the census classifies it as
// malformed, the pool keeps malformed files deliberately so the reader that
// reports them still sees them, and a later reader then parses a
// now-complete file and counts it without the generation checks it should have
// faced. The window is small and the consequence is a silently wrong
// denominator, which is this package's recurring failure.
//
// Rename within one directory is atomic on every filesystem this runs on, so a
// reader sees the file either absent or whole.

/**
 * Writes a file so no reader can observe it half-written.
 *
 * The temporary name carries the process id, so two passes writing the same
 * path cannot interleave into one another's partial file. It sits beside the
 * target rather than in a system temporary directory, because rename is only
 * atomic within a filesystem and the two can differ.
 *
 * @param path - final path the content should appear at
 *
 * @param text - complete file content
 *
 * @example
 * ```ts
 * await writeFileAtomic({ path, text, },);
 * ```
 */
export async function writeFileAtomic(
  {
    path,
    text,
  }: {
    readonly path: string;
    readonly text: string;
  },
): Promise<void> {
  /**
   * Path the content is built at before it takes its real name.
   */
  const partial = `${path}.${String(process.pid,)}.partial`;

  await writeFile(
    partial,
    text,
  );
  await rename(
    partial,
    path,
  );
}

//endregion Atomic write
