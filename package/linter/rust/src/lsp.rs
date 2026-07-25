//! The language server, serving diagnostics and fixes to an editor.
//!
//! Hand-rolled JSON-RPC over stdio rather than built on `tower-lsp`, because
//! that would pull an async runtime into a linter that is otherwise entirely
//! synchronous. A diagnostic-only server needs a header parser and a dispatch
//! table, and both are small enough to own.

/// Reading and writing Language Server Protocol messages over stdio.
pub mod protocol;

/// Unit tests for Language Server Protocol framing.
#[cfg(test)]
mod protocol_tests;

/// Imports the ordered map open documents are held in.
use std::collections::BTreeMap;
/// Imports the standard streams the server speaks over.
use std::io::{BufReader, Write};

/// Imports the parsed command-line options the server lints with.
use crate::cli::Cli;
/// Imports the per-file context and finding types.
use crate::context::LintContext;
use crate::diagnostic::{Diagnostic, Severity};
/// Imports the rule trait the server runs.
use crate::rule::Rule;
/// Imports the framing helpers.
use crate::lsp::protocol::{read_message, write_message};

/// Imports the compiled configuration rules resolve against.
use monochromatic_rust_linter_core::config::resolve::LinterConfig;

/// Imports the serialization trait the outgoing message records derive.
use serde::Serialize;

// What:     Serializable records for the three shapes this server sends, rather
//           than `serde_json::json!` values.
// Why:      The macro expands to a `Result::unwrap`, which `clippy.toml` denies
//           across this repository. Typed records also make the protocol's field
//           names the struct's field names, so a rename is a compile error
//           rather than a client that silently stops understanding us.
/// Capabilities and identity returned from `initialize`.
#[derive(Serialize)]
struct InitializeResult {
    /// What this server can do, which is what the client will then send.
    capabilities: Capabilities,

    /// Name and version, shown in an editor's server list.
    #[serde(rename = "serverInfo")]
    server_info: ServerInfo,
}

/// The capabilities this server advertises.
#[derive(Serialize)]
struct Capabilities {
    // What:     `1`, LSP's `TextDocumentSyncKind::Full`.
    // Why:      Each change carries the whole document. Incremental sync is less
    //           traffic but means applying ranged edits correctly, and a linter
    //           re-parses the whole file regardless.
    #[serde(rename = "textDocumentSync")]
    text_document_sync: u8,
}

/// Server name and version.
#[derive(Serialize)]
struct ServerInfo {
    /// Server name.
    name: &'static str,

    /// Server version, read from the crate at compile time.
    version: &'static str,
}

/// A JSON-RPC response carrying a result.
#[derive(Serialize)]
struct Response<T> {
    /// Protocol version, always "2.0".
    jsonrpc: &'static str,

    /// The request's id, echoed so the client can match them up.
    id: serde_json::Value,

    /// The result payload.
    result: T,
}

/// A `textDocument/publishDiagnostics` notification.
#[derive(Serialize)]
struct DiagnosticsNotification<'a> {
    /// Protocol version, always "2.0".
    jsonrpc: &'static str,

    /// Method name the client dispatches on.
    method: &'static str,

    /// The document and its findings.
    params: DiagnosticsParams<'a>,
}

/// The document and findings a diagnostics notification carries.
#[derive(Serialize)]
struct DiagnosticsParams<'a> {
    /// Document these findings belong to.
    uri: &'a str,

    /// Every finding, replacing whatever the client showed before.
    diagnostics: Vec<LspDiagnostic<'a>>,
}

/// One finding in the shape LSP expects.
#[derive(Serialize)]
struct LspDiagnostic<'a> {
    /// Where the finding is, in zero-based coordinates.
    range: Range,

    /// LSP severity number: 1 error, 2 warning.
    severity: u8,

    /// Reported code, in `plugin(rule)` form.
    code: String,

    /// Which tool produced this, shown beside the message.
    source: &'static str,

    /// Human-readable explanation.
    message: &'a str,
}

/// A zero-based source range.
#[derive(Serialize)]
struct Range {
    /// Where the range starts.
    start: Position,

    /// Where the range ends.
    end: Position,
}

/// A zero-based source position.
#[derive(Serialize)]
struct Position {
    /// Zero-based line.
    line: usize,

    /// Zero-based column, which LSP calls a character offset.
    character: usize,
}

