/**
 * Filename and digest primitives shared by the fingerprinting post-process.
 *
 * Split out of `postprocess.ts` to keep that orchestrator under the
 * max-lines budget; these helpers carry no pipeline state.
 */
import { createHash, } from 'node:crypto';

/**
 * Number of hex characters to use from the SHA-256 digest.
 */
const HASH_LENGTH = 10;

/**
 * Computes a SHA-256 hex digest of a Buffer.
 *
 * @param input - binary data to hash
 *
 * @mutates input through createHash('sha256',).update native-boundary byte access
 *
 * @returns hex-encoded SHA-256 digest
 *
 * @example
 * ```ts
 * const hash = sha256Buffer(await readFile('image.avif'));
 * ```
 */
export function sha256Buffer(input: Buffer,): string {
  return createHash('sha256',)
    .update(input,)
    .digest('hex',);
}

/**
 * Inserts a content hash before the file extension.
 *
 * @param name - original filename (basename only, no directory)
 *
 * @param hash - full hex hash (sliced to HASH_LENGTH internally)
 *
 * @returns filename with hash inserted before the last extension
 *
 * @example
 * ```ts
 * insertHash({ name: 'styles.css', hash: 'a1b2c3d4ef9876543210' });
 * // → 'styles.a1b2c3d4ef.css'
 * ```
 */
export function insertHash(
  {
    name,
    hash,
  }: {
    readonly name: string;
    readonly hash: string;
  },
): string {
  /**
   * Position of the final dot; `-1` indicates the file has no extension.
   */
  const lastDot = name.lastIndexOf('.',);
  if (lastDot === (-1)) {
    return `${name}.${
      hash.slice(
        0,
        HASH_LENGTH,
      )
    }`;
  }
  /**
   * Filename portion before the extension; used as the prefix for the hashed name.
   */
  const stem = name.slice(
    0,
    lastDot,
  );
  /**
   * Extension portion including the leading dot; appended after the hash.
   */
  const ext = name.slice(lastDot,);
  return `${stem}.${
    hash.slice(
      0,
      HASH_LENGTH,
    )
  }${ext}`;
}
