/**
 * Content-hash helper shared by the render dispatchers.
 *
 * Lives in its own file so both `render.ts` (Phase 1) and
 * `render-phase2.ts` can import without a cycle.
 */

/* oxlint-disable eslint/no-magic-numbers, unicorn/prefer-math-trunc -- FNV-1a constants; Uint8Array body is read-only iterated by `for...of`. */
/**
 * FNV-1a 64-bit hash of a byte string.
 *
 * Cheap content-addressing for the fragment-index. Cryptographic
 * resistance is not a goal; we use the hash only to skip identical
 * re-puts.
 *
 * @param bytes - body bytes
 *
 * @returns lowercase hex digest (16 chars)
 *
 * @example
 * ```ts
 * fnv1a64(new TextEncoder().encode('a'));
 * // FNV-1a 64-bit of 'a'
 * ```
 */
export function fnv1a64(bytes: Uint8Array,): string {
  /**
   * Final hash state; computed inside an IIFE so the mutable accumulators stay scoped to the streaming loop.
   */
  const finalState = (function computeFnv1a64(): {
    hi: number;
    lo: number;
  } {
    /**
     * High 32 bits of the FNV-1a 64-bit state; mutated per byte.
     */
    let hi = 0xCB_F2_9C_E4;
    /**
     * Low 32 bits of the FNV-1a 64-bit state; mutated per byte.
     */
    let lo = 0x84_22_23_25;
    /**
     * High word of the FNV prime, split for `Math.imul`.
     */
    const PRIME_HI = 0x00_00_01_00;
    /**
     * Low word of the FNV prime, split for `Math.imul`.
     */
    const PRIME_LO = 0x00_00_01_B3;
    for (const b of bytes) {
      lo ^= b;
      /**
       * Low-word product carrying low-by-low multiplication only.
       */
      const lowMul = Math.imul(
        lo,
        PRIME_LO,
      );
      /**
       * High-word product: cross-term sum reduced modulo 2^32 below.
       */
      const highMul = Math.imul(
        hi,
        PRIME_LO,
      )
        + Math
        .imul(
        lo,
        PRIME_HI,
      );
      lo = lowMul >>> 0;
      hi = highMul >>> 0;
    }
    return {
      hi,
      lo,
    };
  })();
  return finalState.hi
    .toString(16,)
    .padStart(
    8,
    '0',
  )
    + finalState
    .lo
    .toString(16,)
    .padStart(
    8,
    '0',
  );
}
/* oxlint-enable eslint/no-magic-numbers, unicorn/prefer-math-trunc */
