//! Unit tests for the line-to-span lookup added for diagnostic labels.

// What:     `use crate::context::LintContext;` imports the type under test from
//           this same crate.
// Why:      Reach the subject by the same paths any other module would.
//
// In TS you'd write (pseudocode):
// ```ts
// import { LintContext } from "./context";
// ```
use crate::context::LintContext;

// What:     `fn context_for(source: &str) -> LintContext`. Takes a BORROWED
//           string slice and returns an OWNED context. `.to_string()` copies the
//           borrowed text into a heap-allocated `String`, which the constructor
//           takes ownership of.
// Why:      Every test parses a small source; the constructor wants owned values
//           and the tests want to write plain literals.
//
// In TS you'd write (pseudocode):
// ```ts
// function contextFor(source: string): LintContext
// ```
/// Build a context over one in-memory source for a test.
fn context_for(source: &str) -> LintContext {
    return LintContext::new("test.rs".to_string(), source.to_string());
}

/// The first line's span starts at offset zero and stops before the newline.
#[test]
fn first_line_span_excludes_the_newline() {
    let context = context_for("fn a() {}\nfn b() {}\n");

    // What:     `.expect("message")` takes the value out of an `Option`, failing
    //           the test with that message when it is absent.
    // Why:      Line 1 must exist here, and the test should say so if it does not.
    let span = context.line_span(1).expect("line 1 exists");

    assert_eq!(span.offset, 0, "first line starts at zero");
    assert_eq!(span.length, 9, "length covers text, not the newline");
    assert_eq!(span.line, 1, "line round-trips");
    assert_eq!(span.column, 1, "spans start at column 1");
}

/// A middle line starts after the preceding newline.
#[test]
fn middle_line_span_starts_after_the_previous_break() {
    let context = context_for("fn a() {}\nfn b() {}\nfn c() {}\n");

    let span = context.line_span(2).expect("line 2 exists");

    assert_eq!(span.offset, 10, "starts one byte past the first newline");
    assert_eq!(span.length, 9, "covers the second line's text");
    assert_eq!(span.line, 2, "line round-trips");
}

/// A final line with no trailing newline still spans its whole text.
#[test]
fn final_line_without_break_spans_to_end() {
    let context = context_for("fn a() {}\nfn b()");

    let span = context.line_span(2).expect("line 2 exists");

    assert_eq!(span.offset, 10, "starts after the newline");
    assert_eq!(span.length, 6, "covers to the end of the source");
}

/// Line zero is absent, because line numbers are one-based.
#[test]
fn line_zero_is_absent() {
    let context = context_for("fn a() {}\n");

    // What:     `.is_none()` is true when an `Option` holds the absent variant.
    // Why:      `usize` is unsigned, so a naive `line - 1` at zero would wrap to
    //           a huge number and index far out of range instead of going
    //           negative. This asserts the guard that prevents it.
    assert!(
        context.line_span(0).is_none(),
        "line 0 must be absent, not a wrapped index"
    );
}

/// A line past the end of the file is absent rather than a panic.
#[test]
fn line_past_end_is_absent() {
    let context = context_for("fn a() {}\n");

    assert!(
        context.line_span(99).is_none(),
        "out-of-range line must be absent"
    );
}

/// An empty trailing line yields a zero-length span rather than wrapping.
#[test]
fn empty_trailing_line_has_zero_length() {
    // The trailing newline creates a final, empty line after it.
    let context = context_for("fn a() {}\n");

    let span = context.line_span(2).expect("trailing empty line exists");

    assert_eq!(span.length, 0, "an empty line spans nothing");
    assert_eq!(span.offset, 10, "positioned at the end of the source");
}

/// An empty source still answers for its single line.
#[test]
fn empty_source_has_one_line() {
    let context = context_for("");

    let span = context.line_span(1).expect("empty source still has line 1");

    assert_eq!(span.offset, 0, "starts at zero");
    assert_eq!(span.length, 0, "spans nothing");
}
