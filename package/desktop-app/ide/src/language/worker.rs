//! The Language worker: one named thread that owns a single-thread async runtime, helix-lsp's
//! registry, and the session. The interface thread only exchanges owned messages with it.
//!
//! Language servers are spawned from this thread and nowhere else. It lives as long as the
//! handle, which matters for a confining launcher that ends its server when the spawning thread
//! ends (`doc/planning/slint-ide-write-confinement.md`).

/// The registry is assembled in code on this thread, never from project or user configuration.
use super::config::{LanguageSetup, Languages};
/// The steps a command or event is dispatched to, and the wait that ends the thread.
use super::{attach, lifecycle, reap, request, session::Session, traffic};
/// Latest-value results the worker publishes.
use super::{diagnostics::DiagnosticsSnapshot, hints::HintsSnapshot, status::LanguageStatus};
/// Commands and one-shot replies.
use super::{
    hints::HintWindow,
    identity::DocumentStamp,
    reply::{LanguageReply, PositionRequest},
    sync::{DocumentOpen, DocumentReload},
};
/// Start failures name the operation that failed.
use anyhow::{Context, Result};
/// What: `StreamExt` adds `.next()` to streams, which are sequences of values that arrive over
///       time; `FuturesUnordered` is a set of pending futures (promises) that is itself a stream
///       of their results, in completion order.
/// Why: `Registry::incoming` is a stream of server-to-client messages, and the loop awaits its
///      own pending requests the same way instead of handing them to helper tasks.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// for await (const [server, call] of registry.incoming) { }
/// ```
use futures_util::{StreamExt, stream::FuturesUnordered};
/// helix-lsp's server table and its key type.
use helix_lsp::{LanguageServerId, Registry};
/// What: `PathBuf` is an owned filesystem path; `Arc` is a thread-safe shared pointer;
///       `JoinHandle` lets the owner wait for the thread to end; `Duration` is a time span.
/// Why: Published values are shared, immutable, and cheap to hand to the interface thread.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const worker = new Worker('language');
/// ```
use std::{
    path::PathBuf,
    sync::Arc,
    thread::{self, JoinHandle},
    time::Duration,
};
/// What: `mpsc` is a multi-producer queue with an awaitable receiver; `watch` is a single-slot
///       latest-value cell. Both are channels: they move owned messages between threads.
/// Why: Commands and replies are queued and bounded; status, diagnostics, and hints replace
///      themselves, so only the latest value is kept. This follows `search_worker.rs`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const commands = boundedQueue<Command>(64); const status = latestValue<LanguageStatus>();
/// ```
use tokio::sync::{mpsc, watch};

/// Longest wait for servers to exit after `shutdown` and `exit` were sent, as Helix allows on quit.
const SHUTDOWN_GRACE: Duration = Duration::from_secs(1);

/// Longest wait, after every remaining server was killed, until the kernel has ended and the
/// thread has reaped them. The wait ends as soon as none is left, which is at once when every
/// server ended by itself. Measured with sixteen sessions sharing two processors: a killed
/// server took up to 1.5 s to be gone, and the fixed 50 ms pause this replaces was too short in
/// 81 of 1200 shutdowns.
const REAP_GRACE: Duration = Duration::from_secs(2);

/// What: Everything the interface thread can ask for. An `enum` with data is a tagged union.
/// Why: One queue of owned messages is the only thing that crosses the thread boundary inward.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Command = { type: 'open'; open: DocumentOpen } | { type: 'reload'; reload: DocumentReload }
///              | { type: 'close' } | { type: 'request'; number: number; request: PositionRequest }
///              | { type: 'hints'; stamp: DocumentStamp; window: HintWindow };
/// ```
pub(super) enum Command {
    /// A file was displayed.
    Open(
        /// Path, text, and stamp of the displayed file.
        DocumentOpen,
    ),
    /// The displayed file was reloaded from disk.
    Reload(
        /// Both texts and the edits between them.
        DocumentReload,
    ),
    /// No file is displayed any more.
    Close,
    /// One position request with the number its replies will carry.
    Request {
        /// Number assigned by the handle.
        number: u64,
        /// What is asked.
        request: PositionRequest,
    },
    /// The visible lines changed; hints are wanted for them.
    Hints {
        /// The text the lines belong to.
        stamp: DocumentStamp,
        /// The visible lines.
        window: HintWindow,
    },
}

