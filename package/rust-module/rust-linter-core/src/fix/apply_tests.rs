//! Unit tests for applying repairs to source text.

/// Imports the finding record repairs attach to.
use crate::diagnostic::{Diagnostic, Severity};
/// Imports the applier under test and its repair types.
use crate::fix::apply::apply;
use crate::fix::{Edit, Fix, FixKind};
/// Imports the span type edits address.
use crate::span::Span;

// What:     `fn with_fix(offset: usize, length: usize, replacement: &str, kind:
//           FixKind) -> Diagnostic`. Builds a finding carrying one repair.
// Why:      Every test needs a finding with a fix, and only the four numbers
//           differ between them.
/// Build a finding carrying one single-edit repair.
fn with_fix(offset: usize, length: usize, replacement: &str, kind: FixKind) -> Diagnostic {
    return Diagnostic::new(
        "builtin",
        "test-rule",
        Severity::Error,
        "message",
        "src/test.rs",
        Span::new(offset, length, 1, offset + 1),
    )
    .with_fix(Fix::single(
        kind,
        "repair",
        Edit::new(Span::new(offset, length, 1, offset + 1), replacement),
    ));
}

/// A safe repair rewrites the range it names and leaves the rest alone.
#[test]
fn applies_a_safe_repair() {
    let outcome = apply(
        "let a = 1;",
        &[with_fix(4, 1, "b", FixKind::Safe)],
        FixKind::Safe,
    );

    assert_eq!(outcome.source, "let b = 1;", "the range is rewritten");
    assert_eq!(outcome.applied, 1, "one repair applied");
    assert_eq!(outcome.skipped, 0, "none skipped");
}

/// A finding with no repair leaves the text untouched.
#[test]
fn finding_without_a_repair_changes_nothing() {
    let plain = Diagnostic::new(
        "builtin",
        "test-rule",
        Severity::Error,
        "message",
        "src/test.rs",
        Span::new(0, 1, 1, 1),
    );

    let outcome = apply("let a = 1;", &[plain], FixKind::Dangerous);

    assert_eq!(outcome.source, "let a = 1;", "unchanged");
    assert_eq!(outcome.applied, 0, "nothing applied");
}

// What:     Three tests walking the trust ordering from both sides.
// Why:      The whole point of three fix kinds is that `--fix` alone must not
//           apply something that changes behaviour. A ceiling that leaked would
//           rewrite a user's source in a way they explicitly did not ask for,
//           which is the most damaging thing this pipeline could do.
/// A suggestion is withheld from a plain safe-only run.
#[test]
fn suggestion_is_withheld_at_the_safe_ceiling() {
    let outcome = apply(
        "let a = 1;",
        &[with_fix(4, 1, "b", FixKind::Suggestion)],
        FixKind::Safe,
    );

    assert_eq!(outcome.source, "let a = 1;", "unchanged");
    assert_eq!(outcome.applied, 0, "nothing applied");
}

/// A dangerous repair is withheld from a suggestion-level run.
#[test]
fn dangerous_is_withheld_at_the_suggestion_ceiling() {
    let outcome = apply(
        "let a = 1;",
        &[with_fix(4, 1, "b", FixKind::Dangerous)],
        FixKind::Suggestion,
    );

    assert_eq!(outcome.applied, 0, "nothing applied");
}

/// The highest ceiling applies every kind.
#[test]
fn dangerous_ceiling_applies_everything() {
    let outcome = apply(
        "let a = 1;",
        &[with_fix(4, 1, "b", FixKind::Dangerous)],
        FixKind::Dangerous,
    );

    assert_eq!(outcome.source, "let b = 1;", "applied");
}

/// Two repairs in different places both apply.
#[test]
fn disjoint_repairs_both_apply() {
    let outcome = apply(
        "let a = 1;",
        &[
            with_fix(4, 1, "b", FixKind::Safe),
            with_fix(8, 1, "2", FixKind::Safe),
        ],
        FixKind::Safe,
    );

    assert_eq!(outcome.source, "let b = 2;", "both applied");
    assert_eq!(outcome.applied, 2, "two repairs");
}

/// Repairs apply left to right regardless of the order they were reported.
#[test]
fn repairs_apply_in_source_order() {
    let outcome = apply(
        "let a = 1;",
        &[
            with_fix(8, 1, "2", FixKind::Safe),
            with_fix(4, 1, "b", FixKind::Safe),
        ],
        FixKind::Safe,
    );

    assert_eq!(
        outcome.source, "let b = 2;",
        "the later-reported earlier edit still lands correctly"
    );
}

