// File summary (folds in the old KDoc's domain content):
//
// Pure memoization of measured true peaks, a faithful port of the desktop's `peakcache.rs`.
//
// Measuring a track's true peak means decoding the whole audio file, which is slow, so the desktop
// persists a `fingerprint -> peak` map to disk and measures each track at most once. Privacy: the
// fingerprint is a one-way hash of (path, size, mtime), so no filename, path, or tag ever lands on
// disk; the saved cache reveals nothing about which tracks the user has.
//
// This port carries ONLY the platform-independent pieces: the 64-bit FNV-1a `fingerprint` over the
// key material, and the in-memory `PeakCache` map (`get` / `insert` / `snapshot`). The desktop's
// on-disk JSON load/save, the config-directory resolution, the unsaved-insert counter, and the
// atomic-write/idle-sweep machinery are platform I/O and are deferred to the integration layer; do
// NOT expect this file to mention paths, locks, or saving (those exist in the Rust twin, not here).
//
// What:     `package dev.monochromatic.musicplayer.core` names the package (namespace) every
//           declaration in this file belongs to. It mirrors the directory path
//           `dev/monochromatic/musicplayer/core/`. Unlike a TS module, there is no `import` line
//           that pulls this file in; other files in the SAME package see these declarations with no
//           import at all, and other packages reference them as
//           `dev.monochromatic.musicplayer.core.fingerprint`.
// Why:      Kotlin requires a package declaration so the JVM knows the fully-qualified names of the
//           classes and top-level functions compiled from this file.
// TS map:   There is no exact equivalent. Mentally, picture every file under this directory sharing
//           one implicit barrel: a TS folder where sibling files can use each other's exports
//           without an explicit `import`.
//
// In TS you'd write (pseudocode):
// ```ts
// // No 1:1 equivalent. Closest: this file lives in the `core/` module folder and its exports are
// // visible to sibling files in the same folder without an import statement.
// ```
package dev.monochromatic.musicplayer.core

// What:     `private const val FNV_OFFSET: ULong = 14695981039346656037uL` declares a file-private,
//           compile-time constant named `FNV_OFFSET`. `private` limits visibility to THIS file;
//           `const val` means the value is a true compile-time constant (inlined at use sites, no
//           runtime storage); the explicit type is `ULong`. The literal suffix `uL` marks the number
//           as an unsigned 64-bit literal: `u` = unsigned, `L` = 64-bit (Long width). Without `uL`,
//           Kotlin would read `14695981039346656037` as a signed `Long`, and this value overflows a
//           signed `Long` (max ~9.2e18), so the suffix is required, not cosmetic.
//           Siblings the reader might expect for the type: `Long` (signed 64-bit), `UInt` (unsigned
//           32-bit), `Int` (signed 32-bit).
// Why:      This is the published FNV-1a 64-bit "offset basis", the starting value the hash folds
//           from. Hard-coding the standard constant keeps the fingerprint stable across runs and
//           platforms, and bit-for-bit identical to the desktop's `u64` FNV-1a.
// TS map:   `const FNV_OFFSET = 14695981039346656037n;` — TS needs a `BigInt` (`n` suffix) because
//           this value exceeds `Number.MAX_SAFE_INTEGER`; a plain `number` would lose precision.
// Gotcha:   `ULong` is UNSIGNED 64-bit. There is no TS primitive that wraps mod 2^64; you must
//           simulate it with `BigInt.asUintN(64, x)` (see the hash function below).
//
// In TS you'd write (pseudocode):
// ```ts
// const FNV_OFFSET = 14695981039346656037n; // BigInt: u64 value exceeds Number's safe range
// ```
private const val FNV_OFFSET: ULong = 14695981039346656037uL

// What:     `private const val FNV_PRIME: ULong = 1099511628211uL` declares the second FNV-1a
//           constant, file-private and compile-time-inlined. Same `uL` suffix and `ULong` type as
//           above: an unsigned 64-bit literal. Siblings the reader might expect: `Long`, `UInt`,
//           `Int`.
// Why:      This is the FNV-1a 64-bit prime multiplier, the other half of the hash definition
//           (each step is `hash = (hash XOR byte) * prime`). Published constant => stable hash.
// TS map:   `const FNV_PRIME = 1099511628211n;` — a `BigInt`, so the multiply below can stay exact.
//
// In TS you'd write (pseudocode):
// ```ts
// const FNV_PRIME = 1099511628211n; // BigInt
// ```
private const val FNV_PRIME: ULong = 1099511628211uL

