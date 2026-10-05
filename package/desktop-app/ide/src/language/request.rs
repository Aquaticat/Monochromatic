//! Sending the five feature requests: routing by feature, the readiness gate, and bookkeeping.
//!
//! Every request captures a ticket: the stamp, the text, the column unit, and the server
//! process it was sent to. The answer is converted against that ticket, never against later state.

/// Exited servers are started again by an explicit position request.
use super::attach;
/// Hint windows and the latest-value snapshot.
use super::hints::{HintWindow, HintsSnapshot, InlayHint, request_lines};
/// Identities captured in every ticket.
use super::identity::{DocumentStamp, ServerIdentity};
/// Offsets become server positions only through the shared converter.
use super::position::{to_lsp_position, to_lsp_range};
/// Replies and their outcomes.
use super::reply::{LanguageReply, PositionRequest, RequestFailure, RequestKind, RequestOutcome};
/// Session state and configured feature exclusions.
use super::session::{Session, allowed};
/// Servers that could not follow a reload are not asked about positions.
use super::status::ServerState;
/// The worker whose state these steps change.
use super::worker::Worker;
/// What: `Rope` is Helix's character-indexed text buffer; `LanguageServerFeature` names the
///       features a language's configuration can restrict per server.
/// Why: A ticket keeps the text of the revision it asks about; routing honors the configuration.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { type Rope, LanguageServerFeature } from 'helix-core';
/// ```
use helix_core::{Rope, syntax::config::LanguageServerFeature};
/// The column unit of one server and the protocol's data types.
use helix_lsp::{OffsetEncoding, lsp};
/// What: `Future` is Rust's promise; `Pin<Box<dyn Future>>` is an owned, heap-stored promise
///       whose concrete type is erased; `PathBuf` is an owned filesystem path.
/// Why: Each helix-lsp request method returns a differently typed future; erasing the type lets
///      one place await all five.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type PayloadFuture = Promise<Payload>;
/// ```
use std::{future::Future, path::PathBuf, pin::Pin};

/// Converting answers and classifying failures.
mod answer;
/// The worker loop hands finished requests to this function.
pub(super) use answer::finish;

/// What a ticket asks for.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Ask = { kind: 'position'; request: RequestKind }
///          | { kind: 'hints'; firstLine: number; lastLine: number } | { kind: 'pull' };
/// ```
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Ask {
    /// Definition, references, or hover at a character offset.
    Position(RequestKind),
    /// Inlay hints for a line range.
    Hints {
        /// First requested line.
        first_line: usize,
        /// Line the request ends before.
        last_line: usize,
    },
    /// Pull diagnostics for the document.
    Pull,
}

/// What: Everything a late answer needs to be judged and converted, captured when the request
///       is sent. `u32` is an unsigned 32-bit count (siblings: `u64`, `usize`).
/// Why: An answer must be converted against the text it was asked about, and tagged with the
///      revision and server process it belongs to, so the interface can drop it when stale.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Ticket = { number: number; ask: Ask; position: number; stamp: DocumentStamp; text: Rope;
///                 path: string; encoding: Encoding; server: ServerIdentity; attempt: number };
/// ```
#[derive(Clone, Debug)]
pub(super) struct Ticket {
    /// Request number of a position request; zero for requests the worker makes on its own.
    pub(super) number: u64,
    /// What was asked.
    pub(super) ask: Ask,
    /// Character offset of a position request.
    pub(super) position: usize,
    /// File generation and revision the request was sent for.
    pub(super) stamp: DocumentStamp,
    /// Text of that revision; a rope clone shares its chunks.
    pub(super) text: Rope,
    /// Resolved path of the document, to recognize targets inside it.
    pub(super) path: PathBuf,
    /// Column unit of the server that was asked.
    pub(super) encoding: OffsetEncoding,
    /// Server process that was asked.
    pub(super) server: ServerIdentity,
    /// How many times this request was already sent again after being superseded.
    pub(super) attempt: u32,
}

