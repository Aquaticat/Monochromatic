//! Registry of the rules this binary composes.
//!
//! The rules themselves live in rule packages now, not here. This module only
//! answers "which packages does this binary compose, and are they enabled".

// What:     `pub use other_crate::path::Item;` re-exports a name from a
//           DEPENDENCY under this crate's own path, so `crate::rule::Rule` keeps
//           resolving for every consumer that already used it.
// Why:      The trait lives in the core crate; the path it is reached by here
//           did not change when it moved.
//
// In TS you'd write (pseudocode):
// ```ts
// export { Rule } from "@monochromatic-dev/rust-linter-core/rule";
// ```
/// Re-exports the rule interface under this crate's original path.
pub use monochromatic_rust_linter_core::rule::Rule;

/// Imports the compiled configuration deciding which plugins are enabled.
use monochromatic_rust_linter_core::config::resolve::LinterConfig;

// What:     `pub fn all_rules(linter: &LinterConfig) -> Vec<Box<dyn Rule>>`.
//           Takes the configuration, unlike the old no-argument version.
// Why:      Which plugins run is a configuration question now. A plugin the
//           config disabled contributes no rules at all, rather than
//           contributing rules that are then resolved to off one by one.
//
// In TS you'd write (pseudocode):
// ```ts
// function allRules(linter: LinterConfig): Rule[]
// ```
/// Build the rules this binary composes, honouring the enabled plugin set.
pub fn all_rules(linter: &LinterConfig) -> Vec<Box<dyn Rule>> {
    let mut rules: Vec<Box<dyn Rule>> = Vec::new();

    // Each rule package answers for its own rules, so adding one there needs no
    // change here beyond composing the package.
    if linter.plugin_enabled(monochromatic_rust_linter_plugin_builtin::PLUGIN) {
        rules.extend(monochromatic_rust_linter_plugin_builtin::rules());
    }

    return rules;
}
