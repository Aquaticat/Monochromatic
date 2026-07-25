//! Unit tests for proposed repairs and their trust ordering.

// What:     `use crate::fix::{Edit, Fix, FixKind};` imports the three types under
//           test from this same crate.
// Why:      Reach the subject by the same paths any other module would.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Edit, Fix, FixKind } from "./fix";
// ```
use crate::fix::{Edit, Fix, FixKind};
/// Imports the source-range type every edit carries.
use crate::span::Span;

/// A safe edit is applied under every ceiling, including the lowest.
#[test]
fn safe_applies_at_every_ceiling() {
    // What:     `assert!(condition, "message")` fails the test when the condition
    //           is false.
    // Why:      Safe edits are the ones `--fix` alone is allowed to write.
    assert!(FixKind::Safe.is_applied_at(FixKind::Safe), "safe under safe");
    assert!(
        FixKind::Safe.is_applied_at(FixKind::Suggestion),
        "safe under suggestion"
    );
    assert!(
        FixKind::Safe.is_applied_at(FixKind::Dangerous),
        "safe under dangerous"
    );
}

/// A suggestion is withheld from a plain `--fix` run and applied above it.
#[test]
fn suggestion_needs_at_least_its_own_ceiling() {
    // The leading `!` negates: assert that this is NOT applied.
    assert!(
        !FixKind::Suggestion.is_applied_at(FixKind::Safe),
        "suggestion must not apply under --fix alone"
    );
    assert!(
        FixKind::Suggestion.is_applied_at(FixKind::Suggestion),
        "suggestion under suggestion"
    );
    assert!(
        FixKind::Suggestion.is_applied_at(FixKind::Dangerous),
        "suggestion under dangerous"
    );
}

/// A dangerous edit is applied only under the highest ceiling.
#[test]
fn dangerous_applies_only_at_the_top() {
    assert!(
        !FixKind::Dangerous.is_applied_at(FixKind::Safe),
        "dangerous must not apply under --fix"
    );
    assert!(
        !FixKind::Dangerous.is_applied_at(FixKind::Suggestion),
        "dangerous must not apply under --fix-suggestions"
    );
    assert!(
        FixKind::Dangerous.is_applied_at(FixKind::Dangerous),
        "dangerous under dangerous"
    );
}

/// An edit keeps the span and text it was built from.
#[test]
fn edit_keeps_span_and_replacement() {
    let edit = Edit::new(Span::new(4, 6, 1, 5), "replacement");

    assert_eq!(edit.span.offset, 4, "span offset");
    assert_eq!(edit.span.length, 6, "span length");
    assert_eq!(edit.replacement, "replacement", "replacement text");
}

/// Empty replacement text expresses a deletion rather than an absent edit.
#[test]
fn edit_accepts_empty_replacement_as_deletion() {
    let edit = Edit::new(Span::new(0, 3, 1, 1), "");

    // What:     `.is_empty()` is true when the string has no bytes.
    // Why:      Deleting a range is a legitimate edit, not a missing one, so the
    //           type must not confuse it with absence.
    assert!(edit.replacement.is_empty(), "deletion is empty text");
    assert_eq!(edit.span.length, 3, "deletion still spans the removed range");
}

/// A single-edit repair wraps exactly one edit.
#[test]
fn fix_single_holds_one_edit() {
    let fix = Fix::single(
        FixKind::Safe,
        "split the file",
        Edit::new(Span::at(0, 1, 1), "x"),
    );

    assert_eq!(fix.edits.len(), 1, "exactly one edit");
    assert_eq!(fix.kind, FixKind::Safe, "kind round-trips");
    assert_eq!(fix.message, "split the file", "message round-trips");
}

/// A multi-edit repair keeps every edit, in order.
#[test]
fn fix_multiple_keeps_every_edit_in_order() {
    let fix = Fix::multiple(
        FixKind::Dangerous,
        "move the item",
        vec![
            Edit::new(Span::at(0, 1, 1), "first"),
            Edit::new(Span::at(10, 2, 1), "second"),
        ],
    );

    assert_eq!(fix.edits.len(), 2, "both edits kept");
    assert_eq!(fix.edits[0].replacement, "first", "order preserved");
    assert_eq!(fix.edits[1].replacement, "second", "order preserved");
    assert_eq!(fix.kind, FixKind::Dangerous, "kind round-trips");
}

/// A repair may carry no edits at all, which applies as a no-op.
#[test]
fn fix_multiple_accepts_no_edits() {
    // `Vec::new()` builds an empty growable array; `vec![]` would do the same.
    let fix = Fix::multiple(FixKind::Safe, "nothing to do", Vec::new());

    assert!(fix.edits.is_empty(), "an empty repair is representable");
}
