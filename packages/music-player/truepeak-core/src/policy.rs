//! The versioned policy and the identity tuple that keys cache rows.
//!
//! The app ships ONE active policy. A cached decision is reusable only when the full
//! identity matches: the `policy_id` (constants, gain math, cache
//! interpretation), the `meter_id` (Catmull-Rom behavior including the chunk-seam and
//! end-of-track rules), the `decoder_stack_id` (the platform's Symphonia and libopus
//! behavior, supplied by the platform), and the `schema_version` (row layout). Keeping
//! these as separate values, not collapsed into `policy_id`, means a decoder bump does
//! not needlessly churn unrelated rows. The `policy_id` is DERIVED from the policy
//! parameters, so changing a constant cannot silently reuse a stale cache row.

/// What:     `const FNV_OFFSET: u64 = 0xcbf2_9ce4_8422_2325;`. The 64-bit FNV-1a offset
///           basis (its standard starting value). `u64` (siblings `u32`/`u128`) is the
///           width of this hash variant. The `_` digit separators are ignored.
/// Why:      The seed for the small dependency-free hash that derives the identity ids.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const FNV_OFFSET = 0xcbf29ce484222325n; // bigint
/// ```
const FNV_OFFSET: u64 = 0xcbf2_9ce4_8422_2325;

/// What:     `const FNV_PRIME: u64 = 0x0000_0100_0000_01b3;`. The 64-bit FNV-1a prime
///           multiplier. `u64` to match `FNV_OFFSET`.
/// Why:      The per-byte multiply that spreads input bits across the hash.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const FNV_PRIME = 0x100000001b3n; // bigint
/// ```
const FNV_PRIME: u64 = 0x0000_0100_0000_01b3;

/// What:     `pub const SCHEMA_VERSION: u32 = 1;`. The cache row-layout version. `u32`
///           (sibling `u64` overkill) is plenty for a slowly-changing schema counter.
/// Why:      A read is a hit only when the stored row layout matches; bump this when
///           the row columns change.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const SCHEMA_VERSION = 1;
/// ```
pub const SCHEMA_VERSION: u32 = 1;

/// What:     `const METER_DESCRIPTION: &str = "...";`. A string naming every behavior
///           that defines the shared meter's numeric output. `&str` (sibling `String`
///           would needlessly own) is a literal baked into the binary.
/// Why:      `meter_id` is the hash of this string, so any change to meter behavior must
///           edit this description, which bumps `meter_id` and invalidates stale rows.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const METER_DESCRIPTION = "catmull-rom ...";
/// ```
const METER_DESCRIPTION: &str =
    "catmull-rom q/h/tq; 4-sample window; per-channel cursor across chunk seams; interpolate only at 4 real samples; no synthetic end padding; v1";

/// What:     `const SHORT_SCAN_MAX_SECS: f64 = 90.0;`. Tracks at or below this length are
///           scanned in full for an exact peak; longer tracks are probed. `f64` (sibling
///           `f32`) to compare against the source duration.
/// Why:      Short tracks are cheap to scan exactly, so they never carry probe error.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const SHORT_SCAN_MAX_SECS = 90;
/// ```
const SHORT_SCAN_MAX_SECS: f64 = 90.0;

/// What:     `const COVERAGE_FRACTION: f64 = 0.2;`. The fraction of a long track the probe
///           decodes, spread evenly, so coverage is uniform rather than a fixed prefix.
///           `f64` (sibling `f32`) for precision. `0.2` (one fifth) is the largest fraction
///           that keeps total decode under the quarter-library budget.
/// Why:      Uniform proportional coverage bounds the worst gap-miss far better than a
///           fixed-length probe, which under-covers long tracks.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const COVERAGE_FRACTION = 0.2;
/// ```
const COVERAGE_FRACTION: f64 = 0.2;

/// What:     `const PROBE_WINDOW_SECS: f64 = 0.3;`. The length of each evenly-placed probe
///           window. `f64` (sibling `f32`) for precision.
/// Why:      Short windows spread the coverage across many distinct regions, shrinking the
///           gaps that hide inter-window peaks.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const PROBE_WINDOW_SECS = 0.3;
/// ```
const PROBE_WINDOW_SECS: f64 = 0.3;

/// What:     `const PROBE_MARGIN_DB: f64 = 0.8;`. The fixed margin added to a probe's
///           sampled peak. `f64` (sibling `f32`) for precision.
/// Why:      The decided margin: it keeps about ninety-nine percent of tracks within
///           `-0.8 dB` too-quiet, letting the realtime clamp catch the rare too-loud
///           transient that background warming later corrects to an exact cached gain.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const PROBE_MARGIN_DB = 0.8;
/// ```
const PROBE_MARGIN_DB: f64 = 0.8;

