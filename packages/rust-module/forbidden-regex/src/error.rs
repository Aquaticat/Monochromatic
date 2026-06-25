//! Compile-time error type for the forbidden-regex engine.

/// Imports the formatter pieces used to render a human-readable error message.
use std::fmt;

/// Reasons a pattern (or a serialized DFA) is rejected before it can match.
///
/// What: every failure path in parsing, the empty-match guard, the DFA state
/// cap, and (de)serialization funnels into one of these variants.
/// Why: callers (the scanner, tests) get a single typed error to match on, and
/// `compile`/`new` never panic on bad input; they return one of these instead.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CompileError {
    /// A syntax or unsupported-construct rejection at a byte offset.
    ///
    /// What: holds the offset into the pattern and a message naming what was
    /// wrong (unsupported operator, bad escape, unbalanced bracket, operand not
    /// a single atom, mixed operators, stacked quantifier, bad repetition).
    /// Why: one variant covers every parse rejection so the surface stays small
    /// while still pointing the rule author at the exact spot.
    Syntax {
        /// Byte offset into the pattern where the problem was detected.
        pos: usize,
        /// Human-readable description of what was rejected.
        message: String,
    },
    /// The pattern can match the empty string, so under unanchored search it
    /// would match every input.
    ///
    /// What: raised when the parsed root is nullable in some realizable anchor
    /// context. Why: such a rule is a footgun (flags every line); rejecting it
    /// at compile time is safer than silently matching everything.
    EmptyMatchable,
    /// Determinization produced more states than the configured cap.
    ///
    /// What: complement and intersection can blow up the state count on
    /// pathological patterns. Why: a hard cap turns that into a clean error
    /// instead of unbounded memory use.
    StateCap {
        /// State-count limit that was exceeded.
        limit: usize,
    },
    /// Encoding a compiled automaton to bytes failed.
    ///
    /// What: wraps a bincode serialization failure as a string. Why: keeps the
    /// public error free of a bincode type in its signature.
    Serialize {
        /// Underlying codec failure rendered as text.
        message: String,
    },
    /// A deserialized automaton failed structural validation.
    ///
    /// What: raised by `from_bytes` when decoded indices are out of bounds or
    /// lengths are inconsistent. Why: a hostile or corrupt blob must be rejected
    /// before it is ever executed, so the match loop can never read out of
    /// bounds.
    Invalid {
        /// Description of which invariant the decoded automaton violated.
        message: String,
    },
}

/// Renders a `CompileError` for end users and logs.
impl fmt::Display for CompileError {
    /// Writes a one-line description of the error.
    ///
    /// What: matches each variant to a sentence. Why: `Display` is what the
    /// scanner surfaces and what `Error` builds on.
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // What: branch per variant; no `match` value is discarded.
        // Why: each variant carries different fields to interpolate.
        match self {
            CompileError::Syntax { pos, message } => {
                write!(f, "syntax error at byte {pos}: {message}")
            }
            CompileError::EmptyMatchable => {
                write!(f, "pattern can match the empty string, which would match every input")
            }
            CompileError::StateCap { limit } => {
                write!(f, "pattern exceeded the DFA state cap of {limit}")
            }
            CompileError::Serialize { message } => {
                write!(f, "failed to serialize automaton: {message}")
            }
            CompileError::Invalid { message } => {
                write!(f, "invalid serialized automaton: {message}")
            }
        }
    }
}

/// Lets `CompileError` participate in the standard error ecosystem.
impl std::error::Error for CompileError {}

/// Unit tests for error rendering, in a sidecar (max-lines exempt).
#[cfg(test)]
#[path = "error_tests.rs"]
mod tests;
