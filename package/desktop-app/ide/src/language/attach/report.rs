//! Records of a server process that ended unexpectedly or did not finish starting, with the last
//! lines it wrote to standard error (`src/logging/stderr_tail.rs`). The lines go into the log only;
//! no user-facing note shows them.

/// The kept standard-error lines of each server.
use crate::logging::stderr_tail;
/// What: `Duration` is a time span; `Instant` is a point on the runtime's clock.
/// Why: The record of an ended server waits a bounded time for the end of its standard error.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const until = performance.now() + 1000;
/// ```
use tokio::time::{Duration, Instant};

/// Longest wait, after a server process ended, for the end of its standard error, so that the
/// lines it wrote just before it ended are in the record. helix-lsp reads standard output and
/// standard error in separate tasks, so the worker can learn of the end before the last lines
/// arrive; the process is gone, so the end of the stream follows at once unless the machine is
/// very busy or another process still holds the stream open.
pub const SETTLE: Duration = Duration::from_secs(1);

/// Pause between two looks at the stream while the record waits.
const SETTLE_POLL: Duration = Duration::from_millis(10);

/// What: The record of one ended server process, written when this value is dropped. `Drop` is the
///       code Rust runs when a value goes away.
/// Why: The value is dropped when the wait is over, and also when the worker's runtime stops
///      during the wait and discards the waiting task, so the record is written either way.
struct EndRecord {
    /// The server's configured name.
    server: String,
    /// Whether the server had finished starting.
    was_ready: bool,
}

/// Writing the record.
impl Drop for EndRecord {
    /// What: Write the warning with the lines kept by now, if any.
    /// Why: A server that wrote nothing gets the same record without the `stderr_tail` field.
    fn drop(&mut self) {
        let lines = stderr_tail::take(&self.server);
        if lines.is_empty() {
            tracing::warn!(server = %self.server, was_ready = self.was_ready, "language server process ended");
        } else {
            tracing::warn!(server = %self.server, was_ready = self.was_ready, stderr_tail = ?lines, "language server process ended");
        }
    }
}

/// What: Log that a server process ended without being asked to, with its last standard-error
///       lines, once its standard error ended or `SETTLE` passed. `tokio::spawn` runs the wait as
///       its own task, so the worker goes on at once.
/// Why: Session state changes at once; only this record waits for the lines.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function endedUnexpectedly(server: string, wasReady: boolean): void {
///   void (async () => { while (!closed(server) && now() < until) await sleep(10); warn(...); })();
/// }
/// ```
pub(super) fn ended_unexpectedly(server: String, was_ready: bool) {
    let record = EndRecord { server, was_ready };
    tokio::spawn(async move {
        let started = Instant::now();
        let mut looks: u32 = 0;
        while !stderr_tail::is_closed(&record.server) && started.elapsed() < SETTLE {
            tokio::time::sleep(SETTLE_POLL).await;
            looks += 1;
        }
        if looks > 0 {
            let closed = stderr_tail::is_closed(&record.server);
            tracing::debug!(server = %record.server, waited_ms = started.elapsed().as_millis(), closed, "waited for the end of a server's standard error");
        }
        drop(record);
    });
}

/// What: Log that a starting server did not answer `initialize` in time and is stopped, with the
///       lines it wrote to standard error so far.
/// Why: A server that hangs in its start often says why there.
pub(super) fn start_timed_out(server: &str, seconds: u64) {
    let lines = stderr_tail::take(server);
    if lines.is_empty() {
        tracing::error!(server = %server, seconds, "language server did not answer initialize in time and is stopped");
    } else {
        tracing::error!(server = %server, seconds, stderr_tail = ?lines, "language server did not answer initialize in time and is stopped");
    }
}

/// Waiting for the last lines, the record when the runtime stops, and the field's absence.
#[cfg(test)]
#[path = "report_tests.rs"]
mod tests;
