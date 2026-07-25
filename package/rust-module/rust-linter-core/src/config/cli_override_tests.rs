//! Unit tests for command-line severity overrides.

/// Imports the override types under test.
use crate::config::cli_override::{CliOverride, OverrideTarget};
/// Imports the severity and category vocabulary overrides speak.
use crate::severity::{Category, RuleSeverity};

/// The literal `all` is recognised rather than treated as a rule name.
#[test]
fn all_parses_as_the_wildcard_target() {
    let parsed = CliOverride::parse("all", RuleSeverity::Off);

    assert_eq!(parsed.target, OverrideTarget::All, "all is the wildcard");
    assert_eq!(parsed.severity, RuleSeverity::Off, "severity round-trips");
}

/// A category name is recognised as a category, not a rule.
#[test]
fn category_name_parses_as_a_category() {
    let parsed = CliOverride::parse("pedantic", RuleSeverity::Warn);

    assert_eq!(
        parsed.target,
        OverrideTarget::Category(Category::Pedantic),
        "pedantic is a category"
    );
}

/// Anything else is taken as a rule name rather than rejected.
#[test]
fn unknown_name_parses_as_a_rule() {
    let parsed = CliOverride::parse("no-unwrap", RuleSeverity::Error);

    // Rejecting unknown names would break every invocation naming a rule from a
    // plugin this binary happens not to have compiled in.
    assert_eq!(
        parsed.target,
        OverrideTarget::Rule("no-unwrap".to_string()),
        "an unrecognised name is a rule, not an error"
    );
}

/// The wildcard reaches every category except nursery.
#[test]
fn all_skips_nursery() {
    let parsed = CliOverride::parse("all", RuleSeverity::Error);

    assert!(
        parsed.matches("builtin", "some-rule", Category::Correctness),
        "correctness is covered"
    );
    assert!(
        parsed.matches("builtin", "some-rule", Category::Restriction),
        "restriction is covered"
    );
    assert!(
        !parsed.matches("builtin", "some-rule", Category::Nursery),
        "nursery stays opt-in, matching oxlint"
    );
}

/// A category override reaches only rules filed under that category.
#[test]
fn category_override_matches_only_its_category() {
    let parsed = CliOverride::parse("pedantic", RuleSeverity::Off);

    assert!(
        parsed.matches("builtin", "max-lines", Category::Pedantic),
        "same category matches"
    );
    assert!(
        !parsed.matches("builtin", "max-lines", Category::Style),
        "a different category does not"
    );
}

/// A rule override accepts both the bare and the qualified spelling.
#[test]
fn rule_override_accepts_either_spelling() {
    let bare = CliOverride::parse("max-lines", RuleSeverity::Off);
    let qualified = CliOverride::parse("builtin/max-lines", RuleSeverity::Off);

    assert!(
        bare.matches("builtin", "max-lines", Category::Pedantic),
        "bare name matches"
    );
    assert!(
        qualified.matches("builtin", "max-lines", Category::Pedantic),
        "qualified name matches"
    );
    assert!(
        !qualified.matches("other", "max-lines", Category::Pedantic),
        "a qualified name does not match a different plugin"
    );
}

/// A rule override ignores rules with a different name.
#[test]
fn rule_override_ignores_other_rules() {
    let parsed = CliOverride::parse("max-lines", RuleSeverity::Off);

    assert!(
        !parsed.matches("builtin", "require-rustdoc", Category::Pedantic),
        "a different rule is untouched"
    );
}
