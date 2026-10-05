//! Finished requests: conversion against the ticket's text, failure classes, and bounded retries.

/// The request types this module completes.
use super::{Answer, Ask, Payload, Ticket};
/// Hint shaping.
use crate::language::hints;
/// Server ranges become character offsets only through the shared converter.
use crate::language::position::from_lsp_range;
/// Replies and their outcomes.
use crate::language::reply::{
    HoverText, LanguageReply, OpenTarget, RequestFailure, RequestKind, RequestOutcome, Target,
};
/// Locations are validated before any file is read.
use crate::language::target::{Classified, classify};
/// The worker whose state these steps change.
use crate::language::worker::{Internal, Worker};
/// What: `Rope` is Helix's character-indexed text buffer.
/// Why: A target in another file is converted against that file's text.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Rope } from 'helix-core';
/// ```
use helix_core::Rope;
/// The protocol's data types.
use helix_lsp::lsp;
/// What: `Path` is a borrowed filesystem path; `Duration` is a time span.
/// Why: Retries wait a fixed time before the request is sent again.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const RETRY_DELAY_MS = 300;
/// ```
use std::{path::Path, time::Duration};

/// How often a superseded request is sent again before it is reported as superseded.
const MAX_RETRIES: u32 = 3;

/// Wait before a superseded position or hint request is sent again.
const RETRY_DELAY: Duration = Duration::from_millis(300);

/// Wait before a pull request is sent again when the server asked for that, as Helix waits.
const PULL_RETRY_DELAY: Duration = Duration::from_millis(500);

/// Largest target file read to convert a location, in bytes. `u64` matches file sizes.
const MAX_TARGET_BYTES: u64 = 16 * 1024 * 1024;

/// What: How a failed request is treated. An `enum` with data is a tagged union.
/// Why: Codes `-32801` (content modified) and `-32800` (request cancelled) mean the server's
///      state moved under the request; that is not a failure to show.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Failure = { kind: 'superseded' } | { kind: 'failed'; failure: RequestFailure };
/// ```
enum Failure {
    /// The server gave up because its own state changed.
    Superseded,
    /// A real failure, with its class.
    Failed(RequestFailure),
}

/// Name the class of a request error.
fn classify_error(error: &helix_lsp::Error) -> Failure {
    // What: `match` on the borrowed error; `rpc.code.code()` reads the numeric protocol code.
    // Why: A protocol error, a timeout, and an ended server lead to different states.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (error instanceof RpcError) return [-32801, -32800].includes(error.code) ? superseded : failed(error);
    // ```
    return match error {
        helix_lsp::Error::Rpc(rpc) => {
            let code = rpc.code.code();
            if code == -32801 || code == -32800 {
                Failure::Superseded
            } else {
                Failure::Failed(RequestFailure::Rpc {
                    code,
                    // `clone` copies the server's message into the reply.
                    message: rpc.message.clone(),
                })
            }
        }
        helix_lsp::Error::Timeout(_) => Failure::Failed(RequestFailure::Timeout),
        helix_lsp::Error::StreamClosed => Failure::Failed(RequestFailure::StreamClosed),
        other => Failure::Failed(RequestFailure::Other(other.to_string())),
    };
}

/// What: Read a target file's text, or nothing when it is too large or not readable as text.
///       `Option<Rope>` is "a text, or nothing".
/// Why: A location in another file is given in that file's lines and columns; without its text
///      only the line number can be reported.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function readTarget(path: string): Rope | undefined
/// ```
fn read_target(path: &Path) -> Option<Rope> {
    // `ok()?` turns a failed metadata read into "nothing" and returns it.
    let size = std::fs::metadata(path).ok()?.len();
    if size > MAX_TARGET_BYTES {
        tracing::debug!(path = %path.display(), size, "target file is too large to convert its range");
        // `None` is the "nothing" variant of `Option`.
        return None;
    }
    let content = std::fs::read_to_string(path).ok()?;
    // `Some(...)` is the "value present" variant.
    return Some(Rope::from_str(&content));
}

