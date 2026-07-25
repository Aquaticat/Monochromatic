//! Unit tests for the JSONL output format.

/// Imports the finding record the renderer reads.
use crate::diagnostic::{Diagnostic, Severity};
/// Imports the renderer under test.
use crate::format::render;
/// Imports the span type findings point with.
use crate::span::Span;

/// Build one ordinary finding for a test.
fn finding(message: &str, severity: Severity) -> Diagnostic {
    return Diagnostic::new(
        "builtin",
        "max-lines",
        severity,
        message,
        "src/lib.rs",
        Span::new(10, 4, 2, 3),
    );
}

// What:     `fn parse_lines(rendered: &str) -> Vec<serde_json::Value>`. Parses
//           each line back into a JSON value, failing the test on any line that
//           does not parse.
// Why:      Every assertion below is about the parsed record rather than the
//           text, and parsing line by line is exactly what a JSONL consumer
//           does, so this helper checks the format's core promise on the way to
//           whatever the test is really asking.
/// Parse rendered JSONL back into one value per line.
fn parse_lines(rendered: &str) -> Vec<serde_json::Value> {
    return rendered
        .lines()
        .map(|line| {
            return serde_json::from_str(line)
                .unwrap_or_else(|error| panic!("line should be valid JSON: {line}: {error}"));
        })
        .collect();
}

/// Each finding becomes exactly one line.
#[test]
fn one_line_per_finding() {
    let rendered = render(&[
        finding("first", Severity::Error),
        finding("second", Severity::Warn),
    ]);

    assert_eq!(rendered.lines().count(), 2, "two findings, two lines");

    let parsed = parse_lines(&rendered);
    assert_eq!(parsed[0]["message"], "first", "first record");
    assert_eq!(parsed[1]["message"], "second", "second record");
}

/// A clean run prints nothing at all.
#[test]
fn clean_run_prints_nothing() {
    assert!(render(&[]).is_empty(), "no findings, no output");
}

/// Every record carries oxlint's diagnostic field set.
#[test]
fn record_matches_the_oxlint_diagnostic_shape() {
    let parsed = parse_lines(&render(&[finding("too long", Severity::Error)]));
    let record = &parsed[0];

    assert_eq!(record["code"], "builtin(max-lines)", "code is plugin(rule)");
    assert_eq!(record["severity"], "error", "severity label");
    assert_eq!(record["filename"], "src/lib.rs", "filename, not path");
    assert_eq!(record["message"], "too long", "message");
    assert_eq!(record["labels"][0]["span"]["offset"], 10, "span offset");
    assert_eq!(record["labels"][0]["span"]["length"], 4, "span length");
    assert_eq!(record["labels"][0]["span"]["line"], 2, "span line");
    assert_eq!(record["labels"][0]["span"]["column"], 3, "span column");
    assert!(record["causes"].is_array(), "causes is an array");
    assert!(record["related"].is_array(), "related is an array");
}

/// A warning reports its own severity label.
#[test]
fn warning_severity_is_reported() {
    let parsed = parse_lines(&render(&[finding("careful", Severity::Warn)]));

    assert_eq!(parsed[0]["severity"], "warn", "warn label");
}

// What:     `fn assert_absent(..)` is an ordinary helper, not a test: it carries
//           no `#[test]` attribute.
// Why:      Two tests below make the same assertion about different keys, and
//           the failure message is worth writing once.
/// Fail unless a key is omitted from a record entirely.
fn assert_absent(record: &serde_json::Value, key: &str) {
    assert!(
        record.get(key).is_none(),
        "{key} should be omitted entirely, not null: {record}"
    );
}

// What:     A test that two keys are ABSENT rather than null.
// Why:      oxlint omits `help` and `url` when a finding carries neither,
//           verified against its real output, and the repo's own
//           `OxlintDiagnostic` type declares both optional. Emitting `null`
//           would be a different shape for every consumer that checks presence.
/// A finding with no help or url omits both keys.
#[test]
fn absent_optional_keys_are_omitted() {
    let parsed = parse_lines(&render(&[finding("too long", Severity::Error)]));

    assert_absent(&parsed[0], "help");
    assert_absent(&parsed[0], "url");
}

/// Present help and url keys do appear.
#[test]
fn present_optional_keys_are_included() {
    let diagnostic = finding("too long", Severity::Error)
        .with_help("split it")
        .with_url("https://example.invalid/r");

    let parsed = parse_lines(&render(&[diagnostic]));

    assert_eq!(parsed[0]["help"], "split it", "help present");
    assert_eq!(parsed[0]["url"], "https://example.invalid/r", "url present");
}

// What:     A message full of characters that mean something in JSON, including
//           one that would break the LINE structure JSONL depends on.
// Why:      AGENTS.md STB: a transformer emitting another syntax needs
//           adversarial destination cases. The unescaped newline matters most
//           here, because it would split one finding across two lines and every
//           consumer would read it as two malformed records rather than one
//           good one.
/// A message containing JSON metacharacters survives a round trip intact.
#[test]
fn hostile_message_round_trips() {
    let hostile = "quote \" backslash \\ newline \n tab \t brace } bracket ]";
    let rendered = render(&[finding(hostile, Severity::Error)]);

    assert_eq!(
        rendered.lines().count(),
        1,
        "an embedded newline must not split the record: {rendered}"
    );

    let parsed = parse_lines(&rendered);
    assert_eq!(
        parsed[0]["message"], hostile,
        "the message round-trips byte for byte"
    );
}

/// A path containing JSON metacharacters is escaped too.
#[test]
fn hostile_path_round_trips() {
    let mut diagnostic = finding("plain", Severity::Error);
    diagnostic.path = "src/we\"ird\\path\n.rs".to_string();

    let rendered = render(&[diagnostic]);

    assert_eq!(rendered.lines().count(), 1, "still one line: {rendered}");
    assert_eq!(
        parse_lines(&rendered)[0]["filename"],
        "src/we\"ird\\path\n.rs",
        "the path round-trips"
    );
}

/// A finding pointing at several places reports every label.
#[test]
fn every_label_is_reported() {
    /// Imports the label type the multi-label case builds.
    use crate::span::Label;

    let diagnostic = finding("two places", Severity::Error).with_labels(vec![
        Label::new(Span::new(0, 2, 1, 1)),
        Label::with_message(Span::new(20, 3, 4, 5), "and here"),
    ]);

    let parsed = parse_lines(&render(&[diagnostic]));
    let labels = parsed[0]["labels"].as_array().expect("labels array");

    assert_eq!(labels.len(), 2, "both labels reported");
    assert_eq!(labels[1]["span"]["line"], 4, "second label's position");
}
