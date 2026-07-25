//! JSONL output: one JSON object per line, one line per finding.
//!
//! This is the linter's only output format. oxlint ships ten
//! (`default`, `agent`, `json`, `github`, `gitlab`, `unix`, `checkstyle`,
//! `junit`, `sarif`, `stylish`) and none of them is JSONL, so this is a
//! deliberate divergence rather than an unfinished part of the parity work.
//! `doc/planning/rust-linter-oxlint-parity.md` records it under the known
//! parity holes.

/// Imports the serialization trait the record types derive.
use serde::Serialize;

/// Imports the finding record the renderer reads.
use crate::diagnostic::Diagnostic;

// What:     `#[derive(Serialize)]` generates the code that turns this type into
//           JSON, the mirror of the `Deserialize` the config types derive.
// Why:      A typed record rather than an ad-hoc map. The field names ARE the
//           output format, so declaring them once as a struct means the shape
//           cannot drift between the renderer and whatever documents it, and
//           the compiler catches a renamed field instead of a consumer doing so
//           at run time.
//
// In TS you'd write (pseudocode):
// ```ts
// type Record = { message: string; code: string; /* ... */ };
// ```
/// One JSONL record, carrying oxlint's diagnostic field set.
#[derive(Serialize)]
struct Record<'a> {
    /// Human-readable explanation of the finding.
    message: &'a str,

    /// Reported code in oxlint's `plugin(rule)` form.
    code: String,

    /// Severity label, `error` or `warn`.
    severity: &'static str,

    // What:     `causes: [&'a str; 0]` is a fixed-size array of length zero.
    // Why:      oxlint emits `"causes": []` on every diagnostic, and a
    //           zero-length array serializes to exactly that without allocating
    //           a `Vec` per record just to be empty.
    /// Always empty; present because oxlint's shape carries it.
    causes: [&'a str; 0],

    /// File the finding is in.
    filename: &'a str,

    /// Source spans this finding points at.
    labels: Vec<Label>,

    /// Always empty; present because oxlint's shape carries it.
    related: [&'a str; 0],

    // What:     `#[serde(skip_serializing_if = "Option::is_none")]` omits the
    //           key entirely when the value is absent, rather than writing null.
    // Why:      oxlint omits `url` and `help` when a finding carries neither,
    //           verified against its real output, and the repo's own
    //           `OxlintDiagnostic` type in
    //           `package-deprecated/mcp/nvim/src/oxlint-types.ts` declares both
    //           optional. A `null` would be a different shape for any consumer
    //           that checks presence.
    /// Documentation URL for the rule, omitted when absent.
    #[serde(skip_serializing_if = "Option::is_none")]
    url: Option<&'a str>,

    /// Remediation hint, omitted when absent.
    #[serde(skip_serializing_if = "Option::is_none")]
    help: Option<&'a str>,
}

/// One labelled span within a record.
#[derive(Serialize)]
struct Label {
    /// Byte range and resolved position of this label.
    span: Span,
}

/// Byte range and resolved position, as oxlint reports them.
#[derive(Serialize)]
struct Span {
    /// Zero-based byte offset of the span's first byte.
    offset: usize,

    /// Length of the span in bytes.
    length: usize,

    /// One-based line the span starts on.
    line: usize,

    /// One-based column the span starts on.
    column: usize,
}

// What:     `pub fn render(diagnostics: &[Diagnostic]) -> String`. Borrows the
//           findings and returns one owned string holding every line.
// Why:      Returning a string rather than printing keeps the format testable
//           without capturing stdout, which is what lets the escaping cases be
//           asserted directly.
//
// In TS you'd write (pseudocode):
// ```ts
// function render(diagnostics: Diagnostic[]): string
// ```
/// Render findings as JSONL, one JSON object per line.
pub fn render(diagnostics: &[Diagnostic]) -> String {
    // What:     `let mut out = String::new();` then pushing into it in a loop.
    //           `String::new()` allocates an empty owned string.
    // Why:      One buffer grown in place beats joining a vector of pieces.
    let mut out = String::new();

    for diagnostic in diagnostics {
        // What:     `to_string` rather than `to_string_pretty`, and
        //           `.unwrap_or_default()` rather than `.unwrap()`.
        // Why:      A JSONL record is one line by definition, so pretty-printing
        //           would break the format outright. And `Result::unwrap` is
        //           denied by `clippy.toml` across this repository, with good
        //           reason: serializing this record cannot fail, but a panic in
        //           a linter's own output path would be a poor way to find out
        //           otherwise.
        out.push_str(&serde_json::to_string(&record(diagnostic)).unwrap_or_default());
        out.push('\n');
    }

    return out;
}

// What:     `fn record(diagnostic: &'a Diagnostic) -> Record<'a>`. The `'a` is a
//           LIFETIME parameter, naming how long the borrowed strings inside the
//           record stay valid: as long as the diagnostic they came from. TS has
//           no equivalent, because its garbage collector makes the question moot.
// Why:      Borrowing rather than copying every message and path. The record
//           exists only long enough to be serialized, so it never needs to
//           outlive the finding it describes.
//
// In TS you'd write (pseudocode):
// ```ts
// function record(diagnostic: Diagnostic): Record
// ```
/// Build one serializable record from a finding.
fn record(diagnostic: &Diagnostic) -> Record<'_> {
    // AGENTS.md SYB: text crossing a syntax boundary obeys the destination's
    // grammar, and encoding happens at the final interpolation. Handing these
    // values to serde means a message containing quotes, backslashes or
    // newlines is escaped by the destination's own encoder rather than by hand.
    let labels = diagnostic
        .labels
        .iter()
        .map(|label| {
            return Label {
                span: Span {
                    offset: label.span.offset,
                    length: label.span.length,
                    line: label.span.line,
                    column: label.span.column,
                },
            };
        })
        .collect();

    return Record {
        message: &diagnostic.message,
        code: diagnostic.code(),
        severity: diagnostic.severity.label(),
        causes: [],
        filename: &diagnostic.path,
        labels,
        related: [],
        // `.as_deref()` turns `&Option<String>` into `Option<&str>`, borrowing
        // the text rather than copying it.
        url: diagnostic.url.as_deref(),
        help: diagnostic.help.as_deref(),
    };
}