/// What: Validate and convert one location a server returned.
/// Why: Refused addresses are reported as unavailable, never read and never dropped; openable
///      ones carry character offsets of the text they were converted against.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function target(ticket: Ticket, root: string, uri: URL, range: Range): Target
/// ```
fn target(ticket: &Ticket, root: &Path, uri: &lsp::Url, range: lsp::Range) -> Target {
    let (path, outside_project) = match classify(uri, root) {
        Classified::InsideProject(path) => (path, false),
        Classified::OutsideProject(path) => (path, true),
        Classified::Refused(refusal) => {
            return Target::Unavailable {
                uri: uri.to_string(),
                refusal,
            };
        }
    };
    // Documents are compared by resolved path, never by address text.
    let same_document = path == ticket.path;
    let text = if same_document {
        // The open document's server-side text is the ticket's revision, not the file on disk.
        Some(ticket.text.clone())
    } else {
        read_target(&path)
    };
    // `and_then` continues into the conversion only when a text is available.
    let converted = text.and_then(|found| return from_lsp_range(&found, range, ticket.encoding));
    return Target::Open(OpenTarget {
        path,
        outside_project,
        same_document,
        // `try_from` converts the protocol's `u32`; `unwrap_or(usize::MAX)` cannot occur on 64-bit hosts.
        line: usize::try_from(range.start.line).unwrap_or(usize::MAX),
        range: converted,
    });
}

/// Reduce the three definition result shapes to targets.
fn definition_outcome(
    ticket: &Ticket,
    root: &Path,
    found: Option<lsp::GotoDefinitionResponse>,
) -> RequestOutcome {
    let mut targets = Vec::new();
    match found {
        None => {}
        Some(lsp::GotoDefinitionResponse::Scalar(location)) => {
            targets.push(target(ticket, root, &location.uri, location.range));
        }
        Some(lsp::GotoDefinitionResponse::Array(locations)) => {
            for location in &locations {
                targets.push(target(ticket, root, &location.uri, location.range));
            }
        }
        Some(lsp::GotoDefinitionResponse::Link(links)) => {
            for link in &links {
                targets.push(target(
                    ticket,
                    root,
                    &link.target_uri,
                    link.target_selection_range,
                ));
            }
        }
    }
    if targets.is_empty() {
        return RequestOutcome::Empty;
    }
    return RequestOutcome::Locations(targets);
}

/// Convert a references answer; `null` and an empty list are both an empty successful result.
fn references_outcome(
    ticket: &Ticket,
    root: &Path,
    found: Option<Vec<lsp::Location>>,
) -> RequestOutcome {
    let mut targets = Vec::new();
    // `unwrap_or_default()` substitutes an empty list for `null`.
    for location in &found.unwrap_or_default() {
        targets.push(target(ticket, root, &location.uri, location.range));
    }
    if targets.is_empty() {
        return RequestOutcome::Empty;
    }
    return RequestOutcome::Locations(targets);
}

/// Render one legacy hover part; a language-tagged part becomes a fenced code block.
fn marked(part: lsp::MarkedString) -> String {
    return match part {
        lsp::MarkedString::String(text) => text,
        lsp::MarkedString::LanguageString(code) => {
            format!("```{}\n{}\n```", code.language, code.value)
        }
    };
}

/// What: Convert a hover answer. The three content shapes become one text plus a Markdown flag.
/// Why: The interface shows text; it does not interpret the protocol's legacy shapes.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function hoverOutcome(ticket: Ticket, found: Hover | null): RequestOutcome
/// ```
fn hover_outcome(ticket: &Ticket, found: Option<lsp::Hover>) -> RequestOutcome {
    let Some(hover) = found else {
        return RequestOutcome::Empty;
    };
    let (text, markdown) = match hover.contents {
        lsp::HoverContents::Markup(content) => {
            (content.value, content.kind == lsp::MarkupKind::Markdown)
        }
        lsp::HoverContents::Scalar(part) => (marked(part), true),
        lsp::HoverContents::Array(parts) => {
            let mut rendered: Vec<String> = Vec::new();
            for part in parts {
                rendered.push(marked(part));
            }
            // `join` concatenates the parts with a blank line between them.
            (rendered.join("\n\n"), true)
        }
    };
    if text.trim().is_empty() {
        return RequestOutcome::Empty;
    }
    let range = hover
        .range
        .and_then(|found_range| return from_lsp_range(&ticket.text, found_range, ticket.encoding));
    return RequestOutcome::Hover(HoverText {
        text,
        markdown,
        range,
    });
}

