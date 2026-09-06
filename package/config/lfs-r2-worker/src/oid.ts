/**
 Git LFS object identifiers: the sha256 of the object bytes as lowercase hex.

 @module
 */

/**
 Number of hex characters in a sha256 object id.
 */
export const OID_LENGTH = 64;

/**
 Whether one character is a lowercase hex digit.

 @param character - single character to classify

 @returns `true` for `0` to `9` and `a` to `f`
 */
function isLowercaseHexDigit(character: string,): boolean {
  return ((character >= '0') && (character <= '9'))
    || ((character >= 'a') && (character <= 'f'));
}

/**
 Whether `value` is a well-formed git-lfs object id: exactly 64 lowercase hex
 characters. Implemented as a linear scan so the Worker carries no regex.

 @param value - candidate path segment to classify

 @returns `true` when every character is lowercase hex and the length matches

 @example
 ```ts
 isOid('a'.repeat(64)); // true
 isOid('objects'); // false
 isOid('A'.repeat(64)); // false, uppercase is not an oid
 ```
 */
export function isOid(value: string,): boolean {
  if (value.length !== OID_LENGTH) {
    return false;
  }
  for (const character of value) {
    if (!isLowercaseHexDigit(character,)) {
      return false;
    }
  }
  return true;
}
