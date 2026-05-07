/**
 * Content-hash helper shared by the render dispatchers.
 *
 * Lives in its own file so both `render.ts` (Phase 1) and
 * `render-phase2.ts` can import without a cycle.
 */

/* oxlint-disable eslint/no-magic-numbers, unicorn/prefer-math-trunc -- FNV-1a constants */
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
  let hi = 0xCB_F2_9C_E4;
  let lo = 0x84_22_23_25;
  const PRIME_HI = 0x00_00_01_00;
  const PRIME_LO = 0x00_00_01_B3;
  for (const b of bytes) {
    lo ^= b;
    const lowMul = Math.imul(
      lo,
      PRIME_LO,
    );
    const highMul = Math.imul(
      hi,
      PRIME_LO,
    ) + Math.imul(
      lo,
      PRIME_HI,
    );
    lo = lowMul >>> 0;
    hi = highMul >>> 0;
  }
  return hi.toString(16,).padStart(
    8,
    '0',
  ) + lo.toString(16,).padStart(
    8,
    '0',
  );
}
/* oxlint-enable eslint/no-magic-numbers, unicorn/prefer-math-trunc */
