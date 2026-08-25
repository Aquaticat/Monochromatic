import { readdir, } from 'node:fs/promises';

import { errorName, } from '../error-name.ts';

//region Directory listing
// Lists a directory without raising, and names WHY a listing failed in the
// terms an operator acts on.
//
// LIFTED OUT OF TWO COPIES on 2026-08-25, following the same rule
// `error-name.ts` records: `verify-published.ts` returned an empty array and
// printed the absence, and `editor-standing-read.ts` carried its own
// `DirectoryReading` union for the identical job. A third caller was about to
// be written for `#217`.
//
// NAMES THE FILESYSTEM REASON, NOT THE CLASS. Both copies reported
// `errorName`, which answers `Error` for every filesystem failure: a run
// directory that was never created and one whose permissions were changed read
// identically, while the remedies are "point at the right run" and "fix the
// mode". The `code` separates them and is a bounded token rather than a
// message, so it never quotes the path it failed on. A run directory path can
// name a person.

/**
 * What listing one directory produced.
 *
 * ABSENCE IS A KIND rather than an empty list of names, because the two decide
 * different things. A directory that holds nothing and a directory that is not
 * there both yield nothing to work on, but only one of them says the caller
 * was pointed somewhere real.
 *
 * @example
 * ```ts
 * const reading: DirectoryReading = { kind: 'read', names: [], };
 * ```
 */
export type DirectoryReading =
  | {
    readonly kind: 'read';

    /**
     * Everything the directory holds, in whatever order it gave them.
     */
    readonly names: readonly string[];
  }
  | {
    readonly kind: 'unreadable';

    /**
     * Filesystem reason, as a bounded token: `ENOENT`, `EACCES`, `ENOTDIR`.
     */
    readonly reason: string;
  };

/**
 * Narrows a caught value to one carrying a filesystem error code.
 *
 * POSITIONAL BY NECESSITY, against the house preference for a destructured
 * parameter: a type guard narrows the binding it names, and a parameter
 * destructured out of an object narrows nothing the caller holds.
 *
 * @param error - caught value, of unknown type by construction
 *
 * @returns Whether a `code` string can be read off it
 *
 * @example
 * ```ts
 * if (carriesFilesystemCode(error,))
 *   console.log(error.code,);
 * ```
 */
function carriesFilesystemCode(error: unknown,): error is { readonly code: string; } {
  return ((typeof error) === 'object')
    && (error !== null)
    && ('code' in error)
    && ((typeof error.code) === 'string');
}

/**
 * Names why an operation on a path failed, for a reader deciding what to do.
 *
 * @param error - caught value, of unknown type by construction
 *
 * @returns Filesystem code, falling back to the class where there is none
 *
 * @example
 * ```ts
 * console.log(filesystemReason({ error, },),);
 * ```
 */
export function filesystemReason(
  { error, }: { readonly error: unknown; },
): string {
  if (carriesFilesystemCode(error,))
    return error.code;
  return errorName({ error, },);
}

/**
 * Lists one directory, reporting an absent one rather than raising.
 *
 * @param dir - directory to list
 *
 * @returns Its names, or why it could not be listed
 *
 * @example
 * ```ts
 * const reading = await namesIn({ dir, },);
 * ```
 */
export async function namesIn(
  { dir, }: { readonly dir: string; },
): Promise<DirectoryReading> {
  try {
    return {
      kind: 'read',
      names: await readdir(dir,),
    };
  } catch (error) {
    return {
      kind: 'unreadable',
      reason: filesystemReason({ error, },),
    };
  }
}

//endregion Directory listing
