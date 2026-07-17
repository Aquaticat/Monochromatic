//! Curated internal surface for the scanner's fuzz targets.
//!
//! This module appears only when the crate is built with the `fuzzing` Cargo
//! feature; the bin target and the integration tests build with it off and see
//! the unchanged public surface. It gathers the entry points a fuzz target drives
//! into one import path (`forbidden_strings::fuzz_api::*`).
//!
//! The engine-swap teardown (#385) deleted the old resharp/`regex`/aho-corasick
//! internals this module used to re-export; what survives is the forbidden-regex
//! load and scan path. The scanner-level fuzz targets in
//! `package/fuzz/forbidden-strings` were retargeted onto that path by #386: the
//! literal-escaping roundtrip (`escape_literal` plus `RegexSet`), the columnless
//! scan-format and ruleset-invariant checks (`load_from_text` plus `scan_file`), and
//! the two whole-crate construction paths (`compile_from_text`, `load_precompiled`).

/// Re-exports the frx rule-compiler entry points and the redacted load error.
///
/// `compile_from_text` builds a `RegexSet` from two-form rule text (the path a
/// literal-to-dialect escaping target exercises), `load_precompiled` decodes a
/// serialized set, and `LoadError` is the redacted failure both return.
pub use crate::{compile_from_text, load_precompiled, LoadError};

/// Re-exports the literal-to-verbose-dialect escaper the roundtrip target drives.
///
/// `escape_literal` rewrites a bare literal so every byte matches itself in the
/// engine's always-verbose dialect; the `fuzz_literal_roundtrip` target compiles its
/// output and asserts the round-trip, including adversarial cases (spaces, leading
/// `#`, quotes, backslashes, metacharacters, escape sequences, newlines).
pub use crate::rule::frx::escape_literal;

/// Re-exports the engine's compiled ruleset so a target can compile and match directly.
///
/// The roundtrip target builds a single-pattern `RegexSet` from an escaped literal and
/// calls `is_match` to prove the escaped pattern recognizes exactly the input bytes,
/// bypassing the file-format layer that the format-driven targets exercise instead.
pub use forbidden_regex::RegexSet;

/// Re-exports the runtime rule loader, an in-memory loader, and their loaded-set handle.
///
/// `load` resolves and compiles the runtime rules file (and, under the flag, the
/// precompiled baseline) into a `LoadedRules` the scan path consumes; `load_from_text`
/// builds the same handle from an in-memory two-form source so the format-driven
/// targets can drive the strict loader and scan path without touching the filesystem.
pub use crate::frx_load::{load, load_from_text, LoadedRules};

/// Re-exports the per-file line scan entry point.
///
/// `scan_file` splits a file's bytes into lines and runs each loaded set under the
/// fail-closed unwind boundary, returning redacted `PATH:LINE rule=N` findings.
pub use crate::frx_scan::scan_file;