/// What: Send the reply of one position request, retrying or dropping a superseded one.
///       `Result<RequestOutcome, helix_lsp::Error>` is the converted outcome or the request error.
/// Why: A superseded answer for text that is no longer displayed is dropped; for displayed text
///      the request is sent again a bounded number of times before it is reported as superseded.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function replied(worker: Worker, ticket: Ticket, kind: RequestKind, outcome: Outcome | Error): void
/// ```
fn replied(
    worker: &mut Worker,
    ticket: Ticket,
    kind: RequestKind,
    converted: Result<RequestOutcome, helix_lsp::Error>,
) {
    let outcome = match converted {
        Ok(found) => found,
        Err(error) => match classify_error(&error) {
            Failure::Failed(failure) => RequestOutcome::Failed(failure),
            Failure::Superseded => {
                if worker.session.stamp() != Some(ticket.stamp) {
                    tracing::debug!(server = %ticket.server.name, "dropped a superseded answer for text that is no longer displayed");
                    worker.session.answered(ticket.number);
                    return;
                }
                if ticket.attempt < MAX_RETRIES {
                    let mut again = ticket;
                    again.attempt += 1;
                    worker.timer(RETRY_DELAY, Internal::Retry(Box::new(again)));
                    return;
                }
                RequestOutcome::Superseded
            }
        },
    };
    let remaining = worker.session.answered(ticket.number);
    worker.outputs.reply(LanguageReply {
        request: ticket.number,
        stamp: ticket.stamp,
        // `Some(...)` is the "value present" variant: this reply came from a server process.
        server: Some(ticket.server),
        kind,
        position: ticket.position,
        remaining,
        outcome,
    });
}

/// What: Store a pull-diagnostics answer, or send the request again when the server asks for that.
/// Why: The store fences the answer by stamp; a failure whose data says `retriggerRequest` is
///      retried as Helix does (`helix-term/src/handlers/diagnostics.rs`), a bounded number of times.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function pulled(worker: Worker, ticket: Ticket, result: Report | Error): void
/// ```
fn pulled(
    worker: &mut Worker,
    ticket: Ticket,
    result: helix_lsp::Result<lsp::DocumentDiagnosticReportResult>,
) {
    let store = &mut worker.session.diagnostics;
    match result {
        Ok(lsp::DocumentDiagnosticReportResult::Report(lsp::DocumentDiagnosticReport::Full(
            report,
        ))) => {
            let full = report.full_document_diagnostic_report;
            let accepted = store.pulled_full(
                &ticket.server,
                ticket.encoding,
                ticket.stamp,
                full.result_id,
                full.items,
            );
            tracing::debug!(server = %ticket.server.name, accepted, "stored pulled diagnostics");
        }
        Ok(lsp::DocumentDiagnosticReportResult::Report(
            lsp::DocumentDiagnosticReport::Unchanged(report),
        )) => {
            let identifier = report.unchanged_document_diagnostic_report.result_id;
            let accepted = store.pulled_unchanged(&ticket.server, ticket.stamp, identifier);
            tracing::debug!(server = %ticket.server.name, accepted, "kept pulled diagnostics the server reported unchanged");
        }
        Ok(lsp::DocumentDiagnosticReportResult::Partial(_)) => {
            tracing::debug!(server = %ticket.server.name, "ignored a partial pull-diagnostics answer");
        }
        Err(error) => {
            let wants_retry = match &error {
                // `clone` copies the error data so it can be decoded by value.
                helix_lsp::Error::Rpc(rpc) => rpc.data.clone().is_some_and(|data| {
                    return serde_json::from_value::<lsp::DiagnosticServerCancellationData>(data)
                        .is_ok_and(|decoded| return decoded.retrigger_request);
                }),
                _ => false,
            };
            let current = worker.session.stamp() == Some(ticket.stamp);
            if wants_retry && current && ticket.attempt < MAX_RETRIES {
                let mut again = ticket;
                again.attempt += 1;
                worker.timer(PULL_RETRY_DELAY, Internal::Retry(Box::new(again)));
            } else {
                tracing::debug!(server = %ticket.server.name, %error, "pull diagnostics failed");
            }
        }
    }
}

