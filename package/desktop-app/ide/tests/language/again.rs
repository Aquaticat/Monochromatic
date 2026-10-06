//! Requests the worker makes on its own, asked again: an inlay-hint or pull-diagnostics request
//! the server leaves unanswered for its whole request timeout must not be the last one.
//!
//! The scripted server's stall holds its read loop, so whatever the client sends meanwhile waits
//! unread in the server's input. That is what a server process that stopped running for a
//! while looks like to the client, and it needs no load on the machine to happen.

use crate::support::{self, Probe};
use ide_app::language::{
    hints::HintWindow,
    reply::{RequestKind, RequestOutcome},
};
use std::{path::Path, time::Instant};

/// Request timeout of the scripted server in these tests, in seconds.
const TIMEOUT: u64 = 1;

/// One and a half request timeouts: the first request times out, the one sent again is answered.
const STALL: &str = "1500";

/// Longer than the first request and its three retries together, which end after four timeouts.
const LONG_STALL: &str = "4600";

/// The visible lines every test reports.
const WINDOW: HintWindow = HintWindow {
    first_line: 0,
    visible_lines: 20,
};

/// Text displayed first, and the text an external change replaces it with.
const BEFORE: &str = "plain text line\nsecond\n";
const AFTER: &str = "longer plain text line\nsecond\nthird\n";

/// How many `textDocument/inlayHint` requests the server received so far.
fn hint_requests(root: &Path) -> usize {
    return support::received(&support::report(root))
        .iter()
        .filter(|method| return method.as_str() == "textDocument/inlayHint")
        .count();
}

/// Display `BEFORE`, report the window, and wait for the hints of that text.
fn display_with_hints(probe: &mut Probe, root: &Path) {
    probe.open(&root.join("main.scripted"), BEFORE);
    probe.until_ready();
    assert!(
        probe
            .worker
            .request_hints(probe.stamp(), WINDOW)
            .expect("hint window")
    );
    probe.until("hints for the first text", |seen| {
        return seen.hints.is_some();
    });
}

/// Reload to `AFTER` and wait for hints of the new text. Every snapshot handed out after the
/// reload must describe the new text; `what` names the wait in a failure.
fn reload_and_wait_for_hints(probe: &mut Probe, what: &str) {
    probe.reload(AFTER);
    let stamp = probe.stamp();
    // Forget the snapshot of the previous text, so anything seen from here on was handed out
    // after the reload.
    probe.hints = None;
    probe.until(what, |seen| {
        let Some(hints) = seen.hints.as_ref() else {
            return false;
        };
        assert_eq!(
            hints.stamp, stamp,
            "a hint snapshot for other text was handed out after the reload"
        );
        return true;
    });
    let hints = probe.hints.clone().expect("hints");
    // The request that was answered named the lines of the new text, which has one line more.
    assert_eq!((hints.first_line, hints.last_line), (0, 4));
    assert_eq!(hints.hints.len(), 1);
}

/// The first hint request of a displayed file times out; the hints still arrive.
#[test]
fn hints_are_asked_again_when_the_first_request_times_out() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "again::hints_are_asked_again_when_the_first_request_times_out",
            support::standard,
        );
        return;
    };
    let definitions = support::scripted(
        &root,
        &[("STALL_AT", "textDocument/inlayHint"), ("STALL_MS", STALL)],
        TIMEOUT,
    );
    let mut probe = Probe::new(&root, definitions);
    probe.open(&root.join("main.scripted"), BEFORE);
    probe.until_ready();
    let asked = Instant::now();
    assert!(
        probe
            .worker
            .request_hints(probe.stamp(), WINDOW)
            .expect("hint window")
    );
    probe.until(
        "hints for the first text after the first request timed out",
        |seen| {
            return seen.hints.is_some();
        },
    );
    let hints = probe.hints.clone().expect("hints");
    assert_eq!(hints.stamp, probe.stamp());
    assert_eq!((hints.first_line, hints.last_line), (0, 3));
    // A request is sent again only after a whole request timeout passed without an answer.
    let allowed = 1 + usize::try_from(asked.elapsed().as_secs() / TIMEOUT).expect("small count");
    let requests = hint_requests(&root);
    assert!(
        (1..=allowed).contains(&requests),
        "{requests} hint requests were sent where at most {allowed} can follow from timeouts"
    );
}

