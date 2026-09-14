/**
 Git LFS object id of a working-tree file, whether the file is smudged (real
 bytes) or still a pointer.

 @module
 */

import { createHash, } from 'node:crypto';
import { readFile, } from 'node:fs/promises';

/**
 First line of every git-lfs pointer file.
 */
const POINTER_HEADER = 'version https://git-lfs.github.com/spec/v1';

/**
 Key prefix of the pointer line carrying the object id.
 */
const POINTER_OID_PREFIX = 'oid sha256:';

/**
 Number of hex characters in a sha256 object id.
 */
export const OID_HEX_LENGTH = 64;

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
 Whether `value` is a well-formed git-lfs object id: exactly 64 lowercase
 hex characters, scanned by index so no regex and no code-point iteration.

 @param value - candidate object id

 @returns `true` when every character is lowercase hex and the length matches

 @example
 ```ts
 isLfsOid('a'.repeat(64)); // true
 isLfsOid('asset/readme'); // false
 ```
 */
export function isLfsOid(value: string,): boolean {
  if (value.length !== OID_HEX_LENGTH) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!isLowercaseHexDigit(value.charAt(index,),)) {
      return false;
    }
  }
  return true;
}

/**
 Object id declared by pointer text, as a one-element list, or empty when the
 text is not a pointer or its `oid` line is malformed.

 @param text - candidate pointer contents

 @returns one oid, or none
 */
function pointerOid(text: string,): readonly string[] {
  if (!text.startsWith(POINTER_HEADER,)) {
    return [];
  }
  return text
    .split('\n',)
    .filter(function isOidLine(line: string,): boolean {
      return line.startsWith(POINTER_OID_PREFIX,);
    },)
    .map(function oidOf(line: string,): string {
      return line
        .slice(POINTER_OID_PREFIX.length,)
        .trim();
    },)
    .filter(function wellFormed(oid: string,): boolean {
      return isLfsOid(oid,);
    },)
    .slice(
      0,
      1,
    );
}

/**
 Git LFS object id of a working-tree file. A pointer file yields the oid it
 declares; any other file yields the sha256 of its bytes, which is by
 definition the oid git-lfs would assign it.

 @param path - absolute path of the file

 @returns 64-character lowercase hex object id

 @example
 ```ts
 await lfsOidOfFile('/repo/asset/readme/shot.png');
 ```
 */
export async function lfsOidOfFile(path: string,): Promise<string> {
  /**
   File bytes.
   */
  const bytes = await readFile(path,);
  /**
   Declared oid when the bytes are a pointer.
   */
  const [declared,] = pointerOid(bytes.toString('utf8',),);
  if (declared !== undefined) {
    return declared;
  }
  return createHash('sha256',)
    .update(bytes,)
    .digest('hex',);
}
