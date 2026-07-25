//! The shape of one `rust-linter.toml` on disk.

// What:     `use std::collections::BTreeMap;` imports an ordered map. Sibling:
//           `HashMap`, which is faster but iterates in an unpredictable order.
// Why:      Ordered, because `--print-config` has to emit the same bytes for the
//           same config every run, and a hash map's order would shuffle.
//
// In TS you'd write (pseudocode):
// ```ts
// // a Map<string, RuleSetting> that always iterates in sorted key order
// ```
/// Imports the ordered map rule tables are held in.
use std::collections::BTreeMap;

/// Imports the deserialization trait every config type derives.
use serde::Deserialize;

/// Imports the configured-severity and category types.
use crate::severity::{Category, RuleSeverity};

// What:     `#[serde(default)]` on a struct makes every absent field fall back to
//           its type's default rather than being an error, and
//           `deny_unknown_fields` turns a misspelled key into a loud failure
//           instead of a silently ignored one.
// Why:      Config keys are almost all optional, but a typo in one should not
//           quietly do nothing, which is the classic way a lint config lies about
//           what it enforces.
//
// In TS you'd write (pseudocode):
// ```ts
// type ConfigFile = { extends?: string[]; rules?: Record<string, RuleSetting>; /* ... */ };
// ```
/// One configuration file, exactly as written on disk.
#[derive(Clone, Debug, Default, Deserialize)]
#[serde(default, deny_unknown_fields, rename_all = "kebab-case")]
pub struct ConfigFile {
    // What:     `extends: Vec<String>`. Paths, resolved relative to the file that
    //           names them.
    // Why:      Shared policy lives in one file that packages inherit, rather
    //           than being restated in each of the repo's Rust packages.
    /// Paths to configuration files this one inherits from, nearest last.
    pub extends: Vec<String>,

    /// Globs of files never linted, whatever the rules say.
    pub ignore_patterns: Vec<String>,

    /// Run-wide switches, mirroring oxlint's `options` table.
    pub options: Options,

    /// Severity per category, applied before individual rules.
    pub categories: BTreeMap<Category, RuleSeverity>,

    /// Severity, and optionally options, per rule.
    pub rules: BTreeMap<String, RuleSetting>,

    /// Per-glob reconfiguration, applied in order after everything above.
    pub overrides: Vec<Override>,
}

/// Run-wide switches that are not about any single rule.
#[derive(Clone, Debug, Default, Deserialize)]
#[serde(default, deny_unknown_fields, rename_all = "kebab-case")]
pub struct Options {
    /// Make warnings fail the run.
    pub deny_warnings: bool,

    // What:     `max_warnings: Option<usize>`. Absent means "no threshold",
    //           which is a different thing from a threshold of zero.
    // Why:      `Option` keeps those two states distinct; a bare `usize` would
    //           make zero mean both "allow none" and "not configured".
    /// Warning count above which the run fails, absent when unlimited.
    pub max_warnings: Option<usize>,

    /// Severity for directives that suppress nothing, absent when not reported.
    pub report_unused_disable_directives: Option<RuleSeverity>,
}

// What:     `#[serde(untagged)]` tells serde to try each variant in order and
//           keep the first that parses, rather than requiring a tag field naming
//           which variant this is.
// Why:      A rule may be written either as a bare severity string or as a table
//           carrying options, and neither form has a tag to distinguish it. The
//           bare form comes first because it is the narrower parse.
//
// In TS you'd write (pseudocode):
// ```ts
// type RuleSetting = RuleSeverity | { severity: RuleSeverity; [option: string]: unknown };
// ```
/// How one rule is configured: a bare severity, or a severity plus options.
#[derive(Clone, Debug, Deserialize)]
#[serde(untagged)]
pub enum RuleSetting {
    /// `"builtin/max-lines" = "error"`.
    Bare(
        /// Severity this rule reports at.
        RuleSeverity,
    ),

    /// `[rules."builtin/max-lines"]` with `severity` and rule options beside it.
    Detailed(
        /// Severity together with the rule's own option keys.
        DetailedRule,
    ),
}

/// Severity resolution for either spelling of a rule setting.
impl RuleSetting {
    // What:     `match self { RuleSetting::Bare(s) => .., .. }`. Rust's `match`
    //           is not TS's `switch`: it has no fallthrough, needs no `break`,
    //           and the compiler REJECTS it unless every variant is covered. The
    //           `*` on `*severity` dereferences the borrow the pattern bound.
    // Why:      Exhaustiveness is the point. Adding a third spelling of a rule
    //           setting later becomes a compile error here, rather than an
    //           unreachable branch that silently invents a severity.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // severity(): RuleSeverity { return typeof this === "string" ? this : this.severity; }
    // ```
    /// Return the severity this setting configures, whichever form it took.
    pub fn severity(&self) -> RuleSeverity {
        return match self {
            RuleSetting::Bare(severity) => *severity,
            RuleSetting::Detailed(detailed) => detailed.severity,
        };
    }

    // What:     `pub fn options(&self) -> Option<&toml::Table>` hands back a
    //           BORROWED view of the options table rather than a copy, so reading
    //           a rule's options costs nothing.
    // Why:      A bare setting has no options at all, which `None` says exactly.
    /// Return this rule's option table, absent when configured bare.
    pub fn options(&self) -> Option<&toml::Table> {
        return match self {
            RuleSetting::Bare(_) => None,
            RuleSetting::Detailed(detailed) => Some(&detailed.options),
        };
    }
}

// What:     No `deny_unknown_fields` here, unlike every other config struct.
// Why:      It is incompatible with `#[serde(flatten)]` below, and would be
//           wrong anyway: absorbing the unknown keys is exactly what the
//           flattened options table is for. A rule's option names belong to that
//           rule, so this layer cannot know which are valid.
/// A rule configured with options beside its severity.
#[derive(Clone, Debug, Deserialize)]
pub struct DetailedRule {
    /// Severity this rule reports at.
    pub severity: RuleSeverity,

    // What:     `#[serde(flatten)]` folds every remaining key of the table into
    //           this field instead of requiring them under a nested `options`
    //           key. `toml::Table` is an untyped map of whatever was written.
    // Why:      Rule options are written beside the severity, so
    //           `[rules."builtin/max-lines"]` takes `severity` and `max` as
    //           siblings, which is how a TOML author expects to write it.
    /// Every other key in the table, passed to the rule as its options.
    #[serde(flatten)]
    pub options: toml::Table,
}

/// One glob-scoped reconfiguration of the rules above it.
#[derive(Clone, Debug, Default, Deserialize)]
#[serde(default, deny_unknown_fields, rename_all = "kebab-case")]
pub struct Override {
    /// Globs this override applies to.
    pub files: Vec<String>,

    // What:     Globs subtracted from `files`, not from the run as a whole.
    // Why:      A file excluded here is still linted; this override simply does
    //           not apply to it. That is the same distinction oxlint draws
    //           between `excludeFiles` and `ignorePatterns`.
    /// Globs this override does not apply to, though they are still linted.
    pub exclude_files: Vec<String>,

    /// Rule settings replacing the inherited ones for matching files.
    pub rules: BTreeMap<String, RuleSetting>,
}
