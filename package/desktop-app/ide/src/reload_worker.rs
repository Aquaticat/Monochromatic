//! One bounded source-read/diff job at a time, outside the native event loop.

/// What: Channels transfer owned messages between threads; capacity one bounds queued work.
/// Why: UI input remains independent of filesystem reads and Helix diff computation.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const worker = new Worker('source-reader'); // messages are owned snapshots
/// ```
use std::{path::{Path, PathBuf}, sync::mpsc::{sync_channel, Receiver, SyncSender, TryRecvError}, thread::{self, JoinHandle}};
/// Preserve worker-start, request, and unexpected-disconnect diagnostics.
use anyhow::{bail, Context, Result};
/// Snapshots share immutable rope chunks; replies carry only prepared changes.
use crate::{document::{Document, Reload}, file_reload::read_reload, source_style::SourceStyles, syntax::SyntaxEngine};
/// Classification reads the same immutable rope snapshot as correspondence.
use helix_core::Rope;

/// A file generation prevents applying an old file's result after navigation.
pub struct ReloadRequest {
    /// Source target supplied by the UI, never inferred from a background result.
    pub path: PathBuf,
    /// Displayed base revision used by correspondence.
    pub snapshot: Document,
    /// Monotonic file-open identity, separate from each document's revision.
    pub generation: u64,
    /// Request initial/retried classification even without a text change; changed source always classifies.
    pub highlight_unchanged: bool,
}

/// Classifications identify the exact source revision they describe.
pub struct SyntaxReply {
    /// Expected revision after accepting the associated reload, or the unchanged revision.
    pub revision: u64,
    /// None means unrecognized plain text; missing parser assets remain an error.
    pub result: Result<Option<SourceStyles>>,
}

/// A successful read can report unchanged text without creating a revision.
pub struct ReloadReply {
    /// File-open generation that requested this work.
    pub generation: u64,
    /// Prepared change or unchanged result; failure leaves displayed source intact.
    pub result: Result<Option<Reload>>,
    /// Present for changed source and explicitly requested unchanged-source classification.
    pub syntax: Option<SyntaxReply>,
}

/// UI-owned worker handle with at most one requested or unread reply.
pub struct ReloadWorker {
    /// Option permits closing the request channel before joining during Drop.
    requests: Option<SyncSender<ReloadRequest>>,
    /// The UI polls this receiver without blocking.
    replies: Receiver<ReloadReply>,
    /// Includes both executing work and an unread response.
    busy: bool,
    /// Joined on shutdown after the request channel closes.
    thread: Option<JoinHandle<()>>,
}

/// Prepare classifications without making a syntax failure discard readable disk text.
fn classify(engine: &Result<SyntaxEngine>, path: &Path, text: &Rope, revision: u64) -> SyntaxReply {
    let result = match engine {
        Ok(active) => active.highlight(path, text),
        Err(error) => Err(anyhow::anyhow!("Cannot initialize highlighting for {}: {error:#}", path.display())),
    };
    return SyntaxReply { revision, result };
}

/// Own the blocking receive loop entirely outside UI state.
fn run(requests: Receiver<ReloadRequest>, replies: SyncSender<ReloadReply>) {
    let syntax = SyntaxEngine::new();
    loop {
        // What: match extracts either an owned job or the expected closed-channel condition.
        // Why: Shutdown must end the worker without an unhandled channel error.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const request = await receive(); if (closed) return;
        // ```
        let request = match requests.recv() {
            Ok(request) => request,
            Err(error) => {
                tracing::debug!(%error, "source reload worker request channel closed");
                return;
            }
        };
        let result = read_reload(&request.snapshot, &request.path);
        let classified = match &result {
            Ok(Some(reload)) => Some(classify(&syntax, &request.path, reload.text(), request.snapshot.revision() + 1)),
            Ok(None) if request.highlight_unchanged => Some(classify(&syntax, &request.path, request.snapshot.text(), request.snapshot.revision())),
            // Read failures retain their original result; unchanged accepted syntax needs no repeat parse.
            _ => None,
        };
        let reply = ReloadReply { generation: request.generation, result, syntax: classified };
        if let Err(error) = replies.send(reply) {
            tracing::debug!(%error, "source reload worker reply receiver closed");
            return;
        }
    }
}

impl ReloadWorker {
    /// Start a named worker with bounded request and response channels.
    pub fn new() -> Result<Self> {
        // What: sync_channel(1) creates sender/receiver endpoints with one message slot.
        // Why: Rapid UI callbacks cannot accumulate copies of document snapshots.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const requests = boundedChannel(1); const replies = boundedChannel(1);
        // ```
        let (request_sender, request_receiver) = sync_channel(1);
        let (reply_sender, reply_receiver) = sync_channel(1);
        // What: move transfers the receiving and sending endpoints into a named OS thread.
        // Why: No Rc/RefCell UI state or Slint handle crosses threads.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const worker = startWorker(() => run(requestReceiver, replySender));
        // ```
        let worker = thread::Builder::new().name("ide-source-reload".to_string())
            .spawn(move || { run(request_receiver, reply_sender); })
            .context("Cannot start the source reload worker")?;
        return Ok(Self { requests: Some(request_sender), replies: reply_receiver, busy: false, thread: Some(worker) });
    }

    /// Return false while a job or unread response already occupies the worker.
    pub fn request(&mut self, request: ReloadRequest) -> Result<bool> {
        if self.busy { return Ok(false); }
        let sender = self.requests.as_ref().context("Source reload worker is closed")?;
        sender.try_send(request)
            .context("Cannot send a source reload request")?;
        self.busy = true;
        return Ok(true);
    }

    /// Poll without blocking the native event loop; None means no reply yet.
    pub fn try_take(&mut self) -> Result<Option<ReloadReply>> {
        match self.replies.try_recv() {
            Ok(reply) => {
                self.busy = false;
                return Ok(Some(reply));
            }
            Err(TryRecvError::Empty) => { return Ok(None); }
            Err(TryRecvError::Disconnected) => {
                bail!("Source reload worker stopped unexpectedly; reopen the file or restart the application");
            }
        }
    }
}

/// Close input before joining, allowing the last bounded reply to complete.
impl Drop for ReloadWorker {
    /// End the owned thread without leaving a blocked reply sender behind.
    fn drop(&mut self) {
        // Taking the sender drops its owned endpoint at the end of this statement.
        self.requests.take();
        let Some(worker) = self.thread.take() else { return; };
        if let Err(error) = worker.join() {
            tracing::error!(?error, "source reload worker panicked during shutdown");
        }
    }
}