/// What: Store one server's hints for the displayed text, or retry a superseded request.
/// Why: Hints are latest-value state: an answer for another revision is simply dropped.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function hinted(worker: Worker, ticket: Ticket, result: InlayHint[] | null | Error): void
/// ```
fn hinted(
    worker: &mut Worker,
    ticket: Ticket,
    result: helix_lsp::Result<Option<Vec<lsp::InlayHint>>>,
) {
    if worker.session.stamp() != Some(ticket.stamp) {
        tracing::debug!(server = %ticket.server.name, "dropped inlay hints for text that is no longer displayed");
        return;
    }
    let Ask::Hints {
        first_line,
        last_line,
    } = ticket.ask
    else {
        return;
    };
    match result {
        Ok(found) => {
            let shaped = hints::shape(
                found.unwrap_or_default(),
                &ticket.text,
                ticket.encoding,
                &ticket.server,
            );
            // `retain` drops this server's earlier hints before the new ones are stored.
            worker
                .session
                .hints
                .retain(|(server, _)| return server != &ticket.server);
            worker.session.hints.push((ticket.server, shaped));
            worker.session.hint_lines = (first_line, last_line);
        }
        Err(error) => {
            let superseded = matches!(classify_error(&error), Failure::Superseded);
            if superseded && ticket.attempt < MAX_RETRIES {
                let mut again = ticket;
                again.attempt += 1;
                worker.timer(RETRY_DELAY, Internal::Retry(Box::new(again)));
            } else {
                tracing::debug!(server = %ticket.server.name, %error, "inlay hint request failed");
            }
        }
    }
}

/// True when the server itself produced the result, as opposed to a timeout or an ended process.
fn is_server_answer(payload: &Payload) -> bool {
    // What: A closure taking any request error by borrow; `matches!` tests the error's variant.
    // Why: A protocol error is still an answer; silence and a closed stream are not.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const answered = (error?: Error) => !error || error instanceof RpcError;
    // ```
    let answered = |error: Option<&helix_lsp::Error>| {
        return error.is_none_or(|found| return matches!(found, helix_lsp::Error::Rpc(_)));
    };
    return match payload {
        // `as_ref().err()` borrows the error of a failed result, or yields "nothing".
        Payload::Definition(result) => answered(result.as_ref().err()),
        Payload::References(result) => answered(result.as_ref().err()),
        Payload::Hover(result) => answered(result.as_ref().err()),
        Payload::Hints(result) => answered(result.as_ref().err()),
        Payload::Pull(result) => answered(result.as_ref().err()),
    };
}

/// What: Complete one finished request. `Answer` is moved in and taken apart.
/// Why: An answer to a request sent for the displayed text also ends that server's hold on
///      unversioned diagnostics, because it shows the server processed the latest change.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function finish(worker: Worker, answer: Answer): void
/// ```
pub(in crate::language) fn finish(worker: &mut Worker, answer: Answer) {
    let Answer { ticket, payload } = answer;
    if is_server_answer(&payload)
        && worker
            .session
            .diagnostics
            .answered(&ticket.server, ticket.stamp)
    {
        tracing::debug!(server = %ticket.server.name, "diagnostics hold ended by the server's first answer after the reload");
    }
    // `clone` copies the root path so the worker can be changed while targets are converted.
    let root = worker.root.clone();
    match payload {
        Payload::Definition(result) => {
            let outcome = result.map(|found| return definition_outcome(&ticket, &root, found));
            replied(worker, ticket, RequestKind::Definition, outcome);
        }
        Payload::References(result) => {
            let outcome = result.map(|found| return references_outcome(&ticket, &root, found));
            replied(worker, ticket, RequestKind::References, outcome);
        }
        Payload::Hover(result) => {
            let outcome = result.map(|found| return hover_outcome(&ticket, found));
            replied(worker, ticket, RequestKind::Hover, outcome);
        }
        Payload::Hints(result) => hinted(worker, ticket, result),
        Payload::Pull(result) => pulled(worker, ticket, result),
    }
}
