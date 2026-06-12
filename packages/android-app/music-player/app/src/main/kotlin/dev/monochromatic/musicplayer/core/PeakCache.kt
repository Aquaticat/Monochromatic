package dev.monochromatic.musicplayer.core

/**
 * Pure memoization of measured true peaks, a faithful port of the desktop's `peakcache.rs`.
 *
 * The desktop persists a `fingerprint -> peak` map to disk so that measuring a track's true peak
 * (which means decoding the whole file) happens at most once. Privacy: the fingerprint is a one-way
 * hash of (path, size, mtime), so no filename, path, or tag ever lands on disk.
 *
 * This port carries only the platform-independent pieces: the 64-bit FNV-1a [fingerprint] over the
 * key material and the in-memory [PeakCache] map ([PeakCache.get] / [PeakCache.insert]). The on-disk
 * JSON load/save and the config-directory resolution are platform I/O and are deferred to the
 * integration layer (the desktop's `from_path`, `save`, `pending_save`, `cache_path`, and the
 * `metadata` stat inside `fingerprint` are not ported here).
 */

/**
 * 64-bit FNV-1a offset basis (the hash's starting value), the published constant so the fingerprint
 * stays stable across runs and platforms.
 */
private const val FNV_OFFSET: ULong = 14695981039346656037uL

/**
 * 64-bit FNV-1a prime multiplier, the other half of the FNV-1a definition.
 */
private const val FNV_PRIME: ULong = 1099511628211uL

/**
 * Width in bytes of the zero-padded lowercase-hex rendering of a 64-bit fingerprint.
 */
private const val FINGERPRINT_HEX_WIDTH: Int = 16

/**
 * Number of little-endian bytes the size field contributes to the key material, matching the Rust
 * `u64::to_le_bytes()`.
 */
private const val SIZE_LE_BYTES: Int = 8

/**
 * Number of little-endian bytes the mtime field contributes to the key material, matching the Rust
 * `u128::to_le_bytes()`. Only the low [SIZE_LE_BYTES] carry data here (see [fingerprint]); the
 * remaining high bytes are always zero, exactly as a `u128` whose value fits in 64 bits serializes.
 */
private const val MTIME_LE_BYTES: Int = 16

/**
 * Hash a byte array with FNV-1a, a small fast non-cryptographic 64-bit hash.
 *
 * For each byte: `hash = (hash XOR byte) * prime`. [ULong] multiplication in Kotlin wraps modulo
 * 2^64, which is exactly the intentional overflow wraparound the Rust `wrapping_mul` performs, so
 * the result matches the Rust `u64` bit-for-bit.
 *
 * @param bytes Key material to fold into the hash.
 * @return 64-bit FNV-1a hash of [bytes].
 */
private fun fnv1aHash(bytes: ByteArray): ULong =
    bytes.fold(FNV_OFFSET) { hash, byte ->
        (hash xor byte.toUByte().toULong()) * FNV_PRIME
    }

/**
 * Append [value] to [sink] as [width] little-endian bytes (low byte first), matching the Rust
 * `to_le_bytes()` for an unsigned integer of `width * 8` bits whose value fits in 64 bits.
 *
 * @param sink Buffer the bytes are appended to.
 * @param value Unsigned value to serialize; only its low 64 bits are representable, with any higher
 *   bytes emitted as zero.
 * @param width Number of bytes to emit, so the field's footprint matches the Rust integer width.
 */
private fun appendLittleEndian(sink: MutableList<Byte>, value: ULong, width: Int) {
    (0 until width).forEach { byteIndex ->
        val shift = byteIndex * Byte.SIZE_BITS
        // Beyond 64 bits there is nothing left to shift in, so those high bytes are zero, which is
        // why a u128 whose value fits in u64 serializes with trailing zero bytes.
        val byte = if (shift >= ULong.SIZE_BITS) 0u else (value shr shift) and 0xFFuL
        sink.add(byte.toByte())
    }
}

/**
 * Build the opaque cache key for a track from its path, size, and modified-time.
 *
 * The key material is the path's UTF-8 bytes, then the size as 8 little-endian bytes, then the
 * mtime as 16 little-endian bytes, hashed with [fnv1aHash] and rendered as a zero-padded 16-digit
 * lowercase-hex string. Size and mtime are part of the key so that re-encoding (size change) or an
 * in-place edit (mtime change) invalidates a stale entry. The hash is one-way, so the key reveals
 * nothing about the track's path.
 *
 * The desktop sources [size] and [mtimeNanos] from a filesystem stat and returns `None` when the
 * file cannot be stat'd; that stat is platform I/O and is deferred, so this pure port takes the
 * already-measured values as parameters and always returns a fingerprint. The Rust mtime is a
 * `u128` nanosecond count; a [ULong] covers every instant from 1970 to roughly the year 2554, and
 * the high half of the 16-byte field is always zero in that range, so the bytes match the Rust
 * `u128::to_le_bytes()` exactly.
 *
 * @param path Track path; only hashed, never stored, so non-UTF-8 lossiness is irrelevant.
 * @param size File size in bytes, so a re-encode changes the key.
 * @param mtimeNanos Last-modified time in nanoseconds since the Unix epoch, so an in-place edit
 *   changes the key.
 * @return Zero-padded 16-character lowercase-hex fingerprint.
 */
fun fingerprint(path: String, size: ULong, mtimeNanos: ULong): String {
    val material: MutableList<Byte> = mutableListOf()
    material.addAll(path.encodeToByteArray().asList())
    appendLittleEndian(material, size, SIZE_LE_BYTES)
    appendLittleEndian(material, mtimeNanos, MTIME_LE_BYTES)
    val hash = fnv1aHash(material.toByteArray())
    return hash.toString(FINGERPRINT_HEX_WIDTH).padStart(FINGERPRINT_HEX_WIDTH, '0')
}

/**
 * In-memory peak cache: the fingerprint -> measured-true-peak map, a faithful port of the pure part
 * of the desktop's `PeakCache`.
 *
 * The desktop additionally tracks a persistence path and an unsaved-insert counter for batched disk
 * writes; those belong to the deferred on-disk layer and are intentionally omitted here. This type
 * owns only the query/insert behaviour the pure tests exercise.
 */
class PeakCache {
    /**
     * Fingerprint hex -> measured true peak. Mutable because [insert] adds entries over the cache's
     * lifetime; never exposed directly so callers cannot bypass [insert].
     */
    private val map: MutableMap<String, Float> = mutableMapOf()

    /**
     * Look up a cached peak.
     *
     * @param fingerprint Opaque key produced by [fingerprint].
     * @return Cached peak, or `null` when the key has never been inserted.
     */
    fun get(fingerprint: String): Float? = map[fingerprint]

    /**
     * Add or replace a cached peak.
     *
     * @param fingerprint Opaque key produced by [fingerprint].
     * @param peak Measured true peak to memoize for [fingerprint].
     */
    fun insert(fingerprint: String, peak: Float) {
        map[fingerprint] = peak
    }
}
