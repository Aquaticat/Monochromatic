// What:     `crate::fuzz_api` is a curated re-export module that
//           appears ONLY when the crate is built with the `fuzzing`
//           Cargo feature on. It pulls together the helpers
//           `fuzz/fuzz_targets/*.rs` need without widening any
//           production public API: the bin target builds with
//           `fuzzing` off and sees the same surface as before.
// Why:      The plan requires fuzz internals to live behind a
//           feature gate, not be merged into the production `pub use`
//           block in `rules.rs`. This module is the single import
//           surface every fuzz target points at; if we need to
//           expose a new helper, it gets re-exported here once and
//           every target picks it up.
// TS map:   `export * from "./rules"; export * from "./scan"; export * from "./scan_format";`
//           but only when the package is built with the `fuzzing`
//           build tag.
//
// In TS you'd write (pseudocode):
// ```ts
// // Conditional re-export module (no direct TS analogue).
// export {
//   compileRuleSrc, loadRulesetFromSource, extractGatingSubstrings,
//   requiresResharp, lookaroundInComplement, buildResidualShards,
//   walkLiteralBytes, skipAtomWithExtract,
//   groupBodyStart, findMatchingCloseParen, skipAnyQuantifier,
//   quantifierIsRequired, skipClassBody,
//   AcMeta, CompiledRegex, RegexRule, ResidualShard, RuleSet,
//   isWordByte, SUBSTRING_THRESHOLD, ParsedRule, parseRuleSource,
// } from "./rules";
// export { scanContent } from "./scan";
// export {
//   buildLineIndex, lineAndColIndexed, endInLineIndexed,
//   formatHit, emitHit,
// } from "./scan_format";
// ```

// What:     `pub use crate::rules::{...};` re-exports the rules-
//           module symbols the fuzz targets need. Every name is
//           already public-or-pub(crate) inside `crate::rules`;
//           re-exporting them here narrows fuzz target imports to
//           a single path (`forbidden_strings::fuzz_api::*`).
// Why:      Single import surface. If a target needs a new
//           helper, add the name here once.
// TS map:   `export { ... } from "./rules";`.
//
// In TS you'd write (pseudocode):
// ```ts
// export {
//   compileRuleSrc, loadRulesetFromSource, extractGatingSubstrings,
//   requiresResharp, lookaroundInComplement, buildResidualShards,
//   walkLiteralBytes, skipAtomWithExtract,
//   groupBodyStart, findMatchingCloseParen, skipAnyQuantifier,
//   quantifierIsRequired, skipClassBody,
//   AcMeta, CompiledRegex, RegexRule, ResidualShard, RuleSet,
//   isWordByte, SUBSTRING_THRESHOLD, ParsedRule, parseRuleSource,
// } from "./rules";
// ```
pub use crate::rules::{
    build_residual_shards,
    compile_rule_src,
    extract_gating_substrings,
    find_matching_close_paren,
    group_body_start,
    is_word_byte,
    load_ruleset_from_source,
    lookaround_in_complement,
    parse_rule_source,
    quantifier_is_required,
    requires_resharp,
    skip_any_quantifier,
    skip_atom_with_extract,
    skip_class_body,
    walk_literal_bytes,
    AcMeta,
    CompiledRegex,
    ParsedRule,
    RegexRule,
    ResidualShard,
    RuleSet,
    SUBSTRING_THRESHOLD,
};

// What:     `pub use crate::scan::scan_content;`. The main scanner
//           entry point; takes a path label, file content, and a
//           ruleset, and returns the hit-formatted `Vec<String>`.
// Why:      Several fuzz targets exercise the full scan pipeline,
//           not just sub-components. They need this entry point.
// TS map:   `export { scanContent } from "./scan";`.
//
// In TS you'd write (pseudocode):
// ```ts
// export { scanContent } from "./scan";
// ```
pub use crate::scan::scan_content;

// What:     `pub use crate::scan_format::{...};` re-exports the
//           hit-formatting helpers `fuzz_scan_format` exercises.
// Why:      The format target asserts byte-to-line/column conversion
//           and hit redaction invariants -- it needs direct access
//           to the four helpers and the higher-level `format_hit` /
//           `emit_hit` entry points.
// TS map:   `export { buildLineIndex, lineAndColIndexed, endInLineIndexed, formatHit, emitHit } from "./scan_format";`.
//
// In TS you'd write (pseudocode):
// ```ts
// export {
//   buildLineIndex, lineAndColIndexed, endInLineIndexed,
//   formatHit, emitHit,
// } from "./scan_format";
// ```
pub use crate::scan_format::{
    build_line_index,
    emit_hit,
    end_in_line_indexed,
    format_hit,
    line_and_col_indexed,
};