/// The typed result of one request, as helix-lsp delivers it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Payload = { kind: 'definition'; result: Result<DefinitionResponse | null> } | /* ... */;
/// ```
pub(super) enum Payload {
    /// Answer to `textDocument/definition`.
    Definition(helix_lsp::Result<Option<lsp::GotoDefinitionResponse>>),
    /// Answer to `textDocument/references`.
    References(helix_lsp::Result<Option<Vec<lsp::Location>>>),
    /// Answer to `textDocument/hover`.
    Hover(helix_lsp::Result<Option<lsp::Hover>>),
    /// Answer to `textDocument/inlayHint`.
    Hints(helix_lsp::Result<Option<Vec<lsp::InlayHint>>>),
    /// Answer to `textDocument/diagnostic`.
    Pull(helix_lsp::Result<lsp::DocumentDiagnosticReportResult>),
}

/// A finished request: its ticket and what the server said.
pub(super) struct Answer {
    /// What was asked, of whom, about which text.
    pub(super) ticket: Ticket,
    /// The server's result or the failure.
    pub(super) payload: Payload,
}

/// The erased future every request is converted to before it is awaited.
type PayloadFuture = Pin<Box<dyn Future<Output = Payload> + Send>>;

/// A pending request as the worker loop awaits it: it resolves to the answer with its ticket.
pub(super) type AnswerFuture = Pin<Box<dyn Future<Output = Answer> + Send>>;

/// What: Store any future that yields a payload on the heap behind the erased type. `F` is one
///       type parameter: "some future that yields a `Payload`, may move between threads, and
///       borrows nothing".
/// Why: Five differently typed futures then fit one variable and one place that awaits them.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function erase(future: Promise<Payload>): Promise<Payload> { return future; }
/// ```
fn erase<F>(future: F) -> PayloadFuture
where
    F: Future<Output = Payload> + Send + 'static,
{
    return Box::pin(future);
}

/// What happened when a request was to be sent to one server.
enum Sent {
    /// The request is on its way; the worker loop awaits its answer.
    Spawned,
    /// The server has not finished `initialize`.
    Starting,
    /// The server could not follow the latest reload.
    Unsynchronized,
    /// The server does not offer the feature.
    Unsupported,
    /// The server is not asked: no process, feature excluded by configuration, or no valid position.
    Skipped,
}

/// The configuration feature a request is routed by.
fn feature(ask: Ask) -> LanguageServerFeature {
    return match ask {
        Ask::Position(RequestKind::Definition) => LanguageServerFeature::GotoDefinition,
        Ask::Position(RequestKind::References) => LanguageServerFeature::GotoReference,
        Ask::Position(RequestKind::Hover) => LanguageServerFeature::Hover,
        Ask::Hints { .. } => LanguageServerFeature::InlayHints,
        Ask::Pull => LanguageServerFeature::PullDiagnostics,
    };
}