// What:     `private const val FINGERPRINT_HEX_WIDTH: Int = 16` declares a file-private compile-time
//           constant of type `Int` (a signed 32-bit integer). No literal suffix is needed because
//           `16` fits an `Int`. Siblings the reader might expect: `Long` (64-bit), `UInt`/`ULong`
//           (the unsigned widths).
// Why:      A 64-bit hash renders as exactly 16 lowercase-hex characters (each hex digit encodes 4
//           bits, 64 / 4 = 16). This constant is both the radix-conversion width and the zero-pad
//           target, so the fingerprint string is always exactly 16 chars.
// TS map:   `const FINGERPRINT_HEX_WIDTH = 16;` — TS has only `number`, so the `Int`-vs-`Long`
//           choice does not surface.
// Why this type (not `Long`/`UInt`): a small count used for string width and as a `padStart`
//           argument; `Int` is the natural default integer in Kotlin and what `toString(radix)` /
//           `padStart(length, ...)` expect, so no width conversion is needed.
//
// In TS you'd write (pseudocode):
// ```ts
// const FINGERPRINT_HEX_WIDTH = 16;
// ```
private const val FINGERPRINT_HEX_WIDTH: Int = 16

// What:     `private const val SIZE_LE_BYTES: Int = 8` declares a file-private compile-time `Int`
//           constant. `Int` is signed 32-bit; siblings: `Long`, `UInt`, `ULong`.
// Why:      The file size is folded into the key as 8 little-endian bytes, matching the desktop's
//           Rust `u64::to_le_bytes()` (a `u64` is 8 bytes). Re-encoding a track changes its size,
//           which changes these bytes, which changes the fingerprint, which invalidates the stale
//           cached peak.
// TS map:   `const SIZE_LE_BYTES = 8;`
// Why this type (not `Long`/`UInt`): a tiny byte-count used as a loop bound and an `Int` parameter
//           to `appendLittleEndian`; `Int` is the natural counter width.
//
// In TS you'd write (pseudocode):
// ```ts
// const SIZE_LE_BYTES = 8;
// ```
private const val SIZE_LE_BYTES: Int = 8

// What:     `private const val MTIME_LE_BYTES: Int = 16` declares a file-private compile-time `Int`
//           constant. `Int` is signed 32-bit; siblings: `Long`, `UInt`, `ULong`.
// Why:      The modified-time is folded into the key as 16 little-endian bytes, matching the
//           desktop's Rust `u128::to_le_bytes()` (a `u128` is 16 bytes). Here the value actually
//           fits in 64 bits (see `fingerprint`), so only the low 8 of these 16 bytes ever carry
//           data and the high 8 are always zero, which is exactly how a `u128` whose value fits in
//           64 bits serializes. Emitting all 16 keeps the hashed bytes identical to the desktop's.
// TS map:   `const MTIME_LE_BYTES = 16;`
// Why this type (not `Long`/`UInt`): same as `SIZE_LE_BYTES`, a small loop-bound/`Int` argument.
//
// In TS you'd write (pseudocode):
// ```ts
// const MTIME_LE_BYTES = 16;
// ```
private const val MTIME_LE_BYTES: Int = 16

