//! The compiled deterministic automaton: byte classes, builder, table, and runner.

/// Byte-class equivalence computation.
mod classes;

/// Eager determinization from a node into a `Dfa`.
mod build;

/// Moore state minimization.
mod minimize;

/// The serializable `Dfa` table and its match loop.
pub mod table;

/// Re-exports the capped builder entry point.
pub use build::build_dfa_within;

/// Re-exports the minimizer.
pub use minimize::minimize;
