/**
 * Tiny helpers shared by the Phase 2 seed modules: deterministic ids,
 * synthetic SHAs, common constants. Pulled out of `generate-phase2.ts`
 * so each per-resource seeding module stays under the max-lines budget.
 */

/** SHA hex string length (40 chars for SHA-1). */
export const SHA_HEX_LENGTH = 40;

/** Number base for hex SHA derivation. */
export const HEX_RADIX = 16;

/** SHA hex chunk length (8 hex chars per `Number.prototype.toString(16)` round). */
export const SHA_HEX_CHUNK = 8;

/** PR number offset so generated PRs do not collide with regular issue numbers. */
export const PR_NUMBER_BASE = 100_000;

/**
 * Composes a deterministic id of the form `<prefix>-<index>`, mirroring
 * the helper Phase 1's seed package uses.
 *
 * @param prefix - resource family prefix
 *
 * @param index - numeric index
 *
 * @returns composed id
 *
 * @example
 * ```ts
 * deterministicId('milestone', 0); // 'milestone-0'
 * ```
 */
export function deterministicId(
  prefix: string,
  index: number,
): string {
  return `${prefix}-${String(index,)}`;
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
 * fakeSha(0);
 * ```
 */
export function fakeSha(seed: number,): string {
  let s = '';
  let next = Math.trunc(seed,);
  while (s.length < SHA_HEX_LENGTH) {
    next = Math.trunc(
      Math.imul(
        next + 1,
        HEX_RADIX,
      ),
    );
    s += next
      .toString(HEX_RADIX,)
      .padStart(
        SHA_HEX_CHUNK,
        '0',
      )
      .slice(
        0,
        SHA_HEX_CHUNK,
      );
  }
  return s.slice(
    0,
    SHA_HEX_LENGTH,
  );
}
