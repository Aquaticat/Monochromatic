/**
 * Shared path and string helpers for mutation-test orchestration.
 *
 * @example
 * ```ts
 * toPosixPath('src\\file.ts');
 * ```
 */

import {
  relative as relativePath,
  sep,
} from 'node:path';

/**
 * POSIX path separator used by container paths and Stryker config globs.
 */
const POSIX_SEPARATOR = '/';

/**
 * Windows path separator string replaced when normalising host paths.
 */
const WINDOWS_SEPARATOR = '\\';

/**
 * Characters allowed inside local container image tag fragments.
 */
const TAG_SAFE_CHARACTERS = new Set([
  ...'abcdefghijklmnopqrstuvwxyz',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'0123456789',
  '.',
  '_',
  '-',
],);

/**
 * Converts any platform path separators to POSIX separators.
 *
 * @param path - Host or container path to normalise.
 *
 * @returns Path with `/` separators.
 *
 * @example
 * ```ts
 * toPosixPath('src\\index.ts');
 * // 'src/index.ts'
 * ```
 */
export function toPosixPath(path: string,): string {
  return path.split(WINDOWS_SEPARATOR,).join(POSIX_SEPARATOR,);
}

/**
 * Computes POSIX relative path from a host root to a descendant path.
 *
 * @param options - Base and descendant paths.
 *
 * @returns Relative path with `/` separators.
 *
 * @example
 * ```ts
 * relativePosix({ from: '/repo/pkg', to: '/repo/pkg/src/a.ts' });
 * // 'src/a.ts'
 * ```
 */
export function relativePosix(options: {
  readonly from: string;
  readonly to: string;
},): string {
  return toPosixPath(relativePath(
    options.from,
    options.to,
  ),);
}

/**
 * Returns true when a path is relative and stays inside its base directory.
 *
 * @param relative - Relative path candidate.
 *
 * @returns Whether candidate avoids absolute roots and parent traversal.
 *
 * @example
 * ```ts
 * isSafeRelativePath('src/a.ts');
 * // true
 * ```
 */
export function isSafeRelativePath(relative: string,): boolean {
  return (relative !== '')
    && !relative.startsWith(POSIX_SEPARATOR,)
    && !relative.startsWith(`.${POSIX_SEPARATOR}`,)
    && !relative.includes(`${POSIX_SEPARATOR}..${POSIX_SEPARATOR}`,)
    && !relative.endsWith(`${POSIX_SEPARATOR}..`,)
    && (relative !== '..')
    && !relative.split(sep,).includes('..',);
}

/**
 * Sorts strings by code point without mutating caller-owned arrays.
 *
 * @param values - Strings to sort.
 *
 * @returns New sorted array.
 *
 * @example
 * ```ts
 * sortStrings(['b', 'a']);
 * // ['a', 'b']
 * ```
 */
export function sortStrings(values: readonly string[],): readonly string[] {
  return [...values,].sort(function compareStrings(
    left,
    right,
  ): number {
    return left.localeCompare(right, 'en',);
  },);
}

/**
 * Removes a `.ts` suffix from a TypeScript path when present.
 *
 * @param path - Path whose stem is needed.
 *
 * @returns Path without final `.ts` suffix.
 *
 * @example
 * ```ts
 * stripTsExtension('src/a.ts');
 * // 'src/a'
 * ```
 */
export function stripTsExtension(path: string,): string {
  return path.endsWith('.ts',) ? path.slice(0, -'.ts'.length,) : path;
}

/**
 * Returns basename without a TypeScript suffix.
 *
 * @param path - POSIX path.
 *
 * @returns Final segment without `.ts`.
 *
 * @example
 * ```ts
 * basenameWithoutTs('src/a.ts');
 * // 'a'
 * ```
 */
export function basenameWithoutTs(path: string,): string {
  const parts = toPosixPath(path,).split(POSIX_SEPARATOR,);
  const last = parts.at(-1,) ?? path;
  return stripTsExtension(last,);
}

/**
 * Returns parent directory of a POSIX path.
 *
 * @param path - POSIX path.
 *
 * @returns Parent directory or `.` when path has no parent segment.
 *
 * @example
 * ```ts
 * dirnamePosix('src/a.ts');
 * // 'src'
 * ```
 */
export function dirnamePosix(path: string,): string {
  const parts = toPosixPath(path,).split(POSIX_SEPARATOR,);
  const parentParts = parts.slice(0, -1,);
  return parentParts.length === 0 ? '.' : parentParts.join(POSIX_SEPARATOR,);
}

/**
 * Converts arbitrary text into a local image-tag-safe fragment.
 *
 * @param value - Raw value to sanitise.
 *
 * @returns Value containing only OCI tag-safe characters used here.
 *
 * @example
 * ```ts
 * sanitizeTagFragment('linux/arm64');
 * // 'linux-arm64'
 * ```
 */
export function sanitizeTagFragment(value: string,): string {
  return [...value,]
    .map(function mapCharacter(character,): string {
      return TAG_SAFE_CHARACTERS.has(character,) ? character : '-';
    },)
    .join('',);
}

/**
 * Converts bytes to a lower-case hexadecimal string.
 *
 * @param bytes - Bytes to encode.
 *
 * @returns Hexadecimal representation.
 *
 * @example
 * ```ts
 * bytesToHex(new Uint8Array([15]));
 * // '0f'
 * ```
 */
export function bytesToHex(bytes: Uint8Array,): string {
  return [...bytes,]
    .map(function byteToHex(byte,): string {
      return byte.toString(16,).padStart(2, '0',);
    },)
    .join('',);
}