/// What: Events the worker sends to itself from timer tasks.
/// Why: A task that waits for a timer never touches worker state; it hands the event back to
///      the loop, so all state changes happen in one place.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Internal = { type: 'startDeadline'; server: ServerId }
///               | { type: 'holdExpired'; serial: number } | { type: 'retry'; ticket: Ticket };
/// ```
pub(super) enum Internal {
    /// A starting server's time to answer `initialize` ran out.
    StartDeadline(
        /// helix-lsp key of the server that was starting.
        LanguageServerId,
    ),
    /// The fixed delay of a diagnostics hold passed.
    HoldExpired(
        /// Number of the reload that opened the hold.
        u64,
    ),
    /// A superseded request should be sent again. `Box` stores the large value on the heap so
    /// every variant stays small.
    Retry(
        /// The request to send again, with its attempt count already raised.
        Box<request::Ticket>,
    ),
}

/// The sending ends of every channel the interface thread polls.
pub(super) struct Outputs {
    /// One-shot replies to position requests.
    pub(super) replies: mpsc::Sender<LanguageReply>,
    /// Latest status.
    pub(super) status: watch::Sender<Arc<LanguageStatus>>,
    /// Latest diagnostics; nothing while no file is displayed.
    pub(super) diagnostics: watch::Sender<Option<Arc<DiagnosticsSnapshot>>>,
    /// Latest hints; nothing until a server answered for the displayed text.
    pub(super) hints: watch::Sender<Option<Arc<HintsSnapshot>>>,
}

/// Publishing.
impl Outputs {
    /// What: Queue one reply without waiting. `try_send` returns `Err` when the queue is full or
    ///       the handle is gone.
    /// Why: The worker must never block on an interface thread that stopped polling.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// reply(reply: LanguageReply) { if (!queue.offer(reply)) log.warn('dropped'); }
    /// ```
    pub(super) fn reply(&self, reply: LanguageReply) {
        if let Err(error) = self.replies.try_send(reply) {
            tracing::warn!(%error, "dropped a language reply because the reply queue is full or closed");
        }
    }
}

/// All state of the worker thread.
pub(super) struct Worker {
    /// The displayed document and every known server.
    pub(super) session: Session,
    /// helix-lsp's server table and the merged stream of server-to-client messages.
    pub(super) registry: Registry,
    /// Language definitions and the launch seam's results.
    pub(super) languages: Languages,
    /// Resolved project root.
    pub(super) root: PathBuf,
    /// Channels to the interface thread.
    pub(super) outputs: Outputs,
    /// Sender for events the worker's timer tasks hand back to the loop.
    pub(super) internal: mpsc::UnboundedSender<Internal>,
    /// Requests sent to servers and not yet answered; the loop awaits them itself.
    pub(super) requests: FuturesUnordered<request::AnswerFuture>,
}

/// Dispatch and publishing.
impl Worker {
    /// What: Publish status, diagnostics, and hints, each only when its value changed.
    ///       `&self` borrows the worker read-only.
    /// Why: Latest-value slots wake the interface only for real changes; hundreds of progress
    ///      notifications collapse into the few that alter what is shown.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// publish() { status.setIfChanged(session.status()); diagnostics.setIfChanged(...); hints.setIfChanged(...); }
    /// ```
    pub(super) fn publish(&self) {
        let status = self.session.status();
        // What: `send_if_modified` runs the closure on the stored value; returning true marks it
        //       changed. `**current` reads through the borrow and the shared pointer.
        // Why: An equal status must not look like news to the interface thread.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (!deepEqual(slot.value, status)) slot.value = status;
        // ```
        self.outputs.status.send_if_modified(|current| {
            if **current == status {
                return false;
            }
            *current = Arc::new(status);
            return true;
        });
        // `as_ref()` borrows the document inside the `Option`; `and_then` continues with it when present.
        let diagnostics = self
            .session
            .document
            .as_ref()
            .and_then(|document| return self.session.diagnostics.snapshot(&document.text));
        self.outputs.diagnostics.send_if_modified(|current| {
            // `as_deref()` compares the stored snapshot by value instead of by pointer.
            if current.as_deref() == diagnostics.as_ref() {
                return false;
            }
            *current = diagnostics.map(Arc::new);
            return true;
        });
        let hints = request::hints_snapshot(&self.session);
        self.outputs.hints.send_if_modified(|current| {
            if current.as_deref() == hints.as_ref() {
                return false;
            }
            *current = hints.map(Arc::new);
            return true;
        });
    }

