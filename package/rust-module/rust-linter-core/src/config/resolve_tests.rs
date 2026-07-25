//! Unit tests for configuration merging and per-file rule resolution.

/// Imports the borrowed path type resolution matches globs against.
use std::path::Path;

/// Imports the on-disk configuration shape under test.
use crate::config::file::ConfigFile;
/// Imports the merging and resolution machinery under test.
use crate::config::resolve::{merge, LinterConfig};
/// Imports the severity and category vocabulary resolution speaks.
use crate::severity::{Category, RuleSeverity};

// What:     `fn parse(text: &str) -> ConfigFile`. Turns a TOML literal into the
//           config shape, failing the test if it does not parse.
// Why:      Every test below starts from config written as a user would write it,
//           rather than from a hand-built struct that could drift from what the
//           deserializer actually accepts.
//
// In TS you'd write (pseudocode):
// ```ts
// function parse(text: string): ConfigFile { return parseToml(text); }
// ```
/// Parse configuration text for a test, failing on malformed input.
fn parse(text: &str) -> ConfigFile {
    return toml::from_str(text).expect("test config should parse");
}

/// Compile configuration text into a resolvable configuration.
fn compile(text: &str) -> LinterConfig {
    return LinterConfig::compile(parse(text)).expect("test config globs should compile");
}

// What:     `fn severity_of(..) -> RuleSeverity`. Resolves one rule for one path.
// Why:      Nearly every assertion below is about one resolved severity.
/// Resolve one rule's severity for one path in a pedantic-category rule.
fn severity_of(linter: &LinterConfig, path: &str, rule: &str) -> RuleSeverity {
    return linter
        .resolve(Path::new(path), "builtin", rule, Category::Pedantic)
        .severity;
}

/// A rule nobody configured falls back to its category's default.
#[test]
fn unconfigured_rule_takes_its_category_default() {
    let linter = compile("");

    // Pedantic defaults to off, matching oxlint, where only `correctness` is on
    // until asked for.
    assert_eq!(
        severity_of(&linter, "src/lib.rs", "max-lines"),
        RuleSeverity::Off,
        "pedantic is off by default"
    );
}

/// A correctness rule is on by default, where a pedantic one is not.
#[test]
fn correctness_is_the_category_that_is_on_by_default() {
    let linter = compile("");

    let resolved = linter.resolve(
        Path::new("src/lib.rs"),
        "builtin",
        "some-rule",
        Category::Correctness,
    );

    assert_eq!(
        resolved.severity,
        RuleSeverity::Error,
        "correctness is on without being asked for"
    );
}

/// Setting a category reaches every rule filed under it.
#[test]
fn category_setting_reaches_its_rules() {
    let linter = compile("[categories]\npedantic = \"warn\"\n");

    assert_eq!(
        severity_of(&linter, "src/lib.rs", "max-lines"),
        RuleSeverity::Warn,
        "the category setting applies"
    );
}

/// A rule named directly beats its category.
#[test]
fn rule_setting_beats_category_setting() {
    let linter = compile(
        "[categories]\npedantic = \"warn\"\n\n[rules]\n\"builtin/max-lines\" = \"error\"\n",
    );

    assert_eq!(
        severity_of(&linter, "src/lib.rs", "max-lines"),
        RuleSeverity::Error,
        "the rule wins over its category"
    );
}

/// A rule may be named without its plugin prefix.
#[test]
fn bare_rule_name_resolves() {
    let linter = compile("[rules]\n\"max-lines\" = \"error\"\n");

    assert_eq!(
        severity_of(&linter, "src/lib.rs", "max-lines"),
        RuleSeverity::Error,
        "the bare spelling is accepted"
    );
}

/// The qualified spelling wins when a config carries both.
#[test]
fn qualified_rule_name_beats_bare_one() {
    let linter =
        compile("[rules]\n\"max-lines\" = \"warn\"\n\"builtin/max-lines\" = \"error\"\n");

    assert_eq!(
        severity_of(&linter, "src/lib.rs", "max-lines"),
        RuleSeverity::Error,
        "plugin/rule is the more specific spelling"
    );
}

/// An override applies only to the paths its globs match.
#[test]
fn override_applies_only_to_matching_paths() {
    let linter = compile(
        "[rules]\n\"builtin/max-lines\" = \"error\"\n\n[[overrides]]\nfiles = [\"**/*_tests.rs\"]\n\n[overrides.rules]\n\"builtin/max-lines\" = \"off\"\n",
    );

    assert_eq!(
        severity_of(&linter, "a/b/thing_tests.rs", "max-lines"),
        RuleSeverity::Off,
        "matching path is overridden"
    );
    assert_eq!(
        severity_of(&linter, "a/b/thing.rs", "max-lines"),
        RuleSeverity::Error,
        "non-matching path keeps the base setting"
    );
}

