//! The compiled deterministic automaton: byte classes, builder, table, and runner.

/// Byte-class equivalence computation.
mod classes;

/// Eager determinization from a node into a `Dfa`.
mod build;

/// Moore state minimization.
mod minimize;

/// The serializable `Dfa` table and its match loop.
pub mod table;

/// Batched multi-line match kernels (scalar, vertical SIMD, interleaved).
pub mod batch;

/// Sheng-style in-register transition kernel (`vpermb`/`vqtbl4q`).
pub mod sheng;

/// Re-exports the capped builder entry point.
pub use build::build_dfa_within;

/// Re-exports the minimizer.
pub use minimize::minimize;
