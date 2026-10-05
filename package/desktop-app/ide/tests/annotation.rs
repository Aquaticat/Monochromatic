//! Which hints and diagnostics a frame paints: stale snapshots paint nothing, windows are bounded to the
//! materialized rows, multi-line ranges above a window are found, and the caret card lists the worst first.

/// What: Helix's rope and the shared-ownership pointer the Language module hands snapshots out in.
/// Why: Windows are computed from the displayed text's line starts.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Rope } from 'helix-core';
/// ```
use helix_core::Rope;
/// The production selection logic and the Language module's snapshot records.
use ide_app::{
    annotation::{Annotations, Mark, describe},
    language::{
        diagnostics::{Diagnostic, DiagnosticsSnapshot, Freshness, Severity, SourceGroup},
        hints::{HintKind, HintsSnapshot, InlayHint},
        identity::{DocumentStamp, ServerIdentity},
    },
};
/// Snapshots are shared values.
use std::sync::Arc;

/// The displayed text every test uses: five lines, the third empty, the last without a terminator.
const TEXT: &str = "let a = 1;\nlet bb = 22;\n\nfn main() {\n}";

/// The stamp of the displayed text.
const SHOWN: DocumentStamp = DocumentStamp {
    file: 3,
    revision: 7,
};

/// The process every test record names.
fn server() -> ServerIdentity {
    return ServerIdentity {
        name: "scripted".to_string(),
        instance: 1,
    };
}

/// One hint at `position` with `label`.
fn hint(position: usize, label: &str) -> InlayHint {
    return InlayHint {
        position,
        label: label.to_string(),
        kind: Some(HintKind::Type),
        padding_left: true,
        padding_right: false,
        server: server(),
    };
}

/// What: One diagnostic over `start..end`; `Option<Severity>` lets a test omit the severity.
/// Why: Records are built exactly as the Language module builds them.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function problem(start: number, end: number, severity: Severity | undefined, message: string): Diagnostic;
/// ```
fn problem(start: usize, end: usize, severity: Option<Severity>, message: &str) -> Diagnostic {
    return Diagnostic {
        start,
        end,
        severity,
        code: None,
        message: message.to_string(),
        server: server(),
        freshness: Freshness::Versioned,
    };
}

/// Shared hint snapshot for `stamp`.
fn hints(stamp: DocumentStamp, items: Vec<InlayHint>) -> Option<Arc<HintsSnapshot>> {
    return Some(Arc::new(HintsSnapshot {
        stamp,
        first_line: 0,
        last_line: 5,
        hints: items,
    }));
}

/// Shared diagnostics snapshot for `stamp` with one group per `(source, items)` pair.
fn diagnostics(
    stamp: DocumentStamp,
    groups: Vec<(&str, Vec<Diagnostic>)>,
) -> Option<Arc<DiagnosticsSnapshot>> {
    let mut built = Vec::new();
    for (source, items) in groups {
        built.push(SourceGroup {
            source: source.to_string(),
            items,
        });
    }
    return Some(Arc::new(DiagnosticsSnapshot {
        stamp,
        groups: built,
    }));
}

/// A snapshot for another file generation or another revision paints nothing and shows no card.
#[test]
fn stale_snapshots_paint_nothing_and_show_no_card() {
    let text = Rope::from(TEXT);
    for stamp in [
        DocumentStamp {
            file: 2,
            revision: 7,
        },
        DocumentStamp {
            file: 3,
            revision: 6,
        },
        DocumentStamp {
            file: 3,
            revision: 8,
        },
    ] {
        let annotations = Annotations::new(
            hints(stamp, vec![hint(5, ": i32")]),
            diagnostics(stamp, vec![("rustc", vec![problem(4, 5, None, "unused")])]),
        );
        let shown = annotations.visible(SHOWN, &text, 0, 5);
        assert!(
            shown.labels.is_empty(),
            "a stale hint was painted: {stamp:?}"
        );
        assert!(
            shown.marks.is_empty(),
            "a stale mark was painted: {stamp:?}"
        );
        assert!(annotations.at(SHOWN, 4).is_empty());
    }
    let current = Annotations::new(
        hints(SHOWN, vec![hint(5, ": i32")]),
        diagnostics(SHOWN, vec![("rustc", vec![problem(4, 5, None, "unused")])]),
    );
    let shown = current.visible(SHOWN, &text, 0, 5);
    assert_eq!(shown.labels.len(), 1);
    assert_eq!(shown.marks.len(), 1);
}

