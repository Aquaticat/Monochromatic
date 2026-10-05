//! The five feature paths against the scripted server: targets, hover, hints, diagnostics, and
//! the request states (unsupported, failed, superseded, empty, timeout, stale).

use crate::support::{self, Probe, SERVER};
use ide_app::language::{
    diagnostics::Freshness,
    hints::{HintKind, HintWindow},
    reply::{RequestFailure, RequestKind, RequestOutcome, Target},
    target::TargetRefusal,
};

/// Line 0 has an accented letter and an astral character before offset 14; line 2 starts with both.
const SOURCE: &str = "caf\u{e9} \u{1F600} hello world\n\n\u{e9}\u{1F600}cdef tail\n";

/// Definition answers are validated: openable inside and outside the project, or unavailable.
#[test]
fn definition_targets_are_validated_and_converted() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "requests::definition_targets_are_validated_and_converted",
            support::standard,
        );
        return;
    };
    let outside = support::scratch(&root).join("library.scripted");
    std::fs::write(&outside, "library\n").expect("outside file");
    let outside_text = outside.display().to_string();
    let definitions = support::scripted(
        &root,
        &[("ENCODING", "utf-8"), ("OUTSIDE", outside_text.as_str())],
        3,
    );
    let mut probe = Probe::new(&root, definitions);
    let file = root.join("main.scripted");
    probe.open(&file, SOURCE);
    probe.until_ready();
    let number = probe.request(RequestKind::Definition, 3);
    let answers = probe.answers(number);
    assert_eq!(answers.len(), 1);
    assert_eq!(answers[0].stamp, probe.stamp());
    assert_eq!(answers[0].position, 3);
    let RequestOutcome::Locations(targets) = &answers[0].outcome else {
        panic!("definition produced {:?}", answers[0].outcome);
    };
    assert_eq!(targets.len(), 5);
    let Target::Open(same) = &targets[0] else {
        panic!("the same-document target is {:?}", targets[0]);
    };
    assert!(same.same_document && !same.outside_project);
    assert_eq!(same.path, file);
    assert_eq!(same.line, 2);
    // Six UTF-8 bytes on line 2 are the accented letter and the astral character: two characters.
    let line_start = SOURCE.chars().count() - "\u{e9}\u{1F600}cdef tail\n".chars().count();
    assert_eq!(same.range, Some((line_start, line_start + 2)));
    assert_eq!(
        targets[1],
        Target::Unavailable {
            uri: "untitled:Untitled-1".to_string(),
            refusal: TargetRefusal::UnsupportedScheme("untitled".to_string())
        },
        "a non-file target was not reported as unavailable"
    );
    assert!(matches!(
        &targets[2],
        Target::Unavailable { refusal: TargetRefusal::UnsupportedScheme(scheme), .. } if scheme == "jdt"
    ));
    assert_eq!(
        targets[3],
        Target::Unavailable {
            uri: "file:///definitely/missing/file.rs".to_string(),
            refusal: TargetRefusal::Missing
        }
    );
    let Target::Open(library) = &targets[4] else {
        panic!("the outside target is {:?}", targets[4]);
    };
    assert!(
        library.outside_project && !library.same_document,
        "a target outside the project root was not flagged outside project"
    );
    assert_eq!(library.path, outside);
    assert_eq!(library.range, Some((0, 1)));
}

/// A protocol error is a failed request with the server's code; hover still works afterwards.
#[test]
fn failed_request_carries_the_servers_error_code() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "requests::failed_request_carries_the_servers_error_code",
            support::standard,
        );
        return;
    };
    let mut probe = Probe::new(&root, support::scripted(&root, &[], 3));
    probe.open(&root.join("main.scripted"), SOURCE);
    probe.until_ready();
    let number = probe.request(RequestKind::References, 3);
    assert_eq!(
        probe.answers(number)[0].outcome,
        RequestOutcome::Failed(RequestFailure::Rpc {
            code: -32603,
            message: "scripted internal failure".to_string()
        })
    );
    let hover = probe.request(RequestKind::Hover, 3);
    assert!(matches!(
        probe.answers(hover)[0].outcome,
        RequestOutcome::Hover(_)
    ));
}

