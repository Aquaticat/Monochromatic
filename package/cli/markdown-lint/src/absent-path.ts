/**
 Classify a filesystem failure as "the path does not exist", the one outcome
 the LFS helpers treat as ordinary rather than fatal.

 @module
 */

/**
 Node filesystem error code for absent paths.
 */
const FILE_NOT_FOUND_ERROR_CODE = 'ENOENT';

/**
 Whether a caught value is a Node filesystem error for an absent path. Any
 other failure (permissions, I/O) is not, so callers rethrow it.

 @param error - value caught from a filesystem call

 @returns `true` for `ENOENT`

 @example
 ```ts
 try {
   await stat(path);
 }
 catch (error) {
   if (!isAbsentPathError(error)) {
     throw error;
   }
 }
 ```
 */
export function isAbsentPathError(error: unknown,): boolean {
  if (!Error.isError(error,)) {
    return false;
  }
  if (!('code' in error)) {
    return false;
  }
  /**
   Node filesystem error code attached to the failure.
   */
  const { code, } = error as { readonly code: unknown; };
  return code === FILE_NOT_FOUND_ERROR_CODE;
}
