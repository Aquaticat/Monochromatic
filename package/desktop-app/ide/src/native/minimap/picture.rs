//! Taking in the finished pictures:
//!  polling the worker's replies,
//!  and setting on the window each one that is still valid for the displayed text.

/// The reply type of the worker.
use crate::native::minimap_build::Reply;
/// The window,
///  its state,
///  and the displayed text's stamp.
use crate::native::{AppWindow, State, annotate::displayed};
/// Toolkit images,
///  weak handles,
///  and the timers.
use slint::{ComponentHandle, Image, TimerMode};
/// Shared state and its cell,
///  and the poll period.
use std::{cell::RefCell, rc::Rc, time::Duration};

/// Poll period of the worker's replies,
/// the same as the other background pollers.
const POLL: Duration = Duration::from_millis(20);

/// What:
///  Set a finished picture on the window when it is for the displayed text and not older than the one on screen;
///  otherwise count it as dropped.
///  This is the window thread's whole cost of a picture:
/// one comparison and one image setter.
/// Why:
///  A picture of an older text,
/// or of an older request,
/// must never replace a newer one.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function apply(window: AppWindow, state: Shared<State>, reply: Reply): void;
/// ```
pub(in crate::native) fn apply(window: &AppWindow, state: &Rc<RefCell<State>>, reply: Reply) {
    let mut current = state.borrow_mut();
    if reply.id == current.minimap.awaited && reply.last {
        current.minimap.awaited = 0;
    }
    let fresh = reply.id >= current.minimap.shown_id && reply.key.stamp == displayed(&current);
    if !fresh {
        #[cfg(debug_assertions)]
        {
            current.minimap.dropped += 1;
        }
        tracing::debug!(id = reply.id, "dropped a stale minimap picture");
        return;
    }
    current.minimap.shown_id = reply.id;
    current.minimap.shown = Some(reply.key);
    #[cfg(debug_assertions)]
    {
        current.minimap.images_set += 1;
        current.minimap.last_stats = Some(reply.stats);
    }
    drop(current);
    window.set_minimap_image(Image::from_rgba8_premultiplied(reply.pixels));
    tracing::debug!(
        id = reply.id,
        last = reply.last,
        elapsed_us = reply.elapsed.as_micros() as u64,
        "set a minimap picture"
    );
}

/// Take in the finished pictures:
/// each one that is still valid for the displayed text is set on the window.
fn poll(window: &AppWindow, state: &Rc<RefCell<State>>) {
    let replies = {
        let mut current = state.borrow_mut();
        let Some(worker) = current.minimap.worker.as_mut() else {
            current.minimap.poll.stop();
            return;
        };
        match worker.poll() {
            Ok(replies) => replies,
            Err(error) => {
                tracing::error!(%error, "minimap worker stopped");
                current.minimap.worker = None;
                current.minimap.posted = None;
                current.minimap.awaited = 0;
                current.minimap.poll.stop();
                return;
            }
        }
    };
    for reply in replies {
        apply(window, state, reply);
    }
    let current = state.borrow_mut();
    if current.minimap.awaited == 0 {
        current.minimap.poll.stop();
    }
}

/// Start the repeated poll of the worker's replies unless it is already running.
pub(super) fn start_poll(window: &AppWindow, state: &Rc<RefCell<State>>, current: &mut State) {
    if current.minimap.poll.running() {
        return;
    }
    let weak_window = window.as_weak();
    let weak_state = Rc::downgrade(state);
    // The poll holds weak handles only, so the timer never keeps the window or its state alive.
    current
        .minimap
        .poll
        .start(TimerMode::Repeated, POLL, move || {
            let (Some(active), Some(shared)) = (weak_window.upgrade(), weak_state.upgrade()) else {
                return;
            };
            poll(&active, &shared);
        });
}
