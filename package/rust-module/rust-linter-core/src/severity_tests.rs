//! Unit tests for configured severities and rule categories.

/// Imports the severity and category types under test.
use crate::severity::{Category, RuleSeverity};

/// Every severity spelling parses, including oxlint's allow and deny aliases.
#[test]
fn severity_parses_every_accepted_spelling() {
    assert_eq!(RuleSeverity::parse("off"), Some(RuleSeverity::Off), "off");
    assert_eq!(
        RuleSeverity::parse("allow"),
        Some(RuleSeverity::Off),
        "allow is oxlint's -A spelling of off"
    );
    assert_eq!(RuleSeverity::parse("warn"), Some(RuleSeverity::Warn), "warn");
    assert_eq!(
        RuleSeverity::parse("error"),
        Some(RuleSeverity::Error),
        "error"
    );
    assert_eq!(
        RuleSeverity::parse("deny"),
        Some(RuleSeverity::Error),
        "deny is oxlint's -D spelling of error"
    );
}

/// Unrecognised text has no severity rather than a silent fallback.
#[test]
fn unknown_severity_is_absent() {
    // A fallback here would turn a typo into a rule silently running at some
    // severity nobody asked for.
    assert_eq!(RuleSeverity::parse("errr"), None, "typo");
    assert_eq!(RuleSeverity::parse(""), None, "empty");
    assert_eq!(RuleSeverity::parse("Error"), None, "case is significant");
}

/// Only `off` disables a rule; a warning still runs.
#[test]
fn only_off_disables_a_rule() {
    assert!(!RuleSeverity::Off.is_enabled(), "off does not run");
    assert!(RuleSeverity::Warn.is_enabled(), "warn still runs");
    assert!(RuleSeverity::Error.is_enabled(), "error runs");
}

/// Every category name parses back to itself.
#[test]
fn category_names_round_trip() {
    let all = [
        Category::Correctness,
        Category::Suspicious,
        Category::Pedantic,
        Category::Perf,
        Category::Style,
        Category::Restriction,
        Category::Nursery,
    ];

    // What:     `for category in all`. Iterates the fixed-size array by value;
    //           `Category` is `Copy`, so nothing is moved out from under it.
    // Why:      A name that did not parse back would break `-D <category>` for
    //           exactly that category, and only for that one.
    for category in all {
        assert_eq!(
            Category::parse(category.name()),
            Some(category),
            "{} should round-trip",
            category.name()
        );
    }
}

/// Unrecognised category text is absent rather than a silent fallback.
#[test]
fn unknown_category_is_absent() {
    assert_eq!(Category::parse("correct"), None, "near miss");
    assert_eq!(Category::parse(""), None, "empty");
}

/// Correctness is the one category enabled without being asked for.
#[test]
fn only_correctness_is_on_by_default() {
    assert_eq!(
        Category::Correctness.default_severity(),
        RuleSeverity::Error,
        "correctness runs by default, matching oxlint"
    );

    let off_by_default = [
        Category::Suspicious,
        Category::Pedantic,
        Category::Perf,
        Category::Style,
        Category::Restriction,
        Category::Nursery,
    ];

    for category in off_by_default {
        assert_eq!(
            category.default_severity(),
            RuleSeverity::Off,
            "{} should be off until asked for",
            category.name()
        );
    }
}
