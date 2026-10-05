//! Inlay hints and diagnostics enter the window here. The renderer paints only snapshots stamped with the
//! displayed file generation and revision, and only their part inside the materialized rows.
//!
//! Snapshots live in `State::annotations`, an `ide_app::annotation::Annotations`. There are two ways in:
//!
//! - A poll that already holds the state mutably stores each polled snapshot with
//!   `current.annotations.accept_hints(displayed, snapshot)` or `accept_diagnostics(displayed, snapshot)`,
//!   and calls `render` once after releasing the state when either answered `true`.
//!   Accepting draws nothing by itself.
//! - [`set_annotations`] replaces both snapshots at once and renders; tests and the inspection path use it.
//!
//! Either way the render takes the visible part, and the frame stamp repaints the source image only when that
//! part or its inks changed. Reloads and file switches need no call: a held snapshot stops matching the
//! displayed stamp and is no longer painted.

/// The parent's state, its rendering entry point, and the generated marker and box rows.
use super::{
    AppWindow, State, render,
    ui::{SourceMarker, SourceSelection},
};
/// The selection logic, card text, and positioned frame.
use ide_app::annotation::{Annotations, Visible, describe, rank};
/// Annotation inks and the positioned frame the raster paints.
use ide_app::annotation_layout::{AnnotationColors, AnnotationFrame};
/// Snapshot records and the stamp naming the displayed text.
use ide_app::language::{
    diagnostics::DiagnosticsSnapshot, hints::HintsSnapshot, identity::DocumentStamp,
};
/// Window property access.
use slint::SharedString;
/// What: `Rc<RefCell<State>>` is the UI thread's shared source state; `Arc` is the shared snapshot pointer.
/// Why: The Language module hands snapshots out as `Arc`; the window state is single-threaded.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Shared<T> = { current: T };
/// ```
use std::{cell::RefCell, rc::Rc, sync::Arc};

/// What: At most this many problems are listed in the caret card; `usize` is the count type (siblings `u32`, `u64`).
/// Why: A pathological pile of diagnostics at one character must not produce a card taller than the window.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const CARD_PROBLEMS = 8;
/// ```
const CARD_PROBLEMS: usize = 8;

/// What: Replace both snapshots at once and render; `Option<Arc<...>>` is a shared snapshot or nothing.
///       Snapshots for another file generation or revision are kept but never painted.
/// Why: Tests and the inspection path install a complete set in one call. Handing back the same snapshots
///      does nothing; a change repaints only when the visible annotations differ, which the frame stamp decides.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function setAnnotations(window: AppWindow, state: Shared<State>,
///   hints?: HintsSnapshot, diagnostics?: DiagnosticsSnapshot): void;
/// ```
pub(super) fn set_annotations(
    window: &AppWindow,
    state: &Rc<RefCell<State>>,
    hints: Option<Arc<HintsSnapshot>>,
    diagnostics: Option<Arc<DiagnosticsSnapshot>>,
) {
    let mut current = state.borrow_mut();
    if current.annotations.holds(&hints, &diagnostics) {
        return;
    }
    // What: `as_ref().map(...)` reads a field of the snapshot when there is one; `?stamp` logs the debug form.
    // Why: Which text a snapshot names explains why it is or is not painted.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // logger.debug('annotation snapshots installed', { hints: hints?.stamp, diagnostics: diagnostics?.stamp });
    // ```
    let hint_stamp = hints.as_ref().map(|snapshot| return snapshot.stamp);
    let diagnostic_stamp = diagnostics.as_ref().map(|snapshot| return snapshot.stamp);
    tracing::debug!(
        hints = ?hint_stamp,
        diagnostics = ?diagnostic_stamp,
        displayed = ?displayed(&current),
        "annotation snapshots installed"
    );
    current.annotations = Annotations::new(hints, diagnostics);
    drop(current);
    render(window, state);
}

/// The stamp of the text the window displays: its file generation and content revision.
pub(super) fn displayed(current: &State) -> DocumentStamp {
    return DocumentStamp {
        file: current.file_generation,
        revision: current.document.revision(),
    };
}