/// The same character offset reaches the server as the right column in every negotiated unit.
#[test]
fn hover_position_and_range_use_the_negotiated_column_unit() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "requests::hover_position_and_range_use_the_negotiated_column_unit",
            support::standard,
        );
        return;
    };
    // Offset 13 is the `w` of `world`: after `café `, the astral character, and ` hello `.
    // Before it are 17 UTF-8 bytes, 14 UTF-16 units, and 13 characters.
    let position = 13;
    assert_eq!(SOURCE.chars().nth(position), Some('w'));
    for (encoding, column) in [("utf-8", 17), ("utf-16", 14), ("utf-32", 13), ("", 14)] {
        std::fs::remove_file(support::report_path(&root)).unwrap_or_default();
        let mut probe = Probe::new(
            &root,
            support::scripted(&root, &[("ENCODING", encoding)], 3),
        );
        probe.open(&root.join("main.scripted"), SOURCE);
        probe.until_ready();
        let number = probe.request(RequestKind::Hover, position);
        let answers = probe.answers(number);
        let RequestOutcome::Hover(hover) = &answers[0].outcome else {
            panic!("hover produced {:?}", answers[0].outcome);
        };
        assert_eq!(
            hover.text, "line=caf\u{e9} \u{1F600} hello world char=w",
            "the server saw another character in {encoding:?}"
        );
        assert!(hover.markdown);
        assert_eq!(hover.range, Some((position, position)));
        let lines = support::report(&root);
        let sent = lines
            .iter()
            .find(|line| return line["received"] == "textDocument/hover")
            .expect("hover request");
        assert_eq!(sent["params"]["position"]["character"], column);
        assert_eq!(sent["params"]["position"]["line"], 0);
    }
}

/// `null` is an empty successful result, not a failure.
#[test]
fn hover_on_a_blank_line_is_an_empty_result() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "requests::hover_on_a_blank_line_is_an_empty_result",
            support::standard,
        );
        return;
    };
    let mut probe = Probe::new(&root, support::scripted(&root, &[], 3));
    probe.open(&root.join("main.scripted"), SOURCE);
    probe.until_ready();
    let blank = SOURCE
        .find("\n\n")
        .map(|bytes| return SOURCE[..bytes].chars().count() + 1);
    let number = probe.request(RequestKind::Hover, blank.expect("blank line"));
    assert_eq!(probe.answers(number)[0].outcome, RequestOutcome::Empty);
    let outside = probe.request(RequestKind::Hover, 10_000);
    assert!(matches!(
        probe.answers(outside)[0].outcome,
        RequestOutcome::Failed(RequestFailure::Other(_))
    ));
}

/// A running server that lacks a feature answers "unsupported" for it and nothing else changes.
#[test]
fn missing_capabilities_are_reported_per_request() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "requests::missing_capabilities_are_reported_per_request",
            support::standard,
        );
        return;
    };
    let definitions = support::scripted(&root, &[("FEATURES", "minimal")], 3);
    let mut probe = Probe::new(&root, definitions);
    probe.open(&root.join("main.scripted"), SOURCE);
    probe.until_ready();
    let features = probe.status.servers[0].features.expect("features");
    assert!(features.hover);
    assert!(!features.definition && !features.references && !features.inlay_hints);
    for kind in [RequestKind::Definition, RequestKind::References] {
        let number = probe.request(kind, 3);
        assert_eq!(
            probe.answers(number)[0].outcome,
            RequestOutcome::Unsupported
        );
    }
    let hover = probe.request(RequestKind::Hover, 3);
    assert!(matches!(
        probe.answers(hover)[0].outcome,
        RequestOutcome::Hover(_)
    ));
    let window = HintWindow {
        first_line: 0,
        visible_lines: 10,
    };
    assert!(
        probe
            .worker
            .request_hints(probe.stamp(), window)
            .expect("hint window")
    );
    std::thread::sleep(std::time::Duration::from_millis(300));
    probe.poll();
    assert!(probe.hints.is_none());
    let received = support::received(&support::report(&root));
    assert!(
        !received
            .iter()
            .any(|method| return method == "textDocument/definition"
                || method == "textDocument/references"
                || method == "textDocument/inlayHint"),
        "an unsupported request was sent: {received:?}"
    );
}

