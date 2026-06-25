// What:  unit tests for the parser front door: every accepted construct parses, and
//        every rejection path returns the right `CompileError` variant.
// Why:   the parser is the widest branch surface in the engine and the security gate
//        that turns hostile rule text into either a bounded node or a clean error; a
//        regressed accept/reject decision is how unsupported or footgun patterns slip in.

use super::parse;
use crate::error::CompileError;

// Asserts a pattern parses successfully.
fn ok(pattern: &str) {
    assert!(parse(pattern).is_ok(), "expected {pattern:?} to parse, got {:?}", parse(pattern));
}

// Asserts a pattern is rejected as a syntax / unsupported-construct error.
fn syntax_err(pattern: &str) {
    assert!(
        matches!(parse(pattern), Err(CompileError::Syntax { .. })),
        "expected {pattern:?} to be a syntax error, got {:?}",
        parse(pattern),
    );
}

#[test]
fn accepts_literals_and_escapes() {
    ok("abc");
    ok("A3T");
    ok("\\.");
    ok("\\[");
    ok("\\]");
    ok("\\(");
    ok("\\&");
    ok("\\~");
    ok("\\t");
    ok("a\\\\b");
}

#[test]
fn accepts_classes() {
    ok("[abc]");
    ok("[a-z]");
    ok("[a-zA-Z0-9_]");
    ok("[^0-9]");
    ok("[a-f0-9]");
    ok("x[]a]"); // a leading `]` is a class member, not a close
}

#[test]
fn accepts_shorthands_and_dot() {
    ok("\\d");
    ok("\\w");
    ok("\\s");
    ok("\\D");
    ok("\\W");
    ok("\\S");
    ok(".");
}

#[test]
fn accepts_alternation_and_groups() {
    ok("(?:a|b)");
    ok("(?:a|b|c)");
    ok("(?:abc)");
    ok("(?:a|b)x");
}

#[test]
fn accepts_bounded_repetition() {
    ok("a{3}");
    ok("a{3,6}");
    ok("[a-z]{16}");
    ok("xa?"); // optional needs a mandatory neighbour to stay non-nullable
    ok("AKIA[A-Z2-7]{16}");
}

#[test]
fn accepts_anchors() {
    ok("^abc");
    ok("abc$");
    ok("\\bword\\b");
    ok("^a[0-9]:");
}

#[test]
fn accepts_intersection_and_complement() {
    ok("[a-z]&[a-c]");
    ok("[a-z]&~(m)");
    ok("(?:[a-z]{4})&~(abcd)");
    ok("(?:AKIA[A-Z2-7]{16})&~(AKIA2{16})");
}

#[test]
fn rejects_unbounded_and_greedy_quantifiers() {
    syntax_err("a*");
    syntax_err("a+");
    syntax_err("a{2,}");
    syntax_err("a{,5}");
}

#[test]
fn rejects_stacked_quantifiers() {
    syntax_err("a??");
    syntax_err("a{2}{3}");
    syntax_err("a*?");
}

#[test]
fn rejects_bad_repetition_bounds() {
    syntax_err("a{3,1}");
    syntax_err("a{x}");
}

#[test]
fn rejects_unbalanced_brackets() {
    syntax_err("(?:abc");
    syntax_err("[abc");
    syntax_err("abc)");
    syntax_err("~(abc");
}

#[test]
fn rejects_unsupported_groups() {
    syntax_err("(abc)"); // capturing group
    syntax_err("(?=a)"); // lookahead
    syntax_err("(?<=a)"); // lookbehind
    syntax_err("(?P<n>a)"); // named capture
}

#[test]
fn rejects_unknown_escapes() {
    syntax_err("\\q");
    syntax_err("\\xff");
}

#[test]
fn rejects_empty_matchable_patterns() {
    assert_eq!(parse("a?"), Err(CompileError::EmptyMatchable));
    assert_eq!(parse("a{0}"), Err(CompileError::EmptyMatchable));
    assert_eq!(parse("~(abc)"), Err(CompileError::EmptyMatchable));
    assert_eq!(parse("(?:a)?"), Err(CompileError::EmptyMatchable));
}

#[test]
fn rejects_trailing_and_stray_operators() {
    syntax_err("a|");
    syntax_err("|a");
    syntax_err("a&");
}

#[test]
fn verbose_mode_ignores_unescaped_whitespace() {
    // Whitespace outside classes is ignored, so these all parse to the same node.
    let base = parse("abc").unwrap();
    assert_eq!(parse("a b c").unwrap(), base);
    assert_eq!(parse("a\tb\tc").unwrap(), base);
    assert_eq!(parse("a\nb\nc").unwrap(), base);
    assert_eq!(parse("  abc  ").unwrap(), base);
}

#[test]
fn first_column_hash_is_a_comment_to_end_of_line() {
    // A `#` at the start of a line comments out the rest of that line.
    assert_eq!(parse("# a header comment\nabc").unwrap(), parse("abc").unwrap());
    assert_eq!(parse("abc\n# trailing comment line\n").unwrap(), parse("abc").unwrap());
}

#[test]
fn escaped_and_class_whitespace_stays_literal() {
    // An escaped space and a space inside a class are real bytes, not ignored.
    assert_ne!(parse("a\\ b").unwrap(), parse("ab").unwrap());
    assert_ne!(parse("[ ]x").unwrap(), parse("x").unwrap());
}
