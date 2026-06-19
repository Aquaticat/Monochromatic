//! Rustdoc summary for the `rules::engine` module.
/// Rustdoc summary for module `compiled`.
// What:     Engine submodule wiring. Each `mod foo;` declares a sibling
//           file under `src/rules/engine/foo.rs`, and each `pub use`
//           re-exports the public helper through `super::engine::*`.
// Why:      The max-lines Rust linter budgets code lines per file, so
//           engine dispatch, routing, and pre-validators live in
//           smaller topical files while callers keep the same paths.
//
// In TS you'd write (pseudocode):
// ```ts
// export { CompiledRegex } from "./compiled";
// export { requiresResharp } from "./routing";
// ```
mod compiled;
/// Rustdoc summary for module `complement`.
mod complement;
/// Rustdoc summary for module `constants`.
mod constants;
/// Rustdoc summary for module `lookaround_misc`.
mod lookaround_misc;
/// Rustdoc summary for module `lookaround_nested_quant`.
mod lookaround_nested_quant;
/// Rustdoc summary for module `lookaround_trailing`.
mod lookaround_trailing;
/// Rustdoc summary for module `quantifier`.
mod quantifier;
/// Rustdoc summary for module `routing`.
mod routing;
/// Rustdoc summary for module `slow_quantifier`.
mod slow_quantifier;

/// Rustdoc summary for use.
pub use compiled::CompiledRegex;
/// Rustdoc summary for use.
pub use complement::{
    complement_intersection_quantified_group,
    lookaround_in_complement,
    nested_complement,
};
/// Rustdoc summary for use.
pub use lookaround_misc::{
    intersection_with_lookbehind,
    intersection_with_word_end_alternation,
    lookaround_in_alternation_with_sibling,
};
/// Rustdoc summary for use.
pub use lookaround_nested_quant::nested_lookahead_in_quantified_group;
/// Rustdoc summary for use.
pub use lookaround_trailing::quantified_lookahead_with_sibling_content;
/// Rustdoc summary for use.
pub use quantifier::{nested_grouped_quantifier, stacked_quantifier};
/// Rustdoc summary for use.
pub use routing::requires_resharp;
/// Rustdoc summary for use.
pub use slow_quantifier::{
    nested_chain_in_lookaround_body,
    nested_quantifier_after_wildcard,
};