/// `-32801` is retried while the text is unchanged, and reported as superseded, never as a failure.
#[test]
fn superseded_request_is_retried_then_reported_as_superseded() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "requests::superseded_request_is_retried_then_reported_as_superseded",
            support::standard,
        );
        return;
    };
    let mut probe = Probe::new(&root, support::scripted(&root, &[("HOVER", "modified")], 3));
    probe.open(&root.join("main.scripted"), SOURCE);
    probe.until_ready();
    let number = probe.request(RequestKind::Hover, 3);
    let answers = probe.answers(number);
    assert_eq!(answers.len(), 1);
    assert_eq!(
        answers[0].outcome,
        RequestOutcome::Superseded,
        "a superseded request was shown as a failure"
    );
    let hovers = support::received(&support::report(&root))
        .iter()
        .filter(|method| return method.as_str() == "textDocument/hover")
        .count();
    assert_eq!(hovers, 4, "one request and three bounded retries");
    drop(probe);
    std::fs::remove_file(support::report_path(&root)).expect("previous report");
    let once = support::scripted(&root, &[("HOVER", "modified-once")], 3);
    let mut recovering = Probe::new(&root, once);
    recovering.open(&root.join("main.scripted"), SOURCE);
    recovering.until_ready();
    let retried = recovering.request(RequestKind::Hover, 3);
    assert!(matches!(
        recovering.answers(retried)[0].outcome,
        RequestOutcome::Hover(_)
    ));
}

/// A request the server never answers fails by the server's configured timeout.
#[test]
fn unanswered_request_times_out() {
    let Some(root) = support::child_root() else {
        support::run_child("requests::unanswered_request_times_out", support::standard);
        return;
    };
    let mut probe = Probe::new(&root, support::scripted(&root, &[("HOVER", "silent")], 1));
    probe.open(&root.join("main.scripted"), SOURCE);
    probe.until_ready();
    let number = probe.request(RequestKind::Hover, 3);
    assert_eq!(
        probe.answers(number)[0].outcome,
        RequestOutcome::Failed(RequestFailure::Timeout)
    );
}

/// A reply overtaken by a reload or a file switch is dropped when it is read.
#[test]
fn reply_overtaken_by_a_reload_or_file_switch_is_dropped() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "requests::reply_overtaken_by_a_reload_or_file_switch_is_dropped",
            support::standard,
        );
        return;
    };
    let definitions = support::scripted(&root, &[("HOVER_DELAY_MS", "400")], 3);
    let mut probe = Probe::new(&root, definitions);
    probe.open(&root.join("main.scripted"), SOURCE);
    probe.until_ready();
    let overtaken = probe.request(RequestKind::Hover, 3);
    probe.reload("changed text\n");
    probe.until("the overtaken reply to be dropped", |seen| {
        return seen.worker.fence_counts().stale_revision == 1;
    });
    assert!(
        !probe
            .replies
            .iter()
            .any(|reply| return reply.request == overtaken),
        "a reply for the previous revision was accepted"
    );
    let current = probe.request(RequestKind::Hover, 3);
    let answers = probe.answers(current);
    let RequestOutcome::Hover(hover) = &answers[0].outcome else {
        panic!("hover produced {:?}", answers[0].outcome);
    };
    assert_eq!(hover.text, "line=changed text char=n");
    let before_switch = probe.request(RequestKind::Hover, 3);
    probe.open(&root.join("other.scripted"), "other file\n");
    probe.until("the reply for the previous file to be dropped", |seen| {
        return seen.worker.fence_counts().other_file == 1;
    });
    assert!(
        !probe
            .replies
            .iter()
            .any(|reply| return reply.request == before_switch),
        "a reply for the previous file was accepted"
    );
}