// What:     `private fun fnv1aHash(bytes: ByteArray): ULong = ...` declares a file-private function
//           named `fnv1aHash`. It takes one parameter `bytes` of type `ByteArray` (a fixed-length
//           array of signed 8-bit bytes; sibling type `List<Byte>` is a growable list, but an array
//           is cheaper to fold over) and returns a `ULong` (unsigned 64-bit; siblings `Long`,
//           `UInt`). The `=` after the signature (instead of a `{ ... }` block) makes this an
//           "expression-body" function: the single expression on the next lines IS the return value,
//           with no `return` keyword. That whole expression is therefore an implicit-return tail.
// Why:      Folds the key material into one compact, stable, opaque 64-bit number using FNV-1a, a
//           small fast NON-cryptographic hash (good for cache keys, not for security).
// TS map:   `function fnv1aHash(bytes: Uint8Array): bigint { return ...; }` — the expression body
//           becomes an ordinary `return`.
// Gotcha:   `ByteArray` elements are SIGNED bytes (`-128..127`), unlike Rust's `&[u8]` (already
//           `0..255`). The body must reinterpret each byte as unsigned before widening (see below),
//           or a negative byte would sign-extend into a huge wrong number.
// Why `ULong` (not `Long`/`UInt`): FNV-1a is defined over an unsigned 64-bit accumulator that wraps
//           mod 2^64; `Long` would be signed (wrong for the hex render and comparisons) and `UInt`
//           is only 32 bits.
//
// In TS you'd write (pseudocode):
// ```ts
// function fnv1aHash(bytes: Uint8Array): bigint {
//   return [...bytes].reduce(
//     (hash, byte) => BigInt.asUintN(64, (hash ^ BigInt(byte)) * FNV_PRIME),
//     FNV_OFFSET,
//   );
// }
// ```
private fun fnv1aHash(bytes: ByteArray): ULong =
    // What:     `bytes.fold(FNV_OFFSET) { hash, byte -> ... }` is a reduce/accumulate over the
    //           array. `fold` takes a seed (`FNV_OFFSET`, the starting accumulator) and a two-arg
    //           lambda. The `{ hash, byte -> ... }` is Kotlin's TRAILING-LAMBDA syntax: when the
    //           last argument is a lambda, it moves outside the parentheses. `hash` is the running
    //           accumulator (`ULong`), `byte` is the current element (a signed `Byte`), and the
    //           lambda's last expression becomes the new accumulator for the next step. Because this
    //           `fold(...)` call is the function's expression body, its result is the function's
    //           return value (implicit-return tail).
    // Why:      FNV-1a is exactly a fold: start at the offset basis and, for each byte, XOR it in and
    //           multiply by the prime.
    // TS map:   `bytes.reduce((hash, byte) => ..., FNV_OFFSET)` — `fold(seed) { ... }` is `reduce(fn,
    //           seed)`; note Kotlin puts the seed first and the lambda last.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return [...bytes].reduce((hash, byte) => /* see next line */, FNV_OFFSET);
    // ```
    bytes.fold(FNV_OFFSET) { hash, byte ->
        // What:     `(hash xor byte.toUByte().toULong()) * FNV_PRIME` is one FNV-1a step and the
        //           lambda's tail expression (its return value). Piece by piece:
        //           - `xor` is Kotlin's INFIX bitwise XOR; Kotlin spells bitwise operators as words
        //             (`xor`, `and`, `or`, `shl`, `shr`, `ushr`, `inv`), not symbols. TS uses `^`.
        //           - `byte.toUByte()` reinterprets the signed `Byte` (`-128..127`) as a `UByte`
        //             (`0..255`) WITHOUT changing the bits; this is the unsigned-reinterpretation a
        //             TS reader would not think to do, since Rust's `u8` is already unsigned.
        //           - `.toULong()` then zero-extends that `UByte` to a 64-bit `ULong` so it can be
        //             XORed against the accumulator.
        //           - `* FNV_PRIME` multiplies; on `ULong` this multiply WRAPS modulo 2^64 silently
        //             (no exception), which is the intended overflow behaviour and matches the
        //             desktop Rust's `wrapping_mul`.
        // Why:      Compute `hash = (hash XOR thisByteAsUnsigned) * prime`, the FNV-1a recurrence.
        // TS map:   `BigInt.asUintN(64, (hash ^ BigInt(byte & 0xff)) * FNV_PRIME)` — `& 0xff` is the
        //           TS analogue of `.toUByte()` (force into `0..255`), and `BigInt.asUintN(64, ...)`
        //           is the analogue of the `ULong` wrap-around multiply.
        // Gotcha:   The wrap direction is the OPPOSITE of the Rust comment's panic warning. In Rust,
        //           plain `*` on `u64` PANICS on overflow in debug builds, so the desktop must call
        //           `wrapping_mul`. In Kotlin, plain `*` on `ULong` already wraps mod 2^64 with no
        //           panic, which is precisely WHY this port can use the bare `*` and still match the
        //           desktop bit-for-bit. For the TS reader: `number` cannot do either; you must reach
        //           for `BigInt` plus `asUintN(64, ...)`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return BigInt.asUintN(64, (hash ^ BigInt(byte & 0xff)) * FNV_PRIME);
        // ```
        (hash xor byte.toUByte().toULong()) * FNV_PRIME
    }

