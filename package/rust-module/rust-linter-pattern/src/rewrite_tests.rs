//! Unit tests for rewrite rendering.

/// Imports the cascade that turns a snippet into a pattern tree.
use crate::fragment::parse;
/// Imports the matcher that produces the bindings a rewrite substitutes.
use crate::matcher::find_all;
/// Imports the rewrite functions under test.
use crate::rewrite::{render, unbound_metavariables};

/// Imports the parser used to build a haystack from source text.
use ra_ap_syntax::{Edition, SourceFile};

// What:     `fn first_match(pattern: &str, source: &str) -> crate::matcher::Match`.
//           Runs a pattern and hands back the first place it matched.
// Why:      Rewriting needs bindings, and bindings only exist after a match, so
//           every test here starts with one.
/// Run a pattern over source text and return its first match.
fn first_match(pattern: &str, source: &str) -> crate::matcher::Match {
    let parsed = parse(pattern).expect("pattern should parse");
    let haystack = SourceFile::parse(source, Edition::CURRENT).syntax_node();

    return find_all(&parsed.root, &haystack)
        .into_iter()
        .next()
        .expect("pattern should match");
}

/// A rewrite substitutes what the pattern bound.
#[test]
fn rewrite_substitutes_a_binding() {
    let found = first_match("META_X.unwrap()", "fn f() { let a = thing.unwrap(); }");

    assert_eq!(
        render("META_X.expect(\"reason\")", &found),
        "thing.expect(\"reason\")",
        "the receiver is carried into the replacement"
    );
}

/// A rewrite naming no metavariables is emitted verbatim.
#[test]
fn rewrite_without_metavariables_is_literal() {
    let found = first_match("todo!()", "fn f() { todo!() }");

    assert_eq!(render("unimplemented!()", &found), "unimplemented!()", "verbatim");
}

/// A metavariable used twice in a rewrite is substituted twice.
#[test]
fn rewrite_substitutes_every_occurrence() {
    let found = first_match("META_X.unwrap()", "fn f() { let a = thing.unwrap(); }");

    assert_eq!(
        render("if META_X.is_some() { META_X.unwrap() }", &found),
        "if thing.is_some() { thing.unwrap() }",
        "both occurrences substituted"
    );
}

// What:     Two metavariables where one name is a prefix of the other.
// Why:      `META_A` is a prefix of `META_AB`. Substituting the shorter first
//           would rewrite the first six characters of the longer name and strand
//           a `B`, producing source that does not compile. Ordering by
//           descending length is what prevents it, and this is the test that
//           would catch losing that ordering.
/// A metavariable whose name prefixes another is substituted correctly.
#[test]
fn overlapping_metavariable_names_substitute_correctly() {
    let found = first_match("META_A == META_AB", "fn f() { if left == right {} }");

    assert_eq!(
        render("META_AB == META_A", &found),
        "right == left",
        "the longer name is substituted before the shorter one"
    );
}

/// A rewrite naming a metavariable the pattern never bound is reported.
#[test]
fn unbound_metavariable_is_reported() {
    let found = first_match("META_X.unwrap()", "fn f() { let a = thing.unwrap(); }");

    let missing = unbound_metavariables("META_X.or(META_Y)", &found.bindings);

    assert_eq!(
        missing,
        vec!["META_Y".to_string()],
        "the unbound name is named, so a rule can be rejected rather than \
         writing META_Y literally into someone's source"
    );
}

/// A rewrite using only bound metavariables reports nothing missing.
#[test]
fn fully_bound_rewrite_reports_nothing() {
    let found = first_match("META_X.unwrap()", "fn f() { let a = thing.unwrap(); }");

    assert!(
        unbound_metavariables("META_X.expect(\"r\")", &found.bindings).is_empty(),
        "nothing missing"
    );
}

/// A bare prefix with no name after it is not a metavariable.
#[test]
fn bare_prefix_is_not_a_metavariable() {
    let found = first_match("META_X.unwrap()", "fn f() { let a = thing.unwrap(); }");

    assert!(
        unbound_metavariables("META_", &found.bindings).is_empty(),
        "the prefix alone names no hole"
    );
}
