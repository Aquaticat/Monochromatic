//! Search content hits reveal a source line without introducing a go-to-line command or editable source.

/// The existing source renderer and document remain the only geometry and reading-state owners.
use super::{AppWindow, State};
/// Character positions are canonical even when source lines contain multibyte UTF-8 or ligatures.
use ide_app::document::ReadingPosition;
/// Reading-state changes stay on the native event-loop thread.
use std::{cell::RefCell, rc::Rc};

/// Reveal a one-based search line, clamping a now-stale line number to the current source snapshot.
pub(super) fn reveal(window: &AppWindow, source: &Rc<RefCell<State>>, requested: usize) {
    let mut current = source.borrow_mut();
    let line = requested
        .saturating_sub(1)
        .min(current.document.text().len_lines().saturating_sub(1));
    let position = current.document.text().line_to_char(line);
    current.document.select(ReadingPosition {
        anchor: position,
        head: position,
        viewport: position,
    });
    // Release the checked mutable borrow before native scroll callbacks can request another source borrow.
    drop(current);
    window.invoke_reveal_source_line(line as i32);
    let mut scrolled = source.borrow_mut();
    let first = ((-window.get_scroll_y()).max(0.0) / 24.0) as usize;
    scrolled.first = first.saturating_sub(1);
    scrolled.horizontal = 0.0;
    scrolled.frame_stamp = None;
    let mut reading = scrolled.document.position();
    reading.viewport = scrolled
        .document
        .text()
        .line_to_char(first.min(scrolled.document.text().len_lines().saturating_sub(1)));
    scrolled.document.select(reading);
    tracing::debug!(requested, line, "revealed search content line");
}
