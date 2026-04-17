/**
 * Resolves the on-wire transfer size for an asset.
 *
 * When a `.zst` companion exists alongside the requested file,
 * its size is returned instead -- this mirrors file servers that
 * serve pre-compressed variants when the client advertises zstd support.
 * Otherwise the raw file size is returned.
 */
import { stat, } from 'node:fs/promises';

/**
 * Returns `true` if the path exists and is a regular file, `false` otherwise.
 *
 * Any error accessing the path (permissions, I/O) also yields `false`.
 *
 * @param absolutePath - absolute filesystem path to probe
 *
 * @returns whether the path resolves to a readable file
 *
 * @example
 * ```ts
 * if (await fileReadable('/srv/www/index.html')) { ... }
 * ```
 */
async function fileReadable(
  absolutePath: string,
): Promise<boolean> {
  try {
    const info = await stat(absolutePath,);
    return info.isFile();
  }
  catch {
    return false;
  }
}

/**
 * Resolves the wire size of a file, preferring a `.zst` companion when present.
 *
 * If `path.zst` exists as a regular file, its size is returned.
 * Otherwise the raw size of `path` is returned.
 * Returns `null` when neither form exists, letting callers decide how to handle
 * dead references instead of silently zero-counting them.
 *
 * @param absolutePath - absolute path to the originally-requested asset
 *
 * @returns wire size in bytes, or `null` if the file is missing
 *
 * @example
 * ```ts
 * const bytes = await wireSize('/srv/www/styles.css');
 * ```
 */
export async function wireSize(
  absolutePath: string,
): Promise<number | null> {
  const zstPath = `${absolutePath}.zst`;
  if (await fileReadable(zstPath,)) {
    const info = await stat(zstPath,);
    return info.size;
  }
  if (await fileReadable(absolutePath,)) {
    const info = await stat(absolutePath,);
    return info.size;
  }
  return null;
}