/// What:     `const CEILING_DBTP: f64 = -1.0;`. The normalization ceiling in dBTP.
///           `-1.0` is inside the always-allowed `-2..=2` range. `f64` (sibling `f32`)
///           for dB math.
/// Why:      Hashed into `policy_id` so a ceiling change re-keys the cache.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const CEILING_DBTP = -1;
/// ```
const CEILING_DBTP: f64 = -1.0;

/// What:     `const MAX_TOO_LOUD_DB: f64 = 1.0 / 2.0;`. The `+0.5 dB` too-loud bound,
///           composed from the exempt `-2..=2` range rather than a bare `0.5`. `f64`
///           (sibling `f32`) for dB math.
/// Why:      The hard upper error bound; hashed into `policy_id`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const MAX_TOO_LOUD_DB = 1 / 2;
/// ```
const MAX_TOO_LOUD_DB: f64 = 1.0 / 2.0;

/// What:     `const MAX_TOO_QUIET_DB: f64 = -2.0;`. The `-2.0 dB` too-quiet bound.
///           `-2.0` is the edge of the always-allowed `-2..=2` range. `f64` (sibling
///           `f32`) for dB math.
/// Why:      The hard lower error bound; hashed into `policy_id`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const MAX_TOO_QUIET_DB = -2;
/// ```
const MAX_TOO_QUIET_DB: f64 = -2.0;

/// What:     `fn mix(hash: u64, word: u64) -> u64`. Fold one 64-bit word into a running
///           FNV-1a hash, one little-endian byte at a time.
/// Why:      One reusable step so both the word hash and the string hash share the same
///           byte mixing.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function mix(hash: bigint, word: bigint): bigint { ... }
/// ```
fn mix(hash: u64, word: u64) -> u64 {
    // What:     `word.to_le_bytes().iter().fold(hash, |accumulator, &byte| ...)`.
    //           `.to_le_bytes()` turns the `u64` into its 8 little-endian bytes;
    //           `.iter()` borrows each; `&byte` copies it out; `.fold(seed, closure)`
    //           threads the running hash. `byte as u64` widens for the xor. Tail.
    // Why:      FNV-1a is xor-then-multiply per byte; little-endian fixes the order so
    //           the hash is identical on every platform.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let h = hash;
    // for (const byte of toLeBytes(word)) h = (h ^ BigInt(byte)) * FNV_PRIME;
    // return h;
    // ```
    word.to_le_bytes()
        .iter()
        .fold(hash, |accumulator, &byte| {
            (accumulator ^ byte as u64).wrapping_mul(FNV_PRIME)
        })
}

/// What:     `fn hash_words(words: &[u64]) -> u64`. FNV-1a over a slice of 64-bit words.
///           `&[u64]` (sibling `Vec<u64>` would own) borrows the caller's array.
/// Why:      Derive a stable id from a fixed list of policy parameters.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function hashWords(words: bigint[]): bigint { ... }
/// ```
fn hash_words(words: &[u64]) -> u64 {
    // What:     `words.iter().fold(FNV_OFFSET, |hash, &word| mix(hash, word))`. Start
    //           from the offset basis and fold each word through `mix`. Tail -> return.
    // Why:      Order-sensitive hash of all parameters into one id.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return words.reduce((hash, word) => mix(hash, word), FNV_OFFSET);
    // ```
    words.iter().fold(FNV_OFFSET, |hash, &word| mix(hash, word))
}

/// What:     `fn hash_bytes(bytes: &[u8]) -> u64`. FNV-1a over raw bytes. `&[u8]`
///           (sibling `&str` is text-only) borrows the caller's bytes.
/// Why:      Hash the meter description string into `meter_id`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function hashBytes(bytes: Uint8Array): bigint { ... }
/// ```
fn hash_bytes(bytes: &[u8]) -> u64 {
    // What:     `bytes.iter().fold(FNV_OFFSET, |hash, &byte| (hash ^ byte as u64)
    //           .wrapping_mul(FNV_PRIME))`. The same xor-then-multiply per byte, here
    //           directly over bytes. `.wrapping_mul` multiplies modulo 2^64 instead of
    //           panicking on overflow. Tail -> return.
    // Why:      Stable, dependency-free string hash.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return bytes.reduce((hash, byte) => (hash ^ BigInt(byte)) * FNV_PRIME, FNV_OFFSET);
    // ```
    bytes
        .iter()
        .fold(FNV_OFFSET, |hash, &byte| {
            (hash ^ byte as u64).wrapping_mul(FNV_PRIME)
        })
}

