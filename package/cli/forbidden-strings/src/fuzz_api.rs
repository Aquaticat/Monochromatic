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
//! `package/fuzz/forbidden-strings` are retargeted onto that path by #386.

/// Re-exports the frx rule-compiler entry points and the redacted load error.
///
/// `compile_from_text` builds a `RegexSet` from two-form rule text (the path a
/// literal-to-dialect escaping target exercises), `load_precompiled` decodes a
/// serialized set, and `LoadError` is the redacted failure both return.
pub use crate::{compile_from_text, load_precompiled, LoadError};

/// Re-exports the runtime rule loader and its loaded-set handle.
///
/// `load` resolves and compiles the runtime rules file (and, under the flag, the
/// precompiled baseline) into a `LoadedRules` the scan path consumes.
pub use crate::frx_load::{load, LoadedRules};

/// Re-exports the per-file line scan entry point.
///
/// `scan_file` splits a file's bytes into lines and runs each loaded set under the
/// fail-closed unwind boundary, returning redacted `PATH:LINE rule=N` findings.
pub use crate::frx_scan::scan_file;
