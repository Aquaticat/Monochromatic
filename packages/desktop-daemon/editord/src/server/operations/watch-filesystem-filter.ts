/**
 * Filtering constants and helpers for the directory watcher.
 *
 * Centralizes ignore logic so the watcher module stays under the line limit.
 */

/** Entry names always ignored (VCS dirs, OS metadata). */
const IGNORED_NAMES = new Set([
  '.git',
  'node_modules',
  '.DS_Store',
  'Thumbs.db',
],);

/** Pattern matching editor swap/temp files. */
const IGNORED_PATTERN = /\.swp$|~$|^\.#|^#.*#$|^4913$/;

/**
 * Returns whether a filename should be silently ignored by the watcher.
 *
 * @param name - entry name (not full path)
 *
 * @returns true when the name matches a known noise source
 */
export function isIgnored({ name, }: { name: string; },): boolean {
  return IGNORED_NAMES.has(name,) || IGNORED_PATTERN.test(name,);
}

/** Debounce window in milliseconds for coalescing rapid filesystem events. */
export const DEBOUNCE_MS = 200;

/**
 * Suppression window in milliseconds.
 * After a self-triggered save, events for that path are ignored for this duration.
 */
export const SUPPRESS_MS = 500;
