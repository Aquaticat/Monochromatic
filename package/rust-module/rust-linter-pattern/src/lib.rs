//! Structural pattern matching over Rust syntax trees.
//!
//! A pattern is written in Rust itself, with metavariables spelled as ordinary
//! identifiers prefixed `META_`. That is the answer to `AGENTS.md` SYB: the
//! pattern is expressed in the destination language rather than in an invented
//! notation describing it.

/// Parsing a pattern snippet, whatever kind of Rust fragment it is.
pub mod fragment;
/// Matching a parsed pattern against a syntax tree, binding metavariables.
pub mod matcher;
/// Turning a match plus a replacement snippet into a concrete edit.
pub mod rewrite;

/// Unit tests for the fragment cascade.
#[cfg(test)]
mod fragment_tests;
/// Unit tests for structural matching.
#[cfg(test)]
mod matcher_tests;
/// Unit tests for rewrite rendering.
#[cfg(test)]
mod rewrite_tests;