// What:     `private fun appendLittleEndian(sink: MutableList<Byte>, value: ULong, width: Int) { ... }`
//           declares a file-private function with a `{ ... }` block body (so it returns nothing,
//           `Unit`, the Kotlin equivalent of `void`). Parameters:
//           - `sink: MutableList<Byte>` is a GROWABLE list of bytes the function appends to.
//             `MutableList` (sibling: read-only `List<Byte>`, which has no `.add`) is required
//             because we mutate it.
//           - `value: ULong` is the unsigned 64-bit number to serialize (siblings `Long`, `UInt`).
//           - `width: Int` is how many bytes to emit (signed 32-bit count; sibling `Long`).
// Why:      Append `value` to `sink` as `width` little-endian bytes (low byte first), matching the
//           desktop Rust `to_le_bytes()` for an unsigned integer of `width * 8` bits whose value
//           fits in 64 bits. Used to fold the size (8 bytes) and the mtime (16 bytes) into the key.
// TS map:   `function appendLittleEndian(sink: number[], value: bigint, width: number): void { ... }`.
// Why `MutableList<Byte>` (not `List<Byte>`): the function's whole job is to grow the buffer; a
//           read-only `List` exposes no `.add`.
//
// In TS you'd write (pseudocode):
// ```ts
// function appendLittleEndian(sink: number[], value: bigint, width: number): void {
//   for (let byteIndex = 0; byteIndex < width; byteIndex++) {
//     const shift = byteIndex * 8;
//     const byte = shift >= 64 ? 0n : (value >> BigInt(shift)) & 0xffn;
//     sink.push(Number(byte));
//   }
// }
// ```
private fun appendLittleEndian(sink: MutableList<Byte>, value: ULong, width: Int) {
    // What:     `(0 until width).forEach { byteIndex -> ... }` iterates the integers `0, 1, ...,
    //           width - 1`. `0 until width` builds a HALF-OPEN `IntRange` (includes `0`, EXCLUDES
    //           `width`); the inclusive form would be `0..width`. `.forEach { byteIndex -> ... }`
    //           runs the trailing-lambda body once per value, binding it to `byteIndex`.
    // Why:      Emit one byte per position, from the lowest-order byte (index 0) upward.
    // TS map:   `for (let byteIndex = 0; byteIndex < width; byteIndex++) { ... }` — `0 until width`
    //           is `< width` (half-open), and `.forEach { i -> }` is the loop body.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (let byteIndex = 0; byteIndex < width; byteIndex++) { /* body */ }
    // ```
    (0 until width).forEach { byteIndex ->
        // What:     `val shift = byteIndex * Byte.SIZE_BITS` declares an immutable local (`val`, like
        //           a `const`, not reassignable; the mutable sibling keyword is `var`). `Byte.SIZE_BITS`
        //           is a companion constant on the `Byte` type equal to `8` (the bit width of a byte);
        //           naming it instead of writing `8` documents intent. `byteIndex * 8` is the bit
        //           offset of this byte: byte 0 is bits 0..7, byte 1 is bits 8..15, and so on.
        // Why:      We will shift `value` right by this many bits to bring the wanted byte down to the
        //           low 8 bits before masking it out.
        // TS map:   `const shift = byteIndex * 8;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const shift = byteIndex * 8;
        // ```
        val shift = byteIndex * Byte.SIZE_BITS
        // What:     `val byte = if (shift >= ULong.SIZE_BITS) 0u else (value shr shift) and 0xFFuL`
        //           declares an immutable local using `if` AS AN EXPRESSION (it produces a value,
        //           like a ternary). `ULong.SIZE_BITS` is the companion constant `64`. Branches:
        //           - then: `0u`, an unsigned literal `0` (`u` suffix). When `shift >= 64` there is
        //             nothing left to shift in, so the byte is zero. This is why a `u128` whose value
        //             fits in `u64` serializes with trailing zero bytes (bytes 8..15 of the mtime).
        //           - else: `(value shr shift) and 0xFFuL`. `shr` is INFIX bitwise right-shift (TS
        //             `>>>`); `and` is INFIX bitwise AND (TS `&`). `0xFFuL` is the unsigned 64-bit
        //             hex literal `0xFF` (= 255), masking off everything but the low 8 bits. So this
        //             extracts the byte at position `byteIndex`.
        //           (Folds in the original inline note: beyond 64 bits there is nothing to shift in,
        //           so those high bytes are zero, exactly as a `u128` whose value fits in `u64`
        //           serializes with trailing zeros.)
        // Why:      Pull out the single byte living at this position, defaulting to zero past the
        //           64-bit width so the 16-byte mtime field's high half is all zeros.
        // TS map:   `const byte = shift >= 64 ? 0n : (value >> BigInt(shift)) & 0xffn;` — Kotlin's
        //           word operators `shr`/`and` are TS `>>`/`&`, and the unsigned literals `0u`/`0xFFuL`
        //           are `BigInt`s here.
        // Gotcha:   `shr` is the bitwise shift, NOT a method call; `value shr shift` reads as
        //           `value.shr(shift)`. Likewise `and` here is bitwise AND, not the logical `&&`
        //           a TS reader might assume from the word "and".
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const byte = shift >= 64 ? 0n : (value >> BigInt(shift)) & 0xffn;
        // ```
        val byte = if (shift >= ULong.SIZE_BITS) 0u else (value shr shift) and 0xFFuL
        // What:     `sink.add(byte.toByte())` appends to the list. `byte` here is an unsigned value
        //           (a `ULong` masked to 0..255, or the `UInt` `0u`); `.toByte()` converts it down to
        //           the signed `Byte` the list stores, reinterpreting bits so e.g. 255 becomes the
        //           `Byte` value `-1` WITHOUT changing the underlying 8 bits. `.add(...)` is the
        //           `MutableList` append operation.
        // Why:      Store this byte at the end of the key material; the bit pattern is what the hash
        //           consumes, so the signed/unsigned reinterpretation is harmless.
        // TS map:   `sink.push(Number(byte));` — `.add` is `.push`; the `Byte` round-trip vanishes
        //           because TS `number[]` does not distinguish signed/unsigned 8-bit storage.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // sink.push(Number(byte));
        // ```
        sink.add(byte.toByte())
    }
}

