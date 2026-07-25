//! Unit tests for source spans and diagnostic labels.

// What:     `use crate::span::{Label, Span};` imports the two types under test
//           from this same crate; `crate::` means "from this crate's root".
// Why:      A test module is compiled into the crate, so it reaches its subject
//           by the same paths any other module would.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Label, Span } from "./span";
// ```
use crate::span::{Label, Span};

/// A span keeps every number it was built from, in the order given.
#[test]
fn span_new_keeps_all_four_numbers() {
    // What:     `let span = Span::new(12, 5, 3, 7);`. `let` binds an immutable
    //           local; `Span::new` is an associated function, reached through the
    //           type with `::` rather than called on an existing value.
    // Why:      Build one span whose four numbers are all different, so a
    //           field swapped at the call site could not pass unnoticed.
    let span = Span::new(12, 5, 3, 7);

    // What:     `assert_eq!(left, right, "message")`. A macro, marked by its `!`,
    //           that fails the test when the two sides differ and prints both.
    // Why:      Check each field landed where it belongs.
    assert_eq!(span.offset, 12, "offset");
    assert_eq!(span.length, 5, "length");
    assert_eq!(span.line, 3, "line");
    assert_eq!(span.column, 7, "column");
}

/// A point span has zero length so renderers draw a caret, not an underline.
#[test]
fn span_at_has_zero_length() {
    let span = Span::at(40, 9, 2);

    assert_eq!(span.length, 0, "point span must have no width");
    assert_eq!(span.offset, 40, "offset");
    assert_eq!(span.line, 9, "line");
    assert_eq!(span.column, 2, "column");
}

/// A bare label carries no note.
#[test]
fn label_new_has_no_message() {
    let label = Label::new(Span::at(0, 1, 1));

    // What:     `assert!(condition, "message")` fails when the condition is false.
    //           `.is_none()` is true when an `Option` holds the absent variant.
    // Why:      The note must be absent, not an empty string.
    assert!(label.message.is_none(), "bare label must carry no note");
}

/// A label built with a note keeps that note.
#[test]
fn label_with_message_keeps_note() {
    let label = Label::with_message(Span::at(0, 1, 1), "expected here");

    // What:     `assert_eq!(label.message.as_deref(), Some("expected here"))`.
    //           `.as_deref()` turns `Option<String>` into `Option<&str>` so it can
    //           be compared against a borrowed literal without allocating.
    // Why:      Check both that a note is present and that it is the right one.
    assert_eq!(
        label.message.as_deref(),
        Some("expected here"),
        "note should round-trip"
    );
}

/// A note may be supplied as an owned String, not only as a literal.
#[test]
fn label_with_message_accepts_owned_string() {
    // `String::from` builds an OWNED, heap-allocated string from a borrowed one,
    // exercising the other half of the `impl Into<String>` parameter.
    let label = Label::with_message(Span::at(0, 1, 1), String::from("owned note"));

    assert_eq!(label.message.as_deref(), Some("owned note"), "owned note");
}
