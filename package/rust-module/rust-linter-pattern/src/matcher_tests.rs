//! Unit tests for structural matching.

/// Imports the cascade that turns a snippet into a pattern tree.
use crate::fragment::parse;
/// Imports the matcher under test.
use crate::matcher::find_all;

/// Imports the parser used to build a haystack from source text.
use ra_ap_syntax::{Edition, SourceFile};

// What:     `fn matches_in(pattern: &str, source: &str) -> Vec<String>`. Runs a
//           pattern over a source and returns the text each match covered.
// Why:      Every test asks the same two questions: how many places matched, and
//           what did they cover. Returning the matched text answers both.
/// Run a pattern over source text, returning what each match covered.
fn matches_in(pattern: &str, source: &str) -> Vec<String> {
    let parsed = parse(pattern).expect("pattern should parse");
    let haystack = SourceFile::parse(source, Edition::CURRENT).syntax_node();

    return find_all(&parsed.root, &haystack)
        .into_iter()
        .map(|found| return found.node.text().to_string())
        .collect();
}

/// A metavariable stands in for any receiver.
#[test]
fn metavariable_matches_any_receiver() {
    let found = matches_in(
        "META_X.unwrap()",
        "fn f() { let a = thing.unwrap(); let b = other().unwrap(); }",
    );

    assert_eq!(found.len(), 2, "both calls matched: {found:?}");
    assert!(found.contains(&"thing.unwrap()".to_string()), "{found:?}");
    assert!(found.contains(&"other().unwrap()".to_string()), "{found:?}");
}

/// A pattern does not match a different method.
#[test]
fn pattern_does_not_match_a_different_method() {
    let found = matches_in("META_X.unwrap()", "fn f() { let a = thing.expect(\"x\"); }");

    assert!(found.is_empty(), "no match: {found:?}");
}

// What:     The case that decides whether this is structural matching or text
//           matching wearing a costume.
// Why:      A line scanner would find `thing.unwrap()` inside the string and
//           report it. Matching over the syntax tree cannot, because the string
//           is one token and its contents are never parsed as code.
/// Pattern text inside a string literal does not match.
#[test]
fn pattern_inside_a_string_literal_does_not_match() {
    let found = matches_in(
        "META_X.unwrap()",
        "fn f() { let s = \"thing.unwrap()\"; }",
    );

    assert!(found.is_empty(), "a string's contents are not code: {found:?}");
}

/// Pattern text inside a comment does not match either.
#[test]
fn pattern_inside_a_comment_does_not_match() {
    let found = matches_in("META_X.unwrap()", "fn f() {\n    // thing.unwrap()\n}");

    assert!(found.is_empty(), "a comment is not code: {found:?}");
}

/// Formatting differences between pattern and source do not defeat a match.
#[test]
fn whitespace_differences_still_match() {
    let found = matches_in("META_X.unwrap()", "fn f() { let a = thing . unwrap (  ) ; }");

    assert_eq!(found.len(), 1, "spacing is not significant: {found:?}");
}

// What:     One metavariable used twice in a single pattern.
// Why:      Without a consistency check the second occurrence would match
//           anything, and `META_X == META_X` would match `a == b`. The pattern
//           would then say less than it appears to, which is worse than not
//           supporting repetition at all.
/// A metavariable used twice must bind to the same text both times.
#[test]
fn repeated_metavariable_must_match_consistently() {
    let same = matches_in("META_X == META_X", "fn f() { if a == a {} }");
    assert_eq!(same.len(), 1, "identical operands match: {same:?}");

    let different = matches_in("META_X == META_X", "fn f() { if a == b {} }");
    assert!(
        different.is_empty(),
        "differing operands must not match: {different:?}"
    );
}

/// Two different metavariables may bind to different things.
#[test]
fn distinct_metavariables_bind_independently() {
    let found = matches_in("META_A == META_B", "fn f() { if a == b {} }");

    assert_eq!(found.len(), 1, "independent holes: {found:?}");
}

/// A metavariable can stand in for a whole nested expression.
#[test]
fn metavariable_matches_a_nested_expression() {
    let found = matches_in("META_X.unwrap()", "fn f() { let a = map.get(&k).unwrap(); }");

    assert_eq!(found.len(), 1, "nested receiver: {found:?}");
    assert_eq!(found[0], "map.get(&k).unwrap()", "the whole call matched");
}

/// An item pattern matches an item.
#[test]
fn item_pattern_matches_an_item() {
    let found = matches_in("fn META_F() {}", "fn alpha() {}\nfn beta() { let a = 1; }");

    assert_eq!(found.len(), 1, "only the empty-bodied fn: {found:?}");
    assert_eq!(found[0], "fn alpha() {}", "matched the right one");
}

/// A statement pattern matches a statement.
#[test]
fn statement_pattern_matches_a_statement() {
    let found = matches_in("let META_A = 1;", "fn f() { let x = 1; let y = 2; }");

    assert_eq!(found.len(), 1, "only the one binding 1: {found:?}");
    assert_eq!(found[0], "let x = 1;", "matched the right one");
}

/// A literal pattern with no metavariables matches exactly.
#[test]
fn literal_pattern_matches_exactly() {
    let found = matches_in("todo!()", "fn f() { todo!() }\nfn g() { unimplemented!() }");

    assert_eq!(found.len(), 1, "only the exact call: {found:?}");
}

/// A pattern that matches nothing returns nothing rather than failing.
#[test]
fn pattern_matching_nothing_is_empty() {
    let found = matches_in("META_X.unwrap()", "fn f() {}");

    assert!(found.is_empty(), "no matches: {found:?}");
}