/// What: Send one request to one server, or say why it was not sent. `index` is the server's
///       record; `number`, `position`, and `attempt` go into the ticket.
/// Why: This is the single place where the application calls helix-lsp's request methods. Each
///      of them panics on a client that has not initialized, so the readiness gate comes first.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function dispatch(worker, index, number, ask, position, attempt): Sent
/// ```
fn dispatch(
    worker: &mut Worker,
    index: usize,
    number: u64,
    ask: Ask,
    position: usize,
    attempt: u32,
) -> Sent {
    let Some(document) = worker.session.document.as_ref() else {
        return Sent::Skipped;
    };
    let record = &worker.session.servers[index];
    let name = record.identity.name.as_str();
    if record.client.is_none() || !allowed(document.config.as_ref(), name, feature(ask)) {
        return Sent::Skipped;
    }
    // The gate: `ready` is `None` until `initialize` completed.
    let Some(client) = record.ready() else {
        return Sent::Starting;
    };
    if record.state == ServerState::Unsynchronized {
        return Sent::Unsynchronized;
    }
    if !record.opened {
        return Sent::Starting;
    }
    let encoding = client.offset_encoding();
    let identifier = lsp::TextDocumentIdentifier::new(document.url.clone());
    // What: Each arm asks helix-lsp for its typed future. The methods return `None` when the
    //       server did not announce the capability; `erase(async move { ... })` wraps the typed
    //       future so its payload variant records which request it answers.
    // Why: `None` is the observable form of "unsupported capability" for a running server.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const pending: Promise<Payload> | undefined = client.hover(identifier, at)?.then(wrapHover);
    // ```
    let pending: Option<PayloadFuture> = match ask {
        Ask::Position(kind) => {
            let Some(at) = to_lsp_position(&document.text, position, encoding) else {
                return Sent::Skipped;
            };
            match kind {
                RequestKind::Definition => match client.goto_definition(identifier, at, None) {
                    Some(request) => {
                        Some(erase(
                            async move { return Payload::Definition(request.await) },
                        ))
                    }
                    None => None,
                },
                RequestKind::References => {
                    match client.goto_reference(identifier, at, true, None) {
                        Some(request) => {
                            Some(erase(
                                async move { return Payload::References(request.await) },
                            ))
                        }
                        None => None,
                    }
                }
                RequestKind::Hover => match client.text_document_hover(identifier, at, None) {
                    Some(request) => {
                        Some(erase(async move { return Payload::Hover(request.await) }))
                    }
                    None => None,
                },
            }
        }
        Ask::Hints {
            first_line,
            last_line,
        } => {
            // `line_to_char` gives the offset of a line's first character; the line count itself is valid.
            let start = document.text.line_to_char(first_line);
            let end = document.text.line_to_char(last_line);
            let Some(range) = to_lsp_range(&document.text, start, end, encoding) else {
                return Sent::Skipped;
            };
            match client.text_document_range_inlay_hints(identifier, range, None) {
                Some(request) => Some(erase(async move { return Payload::Hints(request.await) })),
                None => None,
            }
        }
        Ask::Pull => {
            let previous = worker
                .session
                .diagnostics
                .previous_result_id(&record.identity);
            match client.text_document_diagnostic(identifier, previous) {
                Some(request) => Some(erase(async move { return Payload::Pull(request.await) })),
                None => None,
            }
        }
    };
    let Some(future) = pending else {
        return Sent::Unsupported;
    };
    let ticket = Ticket {
        number,
        ask,
        position,
        stamp: document.stamp,
        // `clone` on a rope copies a small handle; the ticket keeps this revision's text alive.
        text: document.text.clone(),
        path: document.path.clone(),
        encoding,
        server: record.identity.clone(),
        attempt,
    };
    // What: `Box::pin(async move { ... })` builds a heap-stored future that owns the ticket and
    //       resolves to the answer; `push` adds it to the set the worker loop awaits.
    // Why: The loop keeps answering server requests while this answer is pending, and it sees
    //      the answer before any notification the server sent after it. No helper task and no
    //      worker state are involved until the loop takes the finished answer.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // worker.requests.add(pending.then(payload => ({ ticket, payload })));
    // ```
    worker.requests.push(Box::pin(async move {
        let payload = future.await;
        return Answer { ticket, payload };
    }));
    return Sent::Spawned;
}

/// What: Route one position request to every server that serves the displayed document.
/// Why: States that exist before any wire traffic are replied at once: no server, still
///      starting, out of sync, unsupported. Each asked server answers on its own later.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function position(worker: Worker, number: number, request: PositionRequest): Promise<void>
/// ```
pub(super) async fn position(worker: &mut Worker, number: u64, request: PositionRequest) {
    if worker.session.stamp() != Some(request.stamp) {
        tracing::debug!(
            ?request,
            "dropped a request for text that is no longer displayed"
        );
        return;
    }
    if attach::revive(worker).await {
        tracing::info!("started exited language servers again for an explicit request");
    }
    let in_bounds = worker
        .session
        .document
        .as_ref()
        .is_some_and(|document| return request.position <= document.text.len_chars());
    // `Vec::new()` creates an empty growable list for the replies that need no wire traffic.
    let mut immediate: Vec<(Option<ServerIdentity>, RequestOutcome)> = Vec::new();
    let mut spawned = 0;
    if !in_bounds {
        let failure =
            RequestFailure::Other("the position is outside the displayed text".to_string());
        immediate.push((None, RequestOutcome::Failed(failure)));
    } else {
        for index in 0..worker.session.servers.len() {
            if !worker.session.servers[index].attached {
                continue;
            }
            let server = Some(worker.session.servers[index].identity.clone());
            let sent = dispatch(
                worker,
                index,
                number,
                Ask::Position(request.kind),
                request.position,
                0,
            );
            match sent {
                Sent::Spawned => spawned += 1,
                Sent::Starting => immediate.push((server, RequestOutcome::Starting)),
                Sent::Unsynchronized => immediate.push((server, RequestOutcome::Unsynchronized)),
                Sent::Unsupported => immediate.push((server, RequestOutcome::Unsupported)),
                Sent::Skipped => {}
            }
        }
        if spawned == 0 && immediate.is_empty() {
            immediate.push((None, RequestOutcome::NoServer));
        }
    }
    if spawned > 0 {
        worker.session.pending.push((number, spawned));
    }
    for (server, outcome) in immediate {
        worker.outputs.reply(LanguageReply {
            request: number,
            stamp: request.stamp,
            server,
            kind: request.kind,
            position: request.position,
            remaining: spawned,
            outcome,
        });
    }
    return;
}

