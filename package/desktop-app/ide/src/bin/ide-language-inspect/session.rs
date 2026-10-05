//! One inspection session: the worker handle, the document as the application holds it, and
//! the polling loop every step waits in.

/// Plan steps.
use crate::Step;
/// Rendering of observations.
use crate::render;
/// Failures name the operation that failed.
use anyhow::{Context, Result, bail};
/// The application's own document and reload path.
use ide_app::document::Document;
/// The handle and the types it exchanges.
use ide_app::language::{
    LanguageWorker,
    config::LanguageSetup,
    diagnostics::DiagnosticsSnapshot,
    hints::{HintWindow, HintsSnapshot},
    identity::DocumentStamp,
    reply::{LanguageReply, PositionRequest, RequestKind, RequestOutcome},
    status::{LanguageStatus, ServerState},
    sync::{DocumentOpen, DocumentReload},
};
/// JSON values and the literal-building macro.
use serde_json::{Value, json};
/// What: `Path`/`PathBuf` are borrowed and owned filesystem paths; `Arc` is a thread-safe shared
///       pointer; `Duration` and `Instant` measure time.
/// Why: Every wait is bounded, so a missing answer ends the step instead of hanging it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const deadline = Date.now() + seconds * 1000;
/// ```
use std::{
    path::{Path, PathBuf},
    sync::Arc,
    time::{Duration, Instant},
};

/// Pause between polls, as the application's timer polls its workers.
const POLL: Duration = Duration::from_millis(20);

/// Pause before a position request is repeated while a server warms up.
const REPEAT: Duration = Duration::from_millis(500);

/// Everything one session holds.
pub struct Session {
    /// The handle under inspection.
    worker: LanguageWorker,
    /// Resolved project root.
    project: PathBuf,
    /// Path of the displayed file.
    path: PathBuf,
    /// The displayed document.
    document: Document,
    /// File-open generation. `u64` is an unsigned 64-bit counter.
    file: u64,
    /// Latest status seen.
    status: Arc<LanguageStatus>,
    /// Replies not yet consumed by a step.
    replies: Vec<LanguageReply>,
    /// Latest diagnostics seen.
    diagnostics: Option<Arc<DiagnosticsSnapshot>>,
    /// Latest hints seen.
    hints: Option<Arc<HintsSnapshot>>,
    /// When the session started, for timestamps.
    started: Instant,
}

/// Print one observation line with the milliseconds since the session started.
fn emit(started: Instant, mut record: Value) {
    record["ms"] = json!(started.elapsed().as_millis());
    println!("{record}");
}

/// Session steps.
impl Session {
    /// Start the worker for a project; no server starts until a file is opened.
    pub fn new(project: &Path, setup: LanguageSetup) -> Result<Self> {
        // The trailing `?` returns the start error to the caller.
        let worker = LanguageWorker::with_setup(project, setup)?;
        // `Ok(...)` is the success variant of `Result`.
        return Ok(Self {
            worker,
            project: project.to_path_buf(),
            path: PathBuf::new(),
            document: Document::new(""),
            file: 0,
            status: Arc::new(LanguageStatus::closed()),
            replies: Vec::new(),
            diagnostics: None,
            hints: None,
            started: Instant::now(),
        });
    }

    /// The stamp of the displayed text.
    fn stamp(&self) -> DocumentStamp {
        return DocumentStamp {
            file: self.file,
            revision: self.document.revision(),
        };
    }

