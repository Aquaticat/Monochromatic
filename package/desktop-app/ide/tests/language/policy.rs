//! Server-to-client requests: every one is answered by policy, and every edit is refused.

use crate::support::{self, PRODUCT_TIMEOUT, Probe};
use ide_app::language::reply::{RequestKind, RequestOutcome};
use serde_json::{Value, json};

/// The reply the scripted server recorded for a method; the second `workspace/applyEdit` is the malformed one.
fn replies(lines: &[Value], method: &str) -> Vec<Value> {
    let mut found = Vec::new();
    for line in lines {
        if line["probe"]["method"] == method {
            found.push(line["probe"]["response"].clone());
        }
    }
    return found;
}

/// The server sends every request it can; the client refuses the edit, answers the rest, and goes on.
#[test]
fn server_requests_get_policy_replies_and_edits_change_nothing() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "policy::server_requests_get_policy_replies_and_edits_change_nothing",
            support::standard,
        );
        return;
    };
    let definitions = support::scripted(&root, &[("PROBE", "1"), ("PULL", "1")], PRODUCT_TIMEOUT);
    let mut probe = Probe::new(&root, definitions);
    let file = root.join("guarded.scripted");
    let original = "original bytes \u{e9}\nsecond line\n";
    probe.open(&file, original);
    probe.until_ready();
    let lines = support::report_until(&root, "the end of the server's probe", |seen| {
        return seen.iter().any(|line| return line["probe-done"] == true);
    });
    let edits = replies(&lines, "workspace/applyEdit");
    assert_eq!(edits.len(), 2);
    assert_eq!(
        edits[0],
        json!({ "result": { "applied": false, "failureReason": "read-only client: workspace edits are not applied" } }),
        "a server-initiated workspace edit was not refused"
    );
    assert_eq!(edits[1]["error"]["code"], -32602, "{}", edits[1]);
    assert_eq!(
        std::fs::read(&file).expect("guarded file"),
        original.as_bytes(),
        "a server-initiated edit changed the file"
    );
    assert_eq!(
        replies(&lines, "window/workDoneProgress/create"),
        [json!({ "result": null })]
    );
    assert_eq!(
        replies(&lines, "workspace/configuration"),
        [json!({ "result": [{ "flag": true, "nested": { "value": 42 } }, 42, null] })]
    );
    assert_eq!(
        replies(&lines, "client/registerCapability"),
        [json!({ "result": null })]
    );
    assert_eq!(
        replies(&lines, "workspace/workspaceFolders"),
        [json!({ "result": [{ "uri": format!("file://{}", root.display()), "name": "project" }] })]
    );
    assert_eq!(
        replies(&lines, "window/showMessageRequest"),
        [json!({ "result": null })]
    );
    assert_eq!(
        replies(&lines, "window/showDocument"),
        [json!({ "result": { "success": false } })]
    );
    assert_eq!(
        replies(&lines, "workspace/diagnostic/refresh"),
        [json!({ "result": null })]
    );
    assert_eq!(
        replies(&lines, "scripted/unknownMethod"),
        [
            json!({ "error": { "code": -32601, "message": "Method not found: scripted/unknownMethod" } })
        ]
    );
    let unanswered: Vec<&Value> = lines
        .iter()
        .filter(|line| return line["probe"]["response"]["unanswered"] == true)
        .collect();
    assert!(
        unanswered.is_empty(),
        "a server request was left unanswered: {unanswered:?}"
    );
    // The refresh request makes the client pull diagnostics a second time.
    let pulls = support::report_until(&root, "a second diagnostics pull", |seen| {
        return support::received(seen)
            .iter()
            .filter(|method| return method.as_str() == "textDocument/diagnostic")
            .count()
            >= 2;
    });
    assert!(!pulls.is_empty());
    // The session continues: requests still work and the registered watcher is notified of the reload.
    let number = probe.request(RequestKind::Hover, 2);
    assert!(matches!(
        probe.answers(number)[0].outcome,
        RequestOutcome::Hover(_)
    ));
    probe.reload("reloaded by the test\n");
    let watched = support::report_until(&root, "a watched-file notification", |seen| {
        return support::received(seen)
            .iter()
            .any(|method| return method == "workspace/didChangeWatchedFiles");
    });
    let event = watched
        .iter()
        .find(|line| return line["received"] == "workspace/didChangeWatchedFiles")
        .expect("watched-file notification");
    assert_eq!(
        event["params"]["changes"][0]["uri"],
        format!("file://{}", file.display()).as_str()
    );
    assert_eq!(event["params"]["changes"][0]["type"], 2);
}
