//! Record shapes from helix-lsp's format strings at the pinned revision, near misses that keep
//! their level, and the re-labelled record as the application's subscriber writes it.

use super::{RELABEL, Shape, shape};
use std::{
    io::{self, Write},
    sync::{Arc, Mutex},
};
use tracing_log::log::{self, Log};
use tracing_subscriber::fmt::MakeWriter;

const TRANSPORT: &str = "helix_lsp::transport";

#[derive(Clone, Default)]
struct Capture(Arc<Mutex<Vec<u8>>>);

impl Write for Capture {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.0.lock().expect("capture").extend_from_slice(bytes);
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

/// Send one `log` record with this target, level, and text through the bridge, under a subscriber
/// with `filter`, and return what the subscriber wrote.
fn written(filter: &str, target: &str, level: log::Level, text: &str) -> String {
    let capture = Capture::default();
    let subscriber = tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_ansi(false)
        .with_writer(capture.clone())
        .finish();
    tracing::subscriber::with_default(subscriber, || {
        RELABEL.log(
            &log::Record::builder()
                .args(format_args!("{text}"))
                .level(level)
                .target(target)
                .module_path(Some(target))
                .file(Some("helix-lsp/src/transport.rs"))
                .line(Some(168))
                .build(),
        );
    });
    return String::from_utf8(capture.0.lock().expect("capture").clone()).expect("text");
}

#[test]
fn a_server_stderr_line_is_recognized() {
    assert_eq!(
        shape(TRANSPORT, log::Level::Error, r#"typescript-native err <- "context canceled\n""#),
        Some(Shape::ServerStderrLine)
    );
    assert_eq!(
        shape(
            TRANSPORT,
            log::Level::Error,
            r#"rust-analyzer err <- "2026-10-05T17:08:48  WARN notify error: No path was found.\n""#
        ),
        Some(Shape::ServerStderrLine)
    );
}

#[test]
fn the_end_of_server_stderr_is_recognized() {
    assert_eq!(
        shape(TRANSPORT, log::Level::Error, "rust-analyzer err: <- StreamClosed"),
        Some(Shape::EndOfServerStderr)
    );
}

#[test]
fn moot_error_answers_are_recognized() {
    assert_eq!(
        shape(TRANSPORT, log::Level::Error, "rust-analyzer <- ServerError(-32801): content modified"),
        Some(Shape::MootAnswer)
    );
    assert_eq!(
        shape(TRANSPORT, log::Level::Error, "scripted-ls <- ServerError(-32800): request cancelled"),
        Some(Shape::MootAnswer)
    );
}

#[test]
fn other_error_records_keep_their_level() {
    let kept = [
        // An error answer that is a real request failure.
        (TRANSPORT, "scripted-ls <- InternalError: scripted initialize failure"),
        (TRANSPORT, "scripted-ls <- ServerError(-32803): request failed"),
        // A failure to read or write a server's streams.
        (TRANSPORT, "rust-analyzer err: <- IO(Os { code: 32, kind: BrokenPipe, message: \"Broken pipe\" })"),
        (TRANSPORT, "Exiting rust-analyzer after unexpected error: Parse(\"bad header\")"),
        (TRANSPORT, "Could not close request on a closed channel (id=Num(3))"),
        // The same text without a server name in front.
        (TRANSPORT, " err: <- StreamClosed"),
        (TRANSPORT, " err <- \"line\""),
        (TRANSPORT, " <- ServerError(-32801): content modified"),
        // A quoted line that is cut off is not the stderr shape.
        (TRANSPORT, "scripted-ls err <- \"unterminated"),
        // Another helix-lsp module.
        ("helix_lsp", "failed to initialize language server: scripted initialize failure"),
        ("helix_lsp", "scripted-ls err <- \"line\""),
    ];
    for (target, text) in kept {
        assert_eq!(shape(target, log::Level::Error, text), None, "{target}: {text}");
    }
    // A record that is not at ERROR is never touched, whatever its text.
    assert_eq!(shape(TRANSPORT, log::Level::Warn, "scripted-ls err: <- StreamClosed"), None);
}

#[test]
fn each_shape_has_its_level() {
    assert_eq!(Shape::ServerStderrLine.level(), log::Level::Info);
    assert_eq!(Shape::EndOfServerStderr.level(), log::Level::Debug);
    assert_eq!(Shape::MootAnswer.level(), log::Level::Debug);
}

#[test]
fn a_relabelled_record_keeps_its_target_and_text() {
    let text = r#"typescript-native err <- "context canceled\n""#;
    let line = written("helix_lsp=debug", TRANSPORT, log::Level::Error, text);
    assert!(
        line.ends_with(&format!(" INFO helix_lsp::transport: {text}\n")),
        "{line}"
    );
    let line = written("helix_lsp=debug", TRANSPORT, log::Level::Error, "scripted-ls err: <- StreamClosed");
    assert!(
        line.ends_with(" DEBUG helix_lsp::transport: scripted-ls err: <- StreamClosed\n"),
        "{line}"
    );
}

#[test]
fn a_relabelled_record_is_filtered_at_its_new_level() {
    let text = "scripted-ls err: <- StreamClosed";
    assert_eq!(written("warn", TRANSPORT, log::Level::Error, text), "");
    assert_eq!(written("helix_lsp=info", TRANSPORT, log::Level::Error, text), "");
    assert!(!written("helix_lsp=debug", TRANSPORT, log::Level::Error, text).is_empty());
}

#[test]
fn an_unknown_error_record_stays_error() {
    let text = "rust-analyzer err: <- IO(Os { code: 32, kind: BrokenPipe, message: \"Broken pipe\" })";
    let line = written("warn", TRANSPORT, log::Level::Error, text);
    assert!(
        line.ends_with(&format!(" ERROR helix_lsp::transport: {text}\n")),
        "{line}"
    );
    let line = written("warn", "helix_lsp", log::Level::Error, "failed to initialize language server: refused");
    assert!(
        line.ends_with(" ERROR helix_lsp: failed to initialize language server: refused\n"),
        "{line}"
    );
}

#[test]
fn records_at_other_levels_pass_through_unchanged() {
    let line = written("helix_lsp=info", TRANSPORT, log::Level::Info, "scripted-ls -> {\"jsonrpc\":\"2.0\"}");
    assert!(
        line.ends_with(" INFO helix_lsp::transport: scripted-ls -> {\"jsonrpc\":\"2.0\"}\n"),
        "{line}"
    );
}
