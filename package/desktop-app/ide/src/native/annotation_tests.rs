//! Injected hint and diagnostic snapshots through real key and pointer events: reading geometry, copying,
//! and find rectangles are unchanged, the caret card follows the caret, and stale snapshots disappear.

/// The production setter and the stamp of the displayed text.
use super::annotate::{displayed, set_annotations};
/// Anchor and head of the reading selection.
use super::caret_tests::position;
/// The complete reader fixture and its key helpers.
use super::find_tests::{Reader, chord, eventually, key, reader, status_for, type_text};
/// Bounded waits and tree-row lookup shared with the navigation tests.
use super::navigation_tests::{row, wait_until};
/// The production window.
use super::{AppWindow, render};
/// Snapshot records exactly as the Language module builds them.
use ide_app::language::{
    diagnostics::{Diagnostic, DiagnosticsSnapshot, Freshness, Severity, SourceGroup},
    hints::{HintKind, HintsSnapshot, InlayHint},
    identity::{DocumentStamp, ServerIdentity},
};
/// What: Window events as a seat delivers them, and a point in logical window pixels.
/// Why: Presses and keys go through the real `TouchArea`, `FocusScope`, and callbacks.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { LogicalPosition, Model, PointerEventButton, WindowEvent, Key } from 'slint';
/// ```
use slint::{
    ComponentHandle, LogicalPosition, Model,
    platform::{Key, PointerEventButton, WindowEvent},
};
/// Disposable fixtures and shared snapshot pointers.
use std::{fs, sync::Arc};

/// Source text starts right of the 256 px tree, its 48 px divider cell, and the 56 px line-number gutter.
pub(super) const TEXT_LEFT: f32 = 360.0;
/// Source rows start below the 32 px file label.
pub(super) const TEXT_TOP: f32 = 32.0;

/// Three lines: a call with hints and an error, a line with a tab, CJK, a combining mark, and a ligature,
/// and a last line; the last terminator ends the text.
pub(super) const FIXTURE: &str =
    "let total = area(2, 3);\n\tlet 猫 = e\u{301} != x;\nfn main() {}\n";

/// The process every injected record names.
fn server() -> ServerIdentity {
    return ServerIdentity {
        name: "scripted".to_string(),
        instance: 1,
    };
}

/// One diagnostic of `severity` over `start..end`.
pub(super) fn problem(
    start: usize,
    end: usize,
    severity: Severity,
    code: &str,
    message: &str,
) -> Diagnostic {
    return Diagnostic {
        start,
        end,
        severity: Some(severity),
        code: Some(code.to_string()),
        message: message.to_string(),
        server: server(),
        freshness: Freshness::Versioned,
    };
}

/// One hint at `position`.
pub(super) fn hint(position: usize, label: &str) -> InlayHint {
    return InlayHint {
        position,
        label: label.to_string(),
        kind: Some(HintKind::Type),
        padding_left: false,
        padding_right: true,
        server: server(),
    };
}

/// What: The fixture's snapshots for `stamp`: hints after `total`, before `2`, and after `猫`; an error over the
///       call, a warning on `猫`, a hint over `!=`, a warning from `x` onto the next line, and a point at the
///       end of the last line. The pair is (hints, diagnostics).
/// Why: Every test injects the same realistic mix of overlapping, multi-line, CJK, and point ranges.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function snapshots(stamp: DocumentStamp): [HintsSnapshot, DiagnosticsSnapshot];
/// ```
pub(super) fn snapshots(
    stamp: DocumentStamp,
) -> (Option<Arc<HintsSnapshot>>, Option<Arc<DiagnosticsSnapshot>>) {
    // Line starts: 0, 24, 42, 55. Line 1: tab(24) l e t space 猫(29) space =(31) space e(33) U+0301 space !(36) =(37) space x(39) ;(40).
    let hints = HintsSnapshot {
        stamp,
        first_line: 0,
        last_line: 4,
        hints: vec![hint(9, ": u32"), hint(17, "width:"), hint(30, ": char")],
    };
    let rustc = SourceGroup {
        source: "rustc".to_string(),
        items: vec![
            problem(
                12,
                22,
                Severity::Error,
                "E0308",
                "mismatched types\nexpected `u32`, found `&str`",
            ),
            problem(29, 30, Severity::Warning, "W1", "unused variable `猫`"),
            problem(36, 38, Severity::Hint, "H1", "consider `==`"),
            problem(39, 44, Severity::Warning, "W2", "statement continues"),
        ],
    };
    let analyzer = SourceGroup {
        source: "rust-analyzer".to_string(),
        items: vec![problem(
            54,
            54,
            Severity::Information,
            "I1",
            "missing trailing comment",
        )],
    };
    let diagnostics = DiagnosticsSnapshot {
        stamp,
        groups: vec![analyzer, rustc],
    };
    return (Some(Arc::new(hints)), Some(Arc::new(diagnostics)));
}