/// What:     `pub fn meter_id() -> u64`. The id of the shared meter's behavior, the hash
///           of `METER_DESCRIPTION`.
/// Why:      A cache row is reusable only if it was produced by this exact meter; the id
///           changes whenever the description (and thus the behavior) changes.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function meterId(): bigint { return hashBytes(utf8(METER_DESCRIPTION)); }
/// ```
pub fn meter_id() -> u64 {
    // What:     `hash_bytes(METER_DESCRIPTION.as_bytes())`. `.as_bytes()` views the
    //           string as its UTF-8 bytes without copying. Tail -> return.
    // Why:      Hash the behavior description into a stable id.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return hashBytes(utf8(METER_DESCRIPTION));
    // ```
    hash_bytes(METER_DESCRIPTION.as_bytes())
}

/// What:     `#[derive(Clone, Copy, Debug, PartialEq)] pub struct Policy { ... }`. The
///           shipped policy's tunable parameters. The derives give value copy, debug
///           printing, and equality. All fields are `Copy`, so the whole struct is.
/// Why:      One place holding the constants that define normalization behavior and that
///           feed the `policy_id` hash.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Policy = { shortScanMaxSecs; coverageFraction; probeWindowSecs; probeMarginDb; ceilingDbtp; maxTooLoudDb; maxTooQuietDb };
/// ```
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Policy {
    /// What:     `pub short_scan_max_secs: f64`. Tracks at or below this length are scanned
    ///           in full; longer tracks are probed. `f64` (sibling `f32`) for the duration
    ///           compare.
    /// Why:      Short tracks are cheap to scan exactly, so they carry no probe error.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// shortScanMaxSecs: number;
    /// ```
    pub short_scan_max_secs: f64,
    /// What:     `pub coverage_fraction: f64`. Fraction of a long track the probe decodes,
    ///           spread evenly. `f64` (sibling `f32`) for precision.
    /// Why:      Uniform proportional coverage bounds the worst gap-miss; the per-track
    ///           window count is this fraction times duration over `probe_window_secs`.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// coverageFraction: number;
    /// ```
    pub coverage_fraction: f64,
    /// What:     `pub probe_window_secs: f64`. Length of each evenly-placed probe window.
    ///           `f64` (sibling `f32`) for precision.
    /// Why:      Short windows spread coverage across many regions, shrinking the gaps.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// probeWindowSecs: number;
    /// ```
    pub probe_window_secs: f64,
    /// What:     `pub probe_margin_db: f64`. Fixed margin added to a probe's sampled peak.
    /// Why:      Sets the worst-case too-quiet error and the count of clamped cold-start
    ///           tracks the realtime clamp must catch.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// probeMarginDb: number;
    /// ```
    pub probe_margin_db: f64,
    /// What:     `pub ceiling_dbtp: f64`. The normalization ceiling in dBTP.
    /// Why:      Part of the gain math; a change must re-key the cache.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// ceilingDbtp: number;
    /// ```
    pub ceiling_dbtp: f64,
    /// What:     `pub max_too_loud_db: f64`. The `+0.5 dB` too-loud error bound.
    /// Why:      Hard acceptance bound checked by the corpus verifier.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// maxTooLoudDb: number;
    /// ```
    pub max_too_loud_db: f64,
    /// What:     `pub max_too_quiet_db: f64`. The `-2.0 dB` too-quiet error bound.
    /// Why:      Hard acceptance bound checked by the corpus verifier.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// maxTooQuietDb: number;
    /// ```
    pub max_too_quiet_db: f64,
}

/// What:     `impl Policy { ... }`. The policy's behavior: derive its `policy_id` and
///           bundle the full cache identity.
/// Why:      Keep the id derivation next to the fields it hashes.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // methods on the Policy shape
/// ```
impl Policy {
    /// What:     `pub fn policy_id(&self) -> u64`. The hash of every tunable parameter,
    ///           so two policies share an id only when all parameters match. `&self`
    ///           borrows read-only.
    /// Why:      Deriving the id from the parameters makes a stale-cache reuse bug
    ///           impossible rather than merely discouraged.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// policyId(): bigint { return hashWords([...]); }
    /// ```
    pub fn policy_id(&self) -> u64 {
        // What:     `let words: [u64; 7] = [ ... ];`. A fixed array of the parameters
        //           as 64-bit words. `.to_bits()` reinterprets an `f64` as the `u64`
        //           with the same bit pattern, so floats hash exactly.
        // Why:      A canonical, order-fixed encoding of all parameters to hash.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const words = [f64ToBits(shortScanMaxSecs), f64ToBits(coverageFraction), ...];
        // ```
        let words: [u64; 7] = [
            self.short_scan_max_secs.to_bits(),
            self.coverage_fraction.to_bits(),
            self.probe_window_secs.to_bits(),
            self.probe_margin_db.to_bits(),
            self.ceiling_dbtp.to_bits(),
            self.max_too_loud_db.to_bits(),
            self.max_too_quiet_db.to_bits(),
        ];
        // What:     `hash_words(&words)`. `&words` lends the array as a slice. Tail.
        // Why:      Fold all parameters into one id.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return hashWords(words);
        // ```
        hash_words(&words)
    }

