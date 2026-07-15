//! rules engine support for the forbidden-strings scanner.
/// Registers the `compiled` child module.
// What:     Engine submodule wiring. Each `mod foo;` declares a sibling
//           file under `src/rule/engine/foo.rs`, and each `pub use`
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
/// Registers the `complement` child module.
mod complement;
/// Registers the `constants` child module.
mod constants;
/// Registers the `lookaround_misc` child module.
mod lookaround_misc;
/// Registers the `lookaround_nested_quant` child module.
mod lookaround_nested_quant;
/// Registers the `lookaround_trailing` child module.
mod lookaround_trailing;
/// Registers the `quantifier` child module.
mod quantifier;
/// Registers the `routing` child module.
mod routing;
/// Registers the `slow_quantifier` child module.
mod slow_quantifier;

/// Imports dependencies used by this module.
pub use compiled::CompiledRegex;
/// Imports dependencies used by this module.
pub use complement::{
    complement_intersection_quantified_group,
    lookaround_in_complement,
    nested_complement,
};
/// Imports dependencies used by this module.
pub use lookaround_misc::{
    intersection_with_lookbehind,
    intersection_with_word_end_alternation,
    lookaround_in_alternation_with_sibling,
};
/// Imports dependencies used by this module.
pub use lookaround_nested_quant::nested_lookahead_in_quantified_group;
/// Imports dependencies used by this module.
pub use lookaround_trailing::quantified_lookahead_with_sibling_content;
/// Imports dependencies used by this module.
pub use quantifier::{nested_grouped_quantifier, stacked_quantifier};
/// Imports dependencies used by this module.
pub use routing::requires_resharp;
/// Imports dependencies used by this module.
pub use slow_quantifier::{
    nested_chain_in_lookaround_body,
    nested_quantifier_after_wildcard,
};
