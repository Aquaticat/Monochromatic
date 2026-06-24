//! forbidden-regex: a restricted Brzozowski-derivative regex engine compiled to a
//! serializable byte-class DFA, supporting intersection (`&`) and complement
//! (`~(...)`).
//!
//! The public surface is [`compile`] / [`Regex`] for a single pattern and
//! [`RegexSet`] for a whole ruleset combined into one matcher. Input is matched
//! as bytes (`&[u8]`); see the crate README for the supported dialect.

/// The byte-set leaf alphabet.
mod charset;

/// The compile-time error type.
mod error;

/// The regex node algebra and its smart constructors.
mod ast;

/// The boundary context resolving zero-width assertions.
mod context;

/// Position-dependent nullability.
mod nullable;

/// Brzozowski byte derivatives.
mod derivative;

/// Pattern parsing into the node algebra.
mod parse;

/// Determinization and the compiled table.
mod dfa;

/// The counting back-end for bounded repetition.
mod counting;

/// The per-pattern back-end selector.
mod engine;

/// The RegexSet-level combined literal prefilter.
mod gate;

/// Public matcher types.
mod regex;

/// Re-exports the compile-time error type.
pub use crate::error::CompileError;

/// Re-exports the public matcher API.
pub use crate::regex::{Regex, RegexSet, compile};
