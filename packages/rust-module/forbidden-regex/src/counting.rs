//! Counting back-end: a small structural matcher that keeps bounded-repetition
//! counts in runtime counter-sets instead of unrolled DFA states.
//!
//! The eager DFA unrolls `{n,m}`, which explodes when a repeated class overlaps a
//! literal prefix under unanchored search (an `AKIA[A-Z2-7]{16}` key is exactly
//! that shape). This module keeps such a pattern as a [`LinearProgram`] of
//! [`Element`]s and matches it with a counting-set simulation whose serialized size
//! is linear in the pattern, never in the repetition bound.

/// The linear element IR and the linearizer.
mod element;

/// The counting-set match simulation.
mod run;

/// Re-exports the linear program and linearizer for the engine and compiler.
pub use element::{LinearProgram, linearize};