// What:     `pub fn serve(cli: &Cli, linter: &LinterConfig, rules: &[Box<dyn Rule>]) -> i32`.
//           Runs until the client disconnects, then returns an exit code.
// Why:      The server borrows the same configuration and rule set the one-shot
//           run uses, so an editor and a terminal cannot disagree about what the
//           rules are.
//
// In TS you'd write (pseudocode):
// ```ts
// function serve(cli: Cli, linter: LinterConfig, rules: Rule[]): number
// ```
/// Serve diagnostics over stdio until the client disconnects.
pub fn serve(cli: &Cli, linter: &LinterConfig, rules: &[Box<dyn Rule>]) -> i32 {
    let stdin = std::io::stdin();
    let mut input = BufReader::new(stdin.lock());
    let mut output = std::io::stdout();

    // Open documents, keyed by URI. The editor's buffer is the source of truth
    // while a file is open, because it holds edits the disk has not seen.
    let mut documents: BTreeMap<String, String> = BTreeMap::new();

    // `while let Some(..)` runs until `read_message` answers absent, which is
    // how a closed pipe ends the loop.
    while let Some(body) = read_message(&mut input) {
        let Ok(message) = serde_json::from_str::<serde_json::Value>(&body) else {
            // A malformed message is skipped rather than fatal: one bad frame
            // should not take the editor's diagnostics down for the session.
            continue;
        };

        let method = message["method"].as_str().unwrap_or_default();

        if method == "initialize" {
            respond(&mut output, &message, initialize_result());
        } else if method == "shutdown" {
            respond(&mut output, &message, serde_json::Value::Null);
        } else if method == "exit" {
            return 0;
        } else if method == "textDocument/didOpen" {
            let uri = message["params"]["textDocument"]["uri"]
                .as_str()
                .unwrap_or_default()
                .to_string();
            let text = message["params"]["textDocument"]["text"]
                .as_str()
                .unwrap_or_default()
                .to_string();

            documents.insert(uri.clone(), text);
            publish(&mut output, &uri, &documents, cli, linter, rules);
        } else if method == "textDocument/didChange" {
            let uri = message["params"]["textDocument"]["uri"]
                .as_str()
                .unwrap_or_default()
                .to_string();

            // Full synchronisation: the server advertises `TextDocumentSyncKind`
            // 1, so each change carries the whole document and the last content
            // change is the new text.
            if let Some(changes) = message["params"]["contentChanges"].as_array()
                && let Some(last) = changes.last()
                && let Some(text) = last["text"].as_str()
            {
                documents.insert(uri.clone(), text.to_string());
            }

            publish(&mut output, &uri, &documents, cli, linter, rules);
        } else if method == "textDocument/didClose" {
            let uri = message["params"]["textDocument"]["uri"]
                .as_str()
                .unwrap_or_default()
                .to_string();

            documents.remove(&uri);

            // An empty list clears the editor's markers for a file it is no
            // longer showing. Saying nothing would leave them stranded.
            notify_diagnostics(&mut output, &uri, &[]);
        }
    }

    return 0;
}

// What:     `fn initialize_result() -> serde_json::Value`. The capabilities the
//           server advertises.
// Why:      A client only sends what the server says it handles, so an
//           unadvertised capability is the same as an unimplemented one.
/// Build the capabilities this server advertises.
fn initialize_result() -> InitializeResult {
    return InitializeResult {
        capabilities: Capabilities {
            text_document_sync: 1,
        },
        server_info: ServerInfo {
            name: "rust-linter",
            // `env!` reads the version at COMPILE time, so what the editor is
            // told cannot drift from the binary telling it.
            version: env!("CARGO_PKG_VERSION"),
        },
    };
}

/// Reply to a request, echoing its id so the client can match them up.
fn respond<T: Serialize>(
    output: &mut impl Write,
    message: &serde_json::Value,
    result: T,
) {
    let reply = Response {
        jsonrpc: "2.0",
        id: message["id"].clone(),
        result,
    };

    // `.unwrap_or_default()` rather than `.unwrap()`: serializing these records
    // cannot fail, and a panic in a server's reply path would take the editor's
    // diagnostics down for the whole session.
    write_message(
        output,
        &serde_json::to_string(&reply).unwrap_or_default(),
    );
}