/// A `-32801` answer for text that was reloaded meanwhile is not retried; the fence drops it as stale.
#[test]
fn superseded_answer_for_reloaded_text_is_dropped_by_the_fence() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "requests::superseded_answer_for_reloaded_text_is_dropped_by_the_fence",
            support::standard,
        );
        return;
    };
    let definitions = support::scripted(
        &root,
        &[("HOVER", "modified"), ("HOVER_DELAY_MS", "400")],
        3,
    );
    let mut probe = Probe::new(&root, definitions);
    probe.open(&root.join("main.scripted"), SOURCE);
    probe.until_ready();
    let overtaken = probe.request(RequestKind::Hover, 3);
    probe.reload("changed text\n");
    probe.until("the superseded answer to be dropped as stale", |seen| {
        return seen.worker.fence_counts().stale_revision == 1;
    });
    assert!(
        !probe
            .replies
            .iter()
            .any(|reply| return reply.request == overtaken),
        "a superseded answer for reloaded text reached the interface"
    );
    std::thread::sleep(std::time::Duration::from_millis(600));
    let hovers = support::received(&support::report(&root))
        .iter()
        .filter(|method| return method.as_str() == "textDocument/hover")
        .count();
    assert_eq!(
        hovers, 1,
        "a request for text that is no longer displayed was retried"
    );
}

/// Hints are shaped for drawing, tagged with their text, and asked for again after a reload.
#[test]
fn inlay_hints_are_shaped_and_follow_reloads() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "requests::inlay_hints_are_shaped_and_follow_reloads",
            support::standard,
        );
        return;
    };
    let mut probe = Probe::new(&root, support::scripted(&root, &[], 3));
    probe.open(&root.join("main.scripted"), "plain text line\nsecond\n");
    probe.until_ready();
    let window = HintWindow {
        first_line: 0,
        visible_lines: 20,
    };
    assert!(
        probe
            .worker
            .request_hints(probe.stamp(), window)
            .expect("hint window")
    );
    probe.until("inlay hints", |seen| return seen.hints.is_some());
    let first = probe.hints.clone().expect("hints");
    assert_eq!(first.stamp, probe.stamp());
    assert_eq!((first.first_line, first.last_line), (0, 3));
    assert_eq!(
        first.hints.len(),
        1,
        "the hint on a missing line must be dropped"
    );
    assert_eq!(first.hints[0].label, "part-a-part-b");
    assert_eq!(first.hints[0].position, 5);
    assert_eq!(first.hints[0].kind, Some(HintKind::Type));
    assert!(first.hints[0].padding_left && !first.hints[0].padding_right);
    assert_eq!(first.hints[0].server.name, SERVER);
    probe.reload("longer plain text line\nsecond\nthird\n");
    let stamp = probe.stamp();
    probe.until("hints for the reloaded text", |seen| {
        return seen
            .hints
            .as_ref()
            .is_some_and(|hints| return hints.stamp == stamp);
    });
    let requests = support::received(&support::report(&root))
        .iter()
        .filter(|method| return method.as_str() == "textDocument/inlayHint")
        .count();
    assert_eq!(requests, 2);
}