    /// What: Deliver `event` to the loop after `delay`. `tokio::spawn` starts an independent task
    ///       on this thread's runtime; `async move` moves the captured values into it.
    /// Why: Start deadlines, hold expiry, and retries are timers that must not block the loop.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// timer(delay: number, event: Internal) { setTimeout(() => internal.push(event), delay); }
    /// ```
    pub(super) fn timer(&self, delay: Duration, event: Internal) {
        // `clone` copies the sender so the task owns its own handle to the queue.
        let internal = self.internal.clone();
        tokio::spawn(async move {
            tokio::time::sleep(delay).await;
            // The loop is gone when the handle was dropped; the event is then irrelevant.
            if let Err(error) = internal.send(event) {
                tracing::debug!(%error, "language worker stopped before a timer fired");
            }
        });
    }

    /// Run one command from the interface thread.
    async fn handle(&mut self, command: Command) {
        match command {
            Command::Open(open) => lifecycle::open(self, open).await,
            Command::Reload(reload) => lifecycle::reload(self, reload),
            Command::Close => lifecycle::close(self),
            Command::Request { number, request } => {
                request::position(self, number, request).await;
            }
            Command::Hints { stamp, window } => request::window(self, stamp, window),
        }
        self.publish();
    }

    /// Run one event a timer task handed back.
    fn on_internal(&mut self, event: Internal) {
        match event {
            Internal::StartDeadline(server) => attach::start_deadline(self, server),
            Internal::HoldExpired(serial) => {
                if self.session.diagnostics.hold_expired(serial) {
                    tracing::debug!(serial, "diagnostics hold ended after its fixed delay");
                }
            }
            // `*ticket` moves the value out of its heap box.
            Internal::Retry(ticket) => request::retry(self, *ticket),
        }
        self.publish();
    }

    /// What: Stop every server: send `shutdown` and `exit` without waiting for answers, wait up
    ///       to `SHUTDOWN_GRACE` for the processes to end, then drop the registry, which kills
    ///       the servers it still held. `mut self` takes the worker by value, so it is gone
    ///       afterwards.
    /// Why: Waiting for the synthetic `exit` of each server lets well-behaved servers end by
    ///      themselves; a slow or stuck server cannot hold the window open. Reaping what was
    ///      killed is the thread's last step, after this runtime is gone (`reap.rs`).
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// async shutdown() { for (const client of clients) client.forceShutdown(); await exitsOrTimeout(1000); dropEverything(); }
    /// ```
    async fn shutdown(mut self) {
        // `iter_clients()` lends every client; `cloned().collect()` copies the shared pointers into a list.
        let clients: Vec<_> = self.registry.iter_clients().cloned().collect();
        let mut running = clients.len();
        for client in &clients {
            self.registry.file_event_handler.remove_client(client.id());
            client.force_shutdown();
        }
        // The local clones must go, or a finished process would stay unreaped behind them.
        drop(clients);
        let deadline = tokio::time::Instant::now() + SHUTDOWN_GRACE;
        while running > 0 {
            // What: `timeout_at` resolves to `Err` when the deadline passes first; the inner `Option`
            //       is `None` when no server stream is left.
            // Why: Each ended process announces itself with a synthetic `exit` notification.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const next = await Promise.race([incoming.next(), sleepUntil(deadline)]);
            // ```
            let next = tokio::time::timeout_at(deadline, self.registry.incoming.next()).await;
            let Ok(Some((server, call))) = next else {
                break;
            };
            if traffic::is_exit(&call) {
                self.registry.remove_by_id(server);
                running -= 1;
            }
        }
        tracing::debug!(
            still_running = running,
            "language servers were asked to stop"
        );
        // Dropping the session and the registry releases every client; helix-lsp kills on drop.
        drop(self.session);
        drop(self.registry);
    }
}

