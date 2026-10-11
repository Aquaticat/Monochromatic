//! Scroll re-centering of the source tile on the tile worker,
//!  and the window-thread step that swaps a finished tile in.

/// Frame paint inputs and the frame presentation the swap hands over.
use super::render::{Frame, Paint, show, stamp_for};
/// The tile worker and its result type.
use super::tile_build::{TileBuilt, TileJob, TileWorker};
/// Parent state, the window, and the viewport's hold rule.
use super::{AppWindow, State, viewport::holds};
/// Timer and toolkit-string bridges for the poll and the error message.
use slint::{ComponentHandle, SharedString, TimerMode};
/// Poll period of the worker's reply slot, the same as the other background pollers.
use std::{cell::RefCell, rc::Rc, time::Duration};

/// What:
///  Position and width of one materialized tile:
///  its first line, its line count, its horizontal origin, and the visible width.
/// Why:
///  The requested tile and the displayed tile are both values of this type,
///  so a result can be checked against the window it was built for.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type TileBounds = { first: number; count: number; horizontal: number; width: number };
/// ```
#[derive(Clone, Copy, Debug, PartialEq)]
pub(super) struct TileBounds {
    /// First materialized source line.
    pub(super) first: usize,
    /// Number of materialized source lines.
    pub(super) count: usize,
    /// Horizontal tile origin.
    pub(super) horizontal: f32,
    /// Logical width of the visible code area.
    pub(super) width: f32,
}

/// The tile the reader's view needs next, as last placed.
pub(super) fn requested(current: &State) -> TileBounds {
    return TileBounds {
        first: current.first,
        count: current.count,
        horizontal: current.horizontal,
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
        anyhow::bail!("The source tile worker was not started; restart the application to scroll the source");
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
            let (Some(active), Some(shared)) = (weak_window.upgrade(), weak_state.upgrade())
            else {
                return;
            };
            poll(&active, &shared);
        });
}

/// Whether a finished tile still describes what is displayed, wanted, and the current view.
/// Stale inputs are rejected here, so a result from before an edit, a file change, or a theme change is never shown.
fn accepts(current: &State, paint: &Paint, built: &TileBuilt, height: f32) -> bool {
    return current.tile_job.is_some()
        && built.file == current.file_generation
        && built.view.map == current.row_map
        && built.active == paint.active
        && holds(current, built.bounds, current.offset, height)
        && stamp_for(current, built.bounds, paint) == built.stamp;
}

/// Take at most one finished tile from the worker and swap it in when it is still valid.
pub(super) fn poll(window: &AppWindow, state: &Rc<RefCell<State>>) {
    let polled = {
        let mut current = state.borrow_mut();
        let Some(mut worker) = current.tile_worker.take() else {
            current.tile_poll.stop();
            return;
        };
        let polled = worker.poll();
        match &polled {
            Ok(_) => current.tile_worker = Some(worker),
            // A stopped worker is dropped here, so its thread is joined; the next re-center starts a fresh one.
            Err(_) => {
                current.tile_job = None;
                current.scroll_wanted = None;
            }
        }
        stop_when_idle(&mut current);
        polled
    };
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

/// Stop the poll timer when no re-center is queued and the worker has nothing in flight; `submit` starts it again.
/// What: `Timer::stop` ends the repeated callback; the timer is restarted on the next submission.
/// Why: A cancelled job's reply is still unread while the worker is busy, so the timer must keep polling until it is taken.
fn stop_when_idle(current: &mut State) {
    let in_flight = current.tile_worker.as_ref().is_some_and(TileWorker::is_busy);
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
    let paint = Paint::new(window, &current);
    let height = window.get_viewport_height();
    #[cfg(debug_assertions)]
    {
        current.worker_tiles += 1;
        current.worker_rows_shaped += built.rows_shaped;
    }
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
        return;
    }
    let bounds = built.bounds;
    let pixels = built.pixels;
    current.shaped = Some(built.view);
    current.frame_stamp = Some(built.stamp);
    current.shown = bounds;
    // The requested window now equals what is shown; a newer job still in flight may replace it.
    current.first = bounds.first;
    current.count = bounds.count;
    current.horizontal = bounds.horizontal;
    current.width = bounds.width;
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
            scrolled: None,
            anchor_line: window.get_language_anchor_line(),
            notice: None,
        },
    );
}
