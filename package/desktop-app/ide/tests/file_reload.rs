//! External file updates are prepared in disposable fixtures and applied to current reading state.

/// Application consumers share the same read/diff and bounded worker APIs.
use ide_app::{document::{Document, ReadingPosition}, file_reload::read_reload, reload_worker::{ReloadReply, ReloadWorker}};
/// Bound worker waits instead of hanging an unattended regression run.
use std::time::{Duration, Instant};

/// Wait for a single test reply while retaining an explicit failure deadline.
fn reply(worker: &mut ReloadWorker) -> ReloadReply {
    let start = Instant::now();
    loop {
        // What: expect fails this test on disconnect; Some extracts a completed response.
        // Why: A stopped worker must not look like an indefinitely pending operation.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const response = worker.tryTake(); if (response !== undefined) return response;
        // ```
        if let Some(response) = worker.try_take().expect("poll source worker") {
            return response;
        }
        assert!(start.elapsed() < Duration::from_secs(3), "source worker did not reply");
        std::thread::sleep(Duration::from_millis(2));
    }
}

/// A byte-identical read produces no new revision or diff to apply.
#[test]
fn unchanged_disk_source_has_no_reload() {
    let fixture = tempfile::tempdir().expect("disposable source directory");
    let path = fixture.path().join("source.txt");
    std::fs::write(&path, "a\r\n猫").expect("write fixture source");
    let document = Document::new("a\r\n猫");
    assert!(read_reload(&document, &path).expect("read fixture").is_none());
    assert_eq!(document.revision(), 0);
}

/// An external replacement follows the selected region rather than a later literal match.
#[test]
fn disk_replacement_preserves_corresponding_selection() {
    let fixture = tempfile::tempdir().expect("disposable source directory");
    let path = fixture.path().join("source.txt");
    std::fs::write(&path, "I was a big cat, but now I am a human!").expect("external fixture update");
    let mut document = Document::new("I am a big cat");
    document.select(ReadingPosition { anchor: 2, head: 6, viewport: 0 });
    let reload = read_reload(&document, &path).expect("read updated source").expect("changed source");
    assert!(document.apply_reload(reload));
    assert_eq!(document.selected_text(), "was a");
}

/// Read errors retain the caller's source instead of installing empty or lossy text.
#[test]
fn absent_non_regular_and_non_utf8_sources_fail_without_mutating_document() {
    let fixture = tempfile::tempdir().expect("disposable source directory");
    let path = fixture.path().join("source.txt");
    let document = Document::new("retained source");
    assert!(read_reload(&document, &path).is_err());
    assert!(read_reload(&document, fixture.path()).is_err());
    std::fs::write(&path, [0xff, 0xfe]).expect("invalid UTF-8 fixture");
    assert!(read_reload(&document, &path).is_err());
    assert_eq!(document.text().to_string(), "retained source");
}

/// A second request cannot accumulate while the previous response remains unread.
#[test]
fn worker_bounds_requests_and_maps_the_latest_caret() {
    let fixture = tempfile::tempdir().expect("disposable source directory");
    let path = fixture.path().join("source.txt");
    std::fs::write(&path, "I was a big cat.").expect("external fixture update");
    let mut document = Document::new("I am a big cat.");
    let mut worker = ReloadWorker::new().expect("start source worker");
    assert!(worker.try_take().expect("idle worker").is_none());
    // Clone retains the base rope/revision independently of subsequent UI movement.
    assert!(worker.request(path.clone(), document.clone(), 41).expect("first request"));
    assert!(!worker.request(path, document.clone(), 42).expect("bounded second request"));
    document.select(ReadingPosition { anchor: 9, head: 9, viewport: 0 });
    let response = reply(&mut worker);
    assert_eq!(response.generation, 41);
    let reload = response.result.expect("background source read").expect("changed source");
    assert!(document.apply_reload(reload));
    assert_eq!(document.position().head, 10);
}

/// Failed reads do not terminate the worker or prevent a later successful poll.
#[test]
fn worker_recovers_after_source_reappears() {
    let fixture = tempfile::tempdir().expect("disposable source directory");
    let path = fixture.path().join("source.txt");
    let document = Document::new("same source");
    let mut worker = ReloadWorker::new().expect("start source worker");
    assert!(worker.request(path.clone(), document.clone(), 7).expect("missing-file request"));
    assert!(reply(&mut worker).result.is_err());
    std::fs::write(&path, "same source").expect("restore external fixture");
    assert!(worker.request(path, document, 7).expect("recovered-file request"));
    assert!(reply(&mut worker).result.expect("recovered read").is_none());
}

/// Closing a worker with an unread job/reply joins it without a channel deadlock.
#[test]
fn worker_shutdown_does_not_require_consuming_the_last_reply() {
    let fixture = tempfile::tempdir().expect("disposable source directory");
    let path = fixture.path().join("source.txt");
    std::fs::write(&path, "changed source").expect("write fixture");
    let mut worker = ReloadWorker::new().expect("start source worker");
    assert!(worker.request(path, Document::new("old source"), 1).expect("last request"));
    drop(worker);
}