// What:     `fun fingerprint(path: String, size: ULong, mtimeNanos: ULong): String { ... }` declares
//           a PUBLIC top-level function (no `private`, so other packages may call it). Parameters:
//           - `path: String` is the track's path text. `String` is Kotlin's immutable UTF-16-backed
//             string type (sibling: `CharSequence`, a read-only interface a `String` implements).
//           - `size: ULong` is the file size in bytes (unsigned 64-bit; siblings `Long`, `UInt`).
//           - `mtimeNanos: ULong` is the last-modified time in nanoseconds since 1970 (unsigned
//             64-bit).
//           It returns a `String`. The `{ ... }` block body uses explicit `return`.
// Why:      Builds the opaque cache key for a track from its path, size, and modified-time, then
//           hashes and hex-renders it. Size and mtime are in the key so re-encoding (size change) or
//           an in-place edit (mtime change) invalidates a stale entry; the hash is one-way, so the
//           key reveals nothing about the track's path. The desktop sources size/mtime from a
//           filesystem stat and returns `None` when the file cannot be stat'd; that stat is platform
//           I/O and is deferred, so this pure port takes the already-measured values and ALWAYS
//           returns a fingerprint (no nullable return here).
// TS map:   `function fingerprint(path: string, size: bigint, mtimeNanos: bigint): string { ... }`.
// Why `ULong` for `size`/`mtimeNanos` (not `Long`/`UInt`): the Rust mtime is a `u128` nanosecond
//           count; a `ULong` covers every instant from 1970 to ~year 2554 and the 16-byte field's
//           high half stays zero in that range, so the serialized bytes match Rust's `u128::
//           to_le_bytes()` exactly. `Long` (signed) could go negative; `UInt` (32-bit) is too narrow.
//
// In TS you'd write (pseudocode):
// ```ts
// function fingerprint(path: string, size: bigint, mtimeNanos: bigint): string {
//   const material: number[] = [];
//   material.push(...new TextEncoder().encode(path));
//   appendLittleEndian(material, size, SIZE_LE_BYTES);
//   appendLittleEndian(material, mtimeNanos, MTIME_LE_BYTES);
//   const hash = fnv1aHash(Uint8Array.from(material));
//   return hash.toString(16).padStart(16, "0");
// }
// ```
fun fingerprint(path: String, size: ULong, mtimeNanos: ULong): String {
    // What:     `val material: MutableList<Byte> = mutableListOf()` declares an immutable local
    //           binding (`val`, not reassignable) to a NEWLY-CREATED empty growable byte list.
    //           `mutableListOf()` is the constructor/factory that allocates the list (sibling
    //           factories: `listOf()` makes a read-only `List`, `arrayOf()` makes a fixed array).
    //           The explicit type annotation `MutableList<Byte>` documents that the list is mutable
    //           even though `material` itself cannot be reassigned to a different list.
    // Why:      A scratch buffer to concatenate path bytes + size bytes + mtime bytes before hashing.
    // TS map:   `const material: number[] = [];`
    // Why `MutableList<Byte>` (not `List<Byte>`): we append to it below via `appendLittleEndian` and
    //           `addAll`; a read-only `List` would reject those mutations.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const material: number[] = [];
    // ```
    val material: MutableList<Byte> = mutableListOf()
    // What:     `material.addAll(path.encodeToByteArray().asList())` appends many elements at once.
    //           `path.encodeToByteArray()` encodes the string to its UTF-8 bytes as a `ByteArray`
    //           (the conversion a TS reader would do with `TextEncoder`). `.asList()` wraps that
    //           array as a `List<Byte>` VIEW (no copy) so it satisfies `addAll`'s parameter type.
    //           `.addAll(...)` then appends every byte to `material`.
    // Why:      Put the path's bytes first in the key material, so tracks at different paths get
    //           different fingerprints.
    // TS map:   `material.push(...new TextEncoder().encode(path));`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // material.push(...new TextEncoder().encode(path));
    // ```
    material.addAll(path.encodeToByteArray().asList())
    // What:     `appendLittleEndian(material, size, SIZE_LE_BYTES)` calls the helper to append the
    //           size as `SIZE_LE_BYTES` (8) little-endian bytes onto `material`. Plain function call,
    //           no wrapper or conversion punctuation.
    // Why:      Fold the file size into the key so a re-encode (which changes the size) changes the
    //           fingerprint.
    // TS map:   `appendLittleEndian(material, size, SIZE_LE_BYTES);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // appendLittleEndian(material, size, SIZE_LE_BYTES);
    // ```
    appendLittleEndian(material, size, SIZE_LE_BYTES)
    // What:     `appendLittleEndian(material, mtimeNanos, MTIME_LE_BYTES)` appends the mtime as
    //           `MTIME_LE_BYTES` (16) little-endian bytes. The high 8 bytes are always zero for any
    //           real timestamp (see the helper), matching the desktop's `u128` serialization.
    // Why:      Fold the modified-time into the key so an in-place edit (same size, new mtime) still
    //           changes the fingerprint.
    // TS map:   `appendLittleEndian(material, mtimeNanos, MTIME_LE_BYTES);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // appendLittleEndian(material, mtimeNanos, MTIME_LE_BYTES);
    // ```
    appendLittleEndian(material, mtimeNanos, MTIME_LE_BYTES)
    // What:     `val hash = fnv1aHash(material.toByteArray())` declares an immutable local `hash`.
    //           `material.toByteArray()` COPIES the growable `MutableList<Byte>` into a fixed
    //           `ByteArray` (the type `fnv1aHash` accepts); it is a conversion from list to array.
    //           `fnv1aHash(...)` then returns the `ULong` hash.
    // Why:      Reduce all the key material to one 64-bit number.
    // TS map:   `const hash = fnv1aHash(Uint8Array.from(material));`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const hash = fnv1aHash(Uint8Array.from(material));
    // ```
    val hash = fnv1aHash(material.toByteArray())
    // What:     `return hash.toString(FINGERPRINT_HEX_WIDTH).padStart(FINGERPRINT_HEX_WIDTH, '0')`
    //           is the explicit return. `hash.toString(16)` renders the `ULong` in base 16 (radix
    //           = `FINGERPRINT_HEX_WIDTH`, which is `16`) as lowercase hex; this is a NUMBER-TO-STRING
    //           conversion that takes the RADIX, not a length. `.padStart(16, '0')` then left-pads
    //           the result with the CHARACTER literal `'0'` (single quotes are a `Char`, not a
    //           one-char `String`) up to length 16, so small hashes still render as 16 digits.
    // Why:      Produce the stable, zero-padded 16-digit lowercase-hex fingerprint string the cache
    //           keys on, identical to the desktop's `format!("{:016x}", ...)`.
    // TS map:   `return hash.toString(16).padStart(16, "0");` — but note `toString(16)` on a Kotlin
    //           number takes the radix as the argument, and `'0'` is a `Char` whereas TS's
    //           `padStart` takes a one-char string `"0"`.
    // Gotcha:   `FINGERPRINT_HEX_WIDTH` is reused for TWO different meanings: as the RADIX in
    //           `toString(16)` and as the LENGTH in `padStart(16, ...)`. They coincide at 16 only
    //           because a 64-bit hash is both base-16-rendered and 16 hex digits wide.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return hash.toString(16).padStart(16, "0");
    // ```
    return hash.toString(FINGERPRINT_HEX_WIDTH).padStart(FINGERPRINT_HEX_WIDTH, '0')
}

