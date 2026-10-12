//! Scroll re-centering of the source tile on the tile worker,
//!  and the window-thread step that swaps a finished tile in.

/// Frame paint inputs and the frame presentation the swap hands over.
use super::render::{Frame, Paint, render, show, stamp_for};
/// The vertical mapping's side of the window: measured rows and keeping the view still.
use super::rows;
/// The tile worker and its result type.
use super::tile_build::{TileBuilt, TileJob, TileWorker};
/// The background measurement of the whole text.
use super::tile_pass::{PassJob, PassKey, PassOutput, TAKE_LIMIT};
/// Parent state, the window, and the viewport's hold rule.
use super::{AppWindow, State, viewport::holds};
/// A wrap width must be a positive number of pixels.
use ide_app::wrap::has_wrap_width;
/// Timer and toolkit-string bridges for the poll and the error message.
use slint::{ComponentHandle, SharedString, TimerMode};
/// Poll period of the worker's reply slot, the same as the other background pollers.
use std::{cell::RefCell, rc::Rc, sync::Arc, time::Duration};

/// What:
///  Position and width of one materialized tile:
///  its first line, its line count, and the wrap width its lines are broken at.
/// Why:
///  The requested tile and the displayed tile are both values of this type,
///  so a result can be checked against the window it was built for.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type TileBounds = { first: number; count: number; width: number };
/// ```
#[derive(Clone, Copy, Debug, PartialEq)]
pub(super) struct TileBounds {
    /// First materialized source line.
    pub(super) first: usize,
    /// Number of materialized source lines.
    pub(super) count: usize,
    /// Wrap width in logical pixels, or zero while the view has no width yet.
    pub(super) width: f32,
}

/// The tile the reader's view needs next, as last placed.
pub(super) fn requested(current: &State) -> TileBounds {
    return TileBounds {
        first: current.first,
        count: current.count,
        width: current.width,
    };
}

/// Forget any tile still wanted: its result, when it arrives, is discarded.
pub(super) fn cancel(current: &mut State) {
    // What: `tile_job` is `None` when no worker result is wanted; `take`-like resets are plain assignments.
    // Why: The result of a cancelled job is dropped by `accepts` instead of being shown.
    current.tile_job = None;
    current.scroll_wanted = None;
    if let Some(worker) = current.tile_worker.as_mut() {
        worker.cancel();
    }
}

/// Queue `job` on the worker, starting the worker and its poll timer on first use.
pub(super) fn submit(
    window: &AppWindow,
    state: &Rc<RefCell<State>>,
    current: &mut State,
    job: TileJob,
) -> anyhow::Result<()> {
    let bounds = job.bounds;
    warm(window, state, current)?;
    // What: `take` moves the worker out so `request` can run without a second borrow of the state.
    // Why: The worker is put back on every path, including a failed request.
    let Some(mut worker) = current.tile_worker.take() else {
        anyhow::bail!(
            "The source tile worker was not started; restart the application to scroll the source"
        );
    };
    let sent = worker.request(job);
    current.tile_worker = Some(worker);
    sent?;
    current.tile_job = Some(bounds);
    start_poll(window, state, current);
    return Ok(());
}

/// Start the tile worker with a shaper forked from the window's own, if none is running.
/// What: The fork shares the font registry the window already scanned, so no font discovery runs on the worker.
/// Why: Starting the worker when the first tile is shown keeps its start-up off the scroll path.
pub(super) fn warm(
    window: &AppWindow,
    state: &Rc<RefCell<State>>,
    current: &mut State,
) -> anyhow::Result<()> {
    if current.tile_worker.is_none() {
        let worker = TileWorker::new(current.shaper.fork())?;
        current.tile_worker = Some(worker);
        start_poll(window, state, current);
    }
    return Ok(());
}

/// Start the repeated poll of the worker's replies unless it is already running.
fn start_poll(window: &AppWindow, state: &Rc<RefCell<State>>, current: &mut State) {
    if current.tile_poll.running() {
        return;
    }
    let weak_window = window.as_weak();
    let weak_state = Rc::downgrade(state);
    // The poll holds weak handles only, so the timer never keeps the window or its state alive.
    current
        .tile_poll
        .start(TimerMode::Repeated, Duration::from_millis(20), move || {
            let (Some(active), Some(shared)) = (weak_window.upgrade(), weak_state.upgrade()) else {
                return;
            };
            poll(&active, &shared);
        });
}