/// Install the fixture's snapshots for the text the reader displays now.
pub(super) fn annotate(reader: &Reader) {
    let stamp = displayed(&reader.source.borrow());
    let (hints, diagnostics) = snapshots(stamp);
    set_annotations(&reader.window, &reader.source, hints, diagnostics);
}

/// Window point over source row `row`, `x` logical pixels into the text, in the middle of the line.
fn point(window: &AppWindow, line: usize, x: f32) -> LogicalPosition {
    return LogicalPosition::new(
        TEXT_LEFT + x + window.get_scroll_x(),
        TEXT_TOP + line as f32 * 24.0 + 12.0 + window.get_scroll_y(),
    );
}

/// One complete left click at a window point.
fn click(window: &AppWindow, position: LogicalPosition) {
    window.window().dispatch_event(WindowEvent::PointerPressed {
        position,
        button: PointerEventButton::Left,
    });
    window
        .window()
        .dispatch_event(WindowEvent::PointerReleased {
            position,
            button: PointerEventButton::Left,
        });
}

/// What: Drive one fixed script of clicks, double clicks, keys, copying, and find, recording every resulting
///       selection, copied text, and find rectangle as text; `Vec<String>` is the ordered record.
/// Why: The same script on a reader with annotations and one without must produce the same record.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function script(reader: Reader): string[];
/// ```
fn script(reader: &Reader) -> Vec<String> {
    let window = &reader.window;
    let mut record = Vec::new();
    // Rows alternate, so no two consecutive clicks form a double click; 600 px is past every line, over the hints.
    for x in [0.0, 4.0, 13.0, 37.5, 61.0, 120.0, 205.0, 260.0, 600.0] {
        for line in [0, 1, 2] {
            click(window, point(window, line, x));
            record.push(format!("click {line} {x}: {:?}", position(reader)));
        }
    }
    // Double clicks on a word, on CJK, on the ligature, and on a hint label after the text.
    for (line, x) in [(1, 30.0), (1, 52.0), (1, 135.0), (0, 600.0)] {
        click(window, point(window, 2, 1.0));
        click(window, point(window, line, x));
        click(window, point(window, line, x));
        record.push(format!("double {line} {x}: {:?}", position(reader)));
    }
    chord(window, Key::Control, Key::Home);
    for step in 0..30 {
        key(window, Key::RightArrow);
        record.push(format!("right {step}: {:?}", position(reader)));
    }
    for name in ["down", "up", "end", "down", "home", "word"] {
        if name == "down" {
            key(window, Key::DownArrow);
        } else if name == "up" {
            key(window, Key::UpArrow);
        } else if name == "end" {
            key(window, Key::End);
        } else if name == "home" {
            key(window, Key::Home);
        } else {
            chord(window, Key::Control, Key::RightArrow);
        }
        record.push(format!("{name}: {:?}", position(reader)));
    }
    // Shift+End selects to the line end; the copied text is the toolkit's clipboard source.
    window.window().dispatch_event(WindowEvent::KeyPressed {
        text: Key::Shift.into(),
    });
    key(window, Key::End);
    window.window().dispatch_event(WindowEvent::KeyReleased {
        text: Key::Shift.into(),
    });
    record.push(format!("copy: {:?}", window.get_selected_text()));
    chord(window, Key::Control, "a");
    record.push(format!("copy all: {:?}", window.get_selected_text()));
    chord(window, Key::Control, "f");
    type_text(window, "e");
    status_for(window, "e", "1/4");
    let matches = window.get_source_matches();
    for index in 0..matches.row_count() {
        let rect = matches.row_data(index).expect("match rectangle");
        record.push(format!(
            "match {}: {} {} {} {}",
            index, rect.x, rect.y, rect.width, rect.height
        ));
    }
    key(window, Key::Escape);
    return record;
}