// What:     `class PeakCache { ... }` declares a class named `PeakCache`. There is no `private`, so
//           it is public to other packages. With no `()` after the name it has the default empty
//           constructor (no fields set from outside). The `{ ... }` holds its single field and its
//           methods.
// Why:      The in-memory peak cache: a `fingerprint -> measured-true-peak` map, a faithful port of
//           the PURE part of the desktop's `PeakCache`. The desktop additionally tracks a
//           persistence path and an unsaved-insert counter for batched disk writes; those belong to
//           the deferred on-disk layer and are intentionally OMITTED here, so this type owns only the
//           query/insert/snapshot behaviour the pure tests exercise. Do not expect `path`,
//           `unsaved`, `save`, or locking in this port.
// TS map:   `class PeakCache { /* one private map field, get/insert/snapshot methods */ }`.
//
// In TS you'd write (pseudocode):
// ```ts
// class PeakCache {
//   private map: Record<string, number> = {};
//   get(fingerprint: string): number | undefined { ... }
//   insert(fingerprint: string, peak: number): void { ... }
//   snapshot(): Record<string, number> { ... }
// }
// ```
class PeakCache {
    // What:     `private val map: MutableMap<String, Float> = mutableMapOf()` declares a
    //           file/class-private, non-reassignable (`val`) field bound to a NEWLY-CREATED empty
    //           mutable hash map. `MutableMap<String, Float>` maps `String` keys (the fingerprint
    //           hex) to `Float` values (the measured peak). `mutableMapOf()` is the factory that
    //           allocates an empty `LinkedHashMap` (sibling factory: `mapOf()` builds a read-only
    //           `Map` with no `.put`). `val` fixes the binding (the map object never swaps) while the
    //           map's CONTENTS stay mutable.
    // Why:      The actual memoized data: the fingerprint -> peak entries. `private` so callers cannot
    //           bypass `insert` and mutate the map directly.
    // TS map:   `private map: Record<string, number> = {};`
    // Why `MutableMap` (not read-only `Map`): `insert` adds entries over the cache's lifetime, which
    //           a read-only `Map` forbids.
    // Why `Float` (not `Double`): the desktop stores the peak as a Rust `f32` (32-bit float); using
    //           Kotlin `Float` (also 32-bit) instead of `Double` (64-bit) keeps the serialized JSON
    //           bits agreeing with the desktop's cache so the two could share a file.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private map: Record<string, number> = {}; // TS `number` blurs the f32/f64 distinction
    // ```
    private val map: MutableMap<String, Float> = mutableMapOf()