/// What:
///  What the measurements of the window's text at its current scale and wrap width are valid for.
///  A window without a wrap width yet has wrap bits of zero.
/// Why:
///  A finished tile or pass output is used only when its key is this one.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function currentKey(current: State, scale: number): PassKey;
/// ```
pub(super) fn current_key(current: &State, scale: f32) -> PassKey {
    let wrap = if has_wrap_width(current.width) {
        current.width.to_bits()
    } else {
        0
    };
    return PassKey {
        file: current.file_generation,
        revision: current.document.revision(),
        scale: scale.to_bits(),
        wrap,
    };
}

/// What:
///  Ask the worker to measure the whole text at the current wrap width when it has not been asked yet for this
///  text, scale, width, and syntax snapshot.
/// Why:
///  The pass is what makes the scroll extent exact without any frame waiting for it;
///  a resize or a new text starts it again, and lines the worker kept are only broken again.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function syncPass(window: AppWindow, state: Shared<State>, current: State, scale: number): void;
/// ```
pub(super) fn sync_pass(
    window: &AppWindow,
    state: &Rc<RefCell<State>>,
    current: &mut State,
    scale: f32,
) {
    if !has_wrap_width(current.width) {
        return;
    }
    let key = current_key(current, scale);
    // The address of the syntax snapshot tells a new snapshot from the one the pass already used.
    let styles = Arc::as_ptr(&current.styles).cast::<()>() as usize;
    if current.pass_posted == Some((key, styles)) {
        return;
    }
    if let Err(error) = warm(window, state, current) {
        tracing::error!(%error, "source tile worker could not start");
        return;
    }
    let job = PassJob {
        key,
        document: current.document.clone(),
        styles: Arc::clone(&current.styles),
        typography: current.shaper.typography().clone(),
        scale,
        wrap: current.width,
        focus: current.shown.first,
    };
    let Some(worker) = current.tile_worker.as_mut() else {
        return;
    };
    match worker.post_pass(job) {
        Ok(()) => {
            tracing::debug!(wrap = current.width, focus = current.shown.first, "posted the measurement pass");
            current.pass_posted = Some((key, styles));
            start_poll(window, state, current);
        }
        Err(error) => tracing::error!(%error, "source measurement pass request failed"),
    }
}

/// Whether a finished tile still describes what is displayed, wanted, and the current view.
/// Stale inputs are rejected here, so a result from before an edit, a file change, or a theme change is never shown.
/// The tile's own lines must have the heights the map has for them, which `apply` makes so before asking.
fn accepts(current: &State, paint: &Paint, built: &TileBuilt, height: f32) -> bool {
    return current.tile_job.is_some()
        && built.file == current.file_generation
        && built.active == paint.active
        && built.bounds.width == current.width
        && built
            .measured
            .iter()
            .all(|(line, rows)| return current.row_map.rows_of(*line) == *rows)
        && holds(current, built.bounds, current.offset, height)
        && stamp_for(current, built.bounds, paint) == built.stamp;
}

/// Take at most one finished tile from the worker and what the pass measured, and apply them when they are valid.
pub(super) fn poll(window: &AppWindow, state: &Rc<RefCell<State>>) {
    let (polled, pass) = {
        let mut current = state.borrow_mut();
        let Some(mut worker) = current.tile_worker.take() else {
            current.tile_poll.stop();
            return;
        };
        let polled = worker.poll();
        let pass = if polled.is_ok() {
            worker.take_pass(TAKE_LIMIT)
        } else {
            None
        };
        match &polled {
            Ok(_) => current.tile_worker = Some(worker),
            // A stopped worker is dropped here, so its thread is joined; the next re-center starts a fresh one.
            Err(_) => {
                current.tile_job = None;
                current.scroll_wanted = None;
                current.pass_posted = None;
            }
        }
        stop_when_idle(&mut current);
        (polled, pass)
    };
    if let Some(output) = pass {
        apply_pass(window, state, output);
    }
    let reply = match polled {
        Ok(Some(reply)) => reply,
        Ok(None) => return,
        Err(error) => {
            tracing::error!(%error, "source tile worker stopped");
            window.set_error_message(SharedString::from(format!("{error:#}")));
            return;
        }
    };
    apply(window, state, reply);
}

