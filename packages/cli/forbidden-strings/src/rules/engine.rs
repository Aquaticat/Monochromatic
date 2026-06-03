// What:     Engine submodule wiring. Each `mod foo;` declares a sibling
//           file under `src/rules/engine/foo.rs`, and each `pub use`
//           re-exports the public helper through `super::engine::*`.
// Why:      The max-lines Rust linter budgets code lines per file, so
//           engine dispatch, routing, and pre-validators live in
//           smaller topical files while callers keep the same paths.
// TS map:   `export { ... } from "./engine/foo";` from an `index.ts`.
//
// In TS you'd write (pseudocode):
// ```ts
// export { CompiledRegex } from "./compiled";
// export { requiresResharp } from "./routing";
// ```
mod compiled;
mod complement;
mod constants;
mod lookaround_misc;
mod lookaround_nested_quant;
mod lookaround_trailing;
mod quantifier;
mod routing;
mod slow_quantifier;

pub use compiled::CompiledRegex;
pub use complement::{
    complement_intersection_quantified_group,
    lookaround_in_complement,
    nested_complement,
};
pub use lookaround_misc::{
    intersection_with_lookbehind,
    intersection_with_word_end_alternation,
    lookaround_in_alternation_with_sibling,
};
pub use lookaround_nested_quant::nested_lookahead_in_quantified_group;
pub use lookaround_trailing::quantified_lookahead_with_sibling_content;
pub use quantifier::{nested_grouped_quantifier, stacked_quantifier};
pub use routing::requires_resharp;
pub use slow_quantifier::{
    nested_chain_in_lookaround_body,
    nested_quantifier_after_wildcard,
};