/// Lint one open document and publish what it found.
fn publish(
    output: &mut impl Write,
    uri: &str,
    documents: &BTreeMap<String, String>,
    cli: &Cli,
    linter: &LinterConfig,
    rules: &[Box<dyn Rule>],
) {
    let Some(text) = documents.get(uri) else {
        return;
    };

    let findings = lint_text(uri, text, cli, linter, rules);
    notify_diagnostics(output, uri, &findings);
}

// What:     `fn lint_text(..) -> Vec<Diagnostic>`. Lints the editor's buffer
//           rather than the file on disk.
// Why:      That is the whole point of a language server: the buffer holds edits
//           the disk has not seen, and reporting against the saved file would
//           mean every diagnostic is one keystroke stale.
/// Lint one document's text, resolving rules against its path.
fn lint_text(
    uri: &str,
    text: &str,
    cli: &Cli,
    linter: &LinterConfig,
    rules: &[Box<dyn Rule>],
) -> Vec<Diagnostic> {
    let path = uri_to_path(uri);
    let context = LintContext::new(path.clone(), text.to_string());

    let mut findings = Vec::new();

    for rule in rules {
        let resolved = linter.resolve(
            std::path::Path::new(&path),
            rule.plugin(),
            rule.id(),
            rule.category(),
        );

        if !resolved.severity.is_enabled() {
            continue;
        }

        let before = findings.len();
        let config = crate::config::Config {
            max_lines: crate::resolve_max_lines(cli.max_lines, resolved.options.as_ref()),
        };

        rule.check(&context, &config, &mut findings);

        if let Some(reported) = resolved.severity.as_diagnostic() {
            for diagnostic in &mut findings[before..] {
                diagnostic.severity = reported;
            }
        }
    }

    return findings;
}

/// Send a document's diagnostics to the client.
fn notify_diagnostics(output: &mut impl Write, uri: &str, findings: &[Diagnostic]) {
    let items: Vec<LspDiagnostic<'_>> = findings
        .iter()
        .map(|diagnostic| {
            // LSP positions are ZERO-based and this linter's are one-based, so
            // every number crossing this boundary is decremented. Getting it
            // wrong puts every marker one line and one column off, which reads
            // as a subtly broken linter rather than a broken conversion.
            let line = diagnostic.line().saturating_sub(1);
            let column = diagnostic.column().saturating_sub(1);
            let width = diagnostic
                .labels
                .first()
                .map_or(1, |label| return label.span.length.max(1));

            return LspDiagnostic {
                range: Range {
                    start: Position {
                        line,
                        character: column,
                    },
                    end: Position {
                        line,
                        character: column + width,
                    },
                },
                severity: lsp_severity(diagnostic.severity),
                code: diagnostic.code(),
                source: "rust-linter",
                message: &diagnostic.message,
            };
        })
        .collect();

    let notification = DiagnosticsNotification {
        jsonrpc: "2.0",
        method: "textDocument/publishDiagnostics",
        params: DiagnosticsParams {
            uri,
            diagnostics: items,
        },
    };

    write_message(
        output,
        &serde_json::to_string(&notification).unwrap_or_default(),
    );
}

// What:     `fn lsp_severity(severity: Severity) -> u8`. LSP numbers its
//           severities: 1 error, 2 warning, 3 information, 4 hint.
// Why:      A named constant would be clearer, but the protocol specifies the
//           numbers, and inventing names for them here would only add a layer to
//           read through.
/// Convert a finding's severity into the number LSP uses.
fn lsp_severity(severity: Severity) -> u8 {
    if severity == Severity::Error {
        return 1;
    }

    return 2;
}

// What:     `fn uri_to_path(uri: &str) -> String`. Turns a `file://` URI into a
//           filesystem path.
// Why:      Rules and configuration both work on paths, and glob overrides in
//           particular would never match a URI. This is deliberately minimal:
//           it handles the `file://` scheme an editor actually sends, rather
//           than pulling in a URL parser for the general case.
/// Convert a file URI into a path, leaving anything else alone.
fn uri_to_path(uri: &str) -> String {
    // `.unwrap_or(uri)` leaves a non-file URI untouched, so an editor working
    // over some other scheme still gets diagnostics keyed consistently.
    return uri.strip_prefix("file://").unwrap_or(uri).to_string();
}