    // What:     `fun get(fingerprint: String): Float? = map[fingerprint]` declares a public method
    //           `get` taking one `String` parameter and returning `Float?`. The trailing `?` on the
    //           type makes it a NULLABLE `Float`: the value may be a `Float` OR `null`, and Kotlin's
    //           type system forces callers to handle the `null` case. The `=` is an expression body,
    //           so the single expression is the return value. `map[fingerprint]` is the indexed-read
    //           operator on a `Map`, which compiles to `map.get(fingerprint)` and returns `null` when
    //           the key is absent (hence the `?` on the return type).
    // Why:      Look up a cached peak, returning `null` when the key has never been inserted so the
    //           caller knows to measure the track instead.
    // TS map:   `get(fingerprint: string): number | undefined { return this.map[fingerprint]; }` —
    //           Kotlin's `Float?` is TS's `number | undefined`, and `map[fingerprint]` is the same
    //           index read (TS yields `undefined` on a missing key; Kotlin yields `null`).
    // Gotcha:   `map[key]` on a Kotlin `Map` is NOT a guaranteed-present value like a TS object index
    //           you have asserted; the `?` return type is mandatory because the key may be missing.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // get(fingerprint: string): number | undefined {
    //   return this.map[fingerprint];
    // }
    // ```
    fun get(fingerprint: String): Float? = map[fingerprint]