/// Versioned pushes are exact; they replace each other across reloads without any hold.
#[test]
fn versioned_diagnostics_follow_the_displayed_version() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "requests::versioned_diagnostics_follow_the_displayed_version",
            support::standard,
        );
        return;
    };
    let mut probe = Probe::new(&root, support::scripted(&root, &[("DIAG_VERSION", "1")], 3));
    probe.open(&root.join("main.scripted"), "first\n");
    probe.until("diagnostics for the first text", |seen| {
        return seen.messages() == ["TEXT:first\n"];
    });
    let snapshot = probe.diagnostics.clone().expect("diagnostics");
    assert_eq!(snapshot.groups[0].source, "scripted");
    assert_eq!(snapshot.groups[0].items[0].freshness, Freshness::Versioned);
    assert_eq!(
        (
            snapshot.groups[0].items[0].start,
            snapshot.groups[0].items[0].end
        ),
        (0, 1)
    );
    probe.reload("second\n");
    let stamp = probe.stamp();
    probe.until("diagnostics for the second text", |seen| {
        return seen.messages() == ["TEXT:second\n"]
            && seen
                .diagnostics
                .as_ref()
                .is_some_and(|found| return found.stamp == stamp);
    });
}

/// Unversioned pushes are held after a reload until the server answers something for the new text.
#[test]
fn unversioned_diagnostics_are_held_after_a_reload() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "requests::unversioned_diagnostics_are_held_after_a_reload",
            support::standard,
        );
        return;
    };
    let definitions = support::scripted(&root, &[("PUSH_AFTER_HOVER", "1")], 3);
    let mut probe = Probe::new(&root, definitions);
    probe.open(&root.join("main.scripted"), "first\n");
    probe.until("diagnostics for the first text", |seen| {
        return seen.messages() == ["TEXT:first\n"];
    });
    let snapshot = probe.diagnostics.clone().expect("diagnostics");
    assert_eq!(
        snapshot.groups[0].items[0].freshness,
        Freshness::Unversioned
    );
    probe.reload("second\n");
    let stamp = probe.stamp();
    // The server pushes at once for the change; that set arrives inside the hold and is discarded.
    support::server_text_until(&root, "second\n");
    probe.until(
        "the previous revision's diagnostics to leave the display",
        |seen| {
            return seen
                .diagnostics
                .as_ref()
                .is_some_and(|found| return found.stamp == stamp);
        },
    );
    std::thread::sleep(std::time::Duration::from_millis(300));
    probe.poll();
    assert!(
        probe.messages().is_empty(),
        "an unversioned set that arrived during the hold was displayed: {:?}",
        probe.messages()
    );
    // The hover answer ends the hold; the push that follows it is accepted.
    let number = probe.request(RequestKind::Hover, 1);
    probe.answers(number);
    probe.until("the unversioned set that followed the answer", |seen| {
        return seen.messages() == ["TEXT:second\n"];
    });
}

/// Pull diagnostics are requested after open and after every reload, and fenced by stamp.
#[test]
fn pulled_diagnostics_follow_open_and_reload() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "requests::pulled_diagnostics_follow_open_and_reload",
            support::standard,
        );
        return;
    };
    let definitions = support::scripted(&root, &[("PULL", "1"), ("PUSH", "0")], 3);
    let mut probe = Probe::new(&root, definitions);
    probe.open(&root.join("main.scripted"), "first\n");
    probe.until_ready();
    assert!(
        probe.status.servers[0]
            .features
            .expect("features")
            .pull_diagnostics
    );
    probe.until("pulled diagnostics", |seen| {
        return seen.messages() == ["PULLED:first\n"];
    });
    let snapshot = probe.diagnostics.clone().expect("diagnostics");
    assert_eq!(snapshot.groups[0].source, "scripted-pull");
    assert_eq!(snapshot.groups[0].items[0].freshness, Freshness::Pulled);
    probe.reload("second\n");
    probe.until("pulled diagnostics for the reloaded text", |seen| {
        return seen.messages() == ["PULLED:second\n"];
    });
    assert_eq!(
        probe.diagnostics.clone().expect("diagnostics").stamp,
        probe.stamp()
    );
}
