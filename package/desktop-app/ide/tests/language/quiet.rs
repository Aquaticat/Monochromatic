//! Quiet lifetime: what a clean open, one request, close, and shutdown leave in the application
//! log and in the process table.
//!
//! The log is captured through the application's own pipeline (`ide_app::logging::install`): the
//! same subscriber and the same bridge that re-labels helix-lsp's `log` records. Only the writer is
//! replaced, and the level is set here, because these tests read records below the default.

use crate::support::{self, Probe, SERVER};
use ide_app::language::{
    reply::{RequestKind, RequestOutcome},
    status::{DocumentState, ServerState},
};
use ide_app::logging;
use std::{
    io::{self, Write},
    path::Path,
    sync::{Arc, Mutex},
};
use tracing_subscriber::{EnvFilter, fmt::MakeWriter};

/// A log writer that keeps every byte in memory, shared with the test that reads it.
#[derive(Clone, Default)]
struct Capture(Arc<Mutex<Vec<u8>>>);

impl Write for Capture {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.0.lock().expect("log buffer").extend_from_slice(bytes);
        return Ok(bytes.len());
    }

    fn flush(&mut self) -> io::Result<()> {
        return Ok(());
    }
}

impl<'writer> MakeWriter<'writer> for Capture {
    type Writer = Capture;

    fn make_writer(&'writer self) -> Self::Writer {
        return self.clone();
    }
}

impl Capture {
    fn text(&self) -> String {
        return String::from_utf8(self.0.lock().expect("log buffer").clone()).expect("log text");
    }
}

/// Install the application's log pipeline with every worker record and every helix-lsp record
/// visible, writing into a capture. Once per process, so each test runs in its own child.
fn capture_the_log() -> Capture {
    let capture = Capture::default();
    let filter = EnvFilter::builder()
        .parse_lossy(logging::directives("ide_app=debug,helix_lsp=debug", None));
    logging::install(filter, capture.clone(), Some(false)).expect("log pipeline");
    return capture;
}

/// The records of one level, whole lines. A record starts with its time, then its level.
fn records_at(text: &str, level: &str) -> Vec<String> {
    let mut found = Vec::new();
    for line in text.lines() {
        if line.split_whitespace().nth(1) == Some(level) {
            found.push(line.to_string());
        }
    }
    return found;
}

/// Assert that a record with this level and this ending is in the log.
fn assert_record(text: &str, level: &str, ending: &str) {
    assert!(
        records_at(text, level).iter().any(|line| return line.ends_with(ending)),
        "no {level} record ending with {ending:?} in the log:\n{text}"
    );
}

/// One clean lifetime in which the server produces all three record shapes helix-lsp logs at ERROR
/// for a healthy server: a line on standard error at shutdown, as TypeScript 7's server writes
/// `context canceled`; a `-32801` answer that the worker asks again for; and the end of standard
/// error when the process ends. Returns the whole log.
fn log_of_a_clean_lifetime(root: &Path) -> String {
    let capture = capture_the_log();
    let variables = [("STDERR", "context canceled"), ("HOVER", "modified-once")];
    let mut probe = Probe::new(root, support::scripted(root, &variables, 3));
    probe.open(&root.join("file.scripted"), "alpha\n");
    probe.until_ready();
    assert_eq!(support::children().len(), 1);
    let number = probe.request(RequestKind::Hover, 1);
    assert!(
        matches!(probe.answers(number)[0].outcome, RequestOutcome::Hover(_)),
        "the one request of the lifetime was not answered after the worker asked again"
    );
    probe.worker.close().expect("close");
    probe.until("the closed state", |seen| {
        return seen.status.document == DocumentState::Closed;
    });
    drop(probe);
    support::children_until_none();
    let received = support::received(&support::report(root));
    assert!(
        received.contains(&"shutdown".to_string()) && received.contains(&"exit".to_string()),
        "the server was not asked to shut down: {received:?}"
    );
    let text = capture.text();
    // Positive controls: the capture saw an application record and the shutdown itself.
    assert!(
        text.contains("language server is ready"),
        "the log capture saw no application record:\n{text}"
    );
    assert!(
        text.contains("language servers were asked to stop still_running=0"),
        "the server did not end by itself within the grace period:\n{text}"
    );
    return text;
}

/// A clean lifetime leaves no child process and no ERROR record, and each healthy-server record
/// is still in the log, whole, at the level that says what it is.
#[test]
fn clean_lifetime_logs_no_error_level_record() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "quiet::clean_lifetime_logs_no_error_level_record",
            support::standard,
        );
        return;
    };
    let text = log_of_a_clean_lifetime(&root);
    let errors = records_at(&text, "ERROR");
    assert!(
        errors.is_empty(),
        "a clean lifetime logged at ERROR: {errors:#?}"
    );
    assert_record(
        &text,
        "INFO",
        r#"helix_lsp::transport: scripted-ls err <- "context canceled\n""#,
    );
    assert_record(
        &text,
        "DEBUG",
        "helix_lsp::transport: scripted-ls <- ServerError(-32801): content modified",
    );
    assert_record(
        &text,
        "DEBUG",
        "helix_lsp::transport: scripted-ls err: <- StreamClosed",
    );
}

/// helix-lsp records the bridge does not know keep ERROR: here a server that refuses `initialize`,
/// which helix-lsp logs as an error answer with code `-32603` and as a failed initialization.
#[test]
fn unknown_helix_error_records_keep_their_level() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "quiet::unknown_helix_error_records_keep_their_level",
            support::standard,
        );
        return;
    };
    let capture = capture_the_log();
    let mut probe = Probe::new(&root, support::scripted(&root, &[("INIT", "error")], 1));
    probe.open(&root.join("file.scripted"), "alpha\n");
    probe.until("the failed-start state", |seen| {
        return matches!(seen.state(SERVER), Some(ServerState::FailedToStart { .. }));
    });
    drop(probe);
    support::children_until_none();
    let text = capture.text();
    assert_record(
        &text,
        "ERROR",
        "helix_lsp::transport: scripted-ls <- InternalError: scripted initialize failure",
    );
    assert_record(
        &text,
        "ERROR",
        "helix_lsp: failed to initialize language server: protocol error: InternalError: scripted initialize failure",
    );
}
