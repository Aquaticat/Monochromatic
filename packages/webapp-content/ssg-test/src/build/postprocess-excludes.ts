/**
 * Predicates that filter the leaf-asset set during fingerprinting.
 *
 * Extracted from `postprocess.ts` to keep the orchestrator under the
 * max-lines limit. The historical implementation was a `RegExp[]`; this
 * module provides equivalent suffix, substring, and hidden-directory
 * predicates with no regex usage.
 *
 * @module
 */

/**
 * Suffix-match exclusions; paths ending in any of these are skipped.
 */
const LEAF_EXCLUDE_SUFFIXES = [
  '.html',
  'styles.css',
  'manifest.webmanifest',
  'robots.txt',
  'rss.xml',
  '.mdx',
  '.tsbuildinfo',
  '.jsonl',
  '.zst',
] as const;

/**
 * Substring-match exclusions; paths containing any of these are skipped.
 */
const LEAF_EXCLUDE_SUBSTRINGS = [
  'pagefind/',
  'node_modules/',
  'final/',
] as const;

/**
 * Returns true when `filePath` contains a hidden-directory segment such
 * as `/.git/` or `/.cache/`. Slash-bounded so a leading dotfile basename
 * (no slash before) does not match.
 *
 * @param filePath - path to inspect
 *
 * @returns true when a slash-bounded hidden segment is present
 *
 * @example
 * ```ts
 * containsHiddenDirectory('a/.git/HEAD');   // true
 * containsHiddenDirectory('.envrc');        // false (no leading slash)
 * containsHiddenDirectory('a/./b');         // false (`.` is followed by `/`)
 * ```
 */
export function containsHiddenDirectory(filePath: string,): boolean {
  /**
   * Index of the first `/.` candidate; -1 means no hidden segment exists.
   */
  const dotSlashIdx = filePath.indexOf('/.',);
  if (dotSlashIdx === (-1))
    return false;
  /**
   * Character immediately after `/.`; an empty char or `/` means it is `/./`, not `/.name/`.
   */
  const charAfterDot = filePath.charAt(dotSlashIdx + 2,);
  if ((charAfterDot === '') || (charAfterDot === '/'))
    return containsHiddenDirectory(filePath.slice(dotSlashIdx + 1,),);
  /**
   * Position of the slash that closes the segment; segment is hidden only if a slash follows.
   */
  const closingSlash = filePath.indexOf(
    '/',
    dotSlashIdx + 2,
  );
  if (closingSlash === (-1))
    return containsHiddenDirectory(filePath.slice(dotSlashIdx + 1,),);
  return true;
}

/**
 * Predicate matching the historical `LEAF_EXCLUDES` regex array: returns
 * true when {@link filePath} should be skipped during leaf fingerprinting.
 *
 * @param filePath - candidate asset path
 *
 * @returns true when the path is excluded
 *
 * @example
 * ```ts
 * isLeafExcluded('dist/foo.html');       // true (suffix)
 * isLeafExcluded('dist/node_modules/x'); // true (substring)
 * isLeafExcluded('dist/foo.avif');       // false
 * ```
 */
export function isLeafExcluded(filePath: string,): boolean {
  if (LEAF_EXCLUDE_SUFFIXES.some(function endsWithSuffix(suffix,) {
    return filePath.endsWith(suffix,);
  },))
    return true;
  if (LEAF_EXCLUDE_SUBSTRINGS.some(function includesSubstring(needle,) {
    return filePath.includes(needle,);
  },))
    return true;
  return containsHiddenDirectory(filePath,);
}
