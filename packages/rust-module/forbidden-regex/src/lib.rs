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

/// Per-rule back-end selection and the seedless-rule fold into the gate.
mod build;

/// The RegexSet-level combined literal prefilter.
mod gate;

/// Greedy combination of literal-free rules into union DFAs.
mod group;

/// Public matcher types.
mod regex;

/// Re-exports the compile-time error type.
pub use crate::error::CompileError;

/// Re-exports the public matcher API.
pub use crate::regex::{Regex, RegexSet, compile};

/// Diagnostic: debug-prints the parsed node of a pattern that has no usable seed.
///
/// What: returns `Some(debug)` when the pattern parses and is seedless (no leading
/// seed and no required-literal seed), else `None`. Why: a temporary probe for the
/// CsA work to enumerate exactly which rules force the literal-free second pass.
#[doc(hidden)]
pub fn debug_seedless(pattern: &str) -> Option<String> {
    let node = crate::parse::parse(pattern).ok()?;
    let leading = crate::counting::leading_seeds(&node);
    let seeds = crate::counting::seeds_from_node(&node);
    if leading.is_empty() && seeds.is_empty() {
        Some(format!("{node:?}"))
    } else {
        None
    }
}

/// Diagnostic: tries to build ONE combined search DFA over every pattern.
///
/// What: parses each pattern, alternates them under a single `Σ*` search prefix, and
/// eagerly determinizes the union; returns the state count on success or the
/// `CompileError` (typically `StateCap`) on a blowup. Why: a measured probe of the
/// "all-rules combined automaton" idea, to see whether a single monolithic DFA over the
/// whole ruleset is even buildable (vs the per-rule gate-plus-fold architecture).
#[doc(hidden)]
pub fn try_combined_dfa(patterns: &[&str]) -> Result<usize, CompileError> {
    let roots: Vec<crate::ast::node::Node> =
        patterns.iter().filter_map(|pattern| crate::parse::parse(pattern).ok()).collect();
    let union = crate::ast::smart::alt(roots);
    let combined = crate::ast::smart::concat(vec![crate::ast::node::Node::Top, union]);
    Ok(crate::dfa::build_dfa_within(combined, 65_534)?.num_states as usize)
}