/// What: The worker loop. `tokio::select!` is a macro that waits on several futures (promises)
///       at once and runs the block of whichever finishes first; a branch whose pattern does not
///       match is disabled for that round. `biased;` makes it check the branches in the order
///       they are written instead of a random order.
/// Why: Server-to-client traffic must be drained continuously, because an unanswered server
///      request stalls the server, while commands and timer events must not wait behind it.
///      Answers are checked before other server traffic on purpose: helix-lsp delivers an answer
///      before a notification the server sent after it, and the diagnostics hold relies on
///      seeing them in that order. With no pending request, or no server, the corresponding
///      stream yields `None` at once, which disables its branch. `search_process.rs` uses the
///      same macro.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// for (;;) {
///   const next = await firstReadyInOrder([answers.next(), internal.next(), commands.next(), registry.incoming.next()]);
///   if (next.source === 'commands' && next.done) break;
///   await worker.dispatch(next);
/// }
/// await worker.shutdown();
/// ```
async fn run(
    mut worker: Worker,
    mut commands: mpsc::Receiver<Command>,
    mut internal: mpsc::UnboundedReceiver<Internal>,
) {
    loop {
        tokio::select! {
            biased;
            Some(answer) = worker.requests.next() => {
                request::finish(&mut worker, answer);
                worker.publish();
            }
            Some(event) = internal.recv() => {
                worker.on_internal(event);
            }
            received = commands.recv() => {
                // A closed queue means the handle was dropped: stop every server and end.
                let Some(command) = received else {
                    break;
                };
                worker.handle(command).await;
            }
            Some((server, call)) = worker.registry.incoming.next() => {
                traffic::on_call(&mut worker, server, call).await;
                worker.publish();
            }
        }
    }
    worker.shutdown().await;
}

/// What: Start the worker thread. `Result<JoinHandle<()>>` is the thread handle or a start error.
/// Why: `Registry::new` and every server start spawn tasks, so they must run inside the runtime;
///      building the language registry takes a noticeable fraction of a second, so it happens on
///      this thread and not on the interface thread.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function spawn(root, setup, commands, outputs): Thread
/// ```
pub(super) fn spawn(
    root: PathBuf,
    setup: LanguageSetup,
    commands: mpsc::Receiver<Command>,
    outputs: Outputs,
) -> Result<JoinHandle<()>> {
    // What: A current-thread runtime drives every task on the thread that calls `block_on`;
    //       `enable_all` turns on the I/O driver (server pipes) and the timer (request timeouts).
    // Why: One thread is sufficient for helix-lsp (measured in the integration spike) and keeps
    //      all session state free of locks.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // the event loop of a dedicated worker thread
    // ```
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .context("Cannot initialize language server I/O")?;
    return thread::Builder::new()
        .name("ide-language".to_string())
        .spawn(move || {
            runtime.block_on(async move {
                let languages = match Languages::new(&root, setup) {
                    Ok(languages) => languages,
                    Err(error) => {
                        // Ending the thread closes every channel; the handle reports the module as stopped.
                        tracing::error!(
                            ?error,
                            "cannot build the language registry; language support is unavailable"
                        );
                        return;
                    }
                };
                // `clone` copies the shared pointer so helix-lsp and the worker read the same registry.
                let registry = Registry::new(languages.loader.clone());
                let (internal_sender, internal_receiver) = mpsc::unbounded_channel();
                let worker = Worker {
                    session: Session::new(),
                    registry,
                    languages,
                    root,
                    outputs,
                    internal: internal_sender,
                    requests: FuturesUnordered::new(),
                };
                run(worker, commands, internal_receiver).await;
            });
            // What: `drop` ends the runtime now: every task still on it is dropped, and with the
            //       tasks the last handles of server processes, which kills those processes.
            // Why: helix-lsp keeps a client alive inside the task that awaits `initialize`; only
            //      dropping the runtime releases it. Reaping must come after this, not before.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // eventLoop.close(); // cancels every pending task
            // ```
            drop(runtime);
            reap::finish(REAP_GRACE);
        })
        .context("Cannot start the language worker");
}
