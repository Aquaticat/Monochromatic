//! Server states, stale replies, a stopped module, and closing while a request is pending.

/// Fixtures and real key events.
use super::test_support::{
    address, caret, definition, definitions, eventually, hover, idle, location, popup, project,
    reader, reader_launching, reader_with, ready,
};
/// A tree-row lookup shared with the navigation tests.
use crate::native::navigation_tests::row;
/// What: `anyhow!` builds an error from a message, like `new Error(...)`.
/// Why: A worker that failed to start is passed to the binding as such an error.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const failure = new Error('simulated');
/// ```
use anyhow::anyhow;
/// What a launch policy receives and returns; the refusing policy of one test is written with them.
use ide_app::language::launch::{LaunchRequest, ServerLaunch};
/// Hiding the window after the binding was closed.
use slint::ComponentHandle;
/// Child processes are read from the process table; elapsed time bounds shutdown.
use std::{fs, time::Instant};

/// Three lines of words.
const TEXT: &str = "alpha beta\ngamma delta\nepsilon\n";

/// Ctrl+Q while the server is starting says so; once it is ready the same key shows the hover.
#[test]
fn starting_server_is_explained_and_answers_once_ready() {
    let fixture = project(&[("main.scripted", TEXT)]);
    let reader = reader(
        &fixture,
        "main.scripted",
        definitions(&[("INIT_DELAY_MS", "1500")], None),
    );
    caret(&reader, 6);
    hover(&reader);
    eventually("starting was not explained", || {
        return popup(&reader) == "scripted-ls is still starting. Press Ctrl+Q again in a moment.";
    });
    ready(&reader);
    hover(&reader);
    eventually("the ready server's hover did not appear", || {
        return popup(&reader) == "line=alpha beta char=b";
    });
}

/// A server program that does not exist is named with its remedy.
#[test]
fn missing_server_program_is_named_with_its_remedy() {
    let fixture = project(&[("main.scripted", TEXT)]);
    let languages = definitions(&[], Some("/definitely/missing/ide-scripted-lsp"));
    let reader = reader(&fixture, "main.scripted", languages);
    definition(&reader);
    eventually("the missing program was not explained", || {
        let text = popup(&reader);
        return text.starts_with("Go to definition needs scripted-ls, which is not available:")
            && text.contains("/definitely/missing/ide-scripted-lsp")
            && text.ends_with("After installing it, press Ctrl+B again.");
    });
    assert!(reader.window.get_language_popup_note());
}

/// What: A launch policy that refuses every server. `_request` is deliberately unused.
///       `Err(...)` is the failure variant of `Result`; `.to_string()` copies the literal into
///       an owned `String`, which the policy's return type requires (sibling: borrowed `&str`).
/// Why: The production policy refuses when bubblewrap or namespaces are unavailable and never
///      falls back to an unconfined launch; this stands in for that with a fixed reason.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const refuse: LaunchPolicy = () => { throw new Error('simulated refusal'); };
/// ```
fn refuse(_request: &LaunchRequest) -> Result<ServerLaunch, String> {
    return Err("simulated refusal".to_string());
}

/// A refused launch is explained with its reason, and the window keeps working.
#[test]
fn refused_launch_is_explained_with_its_reason() {
    let fixture = project(&[("main.scripted", TEXT)]);
    let reader = reader_launching(&fixture, "main.scripted", definitions(&[], None), refuse);
    definition(&reader);
    eventually("the refused launch was not explained", || {
        let text = popup(&reader);
        return text.starts_with("scripted-ls was not started because its launch was refused:")
            && text.contains("simulated refusal")
            && text.ends_with("Language features stay off for this file.");
    });
    assert!(reader.window.get_language_popup_note());
    assert!(reader.window.get_source_has_focus());
}

/// A feature the server does not offer is named.
#[test]
fn unsupported_feature_is_named() {
    let fixture = project(&[("main.scripted", TEXT)]);
    let reader = reader(
        &fixture,
        "main.scripted",
        definitions(&[("FEATURES", "hover")], None),
    );
    ready(&reader);
    definition(&reader);
    eventually("the unsupported feature was not named", || {
        return popup(&reader) == "scripted-ls does not offer go to definition.";
    });
}

/// A failed request, here the references Ctrl+B falls back to, is explained with the server's error.
#[test]
fn failed_request_is_explained_with_the_server_error() {
    let fixture = project(&[("main.scripted", TEXT)]);
    let main = address(&fixture.root.join("main.scripted"));
    let answer = format!("[{}]", location(&main, 0, 0, 5));
    let reader = reader(
        &fixture,
        "main.scripted",
        definitions(&[("DEFINITION", &answer)], None),
    );
    ready(&reader);
    definition(&reader);
    eventually("the failure was not explained", || {
        return popup(&reader).starts_with(
            "Find references failed: scripted-ls answered with error -32603: scripted internal failure. Press Ctrl+B",
        );
    });
}