/// Ask one server for diagnostics of the displayed document, if it offers pull diagnostics.
pub(super) fn pull_diagnostics(worker: &mut Worker, index: usize, attempt: u32) {
    // The outcome needs no reply: an unsupported or unready server simply contributes nothing.
    let _sent = dispatch(worker, index, 0, Ask::Pull, 0, attempt);
}

/// Ask one server for hints of the last reported window, if any window was reported.
pub(super) fn hints(worker: &mut Worker, index: usize, attempt: u32) {
    let Some(document) = worker.session.document.as_ref() else {
        return;
    };
    let Some(window) = document.window else {
        return;
    };
    let (first_line, last_line) = request_lines(window, document.text.len_lines());
    let ask = Ask::Hints {
        first_line,
        last_line,
    };
    let _sent = dispatch(worker, index, 0, ask, 0, attempt);
}

/// What: The interface reported the visible lines: remember them and ask every server for hints.
/// Why: The window is kept so hints can be asked for again after a reload and after a late start.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function window(worker: Worker, stamp: DocumentStamp, window: HintWindow): void
/// ```
pub(super) fn window(worker: &mut Worker, stamp: DocumentStamp, window: HintWindow) {
    let Some(document) = worker.session.document.as_mut() else {
        return;
    };
    if document.stamp != stamp {
        tracing::debug!(
            ?stamp,
            "dropped a hint window for text that is no longer displayed"
        );
        return;
    }
    document.window = Some(window);
    for index in 0..worker.session.servers.len() {
        if worker.session.servers[index].attached {
            hints(worker, index, 0);
        }
    }
}

/// What: Send a superseded request again, if its text is still displayed and its server still runs.
/// Why: A server answers `-32801` or `-32800` when its own state moved under the request; the
///      same question is then valid a moment later.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function retry(worker: Worker, ticket: Ticket): void
/// ```
pub(super) fn retry(worker: &mut Worker, ticket: Ticket) {
    let current = worker.session.stamp() == Some(ticket.stamp);
    let record = worker.session.index_of_identity(&ticket.server);
    let sent = match (current, record) {
        (true, Some(index)) => dispatch(
            worker,
            index,
            ticket.number,
            ticket.ask,
            ticket.position,
            ticket.attempt,
        ),
        _ => Sent::Skipped,
    };
    if matches!(sent, Sent::Spawned) {
        return;
    }
    // Only a position request has someone waiting for a reply.
    if let Ask::Position(kind) = ticket.ask {
        let remaining = worker.session.answered(ticket.number);
        worker.outputs.reply(LanguageReply {
            request: ticket.number,
            stamp: ticket.stamp,
            server: Some(ticket.server),
            kind,
            position: ticket.position,
            remaining,
            outcome: RequestOutcome::Superseded,
        });
    }
}

/// What: Merge the stored hints of every server into the latest-value snapshot, or nothing when
///       no server has answered for the displayed text.
/// Why: The interface draws one ordered list regardless of how many servers contributed.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function hintsSnapshot(session: Session): HintsSnapshot | undefined
/// ```
pub(super) fn hints_snapshot(session: &Session) -> Option<HintsSnapshot> {
    // The trailing `?` returns `None` when no document is displayed.
    let document = session.document.as_ref()?;
    if session.hints.is_empty() {
        return None;
    }
    let mut merged: Vec<InlayHint> = Vec::new();
    for (_, hints) in &session.hints {
        // `extend` appends copies of one server's hints.
        merged.extend(hints.iter().cloned());
    }
    // `sort_by_key` orders by the value the closure extracts; equal positions keep server order.
    merged.sort_by_key(|hint| return hint.position);
    return Some(HintsSnapshot {
        stamp: document.stamp,
        first_line: session.hint_lines.0,
        last_line: session.hint_lines.1,
        hints: merged,
    });
}
