//! Configured severities and the rule categories they can be set through.

// What:     `use serde::Deserialize;` imports a DERIVE MACRO's trait from an
//           external dependency. Naming a crate directly, with no `crate::`
//           prefix, is what marks it external rather than part of this crate.
// Why:      The config file is TOML, and these types are read straight out of it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Deserialize } from "serde";
// ```
/// Imports the deserialization trait these config types derive.
use serde::Deserialize;

// What:     `#[derive(Deserialize)]` with `#[serde(rename_all = "kebab-case")]`
//           generates the code that reads this type from TOML, matching variants
//           against lowercase hyphenated spellings rather than the Rust names.
// Why:      A config file should say `warn`, not `Warn`.
//
// In TS you'd write (pseudocode):
// ```ts
// type RuleSeverity = "off" | "warn" | "error";
// ```
/// Severity a rule is configured at, or `Off` when it does not run.
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum RuleSeverity {
    /// Rule does not run at all.
    Off,

    /// Rule runs and reports without failing the run on its own.
    Warn,

    /// Rule runs and its findings fail the run.
    Error,
}

/// Parsing and interrogation helpers for configured severities.
impl RuleSeverity {
    // What:     `pub fn parse(text: &str) -> Option<Self>`. Takes a BORROWED
    //           string slice and answers with `Option<Self>`, the type that says
    //           "may be absent", because unrecognised text has no severity.
    // Why:      oxlint accepts `allow` and `deny` as aliases of `off` and
    //           `error`, and the `-A`/`-W`/`-D` flags speak that vocabulary.
    //           Accepting both spellings here means one parser serves the config
    //           file and the command line.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // static parse(text: string): RuleSeverity | undefined
    // ```
    /// Parse a severity from config or command-line text, aliases included.
    pub fn parse(text: &str) -> Option<Self> {
        // An if/else chain rather than a `match`, per AGENTS.md PP9.
        if text == "off" || text == "allow" {
            return Some(RuleSeverity::Off);
        } else if text == "warn" {
            return Some(RuleSeverity::Warn);
        } else if text == "error" || text == "deny" {
            return Some(RuleSeverity::Error);
        } else {
            return None;
        }
    }

    /// Report whether a rule at this severity runs at all.
    pub fn is_enabled(&self) -> bool {
        return *self != RuleSeverity::Off;
    }
}

// What:     `pub enum Category { .. }` lists the seven groups oxlint sorts every
//           rule into, so a config can set a whole group at once.
// Why:      Naming the same seven means a reader who knows oxlint's categories
//           already knows this linter's, and `-D correctness` means the same
//           thing in both.
//
// In TS you'd write (pseudocode):
// ```ts
// type Category = "correctness" | "suspicious" | /* ... */ | "nursery";
// ```
/// Group a rule belongs to, settable as a unit from config or command line.
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "kebab-case")]
pub enum Category {
    /// Code that is outright wrong or useless.
    Correctness,

    /// Code that is most likely wrong or useless.
    Suspicious,

    /// Strict lints, or ones with occasional false positives.
    Pedantic,

    /// Code that could be written more performantly.
    Perf,

    /// Code that should be written more idiomatically.
    Style,

    /// Lints preventing use of language and library features.
    Restriction,

    /// New lints still under development.
    Nursery,
}

/// Parsing and default-severity helpers for rule categories.
impl Category {
    /// Parse a category from config or command-line text.
    pub fn parse(text: &str) -> Option<Self> {
        if text == "correctness" {
            return Some(Category::Correctness);
        } else if text == "suspicious" {
            return Some(Category::Suspicious);
        } else if text == "pedantic" {
            return Some(Category::Pedantic);
        } else if text == "perf" {
            return Some(Category::Perf);
        } else if text == "style" {
            return Some(Category::Style);
        } else if text == "restriction" {
            return Some(Category::Restriction);
        } else if text == "nursery" {
            return Some(Category::Nursery);
        } else {
            return None;
        }
    }

    /// Return the name this category is written as in config and on the command line.
    pub fn name(&self) -> &'static str {
        if *self == Category::Correctness {
            return "correctness";
        } else if *self == Category::Suspicious {
            return "suspicious";
        } else if *self == Category::Pedantic {
            return "pedantic";
        } else if *self == Category::Perf {
            return "perf";
        } else if *self == Category::Style {
            return "style";
        } else if *self == Category::Restriction {
            return "restriction";
        } else {
            return "nursery";
        }
    }

    // What:     `pub fn default_severity(&self) -> RuleSeverity`.
    // Why:      oxlint enables `correctness` by default and leaves every other
    //           category off until asked for, which is why `oxlint` with no
    //           config reports so little. Matching that means a config that says
    //           nothing behaves the way an oxlint user expects.
    /// Return the severity this category carries when config says nothing.
    pub fn default_severity(&self) -> RuleSeverity {
        if *self == Category::Correctness {
            return RuleSeverity::Error;
        } else {
            return RuleSeverity::Off;
        }
    }
}