    // What:     `fun insert(fingerprint: String, peak: Float) { ... }` declares a public method
    //           `insert` taking a `String` key and a `Float` value, with a `{ ... }` block body that
    //           returns nothing (`Unit`/void). `Float` (sibling `Double`) is the 32-bit peak.
    // Why:      Add or replace a cached peak, memoizing a freshly measured value.
    // TS map:   `insert(fingerprint: string, peak: number): void { ... }`.
    // Why `Float` for `peak` (not `Double`): match the desktop `f32` so cached values are bit-for-bit
    //           comparable across the two implementations.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // insert(fingerprint: string, peak: number): void {
    //   this.map[fingerprint] = peak;
    // }
    // ```
    fun insert(fingerprint: String, peak: Float) {
        // What:     `map[fingerprint] = peak` is the indexed-WRITE operator on a `MutableMap`, which
        //           compiles to `map.put(fingerprint, peak)`. It stores or overwrites the entry.
        // Why:      Record the measurement under its fingerprint key.
        // TS map:   `this.map[fingerprint] = peak;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.map[fingerprint] = peak;
        // ```
        map[fingerprint] = peak
    }

    // What:     `fun snapshot(): Map<String, Float> = map.toMap()` declares a public method
    //           `snapshot` that returns a `Map<String, Float>`. Note the return type is the READ-ONLY
    //           `Map` interface (sibling: the `MutableMap` the field uses), so the caller cannot
    //           mutate what it gets back. The `=` is an expression body. `map.toMap()` builds a fresh
    //           IMMUTABLE copy of the current entries (a defensive copy, not a live view).
    // Why:      Hand the platform persistence layer a snapshot of every cached entry to serialize.
    //           The desktop's `PeakCache` enumerates its entries internally when saving; this pure
    //           port keeps the map private and returns a COPY rather than the live map, so `insert`
    //           stays the only mutation path. A usage from the deferred persistence layer would look
    //           like, in Kotlin:
    //           `JSONObject(cache.snapshot().mapValues { it.value.toDouble() }).toString()`.
    // TS map:   `snapshot(): Readonly<Record<string, number>> { return { ...this.map }; }` — Kotlin's
    //           read-only `Map` return type is TS's `Readonly<Record<...>>`, and `.toMap()` is the
    //           spread-copy `{ ...this.map }`.
    // Why return read-only `Map` (not `MutableMap`): the snapshot is for reading/serializing only;
    //           returning the mutable interface would invite callers to bypass `insert`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // snapshot(): Readonly<Record<string, number>> {
    //   return { ...this.map };
    // }
    // ```
    fun snapshot(): Map<String, Float> = map.toMap()
}
