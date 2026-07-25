//! Unit tests for the finding record and its severity labels.

// What:     `use crate::diagnostic::{Diagnostic, Severity};` imports the two
//           types under test from this same crate.
// Why:      Reach the subject by the same paths any other module would.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Diagnostic, Severity } from "./diagnostic";
// ```
use crate::diagnostic::{Diagnostic, Severity};
/// Imports the repair types attached by the fix builder under test.
use crate::fix::{Edit, Fix, FixKind};
/// Imports the span and label types a finding points with.
use crate::span::{Label, Span};

// What:     `fn sample() -> Diagnostic { .. }` is an ordinary helper, not a test,
//           because it carries no `#[test]` attribute.
// Why:      Every test below needs a finding to start from, and repeating the six
//           constructor arguments in each would bury what each test is checking.
//
// In TS you'd write (pseudocode):
// ```ts
// function sample(): Diagnostic { return Diagnostic.create(...); }
// ```
/// Build a plain finding for tests to start from.
fn sample() -> Diagnostic {
    return Diagnostic::new(
        "builtin",
        "max-lines",
        Severity::Error,
        "file has 400 code lines",
        "src/lib.rs",
        Span::new(100, 20, 42, 1),
    );
}

/// Each severity prints its own lowercase label.
#[test]
fn severity_labels_are_lowercase() {
    assert_eq!(Severity::Error.label(), "error", "error label");
    assert_eq!(Severity::Warn.label(), "warn", "warn label");
}

/// A new finding carries one primary label and no optional detail.
#[test]
fn new_diagnostic_has_one_label_and_no_extras() {
    let diagnostic = sample();

    assert_eq!(diagnostic.labels.len(), 1, "exactly one primary label");
    assert_eq!(diagnostic.labels[0].span.offset, 100, "span round-trips");
    assert!(diagnostic.help.is_none(), "no help by default");
    assert!(diagnostic.url.is_none(), "no url by default");
    assert!(diagnostic.fix.is_none(), "no fix by default");
}

/// The reported code joins plugin and rule the way oxlint prints it.
#[test]
fn code_uses_oxlint_plugin_rule_form() {
    assert_eq!(sample().code(), "builtin(max-lines)", "plugin(rule) form");
}

/// The primary line comes from the first label.
#[test]
fn line_reads_the_primary_label() {
    assert_eq!(sample().line(), 42, "line comes from the first label");
}

/// An unlabelled finding reports line 1 rather than panicking.
#[test]
fn line_falls_back_when_unlabelled() {
    // What:     `.with_labels(Vec::new())` replaces the label list with an empty
    //           one, which is the state `line()` has to survive.
    // Why:      Reaching through `labels[0]` would panic here; the fallback is the
    //           branch that keeps a malformed rule from crashing the whole run.
    let diagnostic = sample().with_labels(Vec::new());

    assert_eq!(diagnostic.line(), 1, "unlabelled findings report line 1");
}

/// Replacing labels keeps every label given, in order.
#[test]
fn with_labels_replaces_the_whole_list() {
    let diagnostic = sample().with_labels(vec![
        Label::with_message(Span::at(0, 7, 1), "defined here"),
        Label::new(Span::at(50, 9, 3)),
    ]);

    assert_eq!(diagnostic.labels.len(), 2, "both labels kept");
    assert_eq!(diagnostic.line(), 7, "primary line follows the new first label");
    assert_eq!(
        diagnostic.labels[0].message.as_deref(),
        Some("defined here"),
        "note round-trips"
    );
}

/// Optional detail attaches through the chaining builders.
#[test]
fn builders_attach_optional_detail() {
    let diagnostic = sample()
        .with_help("split the file")
        .with_url("https://example.invalid/max-lines")
        .with_fix(Fix::single(
            FixKind::Safe,
            "remove the line",
            Edit::new(Span::at(0, 1, 1), ""),
        ));

    assert_eq!(
        diagnostic.help.as_deref(),
        Some("split the file"),
        "help round-trips"
    );
    assert_eq!(
        diagnostic.url.as_deref(),
        Some("https://example.invalid/max-lines"),
        "url round-trips"
    );

    // What:     `.expect("message")` takes the value out of an `Option`, failing
    //           with that message if it is absent. Used here rather than `?`
    //           because a test returning nothing cannot propagate absence.
    // Why:      The fix must be present, and the test should say so if it is not.
    let fix = diagnostic.fix.expect("fix should be attached");
    assert_eq!(fix.kind, FixKind::Safe, "fix kind round-trips");
}

/// The one-line renderer names path, line, severity, rule and message.
#[test]
fn render_names_every_part() {
    assert_eq!(
        sample().render(),
        "src/lib.rs:42: error[max-lines]: file has 400 code lines",
        "single-line render format"
    );
}

/// Warnings render with their own label rather than the error one.
#[test]
fn render_uses_the_findings_own_severity() {
    let diagnostic = Diagnostic::new(
        "builtin",
        "require-rustdoc",
        Severity::Warn,
        "Missing rustdoc on function \"a\".",
        "src/a.rs",
        Span::at(0, 3, 1),
    );

    assert_eq!(
        diagnostic.render(),
        "src/a.rs:3: warn[require-rustdoc]: Missing rustdoc on function \"a\".",
        "warn label appears in rendered output"
    );
}