/// An excluded file is still linted; the override simply misses it.
#[test]
fn exclude_files_subtracts_from_an_override() {
    let linter = compile(
        "[rules]\n\"builtin/max-lines\" = \"error\"\n\n[[overrides]]\nfiles = [\"**/*.rs\"]\nexclude-files = [\"**/keep.rs\"]\n\n[overrides.rules]\n\"builtin/max-lines\" = \"off\"\n",
    );

    assert_eq!(
        severity_of(&linter, "a/drop.rs", "max-lines"),
        RuleSeverity::Off,
        "covered by the override"
    );
    assert_eq!(
        severity_of(&linter, "a/keep.rs", "max-lines"),
        RuleSeverity::Error,
        "excluded from the override, so still enforced"
    );
}

/// When two overrides match, the later one wins.
#[test]
fn later_override_wins() {
    let linter = compile(
        "[[overrides]]\nfiles = [\"**/*.rs\"]\n\n[overrides.rules]\n\"builtin/max-lines\" = \"off\"\n\n[[overrides]]\nfiles = [\"**/*.rs\"]\n\n[overrides.rules]\n\"builtin/max-lines\" = \"error\"\n",
    );

    assert_eq!(
        severity_of(&linter, "a/b.rs", "max-lines"),
        RuleSeverity::Error,
        "the last matching override decides"
    );
}

/// Options travel with the setting that won.
#[test]
fn winning_layer_supplies_the_options() {
    let linter = compile(
        "[rules]\n[rules.\"builtin/max-lines\"]\nseverity = \"error\"\nmax = 120\n",
    );

    let resolved = linter.resolve(
        Path::new("src/lib.rs"),
        "builtin",
        "max-lines",
        Category::Pedantic,
    );

    let options = resolved.options.expect("options should be present");
    assert_eq!(
        options.get("max").and_then(toml::Value::as_integer),
        Some(120),
        "the configured option travels with the severity"
    );
}

/// Ignore patterns exclude a file from the run entirely.
#[test]
fn ignore_patterns_match_paths() {
    let linter = compile("ignore-patterns = [\"**/generated/**\"]\n");

    assert!(
        linter.is_ignored(Path::new("a/generated/x.rs")),
        "generated path ignored"
    );
    assert!(
        !linter.is_ignored(Path::new("a/src/x.rs")),
        "ordinary path not ignored"
    );
}

/// A malformed glob is reported rather than silently matching nothing.
#[test]
fn malformed_glob_is_an_error() {
    // An unclosed character class is not a valid glob.
    let result = LinterConfig::compile(parse("ignore-patterns = [\"a[\"]\n"));

    // `.is_err()` is true when a `Result` holds the failure variant.
    assert!(result.is_err(), "a bad glob must fail loudly");
}

/// Merging lets a nearer configuration restate only what it changes.
#[test]
fn merge_overlays_maps_key_by_key() {
    let base = parse("[rules]\n\"a\" = \"error\"\n\"b\" = \"error\"\n");
    let nearer = parse("[rules]\n\"b\" = \"off\"\n");

    let merged = LinterConfig::compile(merge(base, nearer)).expect("merged config compiles");

    assert_eq!(
        severity_of(&merged, "src/lib.rs", "a"),
        RuleSeverity::Error,
        "untouched key survives the merge"
    );
    assert_eq!(
        severity_of(&merged, "src/lib.rs", "b"),
        RuleSeverity::Off,
        "restated key is replaced"
    );
}

/// Merging concatenates sequences rather than replacing them.
#[test]
fn merge_concatenates_ignore_patterns_and_overrides() {
    let base = parse("ignore-patterns = [\"**/one/**\"]\n");
    let nearer = parse("ignore-patterns = [\"**/two/**\"]\n");

    let merged = LinterConfig::compile(merge(base, nearer)).expect("merged config compiles");

    assert!(merged.is_ignored(Path::new("a/one/x.rs")), "base pattern kept");
    assert!(
        merged.is_ignored(Path::new("a/two/x.rs")),
        "nearer pattern added"
    );
}

/// A nearer option replaces the inherited one, and absence inherits.
#[test]
fn merge_lets_nearer_options_win() {
    let base = parse("[options]\nmax-warnings = 5\ndeny-warnings = true\n");
    let nearer = parse("[options]\nmax-warnings = 0\n");

    let merged = merge(base, nearer);

    assert_eq!(
        merged.options.max_warnings,
        Some(0),
        "nearer value wins, and zero is distinct from absent"
    );
    assert!(
        merged.options.deny_warnings,
        "an option the nearer file said nothing about is inherited"
    );
}
