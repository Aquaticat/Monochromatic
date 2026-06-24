//! The compiled deterministic automaton: byte classes, builder, table, and runner.

/// Byte-class equivalence computation.
mod classes;

/// Eager determinization from a node into a `Dfa`.
mod build;

/// Moore state minimization.
mod minimize;

/// Product-union of per-rule DFAs.
mod union;

/// The serializable `Dfa` table and its match loop.
pub mod table;

/// Re-exports the builder entry point.
pub use build::build_dfa;

/// Re-exports the minimizer.
pub use minimize::minimize;

/// Re-exports the union builder.
pub use union::union;
