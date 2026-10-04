//! Apply background disk updates without suspending selection or blocking source input.

/// What: Borrow UI-thread state while the worker only receives owned snapshots.
/// Why: Filesystem reads and diff computation must never hold the UI RefCell borrow.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { state, render } from '../native';
/// ```
use super::{AppWindow, State, render};
/// Background replies retain the file generation and source base revision.
use ide_app::reload_worker::{ReloadReply, ReloadWorker};
/// Reset source classifications without mutating a snapshot shared with the previous frame.
use ide_app::source_style::SourceStyles;
/// Timer callbacks and weak window references belong to the toolkit event loop.
use slint::{ComponentHandle, Timer, TimerMode};
/// Rc/RefCell stay UI-local; Instant schedules reads without changing wall-clock state.
use std::{cell::RefCell, rc::Rc, time::{Duration, Instant}};
/// Worker creation failure must surface rather than silently disabling external refresh.
use anyhow::Result;

/// Record a changed read diagnostic while retaining the last readable source.
fn read_failed(window: &AppWindow, state: &Rc<RefCell<State>>, message: String) {
    let mut current = state.borrow_mut();
    if current.file_error.as_ref() == Some(&message) { return; }
    tracing::warn!(%message, "source refresh failed; retaining displayed text");
    current.file_error = Some(message);
    drop(current);
    render(window, state);
}

/// Install a matching file/revision result using the current caret and selection.
fn apply(window: &AppWindow, state: &Rc<RefCell<State>>, reply: ReloadReply) {
    if reply.generation != state.borrow().file_generation {
        tracing::debug!(generation = reply.generation, "discarding reload for a previously displayed file");
        return;
    }
    let update = match reply.result {
        Ok(update) => update,
        Err(error) => {
            read_failed(window, state, format!("{error:#}. Showing the last readable source. Restore a readable UTF-8 file at this path or open another file."));
            return;
        }
    };
    let fractional_row = (-window.get_scroll_y()).max(0.0) % 24.0;
    let mut current = state.borrow_mut();
    let recovered = current.file_error.is_some();
    let Some(reload) = update else {
        current.file_error = None;
        drop(current);
        if recovered { render(window, state); }
        return;
    };
    if !current.document.apply_reload(reload) { return; }
    current.file_error = None;
    let position = current.document.position();
    let first = current.document.text().char_to_line(position.viewport);
    let lines = current.document.text().len_lines();
    current.first = first.saturating_sub(1);
    current.document_width = 0.0;
    current.styles = SourceStyles::from([]);
    drop(current);
    // Update extent before the offset so the old document height cannot clamp a mapped viewport.
    window.set_total_lines(lines as i32);
    window.set_scroll_y(-(first as f32 * 24.0 + fractional_row));
    render(window, state);
}

/// Poll completed work on the UI thread; schedule disk reads at 250 ms intervals.
/// The returned timer owns the worker and must remain alive until the window closes.
pub(super) fn bind(window: &AppWindow, shared: &Rc<RefCell<State>>) -> Result<Timer> {
    let mut worker = ReloadWorker::new()?;
    let state = Rc::clone(shared);
    let weak = window.as_weak();
    // What: None represents no submitted request yet, rather than a fabricated timestamp.
    // Why: The first poll checks disk immediately, then applies the configured interval.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let lastRequest: number | undefined;
    // ```
    let mut last_request: Option<Instant> = None;
    let timer = Timer::default();
    timer.start(TimerMode::Repeated, Duration::from_millis(20), move || {
        let Some(active_window) = weak.upgrade() else { return; };
        match worker.try_take() {
            Ok(Some(reply)) => { apply(&active_window, &state, reply); }
            Ok(None) => {}
            Err(error) => {
                read_failed(&active_window, &state, format!("{error:#}"));
                return;
            }
        }
        if let Some(last) = last_request {
            if last.elapsed() < Duration::from_millis(250) { return; }
        }
        let current = state.borrow();
        let Some(path) = &current.file_path else { return; };
        let requested = worker.request(path.clone(), current.document.clone(), current.file_generation);
        drop(current);
        match requested {
            Ok(true) => { last_request = Some(Instant::now()); }
            Ok(false) => {}
            Err(error) => { read_failed(&active_window, &state, format!("{error:#}")); }
        }
    });
    return Ok(timer);
}
