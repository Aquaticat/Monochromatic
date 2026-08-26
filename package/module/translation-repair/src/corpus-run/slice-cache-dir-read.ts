import {
  readdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import type { SliceNamespace, } from './slice-cache-claims.ts';

//region Slice cache directory reads
// The two reads every lane's cache starts with: what is in the entry
// directory, and which generation this lane last stamped there. Lifted out of
// `slice-cache-namespace.ts` for the line cap; that module re-exports them, so
// no call site moved.

/**
 * Lists a directory, reporting an absent one as empty.
 *
 * @param dir - directory to list
 *
 * @returns File names, empty when the directory does not exist
 *
 * @example
 * ```ts
 * const names = await readDirectoryNames({ dir, },);
 * ```
 */
export async function readDirectoryNames(
  { dir, }: { readonly dir: string; },
): Promise<readonly string[]> {
  try {
    return await readdir(dir,);
  }
  catch (error) {
    // An absent directory (ENOENT) means no prior progress; anything else is a
    // real fault and must surface.
    if (Error.isError(error,)
      && ('code' in error)
      && (error.code === 'ENOENT'))
      return [];
    throw error;
  }
}

/**
 * Reads the pipeline that filled one lane's slices.
 *
 * @param dir - per-entry cache directory
 *
 * @param namespace - lane asking
 *
 * @returns Recorded digest, empty when this lane never wrote here
 *
 * @throws Error when the marker exists and cannot be read, since treating an
 * unreadable marker as absent would DELETE the lane's settled slices
 *
 * @example
 * ```ts
 * const cached = await readNamespaceGeneration({ dir, namespace, },);
 * ```
 */
export async function readNamespaceGeneration(
  {
    dir,
    namespace,
  }: {
    readonly dir: string;
    readonly namespace: SliceNamespace;
  },
): Promise<string> {
  try {
    /**
     * Raw marker text, including its trailing newline.
     */
    const text = await readFile(
      join(
        dir,
        namespace.marker,
      ),
      'utf8',
    );
    return text.trim();
  }
  catch (error) {
    // Absent is the ordinary state for a lane that has not written here yet.
    // Anything else, a permission fault above all, must NOT read as absent:
    // that answer discards every settled slice this lane owns.
    if (Error.isError(error,)
      && ('code' in error)
      && (error.code === 'ENOENT'))
      return '';
    throw error;
  }
}

//endregion Slice cache directory reads