/// What:
///  Apply what the pass measured: the visual rows of lines outside the displayed tile go into the window's table,
///  and the window renders when any count changed.
/// Why:
///  The lines of the displayed tile keep the heights they were painted with;
///  a pass result must never move the rows of the frame on screen.
///  A result for another text, scale, or width is dropped.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function applyPass(window: AppWindow, state: Shared<State>, output: PassOutput): void;
/// ```
fn apply_pass(window: &AppWindow, state: &Rc<RefCell<State>>, output: PassOutput) {
    let factor = window.window().scale_factor();
    let mut current = state.borrow_mut();
    if output.key != current_key(&current, factor) {
        tracing::debug!(lines = output.lines.len(), "dropped a measurement for another text or width");
        return;
    }
    let held = current.shown.first..current.shown.first + current.shown.count;
    let count = output.lines.len();
    let changed = rows::absorb(
        &mut current,
        output
            .lines
            .into_iter()
            .filter(|(line, _)| return !held.contains(line)),
    );
    #[cfg(debug_assertions)]
    {
        current.pass_applied += 1;
        current.pass_lines += count as u64;
        current.pass_most_lines = current.pass_most_lines.max(count);
        current.pass_shaped += output.shaped;
        current.pass_rebroken += output.rebroken;
    }
    tracing::debug!(count, changed, done = output.done, "applied a measurement");
    drop(current);
    if changed {
        render(window, state);
    }
}

/// Stop the poll timer when no re-center is queued and the worker has nothing in flight; `submit` starts it again.
/// What: `Timer::stop` ends the repeated callback; the timer is restarted on the next submission.
/// Why: A cancelled job's reply is still unread while the worker is busy, so the timer must keep polling until it is taken.
fn stop_when_idle(current: &mut State) {
    let in_flight = current
        .tile_worker
        .as_ref()
        .is_some_and(TileWorker::is_busy);
    if current.tile_job.is_none() && !in_flight {
        current.tile_poll.stop();
    }
}

/// Swap a finished tile in, or count it as discarded.
/// A failed build keeps the displayed tile on screen and names the failure, never falling back to a synchronous build.
fn apply(window: &AppWindow, state: &Rc<RefCell<State>>, reply: anyhow::Result<TileBuilt>) {
    let built = match reply {
        Ok(built) => built,
        Err(error) => {
            tracing::error!(%error, "source tile build failed");
            window.set_error_message(SharedString::from(format!(
                "Cannot render source: {error:#}"
            )));
            return;
        }
    };
    let factor = window.window().scale_factor();
    let mut current = state.borrow_mut();
    #[cfg(debug_assertions)]
    {
        current.worker_tiles += 1;
        current.worker_rows_shaped += built.rows_shaped;
    }
    // What: The heights the tile's own lines measured go into the table first, and the map follows them.
    // Why: The tile was painted with those heights; the map must agree before the tile can be shown.
    //      A change above the view moves the offset with it, even while the reader scrolls.
    let height = window.get_viewport_height();
    let view_now = (
        -window.get_scroll_y(),
        window.get_viewport_width(),
        height,
    );
    let mut scrolled = None;
    let mut remapped = false;
    if built.key == current_key(&current, factor) {
        remapped = rows::absorb(&mut current, built.measured.iter().copied());
        // The map follows the table also when an earlier change of it was still waiting for the reader to stop.
        scrolled = rows::settle(&mut current, factor, view_now, true);
        remapped = remapped || scrolled.is_some();
    }
    let paint = Paint::new(window, &current);
    // What: `accepts` is a conjunction of cheap identity checks, and the stamp rebuild only runs when the rest pass.
    // Why: A stale tile is common while scrolling fast, and each rejection must cost almost nothing.
    if !accepts(&current, &paint, &built, height) {
        #[cfg(debug_assertions)]
        {
            current.tiles_discarded += 1;
        }
        if current.tile_job == Some(built.bounds) {
            current.tile_job = None;
        }
        tracing::debug!(first = built.bounds.first, "discarded stale source tile");
        drop(current);
        if remapped {
            // The map moved even though the tile was not shown; the window follows it.
            render(window, state);
        }
        return;
    }
    let bounds = built.bounds;
    let pixels = built.pixels;
    // The map may have moved since the job was queued; the tile's rows move with it, and its own lines did not change.
    let mut view = built.view;
    view.rebase(&current.row_map);
    current.shaped = Some(view);
    current.frame_stamp = Some(built.stamp);
    current.shown = bounds;
    // The requested window now equals what is shown; a newer job still in flight may replace it.
    current.first = bounds.first;
    current.count = bounds.count;
    current.scroll_wanted = None;
    if current.tile_job == Some(bounds) {
        current.tile_job = None;
    }
    #[cfg(debug_assertions)]
    {
        current.tiles_applied += 1;
    }
    drop(current);
    show(
        window,
        state,
        Frame {
            pixels: Some(pixels),
            matches_changed: true,
            scale: factor,
            scrolled,
            anchor_line: window.get_language_anchor_line(),
            notice: None,
            sign: None,
        },
    );
}