    /// What:     `pub fn cache_identity(&self, decoder_stack_id: u64) -> CacheIdentity`.
    ///           Bundle the four-part identity a cache row must match. The platform
    ///           supplies `decoder_stack_id` (its Symphonia and libopus behavior).
    /// Why:      A read is a hit only when all four parts match; this assembles them.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// cacheIdentity(decoderStackId): CacheIdentity { ... }
    /// ```
    pub fn cache_identity(&self, decoder_stack_id: u64) -> CacheIdentity {
        // What:     `CacheIdentity { ... }`. The struct literal pairing this policy's id
        //           and meter id with the platform decoder id and the schema version.
        //           Tail -> return.
        // Why:      Hand back the full identity tuple for the cache key.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { policyId: this.policyId(), meterId: meterId(), decoderStackId, schemaVersion: SCHEMA_VERSION };
        // ```
        CacheIdentity {
            policy_id: self.policy_id(),
            meter_id: meter_id(),
            decoder_stack_id,
            schema_version: SCHEMA_VERSION,
        }
    }
}

/// What:     `#[derive(Clone, Copy, Debug, PartialEq, Eq)] pub struct CacheIdentity
///           { ... }`. The four values a cache row must match to be reused. `Eq` (the
///           total-equality marker, valid because every field is an integer) lets it be
///           used as a map key later.
/// Why:      Keep decoder identity separate from policy identity so a decoder bump does
///           not churn unrelated rows.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type CacheIdentity = { policyId; meterId; decoderStackId; schemaVersion };
/// ```
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct CacheIdentity {
    /// What:     `pub policy_id: u64`. Hash of the policy parameters.
    /// Why:      Constants, gain math, and cache interpretation.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// policyId: bigint;
    /// ```
    pub policy_id: u64,
    /// What:     `pub meter_id: u64`. Hash of the meter behavior description.
    /// Why:      Catmull-Rom behavior including chunk-seam and end-of-track rules.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// meterId: bigint;
    /// ```
    pub meter_id: u64,
    /// What:     `pub decoder_stack_id: u64`. Platform-supplied decoder behavior id.
    /// Why:      Symphonia and libopus versions and their conversion behavior.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// decoderStackId: bigint;
    /// ```
    pub decoder_stack_id: u64,
    /// What:     `pub schema_version: u32`. The row-layout version.
    /// Why:      A read is a hit only when the stored layout matches.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// schemaVersion: number;
    /// ```
    pub schema_version: u32,
}

/// What:     `pub fn default_policy() -> Policy`. The one active policy the app ships,
///           built from the provisional starting constants above.
/// Why:      A single entry point for the shipped policy; Stage two replaces the
///           starting constants with the searched values, which re-keys the cache.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function defaultPolicy(): Policy { return { ... }; }
/// ```
pub fn default_policy() -> Policy {
    // What:     `Policy { ... }`. The struct literal assigning each named starting
    //           constant to its field. Tail -> return.
    // Why:      Hand back the shipped policy.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return { shortScanMaxSecs: SHORT_SCAN_MAX_SECS, ... };
    // ```
    Policy {
        short_scan_max_secs: SHORT_SCAN_MAX_SECS,
        coverage_fraction: COVERAGE_FRACTION,
        probe_window_secs: PROBE_WINDOW_SECS,
        probe_margin_db: PROBE_MARGIN_DB,
        ceiling_dbtp: CEILING_DBTP,
        max_too_loud_db: MAX_TOO_LOUD_DB,
        max_too_quiet_db: MAX_TOO_QUIET_DB,
    }
}

/// What:     `#[cfg(test)] #[path = "policy_tests.rs"] mod tests;`. Test-only submodule
///           in the sibling file `policy_tests.rs`, gated to test builds.
/// Why:      Keep this file to production code; sibling `*_tests.rs` is max-lines exempt.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // policy.unit.test.ts
/// ```
#[cfg(test)]
#[path = "policy_tests.rs"]
mod tests;
