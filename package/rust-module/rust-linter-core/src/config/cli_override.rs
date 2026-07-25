//! Severity overrides accumulated from the command line.

/// Imports the severity and category vocabulary overrides speak.
use crate::severity::{Category, RuleSeverity};

// What:     `pub enum OverrideTarget { .. }` names what one `-A`, `-W` or `-D`
//           flag points at. The `Rule` variant CARRIES an owned `String`, unlike
//           the other two, because a rule name is arbitrary text rather than one
//           of a fixed set.
// Why:      `-D correctness` and `-D no-unwrap` look identical on the command
//           line but mean different things, and the difference has to survive
//           into resolution rather than being guessed there.
//
// In TS you'd write (pseudocode):
// ```ts
// type OverrideTarget = { kind: "all" } | { kind: "category"; value: Category }
//                     | { kind: "rule"; value: string };
// ```
/// What a command-line severity flag applies to.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum OverrideTarget {
    /// Every category except nursery, matching oxlint's `all`.
    All,

    /// One category, and so every rule filed under it.
    Category(
        /// Category this flag names.
        Category,
    ),

    /// One rule, named with or without its plugin prefix.
    Rule(
        /// Rule name as written on the command line.
        String,
    ),
}

/// One `-A`, `-W` or `-D` flag, in the order it appeared.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CliOverride {
    /// What this flag applies to.
    pub target: OverrideTarget,

    /// Severity it sets.
    pub severity: RuleSeverity,
}

/// Construction and matching for command-line severity overrides.
impl CliOverride {
    // What:     `pub fn parse(name: &str, severity: RuleSeverity) -> Self`.
    //           Cannot fail: anything that is not `all` and not a category name
    //           is taken as a rule name.
    // Why:      oxlint resolves the same ambiguity the same way, and a linter
    //           that rejected `-D my-rule` because it did not recognise the rule
    //           would break every config that names a rule from a plugin the
    //           binary happens not to have compiled in.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // static parse(name: string, severity: RuleSeverity): CliOverride
    // ```
    /// Build an override from a flag's argument text.
    pub fn parse(name: &str, severity: RuleSeverity) -> Self {
        if name == "all" {
            return Self {
                target: OverrideTarget::All,
                severity,
            };
        }

        // `if let Some(category) = ..` runs the block only when the parse
        // produced a value, binding it.
        if let Some(category) = Category::parse(name) {
            return Self {
                target: OverrideTarget::Category(category),
                severity,
            };
        }

        return Self {
            target: OverrideTarget::Rule(name.to_string()),
            severity,
        };
    }

    // What:     `pub fn matches(&self, plugin: &str, rule_id: &str, category:
    //           Category) -> bool`. Answers whether this override governs one
    //           specific rule.
    // Why:      Resolution walks every override in order, and each has to answer
    //           for itself rather than the resolver knowing each variant's rules.
    /// Report whether this override applies to the given rule.
    pub fn matches(&self, plugin: &str, rule_id: &str, category: Category) -> bool {
        return match &self.target {
            // `all` covers every category except nursery, which stays opt-in
            // because those rules are explicitly still under development.
            OverrideTarget::All => category != Category::Nursery,

            // `*named` dereferences the borrow the pattern bound, so the
            // comparison is between two values rather than a value and a borrow.
            OverrideTarget::Category(named) => *named == category,

            // Both spellings are accepted, matching how the config file resolves
            // a rule name.
            OverrideTarget::Rule(named) => {
                named == rule_id || *named == format!("{plugin}/{rule_id}")
            }
        };
    }
}