    /// What: Take everything the worker published, printing each change. `&mut self` allows
    ///       storing what was taken.
    /// Why: This is the application's polling contract: nothing blocks, stale results never appear.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// poll() { for (const change of worker.takeAll()) { record(change); } }
    /// ```
    fn poll(&mut self) -> Result<()> {
        // `if let Some(x) = ...?` runs the block only when something new was published.
        if let Some(status) = self.worker.try_take_status()? {
            emit(self.started, json!({ "status": render::status(&status) }));
            self.status = status;
        }
        // `while let Some(x) = ...?` repeats until the reply queue is empty.
        while let Some(reply) = self.worker.try_take_reply()? {
            emit(self.started, json!({ "reply": render::reply(&reply) }));
            self.replies.push(reply);
        }
        if let Some(diagnostics) = self.worker.try_take_diagnostics()? {
            emit(
                self.started,
                json!({ "diagnostics": render::diagnostics(&diagnostics, self.document.text()) }),
            );
            // `Some(...)` is the "value present" variant of `Option`.
            self.diagnostics = Some(diagnostics);
        }
        if let Some(hints) = self.worker.try_take_hints()? {
            emit(
                self.started,
                json!({ "hints": render::hints(&hints, self.document.text()) }),
            );
            self.hints = Some(hints);
        }
        return Ok(());
    }

    /// What: Poll until `done` accepts the session or the time is up; returns whether it did.
    ///       `&dyn Fn(&Session) -> bool` borrows any function or closure with that signature.
    /// Why: Real servers answer after an unknown warm-up; every step states its own limit.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// until(seconds: number, done: (session: Session) => boolean): boolean
    /// ```
    fn until(&mut self, limit: Duration, done: &dyn Fn(&Session) -> bool) -> Result<bool> {
        let start = Instant::now();
        loop {
            self.poll()?;
            if done(self) {
                return Ok(true);
            }
            if start.elapsed() >= limit {
                return Ok(false);
            }
            std::thread::sleep(POLL);
        }
    }

    /// Send one position request; nothing is returned when the command queue is full.
    fn ask(&mut self, kind: RequestKind, at: usize) -> Result<Option<u64>> {
        let request = PositionRequest {
            stamp: self.stamp(),
            kind,
            position: at,
        };
        return self.worker.request(request);
    }

    /// Write new content to the displayed file and apply the reload as the application does.
    fn reload(&mut self, text: &str) -> Result<()> {
        std::fs::write(&self.path, text)
            .with_context(|| return format!("Cannot write {}", self.path.display()))?;
        let reload = self.document.prepare_reload(text);
        let command = DocumentReload::from_reload(self.file, &reload);
        if !self.document.apply_reload(reload) {
            bail!("the document refused its own reload");
        }
        if !self.worker.reload(command)? {
            bail!("the command queue was full");
        }
        return Ok(());
    }

    /// What: Repeat a position request until its outcome is the wanted kind or time is up.
    /// Why: A server that is still loading answers `null` or "content modified"; the record
    ///      keeps every attempt so the warm-up is visible.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// request(kind: string, at: number, until: string, seconds: number): object
    /// ```
    fn request(&mut self, kind: &str, at: usize, until: &str, seconds: u64) -> Result<Value> {
        let wanted = match kind {
            "definition" => RequestKind::Definition,
            "references" => RequestKind::References,
            "hover" => RequestKind::Hover,
            other => bail!("unknown request kind {other}"),
        };
        let start = Instant::now();
        let limit = Duration::from_secs(seconds);
        let mut attempts = 0;
        loop {
            attempts += 1;
            self.replies.clear();
            let Some(number) = self.ask(wanted, at)? else {
                bail!("the command queue was full");
            };
            // What: A closure capturing `number` by copy; `move` gives it its own copy.
            // Why: The wait ends when the last server answered this request.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const answered = (session: Session) => session.replies.some(r => r.request === number && r.remaining === 0);
            // ```
            let answered = move |session: &Session| {
                return session
                    .replies
                    .iter()
                    .any(|reply| return reply.request == number && reply.remaining == 0);
            };
            let complete = self.until(limit.saturating_sub(start.elapsed()), &answered)?;
            let matched = self.replies.iter().any(|reply| {
                // `matches!` is true when the pair fits one of the listed patterns.
                return matches!(
                    (&reply.outcome, until),
                    (RequestOutcome::Hover(_), "hover")
                        | (RequestOutcome::Locations(_), "locations")
                        | (RequestOutcome::Empty, "empty")
                        | (_, "")
                );
            });
            if matched || start.elapsed() >= limit {
                return Ok(
                    json!({ "attempts": attempts, "complete": complete, "matched": matched }),
                );
            }
            std::thread::sleep(REPEAT);
        }
    }

