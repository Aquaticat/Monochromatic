/**
 * Computes SHA-256 hash of a string and returns hexadecimal representation.
 *
 * Uses the Web Crypto API to create a cryptographically secure hash suitable for
 * data integrity verification, unique identifiers, or security applications.
 *
 * @param value - string to hash
 * @returns hexadecimal string representation of the SHA-256 hash
 * @example
 * ```ts
 * const hash = await hashString('hello world');
 * console.log(hash); // "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
 * ```
 */
export async function hashString(value: string,): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value,);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data,);
  const hashArray = Array.from(new Uint8Array(hashBuffer,),);
  const hashHex = hashArray.map(b => b.toString(16,).padStart(2, '0',)).join('',);
  return hashHex;
}
