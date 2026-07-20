// Tests for the tail-format sectioned parser: header grammar, body classification,
// autodetection, and the fail-closed near-header/duplicate/empty/pre-header rules.

use super::{detect_tail_format, parse_sections};
use crate::rule::frx::LoadError;
use forbidden_regex::RegexSet;

#[test]
fn single_line_bare_literal_section_is_boundary_gated_and_named() {
    // One significant line classifies by the incumbent two-form rule; a short bare
    // literal is escaped and word-boundary gated, and the section name is retained.
    let rules = parse_sections("==> qqq-token <==\nabc").expect("one literal rule");
    assert_eq!(rules.len(), 1);
    assert_eq!(rules[0].name.as_deref(), Some("qqq-token"));
    assert_eq!(rules[0].pattern, "\\babc\\b");
}

#[test]
fn single_line_regex_section_passes_body_and_retains_name() {
    // A single `/PATTERN/FLAGS` line keeps the incumbent regex form: the body passes
    // through, `m`/`x` drop as no-ops, and the section name is retained.
    let rules = parse_sections("==> qqq-re <==\n/foo[0-9]/mx").expect("one regex rule");
    assert_eq!(rules.len(), 1);
    assert_eq!(rules[0].name.as_deref(), Some("qqq-re"));
    assert_eq!(rules[0].pattern, "foo[0-9]");
    let set = RegexSet::new(std::slice::from_ref(&rules[0].pattern)).expect("compile regex");
    assert!(set.is_match(b"foo7"));
}

#[test]
fn multi_line_section_with_first_column_comments_compiles_and_matches() {
    // More than one significant line makes the whole body one verbatim pattern; the
    // always-verbose engine consumes the first-column `#` comments and joins the
    // significant lines into one concatenated regex.
    let text = concat!(
        "==> qqq-multi <==\n",
        "# the alpha marker\n",
        "alpha\n",
        "# then a trailing digit\n",
        "[0-9]\n",
    );
    let rules = parse_sections(text).expect("multi-line section");
    assert_eq!(rules.len(), 1);
    assert_eq!(rules[0].name.as_deref(), Some("qqq-multi"));
    // The comments survive verbatim in the handed-over pattern.
    assert!(rules[0].pattern.contains("# the alpha marker"), "{}", rules[0].pattern);
    assert!(rules[0].pattern.contains("# then a trailing digit"), "{}", rules[0].pattern);
    let set = RegexSet::new(std::slice::from_ref(&rules[0].pattern)).expect("compile multi-line");
    assert!(set.is_match(b"see alpha5 here"));
    assert!(!set.is_match(b"see alpha here"));
    assert!(!set.is_match(b"see beta5 here"));
}

#[test]
fn reshape_convention_matches_header_text_through_regexset() {
    // A body line that must match tail-header text reshapes its first byte with a
    // character class, so `[=]=>` stays body (not a header) yet matches `==>`; the
    // second significant line keeps the body in the verbatim regex path.
    let text = concat!(
        "==> qqq-reshape <==\n",
        "# reshaped so this stays body, not a header\n",
        "[=]=>foo\n",
        "# a trailing digit keeps this a multi-line verbatim body\n",
        "[0-9]\n",
    );
    let rules = parse_sections(text).expect("reshape section");
    assert_eq!(rules.len(), 1);
    let set = RegexSet::new(std::slice::from_ref(&rules[0].pattern)).expect("compile reshape");
    assert!(set.is_match(b"prefix ==>foo7 suffix"), "{}", rules[0].pattern);
    assert!(!set.is_match(b"prefix ==>foobar suffix"), "{}", rules[0].pattern);
}

#[test]
fn out_of_alphabet_middle_stays_content_not_near_header() {
    // The collision defense: a header-shaped line whose middle leaves the strict
    // alphabet (uppercase, a slash) is ordinary content, never a near-header error.
    let text = concat!(
        "==> qqq-carve <==\n",
        "content-a\n",
        "==> Upper9 <==\n",
        "==> path/seg <==\n",
    );
    let rules = parse_sections(text).expect("out-of-alphabet middles stay content");
    assert_eq!(rules.len(), 1);
    assert_eq!(rules[0].name.as_deref(), Some("qqq-carve"));
    assert!(rules[0].pattern.contains("Upper9"), "{}", rules[0].pattern);
    assert!(rules[0].pattern.contains("path/seg"), "{}", rules[0].pattern);
}

