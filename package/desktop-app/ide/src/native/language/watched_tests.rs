//! The application's language tick hands the worker's file-change queue to the change watcher, so a file
//! changed outside the IDE reaches the scripted server that registered a watcher for it.

/// Fixtures, the scripted server's definitions, bounded waiting, and the readiness wait.
use super::test_support::{address, definitions, eventually, project, reader, ready};
/// External writes and the server's report.
use std::fs;

/// A file written by another program reaches the server as `workspace/didChangeWatchedFiles`.
#[test]
fn an_external_change_reaches_the_server_through_the_application() {
    let fixture = project(&[
        ("main.scripted", "watched\n"),
        ("lib/other.scripted", "before\n"),
    ]);
    let report = fixture.outside.join("report.jsonl");
    let report_text = report.display().to_string();
    let reader = reader(
        &fixture,
        "main.scripted",
        definitions(
            &[
                ("WATCHERS", r#"[{"globPattern":"**/*.scripted"}]"#),
                ("REPORT", &report_text),
            ],
            None,
        ),
    );
    ready(&reader);
    let changed = fixture.root.join("lib/other.scripted");
    let expected = address(&changed);
    // The server registers after `initialized` and the folders are then scanned, so the write is
    // repeated every 100 ms until one lands in a watched folder.
    let mut ticks = 0;
    eventually("the external change did not reach the server", || {
        if ticks % 50 == 0 {
            fs::write(&changed, format!("after {ticks}\n")).expect("external change");
        }
        ticks += 1;
        // What: `unwrap_or_default` reads an absent report as empty text.
        // Why: The server creates the report when it starts.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const text = existsSync(report) ? readFileSync(report, 'utf8') : '';
        // ```
        let text = fs::read_to_string(&report).unwrap_or_default();
        return text.lines().any(|line| {
            return line.contains("workspace/didChangeWatchedFiles") && line.contains(&expected);
        });
    });
}
