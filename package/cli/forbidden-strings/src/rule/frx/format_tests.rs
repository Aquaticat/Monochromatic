// Tests for the two-form file format, flag policy, and BOM stripping.

use super::parse_patterns;
use super::strip_bom;
use crate::rule::frx::LoadError;

#[test]
fn literal_line_is_escaped() {
    let patterns = parse_patterns("a.b").expect("one literal");
    assert_eq!(patterns, vec!["a\\.b".to_string()]);
}

#[test]
fn regex_line_passes_body_and_drops_noop_flags() {
    // `m` and `x` are no-ops (the engine is always multiline and verbose), so the
    // body is passed through unchanged with the flags dropped.
    let patterns = parse_patterns("/foo[0-9]/mx").expect("regex with noop flags");
    assert_eq!(patterns, vec!["foo[0-9]".to_string()]);

    let plain = parse_patterns("/bar/").expect("regex no flags");
    assert_eq!(plain, vec!["bar".to_string()]);
}

#[test]
fn bad_flag_fails_closed_with_index() {
    // First rule good, second carries an unsupported `i`, so index 1 hard-errors.
    let err = parse_patterns("/good/\n/other/i").expect_err("bad flag");
    assert_eq!(err, LoadError::UnsupportedFlag { index: 1, flag: 'i' });

    // `m`/`x` before a bad letter still report the first offender.
    let mixed = parse_patterns("/p/mxs").expect_err("bad flag after noops");
    assert_eq!(mixed, LoadError::UnsupportedFlag { index: 0, flag: 's' });
}

#[test]
fn blanks_and_comments_are_skipped() {
    let patterns = parse_patterns("# comment\n\n  \nreal").expect("one rule");
    assert_eq!(patterns, vec!["real".to_string()]);
}

#[test]
fn empty_or_comment_only_source_is_no_rules() {
    assert_eq!(parse_patterns("").expect_err("empty"), LoadError::NoRules);
    assert_eq!(
        parse_patterns("# only a comment\n\n").expect_err("comment only"),
        LoadError::NoRules,
    );
}

#[test]
fn leading_bom_is_stripped() {
    // A BOM before the first rule must not become part of it.
    let patterns = parse_patterns("\u{FEFF}abc").expect("bom rule");
    assert_eq!(patterns, vec!["abc".to_string()]);

    assert_eq!(strip_bom("plain"), "plain");
    assert_eq!(strip_bom("\u{FEFF}x"), "x");
    // A BOM followed only by a comment still yields no rules.
    assert_eq!(parse_patterns("\u{FEFF}# c").expect_err("bom comment"), LoadError::NoRules);
}

#[test]
fn slashed_line_with_nonflag_trailer_is_literal() {
    // Trailing `9` is not a lowercase flag run, so the whole line is a literal,
    // not the regex body `x`.
    let patterns = parse_patterns("/x/9").expect("literal");
    assert_eq!(patterns.len(), 1);
    assert_ne!(patterns[0], "x");
    let set = forbidden_regex::RegexSet::new(&patterns).expect("compile");
    assert!(set.is_match(b"/x/9"));
}
