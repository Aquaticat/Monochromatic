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

/**
 * Number of leading characters encoded into the order value.
 */
const ORDER_CHARS = 4;

/**
 * Base for character encoding (7-bit ASCII covers all printable chars).
 */
const ORDER_BASE = 128;

/**
 * Converts a filename to a CSS `order` integer for visual sorting.
 *
 * Encodes the first {@link ORDER_CHARS} lowercase characters as a
 * base-{@link ORDER_BASE} number. Directories and files are treated
 * identically: both sort alphabetically by name.
 *
 * @param name - entry name (not full path)
 *
 * @returns integer suitable for the CSS `order` property
 *
 * @example
 * ```ts
 * const result = nameToOrder({ name: 'utils.ts', });
 * ```
 */
export function nameToOrder({ name, }: { readonly name: string; },): number {
  /**
   * Case-folded copy keeps mixed-case sibling files sorted alphabetically.
   */
  const lower = name.toLowerCase();
  /**
   * Capped iteration count keeps the accumulator below Number.MAX_SAFE_INTEGER.
   */
  const limit = Math.min(
    lower.length,
    ORDER_CHARS,
  );
  // Mutable accumulator shifted left by ORDER_BASE per character
  /**
   * Built up as a base-{@link ORDER_BASE} number from the first `limit` code points.
   */
  let order = 0;
  for (let index = 0; index < limit; index++)
    order = (order * ORDER_BASE) + (lower.codePointAt(index,)
      ?? 0);
  return order;
}
