/**
 * Tiny helpers shared by the Phase 2 seed modules: deterministic ids,
 * synthetic SHAs, common constants. Pulled out of `generate-phase2.ts`
 * so each per-resource seeding module stays under the max-lines budget.
 */

/**
 * SHA hex string length (40 chars for SHA-1).
 */
export const SHA_HEX_LENGTH = 40;

/**
 * Number base for hex SHA derivation.
 */
export const HEX_RADIX = 16;

/**
 * SHA hex chunk length (8 hex chars per `Number.prototype.toString(16)` round).
 */
export const SHA_HEX_CHUNK = 8;

/**
 * PR number offset so generated PRs do not collide with regular issue numbers.
 */
export const PR_NUMBER_BASE = 100_000;

/**
 * Composes a deterministic id of the form `<prefix>-<index>`, mirroring
 * the helper Phase 1's seed package uses.
 *
 * @param row - prefix and numeric index
 *
 * @returns composed id
 *
 * @example
 * ```ts
 * deterministicId({ prefix: 'milestone', index: 0 }); // 'milestone-0'
 * ```
 */
export function deterministicId(row: {
  prefix: string;
  index: number;
},): string {
  return `${row.prefix}-${String(row.index,)}`;
}

/**
 * Generates a deterministic 40-character hex SHA from a seed.
 *
 * @param seed - RNG seed
 *
 * @returns 40-char lowercase hex string
 *
 * @example
 * ```ts
 * fakeSha(0); // 40 lowercase hex chars, deterministic for seed 0
 * ```
 */
export function fakeSha(seed: number,): string {
  /**
   * Appends hex chunks recursively until the SHA hex target length is reached,
   * threading the rolling integer state without function-root lets.
   *
   * @param row - accumulated hex string and rolling integer state
   *
   * @returns accumulated SHA hex string clipped to the target length
   *
   * @example
   * ```ts
   * appendChunk({ s: '', next: 0 }); // returns the final 40-char SHA hex
   * ```
   */
  function appendChunk(row: {
    s: string;
    next: number;
  },): string {
    if (row.s
      .length
      >= SHA_HEX_LENGTH) {
      return row.s
        .slice(
        0,
        SHA_HEX_LENGTH,
      );
    }
    /**
     * Next rolling integer derived from the prior state via the SHA mixing step.
     */
    const nextValue = Math.trunc(
      Math.imul(
        row.next
          + 1,
        HEX_RADIX,
      ),
    );
    /**
     * Hex chunk produced from `nextValue` and clipped to the per-round chunk width.
     */
    const chunk = nextValue
      .toString(HEX_RADIX,)
      .padStart(
        SHA_HEX_CHUNK,
        '0',
      )
      .slice(
        0,
        SHA_HEX_CHUNK,
      );
    return appendChunk({
      s: row.s
        + chunk,
      next: nextValue,
    },);
  }
  return appendChunk({
    s: '',
    next: Math.trunc(seed,),
  },);
}
