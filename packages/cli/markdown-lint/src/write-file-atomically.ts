import { randomUUID, } from 'node:crypto';
import {
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import {
  basename,
  dirname,
  join,
} from 'node:path';

/**
 * Permission bits preserved when atomically replacing a file. `stat.mode` also
 * includes file-type bits, but `writeFile` expects only the permission mask.
 */
const FILE_PERMISSION_BITS = 0o777;

/**
 * Filename marker for temporary replacements owned by markdown-lint.
 */
const TEMPORARY_FILE_NAME_MARKER = 'markdown-lint';

/**
 * Parameters for {@link writeFileAtomically}.
 */
type WriteFileAtomicallyParams = {
  /**
   * Destination file.
   */
  readonly path: string;
  /**
   * Complete replacement source.
   */
  readonly source: string;
  /**
   * Original file mode to preserve on the replacement.
   */
  readonly mode: number;
};

/**
 * Remove a temporary file created during atomic replacement.
 *
 * @param path - temporary file path
 *
 * @example
 * ```ts
 * await removeTempFile('/tmp/.README.md.markdown-lint-1-example.tmp');
 * ```
 */
async function removeTempFile(path: string,): Promise<void> {
  await rm(
    path,
    { force: true, },
  );
}

/**
 * Write fixed contents through a same-directory temporary file and atomic
 * rename. `fs.writeFile(path, ...)` opens with truncation, so a process crash or
 * uncaught sibling error can leave the target at zero bytes. A temp file keeps
 * the original intact until the complete replacement is ready.
 *
 * @param path - destination file
 *
 * @param source - fixed contents to write
 *
 * @param mode - original file mode to preserve on the replacement
 *
 * @example
 * ```ts
 * await writeFileAtomically({ path: 'README.md', source: '# Title\n', mode: 0o644 });
 * ```
 */
export async function writeFileAtomically({
  path,
  source,
  mode,
}: WriteFileAtomicallyParams,): Promise<void> {
  /**
   * Same-directory temporary path, so final rename is on same device.
   */
  const tempPath = join(
    dirname(path,),
    `.${basename(path,)}.${TEMPORARY_FILE_NAME_MARKER}-${process.pid}-${randomUUID()}.tmp`,
  );
  try {
    await writeFile(
      tempPath,
      source,
      { mode: mode & FILE_PERMISSION_BITS, },
    );
    await rename(
      tempPath,
      path,
    );
  } catch (error) {
    await removeTempFile(tempPath,);
    throw error;
  }
}
