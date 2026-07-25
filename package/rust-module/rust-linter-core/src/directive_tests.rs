//! Unit tests for directive parsing and application.

/// Imports the parsed per-file context directives are read from.
use crate::context::LintContext;
/// Imports the finding record suppression filters.
use crate::diagnostic::{Diagnostic, Severity};
/// Imports the directive types and the applier under test.
use crate::directive::apply::{apply, INVALID_RULE, UNUSED_RULE};
use crate::directive::{parse, DirectiveKind};
/// Imports the configured severity the unused report takes.
use crate::severity::RuleSeverity;
/// Imports the span type findings point with.
use crate::span::Span;

/// Parse directives out of one in-memory source.
fn directives_in(source: &str) -> Vec<crate::directive::Directive> {
    let context = LintContext::new("src/test.rs".to_string(), source.to_string());
    return parse(&context);
}

/// Build a finding on a given line, for the applier to consider.
fn finding_on(line: usize, rule: &'static str) -> Diagnostic {
    return Diagnostic::new(
        "builtin",
        rule,
        Severity::Error,
        "something",
        "src/test.rs",
        Span::new(0, 1, line, 1),
    );
}

// What:     `fn permissive(_: &str, _: &str) -> bool { true }` and its opposite.
// Why:      Suppressibility is declared on the rule, and no rule shipped today
//           permits it, so the applier's suppressing path can only be exercised
//           with a closure that says yes.
/// A suppressibility check that permits every rule.
fn permissive(_plugin: &str, _rule: &str) -> bool {
    return true;
}

/// A suppressibility check that permits nothing.
fn forbidding(_plugin: &str, _rule: &str) -> bool {
    return false;
}

/// A disable-next-line directive is recognised with its rules and reason.
#[test]
fn parses_disable_next_line() {
    let found = directives_in(
        "//! Doc.\n// rust-linter-disable-next-line max-lines -- generated file\nfn a() {}\n",
    );

    assert_eq!(found.len(), 1, "one directive: {found:?}");
    assert_eq!(found[0].kind, DirectiveKind::DisableNextLine, "kind");
    assert_eq!(found[0].rules, vec!["max-lines".to_string()], "rules");
    assert_eq!(
        found[0].justification.as_deref(),
        Some("generated file"),
        "justification"
    );
    assert_eq!(found[0].line, 2, "line the comment sits on");
}

/// Several rules may be named, separated by spaces or commas.
#[test]
fn parses_several_rules() {
    let found = directives_in("// rust-linter-disable a, b c -- reason\n");

    assert_eq!(
        found[0].rules,
        vec!["a".to_string(), "b".to_string(), "c".to_string()],
        "commas and spaces both separate"
    );
}

/// A directive naming no rules targets every rule.
#[test]
fn no_named_rules_targets_everything() {
    let found = directives_in("// rust-linter-disable-line -- reason\n");

    assert!(found[0].rules.is_empty(), "no rules named");
    assert!(found[0].targets("builtin", "anything"), "targets every rule");
}

/// A rule may be named with or without its plugin prefix.
#[test]
fn targets_accept_either_spelling() {
    let bare = directives_in("// rust-linter-disable max-lines -- r\n");
    let qualified = directives_in("// rust-linter-disable builtin/max-lines -- r\n");

    assert!(bare[0].targets("builtin", "max-lines"), "bare spelling");
    assert!(
        qualified[0].targets("builtin", "max-lines"),
        "qualified spelling"
    );
    assert!(
        !qualified[0].targets("other", "max-lines"),
        "a qualified name does not match another plugin"
    );
}

// What:     A directive spelled inside a string literal rather than a comment.
// Why:      Parsing walks the lexer's COMMENT tokens rather than scanning lines,
//           and this is the case that distinguishes the two. A line scanner
//           would find this and silently suppress a rule nobody asked to
//           suppress, which is the worst failure a linter can have: quiet.
/// Directive text inside a string literal is not a directive.
#[test]
fn directive_inside_a_string_literal_is_ignored() {
    let found = directives_in("fn a() {\n    let s = \"// rust-linter-disable all -- nope\";\n}\n");

    assert!(
        found.is_empty(),
        "text inside a string is not a directive: {found:?}"
    );
}

