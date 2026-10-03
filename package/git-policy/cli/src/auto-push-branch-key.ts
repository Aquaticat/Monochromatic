/**
 Filesystem-safe reversible encoding of a branch ref name for per-branch push coordination files.

 Each UTF-8 byte outside lowercase ASCII letters,
 digits,
 `-`,
 `_`,
 and `.` becomes `%XX` with uppercase hexadecimal digits.
 Uppercase letters are escaped too,
 so two refs differing only in case never share one file on a case-insensitive filesystem,
 and `/` is escaped,
 so every ref maps to one flat file name.

 @module
 */

//region Branch key encoding

/**
 Bytes kept verbatim: lowercase ASCII letters, digits, `-`, `_`, and `.`.
 */
const VERBATIM_CHARACTERS = new Set('abcdefghijklmnopqrstuvwxyz0123456789-_.',);

/**
 Escape introducer.
 */
const ESCAPE_CHARACTER = '%';

/**
 Hexadecimal radix of escaped bytes.
 */
const HEX_RADIX = 16;

/**
 Width of one escaped byte's hexadecimal digits.
 */
const HEX_WIDTH = 2;

/**
 Width of one complete escape sequence, `%XX`.
 */
const ESCAPE_WIDTH = HEX_WIDTH + 1;

/**
 Uppercase hexadecimal digits accepted when decoding, so every name has exactly one encoding.
 */
const HEX_DIGITS = new Set('0123456789ABCDEF',);

/**
 Strict UTF-8 decoder for reversed keys.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 Encoder producing a ref name's UTF-8 bytes.
 */
const ENCODER = new TextEncoder();

/**
 A push coordination key is not the output of {@link encodeBranchKey}.
 */
export class BranchKeyError extends Error {
  /**
   Creates a decoding failure.

   @param message - diagnostic naming the key
   */
  public constructor(message: string,) {
    super(message,);
    this.name = 'BranchKeyError';
  }
}

/**
 Encodes a branch ref name as one flat, case-insensitive-safe file name component.

 @param refName - full ref name such as `refs/heads/main`

 @returns reversible file name component

 @example
 ```ts
 encodeBranchKey('refs/heads/Main'); // => 'refs%2Fheads%2F%4Dain'
 ```
 */
export function encodeBranchKey(refName: string,): string {
  return [...ENCODER.encode(refName,),]
    .map(function encodeByte(byte,): string {
      /**
       Byte as a one-character string, meaningful only for ASCII bytes.
       */
      const character = String.fromCodePoint(byte,);
      return VERBATIM_CHARACTERS.has(character,)
        ? character
        : `${ESCAPE_CHARACTER}${byte.toString(HEX_RADIX,)
          .toUpperCase()
          .padStart(
            HEX_WIDTH,
            '0',
          )}`;
    },)
    .join('',);
}

/**
 Decodes the escape sequence starting at one position of a key.

 @param key - encoded file name component

 @param index - position of the escape introducer

 @returns escaped byte

 @throws {@link BranchKeyError} when the escape is truncated, lowercase, or escapes a verbatim byte
 */
function decodeEscape({
  key,
  index,
}: Readonly<{
  key: string;
  index: number;
}>,): number {
  /**
   Escaped hexadecimal digits.
   */
  const digits = key.slice(
    index + 1,
    index + ESCAPE_WIDTH,
  );
  if ((digits.length !== HEX_WIDTH)
    || (!HEX_DIGITS.has(digits.charAt(0,),))
    || (!HEX_DIGITS.has(digits.charAt(1,),)))
    throw new BranchKeyError(`Push coordination key has a malformed escape at ${String(index,)}: ${key}`,);
  /**
   Escaped byte value.
   */
  const byte = Number.parseInt(
    digits,
    HEX_RADIX,
  );
  if (VERBATIM_CHARACTERS.has(String.fromCodePoint(byte,),))
    throw new BranchKeyError(`Push coordination key escapes a verbatim character at ${String(index,)}: ${key}`,);
  return byte;
}

/**
 Decodes a key into the UTF-8 bytes of its ref name in one left-to-right pass.

 @param key - encoded file name component

 @returns ref name bytes

 @throws {@link BranchKeyError} when the key holds a character or escape `encodeBranchKey` never produces
 */
function decodeKeyBytes(key: string,): readonly number[] {
  /**
   Decoded bytes, in order.
   */
  const bytes: number[] = [];
  /**
   Read position inside the key.
   */
  let index = 0;
  while (index < key.length) {
    /**
     Character at the read position.
     */
    const character = key.charAt(index,);
    if (character === ESCAPE_CHARACTER) {
      bytes.push(decodeEscape({
        key,
        index,
      },),);
      index += ESCAPE_WIDTH;
    }
    else {
      /**
       ASCII byte of a verbatim character, absent for any other character.
       */
      const byte = VERBATIM_CHARACTERS.has(character,) ? ENCODER.encode(character,)[0] : undefined;
      if (byte === undefined)
        throw new BranchKeyError(`Push coordination key holds an unescaped character at ${String(index,)}: ${key}`,);
      bytes.push(byte,);
      index += 1;
    }
  }
  return bytes;
}

/**
 Reverses {@link encodeBranchKey}.

 @param key - encoded file name component

 @returns original ref name

 @throws {@link BranchKeyError} when the key holds a character or escape `encodeBranchKey` never produces, or bytes that are not UTF-8

 @example
 ```ts
 decodeBranchKey('refs%2Fheads%2F%4Dain'); // => 'refs/heads/Main'
 ```
 */
export function decodeBranchKey(key: string,): string {
  /**
   Ref name bytes.
   */
  const bytes = decodeKeyBytes(key,);
  try {
    return DECODER.decode(Uint8Array.from(bytes,),);
  }
  catch (error: unknown) {
    throw new BranchKeyError(`Push coordination key is not UTF-8 (${String(error,)}): ${key}`,);
  }
}

//endregion Branch key encoding
