//! Counting back-end: a small structural matcher that keeps bounded-repetition
//! counts in runtime counter-sets instead of unrolled DFA states.
//!
//! The eager DFA unrolls `{n,m}`, which explodes when a repeated class overlaps a
//! literal prefix under unanchored search (an `AKIA[A-Z2-7]{16}` key is exactly
//! that shape). This module keeps such a pattern as a [`CountingNfa`] of positions
//! and matches it with a counting-set simulation whose serialized size is linear in
//! the pattern, never in the repetition bound; alternation costs only follow edges,
//! and intersection with complement runs as a synchronized [`ProductProgram`].

/// The element leaf type and its decode-time validation.
mod element;

/// The bounded count bitset used by the simulation state.
mod countset;

/// The required-literal prefilter derived from a counting NFA.
mod prefilter;

/// The shared counting-NFA simulation core.
mod sim;

/// The serializable counting NFA.
mod nfa;

/// The Glushkov-style NFA builder.
mod build;

/// The single-pattern counting-NFA search loop.
mod run;

/// The synchronized-product back-end for `&` and `~`.
mod product;

/// Re-exports the counting NFA and its builder for the engine and compiler.
pub use build::build_nfa;

/// Re-exports the counting NFA type for the engine.
pub use nfa::CountingNfa;

/// Re-exports the product program and its builder for the engine and compiler.
pub use product::{ProductProgram, build_product};

/// Re-exports the prefilter, seed extractors, and leading-seed probes for the engine.
pub(crate) use prefilter::{
    Prefilter, leading_seeds, leading_seeds_min, seeds_from_node, seeds_from_node_min,
};