/// A block comment carries a directive just as a line comment does.
#[test]
fn block_comment_directive_is_recognised() {
    let found = directives_in("/* rust-linter-disable-line max-lines -- reason */\n");

    assert_eq!(found.len(), 1, "block comment parsed: {found:?}");
    assert_eq!(found[0].kind, DirectiveKind::DisableLine, "kind");
}

/// A justification may itself contain the separator.
#[test]
fn justification_may_contain_the_separator() {
    let found = directives_in("// rust-linter-disable a -- see issue -- 42\n");

    assert_eq!(
        found[0].justification.as_deref(),
        Some("see issue -- 42"),
        "only the first separator delimits"
    );
}

/// A separator with nothing after it counts as no justification.
#[test]
fn empty_justification_counts_as_absent() {
    let found = directives_in("// rust-linter-disable a --\n");

    assert!(
        found[0].justification.is_none(),
        "an empty reason explains no more than none at all"
    );
}

/// A justified directive on a suppressible rule silences the finding.
#[test]
fn justified_directive_suppresses() {
    let directives = directives_in("// rust-linter-disable-next-line max-lines -- reason\n");

    let outcome = apply(
        &directives,
        vec![finding_on(2, "max-lines")],
        "src/test.rs",
        None,
        &permissive,
    );

    assert!(outcome.kept.is_empty(), "the finding is suppressed");
    assert!(
        outcome.directive_problems.is_empty(),
        "and nothing is reported about the directive"
    );
}

/// A directive governs only the line it names.
#[test]
fn directive_does_not_reach_other_lines() {
    let directives = directives_in("// rust-linter-disable-next-line max-lines -- reason\n");

    let outcome = apply(
        &directives,
        vec![finding_on(9, "max-lines")],
        "src/test.rs",
        None,
        &permissive,
    );

    assert_eq!(outcome.kept.len(), 1, "a finding elsewhere survives");
}

/// A directive naming another rule does not silence this one.
#[test]
fn directive_does_not_reach_other_rules() {
    let directives = directives_in("// rust-linter-disable-next-line other-rule -- reason\n");

    let outcome = apply(
        &directives,
        vec![finding_on(2, "max-lines")],
        "src/test.rs",
        None,
        &permissive,
    );

    assert_eq!(outcome.kept.len(), 1, "a different rule survives");
}

// What:     The case AGENTS.md MXL, MXR and RDC turn on.
// Why:      Those rules say `max-lines` and `require-rustdoc` are never
//           disabled. That guarantee is only worth something if a directive
//           aimed at one is refused AND reported, rather than quietly ignored.
/// A directive aimed at a non-suppressible rule is refused and reported.
#[test]
fn directive_on_a_non_suppressible_rule_is_refused() {
    let directives = directives_in("// rust-linter-disable-next-line max-lines -- reason\n");

    let outcome = apply(
        &directives,
        vec![finding_on(2, "max-lines")],
        "src/test.rs",
        None,
        &forbidding,
    );

    assert_eq!(outcome.kept.len(), 1, "the finding survives");
    assert_eq!(
        outcome.directive_problems.len(),
        1,
        "and the directive is reported"
    );
    assert_eq!(
        outcome.directive_problems[0].rule_id, INVALID_RULE,
        "reported as an invalid directive"
    );
}

/// A directive with no justification does not suppress, and is reported.
#[test]
fn unjustified_directive_does_not_suppress() {
    let directives = directives_in("// rust-linter-disable-next-line max-lines\n");

    let outcome = apply(
        &directives,
        vec![finding_on(2, "max-lines")],
        "src/test.rs",
        None,
        &permissive,
    );

    assert_eq!(outcome.kept.len(), 1, "the finding survives");
    assert_eq!(
        outcome.directive_problems[0].rule_id, INVALID_RULE,
        "and the directive is reported"
    );
}