    /// What: Run one plan step and print its result.
    /// Why: A step that does not reach its goal is recorded as such; only a broken session is an error.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// run(number: number, step: Step): void
    /// ```
    pub fn run(&mut self, number: usize, step: &Step) -> Result<()> {
        let result = match step {
            Step::Open { file } => {
                let path = self.project.join(file);
                let text = std::fs::read_to_string(&path)
                    .with_context(|| return format!("Cannot read {}", path.display()))?;
                self.file += 1;
                self.document = Document::new(&text);
                self.path = path.clone();
                self.replies.clear();
                self.diagnostics = None;
                self.hints = None;
                let sent = self.worker.open(DocumentOpen {
                    path,
                    // `clone` on a rope copies a small handle.
                    text: self.document.text().clone(),
                    stamp: self.stamp(),
                })?;
                json!({ "sent": sent })
            }
            Step::Ready { seconds } => {
                let ready = |session: &Session| {
                    return session
                        .status
                        .servers
                        .iter()
                        .any(|row| return row.state == ServerState::Ready);
                };
                json!({ "ready": self.until(Duration::from_secs(*seconds), &ready)? })
            }
            Step::Request {
                kind,
                at,
                until,
                seconds,
            } => self.request(kind, *at, until, *seconds)?,
            Step::Hints {
                first,
                visible,
                minimum,
                seconds,
            } => {
                let window = HintWindow {
                    first_line: *first,
                    visible_lines: *visible,
                };
                let sent = self.worker.request_hints(self.stamp(), window)?;
                let least = *minimum;
                let stamp = self.stamp();
                // Hints are latest-value state: an unchanged snapshot is not published again, so the
                // one already held counts when it describes the displayed revision.
                let enough = move |session: &Session| {
                    return session.hints.as_ref().is_some_and(|hints| {
                        return hints.stamp == stamp && hints.hints.len() >= least;
                    });
                };
                json!({ "sent": sent, "enough": self.until(Duration::from_secs(*seconds), &enough)? })
            }
            Step::Diagnostics {
                minimum,
                maximum,
                seconds,
            } => {
                let (least, most) = (*minimum, *maximum);
                let stamp = self.stamp();
                let within = move |session: &Session| {
                    return session.diagnostics.as_ref().is_some_and(|found| {
                        let count: usize = found
                            .groups
                            .iter()
                            .map(|group| return group.items.len())
                            .sum();
                        return found.stamp == stamp && count >= least && count <= most;
                    });
                };
                json!({ "within": self.until(Duration::from_secs(*seconds), &within)? })
            }
            Step::Reload { text } => {
                self.reload(text)?;
                json!({ "revision": self.document.revision() })
            }
            Step::Stale { at, text, settle } => {
                let before = self.worker.fence_counts();
                self.replies.clear();
                let overtaken = self.ask(RequestKind::Hover, *at)?;
                self.reload(text)?;
                let never = |_: &Session| return false;
                self.until(Duration::from_millis(*settle), &never)?;
                let after = self.worker.fence_counts();
                let delivered = self
                    .replies
                    .iter()
                    .any(|reply| return Some(reply.request) == overtaken);
                json!({
                    "request": overtaken,
                    "delivered": delivered,
                    "droppedStaleRevision": after.stale_revision - before.stale_revision,
                })
            }
            Step::Sleep { milliseconds } => {
                let never = |_: &Session| return false;
                self.until(Duration::from_millis(*milliseconds), &never)?;
                json!({})
            }
            Step::Close => json!({ "sent": self.worker.close()? }),
        };
        emit(
            self.started,
            json!({ "step": number, "do": format!("{step:?}").split_whitespace().next(), "result": result }),
        );
        return Ok(());
    }

    /// Print the final counters; dropping the session then stops every server.
    pub fn finish(self) {
        let counts = self.worker.fence_counts();
        emit(
            self.started,
            json!({ "done": true, "fence": format!("{counts:?}") }),
        );
    }
}