/// An empty answer and a file without a language each get their sentence.
#[test]
fn empty_answer_and_unknown_language_are_explained() {
    let fixture = project(&[
        ("main.scripted", TEXT),
        ("notes.unknownext", "plain notes\n"),
    ]);
    let reader = reader(
        &fixture,
        "main.scripted",
        definitions(&[("DEFINITION", "[]")], None),
    );
    ready(&reader);
    definition(&reader);
    eventually("the empty answer was not explained", || {
        return popup(&reader) == "No definition found.";
    });
    eventually("the tree did not show the files", || {
        return row(&reader.window, "notes.unknownext").is_some();
    });
    reader
        .window
        .invoke_tree_activate(row(&reader.window, "notes.unknownext").expect("notes row"));
    eventually("the notes did not open", || {
        return reader.window.get_source_text() == "plain notes\n";
    });
    definition(&reader);
    eventually("the unknown language was not explained", || {
        return popup(&reader)
            == "No language is recognized for this file, so go to definition is not available here.";
    });
}

/// A hover answer for text a reload replaced is never shown; the reader is told to ask again.
#[test]
fn hover_answer_overtaken_by_a_reload_is_not_shown() {
    let fixture = project(&[("main.scripted", TEXT)]);
    let reader = reader(
        &fixture,
        "main.scripted",
        definitions(&[("HOVER_DELAY_MS", "800")], None),
    );
    ready(&reader);
    caret(&reader, 6);
    hover(&reader);
    idle(100);
    let revision = reader.source.borrow().document.revision();
    fs::write(fixture.root.join("main.scripted"), format!("{TEXT}zeta\n"))
        .expect("external change");
    eventually("the reload did not arrive", || {
        return reader.source.borrow().document.revision() != revision;
    });
    let start = Instant::now();
    while start.elapsed().as_millis() < 1500 {
        idle(10);
        assert!(
            !popup(&reader).starts_with("line="),
            "a hover answer for replaced text was shown"
        );
    }
    assert_eq!(
        popup(&reader),
        "The file changed on disk before the hover information arrived. Press Ctrl+Q again."
    );
}

/// A hover answer for a file that is no longer displayed is never shown.
#[test]
fn hover_answer_overtaken_by_a_file_switch_is_not_shown() {
    let fixture = project(&[("main.scripted", TEXT), ("other.scripted", "other words\n")]);
    let reader = reader(
        &fixture,
        "main.scripted",
        definitions(&[("HOVER_DELAY_MS", "800")], None),
    );
    eventually("the tree did not show the files", || {
        return row(&reader.window, "other.scripted").is_some();
    });
    ready(&reader);
    caret(&reader, 6);
    hover(&reader);
    idle(100);
    reader
        .window
        .invoke_tree_activate(row(&reader.window, "other.scripted").expect("other row"));
    eventually("the file did not switch", || {
        return reader.window.get_source_text() == "other words\n";
    });
    idle(1500);
    assert_eq!(
        popup(&reader),
        "",
        "an answer for the previous file was shown"
    );
}

/// A worker that could not start leaves the window working and explains itself on request.
#[test]
fn unavailable_language_support_is_explained_on_request() {
    let fixture = project(&[("main.scripted", TEXT)]);
    let reader = reader_with(
        &fixture,
        "main.scripted",
        Err(anyhow!("simulated start failure")),
    );
    definition(&reader);
    eventually("the failure was not explained", || {
        return popup(&reader) == "simulated start failure.";
    });
    assert!(reader.window.get_source_has_focus());
}

/// Processes whose parent is this test process and whose name starts with the scripted server's.
fn scripted_children() -> Vec<String> {
    let own = std::process::id().to_string();
    let mut found = Vec::new();
    for entry in fs::read_dir("/proc").expect("process table").flatten() {
        let Ok(stat) = fs::read_to_string(entry.path().join("stat")) else {
            continue;
        };
        // The name is in parentheses; the state and the parent follow the last `)`.
        let (Some(open), Some(close)) = (stat.find('('), stat.rfind(')')) else {
            continue;
        };
        let fields: Vec<&str> = stat[close + 1..].split_whitespace().collect();
        if fields.get(1) == Some(&own.as_str()) && stat[open + 1..close].starts_with("ide-scripted")
        {
            found.push(stat.clone());
        }
    }
    return found;
}

/// Closing while a request waits stops the server within the shutdown bound and leaves no child.
#[test]
fn closing_while_a_request_is_pending_is_orderly() {
    let fixture = project(&[("main.scripted", TEXT)]);
    let mut reader = reader(
        &fixture,
        "main.scripted",
        definitions(&[("HOVER", "silent")], None),
    );
    ready(&reader);
    caret(&reader, 6);
    hover(&reader);
    eventually("the server did not start", || {
        return !scripted_children().is_empty();
    });
    idle(300);
    let binding = reader.binding.take().expect("binding");
    let started = Instant::now();
    binding.close();
    let elapsed = started.elapsed();
    assert!(elapsed.as_secs_f32() < 3.0, "closing took {elapsed:?}");
    assert_eq!(
        scripted_children(),
        Vec::<String>::new(),
        "a server outlived the window"
    );
    reader.window.hide().expect("close the window");
}
