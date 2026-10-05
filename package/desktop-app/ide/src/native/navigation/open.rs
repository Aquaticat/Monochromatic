//! File-open success is the only boundary that replaces displayed source or promotes history.

/// Native source state and tree presentation share one event-loop thread.
use super::{AppWindow, Navigation, State, line, present};
/// Reuse the same revision-aware classification application as external reloads.
use crate::native::{reload::apply_syntax, render};
/// Identity exhaustion reports an error rather than reusing an obsolete file generation.
use anyhow::{Context, Result};
/// New source documents arrive only after successful project-boundary resolution and reading.
use ide_app::{file_open::OpenedFile, source_style::SourceStyles};
/// File context remains a display-only native-path label.
use slint::SharedString;
/// Shared source state never crosses the background-reader thread.
use std::{cell::RefCell, path::PathBuf, rc::Rc};

/// Keep the current document and viewport when reopening its existing canonical target.
pub(super) fn request(
    window: &AppWindow,
    source: &Rc<RefCell<State>>,
    navigation: &mut Navigation,
    path: PathBuf,
) -> Result<()> {
    return request_at(window, source, navigation, path, None);
}

/// A content result's line stays attached to the newest request, including contained canonical aliases.
pub(super) fn request_at(
    window: &AppWindow,
    source: &Rc<RefCell<State>>,
    navigation: &mut Navigation,
    path: PathBuf,
    target_line: Option<usize>,
) -> Result<()> {
    navigation.pending_line = None;
    if source.borrow().file_path.as_ref() == Some(&path) {
        navigation.opener.cancel()?;
        navigation.reveal = Some(path);
        source.borrow_mut().navigation_error = None;
        present::update(window, source, navigation);
        if let Some(target) = target_line {
            line::reveal(window, source, target);
        }
        render(window, source);
        if !window.get_search_open() {
            window.invoke_focus_source();
        }
        return Ok(());
    }
    navigation.opener.request(path)?;
    navigation.pending_line = target_line;
    // A new intent clears the previous open diagnostic, not the old document or its own refresh errors.
    source.borrow_mut().navigation_error = None;
    render(window, source);
    return Ok(());
}

/// Read failures do not replace readable source or promote a failed path into history.
pub(super) fn failed(window: &AppWindow, source: &Rc<RefCell<State>>, message: String) {
    tracing::warn!(%message, "project source open failed; retaining displayed source");
    source.borrow_mut().navigation_error = Some(message);
    render(window, source);
}

/// Install a successful different file, invalidating all source-specific frame and accessibility caches.
pub(super) fn apply(
    window: &AppWindow,
    source: &Rc<RefCell<State>>,
    navigation: &mut Navigation,
    opened: OpenedFile,
) -> Result<()> {
    // Own the resolved identity for history/reveal after the document moves into its native owner.
    let path = opened.path;
    let mut current = source.borrow_mut();
    let changed = current.file_path.as_ref() != Some(&path);
    if changed {
        let generation = current
            .file_generation
            .checked_add(1)
            .context("Displayed-file identity exhausted; restart the application")?;
        current.document = opened.document;
        current.file_path = Some(path.clone());
        current.file_generation = generation;
        current.file_error = None;
        current.syntax_error = None;
        current.syntax_revision = None;
        current.styles = SourceStyles::from([]);
        current.first = 0;
        current.horizontal = 0.0;
        current.document_width = 0.0;
        current.shaped = None;
        current.frame_stamp = None;
        current.presented_revision = None;
        if let Some(syntax) = opened.syntax {
            apply_syntax(&mut current, syntax);
        }
    }
    current.navigation_error = None;
    let lines = current.document.text().len_lines();
    drop(current);
    // Promote only successful opens; canonical aliases share the existing history slot.
    navigation.recent.opened(path.clone());
    navigation.reveal = Some(path.clone());
    window.set_file_label(SharedString::from(path.display().to_string()));
    window.set_source_available(true);
    if changed {
        window.set_total_lines(lines as i32);
        window.invoke_reset_source_scroll();
    }
    if let Some(target) = navigation.pending_line.take() {
        line::reveal(window, source, target);
    }
    render(window, source);
    present::update(window, source, navigation);
    if !window.get_search_open() {
        window.invoke_focus_source();
    }
    tracing::info!(path = %path.display(), changed, "project source open presented");
    return Ok(());
}