// What:     Two repairs wanting the same bytes.
// Why:      Two rules can both want to rewrite one range, and applying both
//           would produce text neither intended. Skipping the second is safe
//           because the fixpoint loop runs again and the rule reports afresh
//           against the new text.
/// Overlapping repairs apply one and skip the other.
#[test]
fn overlapping_repairs_skip_the_later_one() {
    let outcome = apply(
        "let alpha = 1;",
        &[
            with_fix(4, 5, "beta", FixKind::Safe),
            with_fix(6, 3, "xxx", FixKind::Safe),
        ],
        FixKind::Safe,
    );

    assert_eq!(outcome.source, "let beta = 1;", "the first repair won");
    assert_eq!(outcome.applied, 1, "one applied");
    assert_eq!(outcome.skipped, 1, "one skipped as overlapping");
}

/// An empty replacement deletes the range.
#[test]
fn empty_replacement_deletes() {
    let outcome = apply(
        "let a = 1;",
        &[with_fix(3, 2, "", FixKind::Safe)],
        FixKind::Safe,
    );

    // Offsets 3 and 4 are the space and the `a`, so both go and the space
    // before the `=` remains.
    assert_eq!(outcome.source, "let = 1;", "the range is removed");
}

/// A repair may insert without removing anything.
#[test]
fn zero_length_span_inserts() {
    let outcome = apply(
        "let a = 1;",
        &[with_fix(0, 0, "pub ", FixKind::Safe)],
        FixKind::Safe,
    );

    assert_eq!(outcome.source, "pub let a = 1;", "text is inserted");
}

// What:     A repair whose range runs past the end of the file.
// Why:      That is a rule bug, but it reaches this code as ordinary data.
//           Slicing past the end would panic, and panicking in the one code path
//           that rewrites a user's source is the worst possible response.
/// A repair pointing past the end of the file is skipped, not panicked on.
#[test]
fn repair_past_the_end_is_skipped() {
    let outcome = apply(
        "short",
        &[with_fix(100, 5, "x", FixKind::Safe)],
        FixKind::Safe,
    );

    assert_eq!(outcome.source, "short", "unchanged");
    assert_eq!(outcome.skipped, 1, "skipped rather than applied");
}

// What:     A repair whose range cuts through a multi-byte character.
// Why:      Rust strings are UTF-8 and slicing mid-character panics. Source
//           files contain non-ASCII text in strings and comments, so this is a
//           real input rather than a theoretical one.
/// A repair splitting a multi-byte character is skipped, not panicked on.
#[test]
fn repair_splitting_a_character_is_skipped() {
    // The emoji occupies four bytes starting at offset 4.
    let source = "let \u{1f600} = 1;";

    let outcome = apply(source, &[with_fix(5, 2, "x", FixKind::Safe)], FixKind::Safe);

    assert_eq!(outcome.source, source, "unchanged");
    assert_eq!(outcome.skipped, 1, "skipped rather than panicking");
}

/// A repair may carry several edits, all applied together.
#[test]
fn multi_edit_repair_applies_every_edit() {
    let diagnostic = Diagnostic::new(
        "builtin",
        "test-rule",
        Severity::Error,
        "message",
        "src/test.rs",
        Span::new(0, 1, 1, 1),
    )
    .with_fix(Fix::multiple(
        FixKind::Safe,
        "move it",
        vec![
            Edit::new(Span::new(0, 3, 1, 1), "PUB"),
            Edit::new(Span::new(8, 1, 1, 9), "9"),
        ],
    ));

    let outcome = apply("let a = 1;", &[diagnostic], FixKind::Safe);

    assert_eq!(outcome.source, "PUB a = 9;", "both edits applied");
    assert_eq!(outcome.applied, 2, "counted per edit");
}

/// Text after the last repair is preserved.
#[test]
fn trailing_text_is_preserved() {
    let outcome = apply(
        "let a = 1;\nlet b = 2;\n",
        &[with_fix(4, 1, "z", FixKind::Safe)],
        FixKind::Safe,
    );

    assert_eq!(
        outcome.source, "let z = 1;\nlet b = 2;\n",
        "the rest of the file survives"
    );
}