#[test]
fn near_header_fails_closed_with_line_number() {
    // A within-alphabet name that fails the strict grammar (leading dash) is a
    // mistyped header, reported by line number only, never absorbed as body.
    let err = parse_sections("==> qqq-ok <==\nabcdefgh\n==> -bad <==\nx")
        .expect_err("near header");
    assert_eq!(err, LoadError::NearHeader { line: 3 });
}

#[test]
fn duplicate_name_fails_closed_with_both_lines() {
    // The same section name twice collides the rule identities the format keeps
    // unique; both declaring line numbers are reported.
    let err = parse_sections("==> qqq-dup <==\naaaa\n==> qqq-dup <==\nbbbb\n")
        .expect_err("duplicate name");
    assert_eq!(err, LoadError::DuplicateName { first_line: 1, line: 3 });
}

#[test]
fn empty_section_fails_closed_with_header_line() {
    // A header whose body carries no significant line fails closed at the header,
    // rather than silently dropping the section.
    let err = parse_sections("==> qqq-empty <==\n\n# only a comment\n\n==> qqq-next <==\nzzzz\n")
        .expect_err("empty section");
    assert_eq!(err, LoadError::EmptySection { line: 1 });
}

#[test]
fn pre_header_content_fails_closed_with_line_number() {
    // Significant content before the first header cannot escape into a section, so
    // the tail parser fails closed on it defensively.
    let err = parse_sections("stray content\n==> qqq-late <==\nbody\n")
        .expect_err("pre-header content");
    assert_eq!(err, LoadError::PreHeaderContent { line: 1 });
}

#[test]
fn blanks_and_comments_before_first_header_are_ignored() {
    // Leading blank and `#`-comment lines before the first header are insignificant.
    let rules = parse_sections("\n# leading comment\n\n==> qqq-lead <==\nzzzz\n")
        .expect("leading blanks and comments ignored");
    assert_eq!(rules.len(), 1);
    assert_eq!(rules[0].name.as_deref(), Some("qqq-lead"));
}

#[test]
fn trailing_blank_lines_are_insignificant() {
    // Trailing blank lines of a section do not change its single-significant-line
    // classification.
    let rules = parse_sections("==> qqq-trail <==\n/foo[0-9]/\n\n\n")
        .expect("trailing blanks trimmed");
    assert_eq!(rules.len(), 1);
    assert_eq!(rules[0].pattern, "foo[0-9]");
}

#[test]
fn section_order_is_file_order_with_deterministic_indices() {
    // Rule order follows file order, so indices are deterministic.
    let rules = parse_sections("==> qqq-a <==\naaaa\n==> qqq-b <==\nbbbb\n==> qqq-c <==\ncccc\n")
        .expect("three sections");
    let names: Vec<Option<&str>> = rules.iter().map(|rule| return rule.name.as_deref()).collect();
    assert_eq!(names, vec![Some("qqq-a"), Some("qqq-b"), Some("qqq-c")]);
}

#[test]
fn detect_tail_format_selects_the_right_path_both_directions() {
    // A strict header on the first significant line selects tail-format, after any
    // leading blank and comment lines; every other first-line shape stays legacy.
    assert!(detect_tail_format("==> qqq-hdr <==\nbody\n"));
    assert!(detect_tail_format("\n# comment\n\n==> qqq-hdr <==\nbody\n"));
    // A legacy file whose first line starts with `=` is not a strict header.
    assert!(!detect_tail_format("=starts-with-equals\nmore\n"));
    assert!(!detect_tail_format("plain literal\n"));
    // A loose bad-name header on the first line is not strict, so it stays legacy
    // and byte-for-byte identical, rather than becoming a near-header error.
    assert!(!detect_tail_format("==> Bad-Name <==\nbody\n"));
    assert!(!detect_tail_format(""));
}