/// Caret placement, clicks on hints, word selection, keys, copying, and find rectangles are the same with
/// annotations as without them.
#[test]
fn annotations_leave_reading_geometry_copy_and_find_unchanged() {
    let plain_fixture = tempfile::tempdir().expect("disposable plain project");
    fs::write(plain_fixture.path().join("main.rs"), FIXTURE).expect("plain fixture");
    let plain = reader(plain_fixture.path(), "main.rs");
    let annotated_fixture = tempfile::tempdir().expect("disposable annotated project");
    fs::write(annotated_fixture.path().join("main.rs"), FIXTURE).expect("annotated fixture");
    let annotated = reader(annotated_fixture.path(), "main.rs");
    annotate(&annotated);
    assert!(
        annotated.window.get_source_markers().row_count() >= 3,
        "the injected diagnostics were not marked (positive control)"
    );
    assert_eq!(annotated.window.get_hint_boxes().row_count(), 3);
    let expected = script(&plain);
    let actual = script(&annotated);
    for (before, after) in expected.iter().zip(actual.iter()) {
        assert_eq!(before, after, "annotations changed a reading result");
    }
    assert_eq!(expected.len(), actual.len());
    // A click on a hint label after line 0, or past it, lands on that line's end, as any click past the text does.
    assert!(actual.contains(&"click 0 260: (23, 23)".to_string()));
    assert!(actual.contains(&"click 0 600: (23, 23)".to_string()));
    let copied = actual
        .iter()
        .find(|line| return line.starts_with("copy all"));
    assert_eq!(
        copied,
        Some(&format!("copy all: {FIXTURE:?}")),
        "copying included hint text"
    );
}

/// The caret card lists the problems at the caret, worst first, in words; it is empty elsewhere and follows
/// the caret into a CJK range and onto a point at a line end.
#[test]
fn caret_card_follows_the_caret_and_spells_out_the_problems() {
    let fixture = tempfile::tempdir().expect("disposable card project");
    fs::write(fixture.path().join("main.rs"), FIXTURE).expect("card fixture");
    let reader = reader(fixture.path(), "main.rs");
    let window = &reader.window;
    annotate(&reader);
    chord(window, Key::Control, Key::Home);
    assert_eq!(window.get_caret_problems(), "");
    assert!(!window.get_problem_card_visible());
    for _ in 0..12 {
        key(window, Key::RightArrow);
    }
    assert_eq!(position(&reader), (12, 12));
    assert_eq!(
        window.get_caret_problems(),
        "Error E0308 (rustc): mismatched types\nexpected `u32`, found `&str`"
    );
    assert_eq!(window.get_caret_problem_severity(), 0);
    assert!(
        window.get_problem_card_visible(),
        "the card is not shown with source focus"
    );
    key(window, Key::End);
    assert_eq!(
        window.get_caret_problems(),
        "",
        "the card stayed after leaving the range"
    );
    key(window, Key::DownArrow);
    key(window, Key::Home);
    for _ in 0..5 {
        key(window, Key::RightArrow);
    }
    assert_eq!(position(&reader), (29, 29));
    assert_eq!(
        window.get_caret_problems(),
        "Warning W1 (rustc): unused variable `猫`"
    );
    assert_eq!(window.get_caret_problem_severity(), 1);
    key(window, Key::DownArrow);
    key(window, Key::End);
    assert_eq!(position(&reader), (54, 54));
    assert_eq!(
        window.get_caret_problems(),
        "Information I1 (rust-analyzer): missing trailing comment"
    );
    // Focus elsewhere hides the card; the text stays for the source view's accessible description.
    window.invoke_focus_tree();
    assert!(!window.get_problem_card_visible());
}