/// A directive that suppressed nothing is reported when asked for.
#[test]
fn unused_directive_is_reported_when_requested() {
    let directives = directives_in("// rust-linter-disable-next-line max-lines -- reason\n");

    let outcome = apply(
        &directives,
        Vec::new(),
        "src/test.rs",
        Some(RuleSeverity::Warn),
        &permissive,
    );

    assert_eq!(outcome.directive_problems.len(), 1, "reported");
    assert_eq!(
        outcome.directive_problems[0].rule_id, UNUSED_RULE,
        "reported as unused"
    );
    assert_eq!(
        outcome.directive_problems[0].severity,
        Severity::Warn,
        "at the requested severity"
    );
}

/// Unused directives are silent unless the report is switched on.
#[test]
fn unused_directive_is_silent_by_default() {
    let directives = directives_in("// rust-linter-disable-next-line max-lines -- reason\n");

    let outcome = apply(&directives, Vec::new(), "src/test.rs", None, &permissive);

    assert!(
        outcome.directive_problems.is_empty(),
        "nothing reported without the flag"
    );
}

// What:     A refused directive checked against the unused report as well.
// Why:      It suppressed nothing, so a naive implementation reports it twice:
//           once as invalid and once as unused. One mistake deserves one
//           complaint, and the invalid one says what is actually wrong.
/// A refused directive is not additionally reported as unused.
#[test]
fn refused_directive_is_not_also_called_unused() {
    let directives = directives_in("// rust-linter-disable-next-line max-lines -- reason\n");

    let outcome = apply(
        &directives,
        vec![finding_on(2, "max-lines")],
        "src/test.rs",
        Some(RuleSeverity::Warn),
        &forbidding,
    );

    assert_eq!(
        outcome.directive_problems.len(),
        1,
        "exactly one complaint: {:?}",
        outcome.directive_problems
    );
    assert_eq!(
        outcome.directive_problems[0].rule_id, INVALID_RULE,
        "and it is the one that says what is wrong"
    );
}

/// A ranged disable covers every line until its matching enable.
#[test]
fn ranged_disable_ends_at_the_enable() {
    let directives = directives_in(
        "// rust-linter-disable max-lines -- reason\nfn a() {}\nfn b() {}\n// rust-linter-enable max-lines\nfn c() {}\n",
    );

    let outcome = apply(
        &directives,
        vec![finding_on(2, "max-lines"), finding_on(5, "max-lines")],
        "src/test.rs",
        None,
        &permissive,
    );

    assert_eq!(
        outcome.kept.len(),
        1,
        "inside the range is suppressed, after it is not: {:?}",
        outcome.kept
    );
    assert_eq!(
        outcome.kept[0].labels[0].span.line, 5,
        "the surviving finding is the one past the enable"
    );
}

/// A ranged disable with no enable runs to the end of the file.
#[test]
fn ranged_disable_without_enable_runs_to_end() {
    let directives = directives_in("// rust-linter-disable max-lines -- reason\n");

    let outcome = apply(
        &directives,
        vec![finding_on(50, "max-lines")],
        "src/test.rs",
        None,
        &permissive,
    );

    assert!(outcome.kept.is_empty(), "a far later line is still covered");
}

/// A ranged disable does not reach lines above itself.
#[test]
fn ranged_disable_does_not_reach_backwards() {
    let directives = directives_in("fn a() {}\n// rust-linter-disable max-lines -- reason\n");

    let outcome = apply(
        &directives,
        vec![finding_on(1, "max-lines")],
        "src/test.rs",
        None,
        &permissive,
    );

    assert_eq!(outcome.kept.len(), 1, "an earlier line is untouched");
}

/// An enable on its own is never reported as unused.
#[test]
fn enable_is_never_reported_unused() {
    let directives = directives_in("// rust-linter-enable max-lines\n");

    let outcome = apply(
        &directives,
        Vec::new(),
        "src/test.rs",
        Some(RuleSeverity::Warn),
        &permissive,
    );

    assert!(
        outcome.directive_problems.is_empty(),
        "an enable closes a range rather than suppressing: {:?}",
        outcome.directive_problems
    );
}

/// An ordinary comment is not a directive.
#[test]
fn ordinary_comment_is_not_a_directive() {
    let found = directives_in("// just a comment about rust-linter\n// TODO: fix\n");

    assert!(found.is_empty(), "no directives: {found:?}");
}
