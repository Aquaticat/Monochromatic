//! Rule compiler targeting the in-house `forbidden-regex` engine.
//!
//! This module owns the two-form rule-file format, the flag policy, UTF-8 BOM
//! stripping, redacted load-error reporting, and both construction paths (from
//! rule text and from a serialized precompiled `RegexSet`). It is the live load
//! path: `crate::frx_load` builds the scan's rule sets through these entry points,
//! and `crate::frx_scan` runs them. The resharp/`regex`-crate pipeline it once sat
//! beside was deleted in the engine-swap teardown (#385).
//!
//! The engine is always in verbose, multiline mode, so this compiler never calls
//! `forbidden_regex::compile` (its single-pattern path logs the pattern via
//! `tracing`, a leak vector). It builds only through `RegexSet::new` and
//! `RegexSet::from_bytes`, neither of which logs, so a failing rule's bytes never
//! reach a subscriber.

/// Imports the engine's compiled-ruleset type and its compile-time error.
use forbidden_regex::{CompileError, RegexSet};

/// Registers the redacted load-error type.
mod error;
/// Registers the literal-to-verbose-dialect escaper.
mod escape;
/// Registers the two-form file-format parser and flag policy.
mod format;

/// Re-exports the redacted load-error type as this module's public failure.
pub use error::LoadError;

/// Compiles a rule source (two-form text) into a combined `RegexSet`.
///
/// Parses the two-form format (escaping literals, applying the flag policy,
/// stripping a BOM), then validates each rule through the engine to attribute a
/// redacted, index-bearing error to the first offender, and finally assembles the
/// combined set. Validation and assembly both go through `RegexSet::new`, so no
/// pattern is ever logged. Errors carry only an opaque rule index and the
/// engine's static reason, never rule text.
pub fn compile_from_text(text: &str) -> Result<RegexSet, LoadError> {
    let patterns = format::parse_patterns(text)?;
    // Validate rule by rule first: `RegexSet::new` over the whole slice reports
    // only its first error without the offending index, so a per-rule pass
    // recovers the index for the redacted diagnostic. Each single-rule set is
    // discarded; the combined set is built once below.
    for (index, pattern) in patterns.iter().enumerate() {
        if let Err(reason) = RegexSet::new(std::slice::from_ref(pattern)) {
            return Err(LoadError::Compile { index, reason });
        }
    }
    // Every rule compiled individually, so assembly cannot fail on a rule; any
    // error here is a genuine engine invariant break, surfaced fail-closed with a
    // sentinel index and the engine's static reason (still no rule text).
    return RegexSet::new(&patterns).map_err(|reason| return LoadError::Compile {
        index: patterns.len(),
        reason,
    });
}

/// Loads a precompiled serialized `RegexSet` from bytes.
///
/// Wraps the engine's `from_bytes`, which decodes and structurally validates the
/// blob before it can match. The planning doc resolved that the builtin baseline
/// is embedded precompiled at build time (runtime compilation is too slow); stage
/// two performs the embedding, and this is the construction path it will use. A
/// decode or validation failure becomes a redacted `Precompiled` error.
pub fn load_precompiled(bytes: &[u8]) -> Result<RegexSet, LoadError> {
    return RegexSet::from_bytes(bytes)
        .map_err(|reason: CompileError| return LoadError::Precompiled { reason });
}

/// Registers the compile, redaction, and precompiled round-trip tests
/// (sidecar, lint-exempt).
#[cfg(test)]
mod compile_tests;
