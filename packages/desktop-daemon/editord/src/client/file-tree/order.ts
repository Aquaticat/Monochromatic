/**
 * CSS `order` computation for file tree entries.
 *
 * Encodes the first few characters of a lowercased filename as a base-128
 * integer. Equal `order` values preserve DOM (readdir) order as a tiebreaker.
 *
 * @example
 * ```ts
 * element.style.order = String(nameToOrder({ name: 'index.ts' }));
 * ```
 */

/** Number of leading characters encoded into the order value. */
const ORDER_CHARS = 4;

/** Base for character encoding (7-bit ASCII covers all printable chars). */
const ORDER_BASE = 128;

/**
 * Converts a filename to a CSS `order` integer for visual sorting.
 *
 * Encodes the first {@link ORDER_CHARS} lowercase characters as a
 * base-{@link ORDER_BASE} number. Directories and files are treated
 * identically — both sort alphabetically by name.
 *
 * @param name - entry name (not full path)
 *
 * @returns integer suitable for the CSS `order` property
 */
export function nameToOrder({ name, }: { name: string; },): number {
  const lower = name.toLowerCase();
  const limit = Math.min(
    lower.length,
    ORDER_CHARS,
  );
  // Mutable accumulator shifted left by ORDER_BASE per character
  let order = 0;
  for (let index = 0; index < limit; index++)
    order = order * ORDER_BASE + (lower.codePointAt(index,) ?? 0);
  return order;
}