/// Hints are taken for the window's rows only, a hint at a line end stays on its line, the end of the text
/// belongs to the last line, labels lose their padding spaces, and blank labels are dropped.
#[test]
fn hint_window_follows_rows_and_line_ends() {
    let text = Rope::from(TEXT);
    // Line starts: 0, 11, 24, 25, 37; the text has 38 characters.
    let annotations = Annotations::new(
        hints(
            SHOWN,
            vec![
                hint(5, " : i32 "),
                hint(10, "end-of-line-0"),
                hint(11, "start-of-line-1"),
                hint(24, "   "),
                hint(38, "end-of-text"),
            ],
        ),
        None,
    );
    let first = annotations.visible(SHOWN, &text, 0, 1);
    let texts: Vec<&str> = first
        .labels
        .iter()
        .map(|label| return label.text.as_str())
        .collect();
    assert_eq!(texts, [": i32", "end-of-line-0"]);
    let middle = annotations.visible(SHOWN, &text, 1, 3);
    let texts: Vec<&str> = middle
        .labels
        .iter()
        .map(|label| return label.text.as_str())
        .collect();
    assert_eq!(texts, ["start-of-line-1"]);
    let last = annotations.visible(SHOWN, &text, 4, 5);
    assert_eq!(last.labels.len(), 1);
    assert_eq!(last.labels[0].position, 38);
    assert!(annotations.visible(SHOWN, &text, 5, 9).labels.is_empty());
}

/// A range starting above the window is found through the reach index; ranges ending before it are not;
/// groups of several sources merge into one start order.
#[test]
fn diagnostic_window_finds_ranges_starting_above_it() {
    let text = Rope::from(TEXT);
    let annotations = Annotations::new(
        None,
        diagnostics(
            SHOWN,
            vec![
                (
                    "rustc",
                    vec![
                        problem(0, 3, Some(Severity::Error), "early"),
                        problem(4, 30, Some(Severity::Warning), "long"),
                    ],
                ),
                ("clippy", vec![problem(2, 6, Some(Severity::Hint), "short")]),
            ],
        ),
    );
    // Rows 3 and 4 start at character 25; only the long range reaches them.
    let below = annotations.visible(SHOWN, &text, 3, 5);
    assert_eq!(
        below.marks,
        [Mark {
            start: 4,
            end: 30,
            severity: Severity::Warning,
        }]
    );
    let top = annotations.visible(SHOWN, &text, 0, 1);
    let starts: Vec<usize> = top.marks.iter().map(|mark| return mark.start).collect();
    assert_eq!(starts, [0, 2, 4]);
}

/// The caret card lists every range touching the caret, ends included, worst first;
/// an omitted severity is a warning and a point range is found at its position.
#[test]
fn caret_problems_include_range_ends_and_order_by_severity() {
    let annotations = Annotations::new(
        None,
        diagnostics(
            SHOWN,
            vec![
                (
                    "rustc",
                    vec![
                        problem(4, 9, Some(Severity::Hint), "suggestion"),
                        problem(6, 9, None, "no severity"),
                        problem(9, 9, Some(Severity::Error), "point"),
                    ],
                ),
                (
                    "other",
                    vec![problem(12, 14, Some(Severity::Error), "elsewhere")],
                ),
            ],
        ),
    );
    let at_end: Vec<&str> = annotations
        .at(SHOWN, 9)
        .iter()
        .map(|item| return item.message.as_str())
        .collect();
    assert_eq!(at_end, ["point", "no severity", "suggestion"]);
    assert_eq!(annotations.at(SHOWN, 6)[0].mark.severity, Severity::Warning);
    let at_start: Vec<&str> = annotations
        .at(SHOWN, 4)
        .iter()
        .map(|item| return item.message.as_str())
        .collect();
    assert_eq!(at_start, ["suggestion"]);
    assert!(annotations.at(SHOWN, 10).is_empty());
    assert!(annotations.at(SHOWN, 3).is_empty());
}

/// The card names the severity in words, then the code and source, then the trimmed message.
#[test]
fn card_text_spells_out_severity_code_and_source() {
    let mut coded = problem(
        0,
        1,
        Some(Severity::Error),
        "mismatched types\nexpected `u32`\n",
    );
    coded.code = Some("E0308".to_string());
    let annotations = Annotations::new(
        None,
        diagnostics(
            SHOWN,
            vec![
                ("rustc", vec![coded]),
                (
                    "",
                    vec![problem(2, 3, Some(Severity::Information), "plain")],
                ),
            ],
        ),
    );
    assert_eq!(
        describe(annotations.at(SHOWN, 0)[0]),
        "Error E0308 (rustc): mismatched types\nexpected `u32`"
    );
    assert_eq!(describe(annotations.at(SHOWN, 2)[0]), "Information: plain");
}

/// Handing back the same shared snapshots is recognized, so a poll does not rebuild the index.
#[test]
fn identical_snapshots_are_recognized_by_identity() {
    let hint_snapshot = hints(SHOWN, vec![hint(5, ": i32")]);
    let problem_snapshot = diagnostics(SHOWN, vec![("rustc", vec![problem(4, 5, None, "x")])]);
    // `clone` on an `Option<Arc<...>>` copies the pointer, not the snapshot.
    let annotations = Annotations::new(hint_snapshot.clone(), problem_snapshot.clone());
    assert!(annotations.holds(&hint_snapshot, &problem_snapshot));
    let equal_copy = hints(SHOWN, vec![hint(5, ": i32")]);
    assert!(!annotations.holds(&equal_copy, &problem_snapshot));
    assert!(!annotations.holds(&None, &problem_snapshot));
    assert!(Annotations::default().holds(&None, &None));
}