/// The hint request that follows a reload times out; hints for the new text still arrive.
#[test]
fn hints_are_asked_again_after_a_reload_when_the_request_times_out() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "again::hints_are_asked_again_after_a_reload_when_the_request_times_out",
            support::standard,
        );
        return;
    };
    let definitions = support::scripted(
        &root,
        &[("STALL_AT", "textDocument/didChange"), ("STALL_MS", STALL)],
        TIMEOUT,
    );
    let mut probe = Probe::new(&root, definitions);
    display_with_hints(&mut probe, &root);
    let reloaded = Instant::now();
    reload_and_wait_for_hints(
        &mut probe,
        "hints for the reloaded text after the request timed out",
    );
    // One request for the first text, one for the new text, and one more per elapsed timeout.
    let allowed = 2 + usize::try_from(reloaded.elapsed().as_secs() / TIMEOUT).expect("small count");
    let requests = hint_requests(&root);
    assert!(
        (2..=allowed).contains(&requests),
        "{requests} hint requests were sent where at most {allowed} can follow from timeouts"
    );
}

/// The pull request that follows a reload times out; diagnostics for the new text still arrive.
#[test]
fn pulled_diagnostics_are_asked_again_after_a_reload_when_the_request_times_out() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "again::pulled_diagnostics_are_asked_again_after_a_reload_when_the_request_times_out",
            support::standard,
        );
        return;
    };
    let definitions = support::scripted(
        &root,
        &[
            ("PULL", "1"),
            ("PUSH", "0"),
            ("STALL_AT", "textDocument/didChange"),
            ("STALL_MS", STALL),
        ],
        TIMEOUT,
    );
    let mut probe = Probe::new(&root, definitions);
    probe.open(&root.join("main.scripted"), "first\n");
    probe.until("pulled diagnostics for the first text", |seen| {
        return seen.messages() == ["PULLED:first\n"];
    });
    probe.reload("second\n");
    let stamp = probe.stamp();
    probe.until(
        "pulled diagnostics for the reloaded text after the request timed out",
        |seen| {
            return seen.messages() == ["PULLED:second\n"]
                && seen
                    .diagnostics
                    .as_ref()
                    .is_some_and(|found| return found.stamp == stamp);
        },
    );
}

/// Every retry times out during a long stall; the server's next notification makes the worker
/// ask once more.
#[test]
fn hints_are_asked_again_when_the_server_sends_a_notification_after_every_retry_timed_out() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "again::hints_are_asked_again_when_the_server_sends_a_notification_after_every_retry_timed_out",
            support::standard,
        );
        return;
    };
    // The server pushes diagnostics for the change as soon as its stall ends.
    let definitions = support::scripted(
        &root,
        &[
            ("STALL_AT", "textDocument/didChange"),
            ("STALL_MS", LONG_STALL),
        ],
        TIMEOUT,
    );
    let mut probe = Probe::new(&root, definitions);
    display_with_hints(&mut probe, &root);
    reload_and_wait_for_hints(
        &mut probe,
        "hints for the reloaded text after the server's notification followed the timed-out retries",
    );
}

/// Every retry times out during a long stall and the server pushes nothing; its answer to a
/// later hover request makes the worker ask once more.
#[test]
fn hints_are_asked_again_when_the_server_answers_another_request_after_every_retry_timed_out() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "again::hints_are_asked_again_when_the_server_answers_another_request_after_every_retry_timed_out",
            support::standard,
        );
        return;
    };
    let definitions = support::scripted(
        &root,
        &[
            ("PUSH", "0"),
            ("STALL_AT", "textDocument/didChange"),
            ("STALL_MS", LONG_STALL),
        ],
        TIMEOUT,
    );
    let mut probe = Probe::new(&root, definitions);
    display_with_hints(&mut probe, &root);
    probe.reload(AFTER);
    let stamp = probe.stamp();
    probe.hints = None;
    // When the stall ends the server reads the request sent with the change and its three
    // retries, which the client had all given up. Wait until it has read them, so the hover
    // answer is the first thing the worker hears from it. Hints seen this early mean a retry
    // was still waiting when the stall ended, which only a delayed worker thread produces.
    probe.until("the server to read every timed-out hint request", |seen| {
        return seen.hints.is_some() || hint_requests(&root) >= 5;
    });
    let number = probe.request(RequestKind::Hover, 3);
    assert!(matches!(
        probe.answers(number)[0].outcome,
        RequestOutcome::Hover(_)
    ));
    probe.until(
        "hints for the reloaded text after the server's hover answer followed the timed-out retries",
        |seen| {
            let Some(hints) = seen.hints.as_ref() else {
                return false;
            };
            assert_eq!(
                hints.stamp, stamp,
                "a hint snapshot for other text was handed out after the reload"
            );
            return true;
        },
    );
}