/// After an external change and after a file switch, the old snapshots paint nothing and show no card until
/// snapshots for the new text arrive.
#[test]
fn stale_snapshots_disappear_after_reload_and_file_switch() {
    let fixture = tempfile::tempdir().expect("disposable stale project");
    let path = fixture.path().join("main.rs");
    fs::write(&path, FIXTURE).expect("stale fixture");
    fs::write(fixture.path().join("other.rs"), "fn other() {}\n").expect("second fixture");
    let reader = reader(fixture.path(), "main.rs");
    let window = &reader.window;
    annotate(&reader);
    for _ in 0..12 {
        key(window, Key::RightArrow);
    }
    assert!(window.get_source_markers().row_count() > 0);
    assert_ne!(window.get_caret_problems(), "");
    let revision = reader.source.borrow().document.revision();
    fs::write(&path, format!("// changed\n{FIXTURE}")).expect("external change");
    eventually("the external change was not reloaded", || {
        return reader.source.borrow().document.revision() > revision;
    });
    assert_eq!(
        window.get_source_markers().row_count(),
        0,
        "stale markers were painted after reload"
    );
    assert_eq!(
        window.get_hint_boxes().row_count(),
        0,
        "stale hints were painted after reload"
    );
    assert_eq!(
        window.get_caret_problems(),
        "",
        "a stale card was shown after reload"
    );
    annotate(&reader);
    assert!(
        window.get_source_markers().row_count() > 0,
        "current snapshots were not painted"
    );
    wait_until(|| return row(window, "other.rs").is_some());
    let generation = reader.source.borrow().file_generation;
    window.invoke_tree_activate(row(window, "other.rs").expect("second file row"));
    wait_until(|| return reader.source.borrow().file_generation > generation);
    assert_eq!(
        window.get_source_markers().row_count(),
        0,
        "markers of the previous file were painted"
    );
    assert_eq!(
        window.get_hint_boxes().row_count(),
        0,
        "hints of the previous file were painted"
    );
}

/// The Language poll's path: snapshots accepted into the state's store, hints and diagnostics independently,
/// show after one render, and a snapshot for other text is refused and changes nothing.
#[test]
fn accepted_snapshots_show_after_one_render() {
    let fixture = tempfile::tempdir().expect("disposable accept project");
    fs::write(fixture.path().join("main.rs"), FIXTURE).expect("accept fixture");
    let reader = reader(fixture.path(), "main.rs");
    let window = &reader.window;
    let stamp = displayed(&reader.source.borrow());
    let (hints, diagnostics) = snapshots(stamp);
    let stale = DocumentStamp {
        file: stamp.file,
        revision: stamp.revision + 1,
    };
    let (stale_hints, stale_diagnostics) = snapshots(stale);
    // What: `borrow_mut` lends the state for writing, as the poll holds it while accepting.
    // Why: The store's answer tells the poll whether a render is needed.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const accepted = state.current.annotations.acceptHints(stamp, hints);
    // ```
    let refused = reader
        .source
        .borrow_mut()
        .annotations
        .accept_hints(stamp, stale_hints.expect("stale hints"));
    assert!(!refused, "hints for another revision were accepted");
    let accepted_hints = reader
        .source
        .borrow_mut()
        .annotations
        .accept_hints(stamp, hints.expect("hints"));
    assert!(accepted_hints);
    assert_eq!(
        window.get_hint_boxes().row_count(),
        0,
        "accepting must not draw before the render the poll requests"
    );
    render(window, &reader.source);
    assert_eq!(
        window.get_hint_boxes().row_count(),
        3,
        "accepted hints were not drawn"
    );
    assert_eq!(window.get_source_markers().row_count(), 0);
    let accepted_diagnostics = reader
        .source
        .borrow_mut()
        .annotations
        .accept_diagnostics(stamp, diagnostics.expect("diagnostics"));
    assert!(accepted_diagnostics);
    render(window, &reader.source);
    assert!(
        window.get_source_markers().row_count() >= 3,
        "accepted diagnostics were not drawn"
    );
    assert_eq!(
        window.get_hint_boxes().row_count(),
        3,
        "accepting diagnostics dropped the hints"
    );
    let late = reader
        .source
        .borrow_mut()
        .annotations
        .accept_diagnostics(stamp, stale_diagnostics.expect("stale diagnostics"));
    assert!(!late, "diagnostics for another revision were accepted");
    render(window, &reader.source);
    assert!(
        window.get_source_markers().row_count() >= 3,
        "a refused snapshot removed the marks"
    );
}