/// Convert a toolkit color to raster bytes without losing alpha.
fn rgba(color: slint::Color) -> [u8; 4] {
    return [color.red(), color.green(), color.blue(), color.alpha()];
}

/// Annotation inks of the current scheme, read from the window so markers and raster agree.
pub(super) fn colors(window: &AppWindow) -> AnnotationColors {
    return AnnotationColors {
        hint: rgba(window.get_hint_ink().color()),
        error: rgba(window.get_error_ink()),
        warning: rgba(window.get_warning_ink()),
        information: rgba(window.get_information_ink()),
        suggestion: rgba(window.get_suggestion_ink()),
    };
}

/// What: The annotations of the materialized rows, or nothing for stale snapshots; `Arc` lets the frame stamp
///       and the layout share one list.
/// Why: Computed on every render with two binary searches, so an unchanged visible part reuses the image.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function visible(current: State): Visible;
/// ```
pub(super) fn visible(current: &State) -> Arc<Visible> {
    let last = current.first.saturating_add(current.count);
    let shown = current.annotations.visible(
        displayed(current),
        current.document.text(),
        current.first,
        last,
    );
    return Arc::new(shown);
}

/// What: Marker and hint-box rows for the window, from one positioned frame; the pair is (markers, boxes).
/// Why: Markers and boxes change only together with the frame, like find rectangles.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function rows(frame: AnnotationFrame): [SourceMarker[], SourceSelection[]];
/// ```
pub(super) fn rows(frame: &AnnotationFrame) -> (Vec<SourceMarker>, Vec<SourceSelection>) {
    let mut markers = Vec::new();
    for marker in &frame.markers {
        markers.push(SourceMarker {
            x: marker.x,
            y: marker.row as f32 * 24.0,
            // `i32::from` widens the byte rank to the toolkit's integer.
            severity: i32::from(rank(marker.severity)),
        });
    }
    let mut boxes = Vec::new();
    for hint in &frame.hints {
        boxes.push(SourceSelection {
            x: hint.x,
            y: hint.row as f32 * 24.0,
            width: hint.width,
            height: 24.0,
        });
    }
    return (markers, boxes);
}

/// What: The caret card's text and the worst severity at the caret; empty text means no card.
/// Why: Every render recomputes it, because any caret movement can enter or leave a range.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function card(current: State): [string, number];
/// ```
pub(super) fn card(current: &State) -> (String, i32) {
    let head = current.document.position().head;
    let problems = current.annotations.at(displayed(current), head);
    let mut lines = Vec::new();
    for problem in problems.iter().take(CARD_PROBLEMS) {
        lines.push(describe(problem));
    }
    if problems.len() > CARD_PROBLEMS {
        lines.push(format!("{} more", problems.len() - CARD_PROBLEMS));
    }
    // What: `first()` is the worst problem or nothing; `map_or` reads its rank or answers zero.
    // Why: The card's stripe uses the worst severity's ink.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const worst = problems[0] ? rank(problems[0].mark.severity) : 0;
    // ```
    let worst = problems
        .first()
        .map_or(0, |problem| return i32::from(rank(problem.mark.severity)));
    return (lines.join("\n"), worst);
}

/// Show the caret card text and severity; an unchanged text leaves the toolkit property alone.
pub(super) fn present_card(window: &AppWindow, text: String, severity: i32) {
    let shared = SharedString::from(text);
    if window.get_caret_problems() != shared {
        window.set_caret_problems(shared);
    }
    window.set_caret_problem_severity(severity);
}

/// What: Right edge of the furthest annotation in logical pixels, or zero without a frame.
/// Why: The scroll range must reach labels after the widest line.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function extent(frame?: AnnotationFrame): number;
/// ```
pub(super) fn extent(frame: Option<&AnnotationFrame>) -> f32 {
    // A line with only a marker reaches the marker's right edge, which the frame's extent includes.
    return frame.map_or(0.0, |positioned| return positioned.extent);
}
