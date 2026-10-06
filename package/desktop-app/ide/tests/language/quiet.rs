//! Quiet lifetime: what a clean open, one request, close, and shutdown leave in the application
//! log and in the process table.
//!
//! The log is captured exactly as the application writes it: the same filter directive, and the
//! same bridge that turns helix-lsp's `log` records into application records. helix-lsp logs
//! every line a server writes to standard error, so the capture holds that stream too.

use crate::support::{self, Probe};
use ide_app::language::{
    HELIX_LOG_DIRECTIVE,
    reply::{RequestKind, RequestOutcome},
    status::DocumentState,
};
use std::{
    io::{self, Write},
    path::Path,
    sync::{Arc, Mutex},
};
use tracing_subscriber::fmt::MakeWriter;

/// The one ERROR-level record a clean lifetime leaves today. helix-lsp writes it, not the server
/// and not the application: its reader of a server's standard error reports the end of that
/// stream at ERROR on every server exit, requested or not
/// (`doc/troubleshooting/helix-lsp-transport-error-level-records.md`).
const HELIX_END_OF_STREAM: &str = "helix_lsp::transport: scripted-ls err: <- StreamClosed";

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

/// Run one clean lifetime against the scripted server and return every ERROR-level log record.
/// Installs the process-wide log subscriber, so it runs once per child process.
fn errors_of_a_clean_lifetime(root: &Path) -> Vec<String> {
    let capture = Capture::default();
    // The application's own setup (`native::run`), with the writer replaced and colors off.
    // `init` also installs the bridge for helix-lsp's `log` records.
    tracing_subscriber::fmt()
        .with_env_filter(format!("ide_app=debug,{HELIX_LOG_DIRECTIVE}"))
        .with_ansi(false)
        .with_writer(capture.clone())
        .init();
    let mut probe = Probe::new(root, support::scripted(root, &[], 3));
    probe.open(&root.join("file.scripted"), "alpha\n");
    probe.until_ready();
    assert_eq!(support::children().len(), 1);
    let number = probe.request(RequestKind::Hover, 1);
    assert!(
        matches!(probe.answers(number)[0].outcome, RequestOutcome::Hover(_)),
        "the one request of the lifetime was not answered"
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
    let bytes = capture.0.lock().expect("log buffer").clone();
    let text = String::from_utf8(bytes).expect("log text");
    // Positive controls: the capture saw an application record and a record of the shutdown itself.
    assert!(
        text.contains("language server is ready"),
        "the log capture saw no application record:\n{text}"
    );
    assert!(
        text.contains("language servers were asked to stop still_running=0"),
        "the server did not end by itself within the grace period:\n{text}"
    );
    let mut errors = Vec::new();
    for line in text.lines() {
        // A record starts with its time, then its level.
        if line.split_whitespace().nth(1) == Some("ERROR") {
            errors.push(line.to_string());
        }
    }
    return errors;
}

/// A clean lifetime leaves no child process and nothing at ERROR that the application or the
/// server caused; the helix-lsp end-of-stream record is the single, named exception.
#[test]
fn clean_lifetime_logs_no_error_besides_the_helix_end_of_stream_record() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "quiet::clean_lifetime_logs_no_error_besides_the_helix_end_of_stream_record",
            support::standard,
        );
        return;
    };
    let errors = errors_of_a_clean_lifetime(&root);
    let mut unexpected = Vec::new();
    for line in &errors {
        if !line.ends_with(HELIX_END_OF_STREAM) {
            unexpected.push(line.clone());
        }
    }
    assert!(
        unexpected.is_empty(),
        "a clean lifetime logged at ERROR: {unexpected:#?}"
    );
    assert!(
        errors.len() <= 1,
        "the end-of-stream record appeared more than once: {errors:#?}"
    );
}

/// The acceptance test for the pending decision: a clean lifetime logs nothing at ERROR at all.
#[test]
#[ignore = "fails until helix-lsp's end-of-stream record no longer reaches the log at ERROR; see doc/troubleshooting/helix-lsp-transport-error-level-records.md"]
fn clean_lifetime_logs_no_error_level_record() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "quiet::clean_lifetime_logs_no_error_level_record",
            support::standard,
        );
        return;
    };
    let errors = errors_of_a_clean_lifetime(&root);
    assert!(
        errors.is_empty(),
        "a clean lifetime logged at ERROR: {errors:#?}"
    );
}
