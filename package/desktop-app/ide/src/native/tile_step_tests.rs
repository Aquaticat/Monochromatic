//! A finished tile is swapped in by the frame of the next scroll step.
//!  A scroll draws a frame at every step of the input,
//!  and the setters that swap a tile in ask the toolkit for a frame of their own,
//!  so a tile taken between two steps is a second frame in that step's time:
//!  the compositor shows the frames after it a step later,
//!  and the text does not move for one tick.
//!  When no step is due,
//!  the poll of the tile worker takes the tile,
//!  or the old tile would stay on screen.
//! Nothing here waits on the window thread:
//! every wait advances timers and lets the worker answer.

/// The disposable document,
/// the window on it,
/// and the scroll helpers.
use super::overscan_tile_tests::{START, document, open, reset, scroll_to, settle_tile};
/// The window and its state.
use super::{AppWindow, State};
/// Toolkit events.
use slint::{ComponentHandle, platform::update_timers_and_animations};
/// Shared state and its cell,
/// and the clocks.
use std::{
    cell::RefCell,
    rc::Rc,
    time::{Duration, Instant},
};

/// Longest wait for the tile worker to answer one re-center;
/// the host can be under heavy load.
const PATIENCE: Duration = Duration::from_secs(10);

/// A time that no test outlives,
/// so a step stays due for the whole test.
const FOR_GOOD: Duration = Duration::from_secs(3600);

/// A little longer than the poll period of the tile worker,
/// so every wait of the first test lets the poll fire.
const POLL_AND_MORE: Duration = Duration::from_millis(30);

/// Tiles swapped in since the last reset.
fn tiles_applied(state: &Rc<RefCell<State>>) -> u64 {
    return state.borrow().tiles_applied;
}

/// Open a window,
/// settle its first tile,
/// and scroll out of that tile,
/// so the worker builds another;
/// return the offset the window is at.
fn leave_the_tile(window: &AppWindow, state: &Rc<RefCell<State>>) -> f32 {
    let height = window.get_viewport_height();
    scroll_to(window, START);
    settle_tile(state);
    reset(state);
    let target = START + height;
    scroll_to(window, target);
    return target;
}

/// Advance timers for `time`.
fn let_the_timers_run(time: Duration) {
    let until = Instant::now() + time;
    while Instant::now() < until {
        update_timers_and_animations();
        std::thread::sleep(Duration::from_millis(2));
    }
}

/// A tile that finishes while the next scroll step is due is not taken by the poll,
/// and the step takes it:
/// the setters that swap it in run in the step's own frame.
#[test]
fn a_tile_that_finishes_between_two_steps_is_left_for_the_next_step() {
    let (window, state) = open(&document());
    let mut offset = leave_the_tile(&window, &state);
    let start = Instant::now();
    loop {
        // The last step is recent for the whole test, so the poll must leave a finished tile alone.
        state.borrow_mut().stepped_at = Some(Instant::now() + FOR_GOOD);
        let_the_timers_run(POLL_AND_MORE);
        assert_eq!(
            tiles_applied(&state),
            0,
            "the poll took a tile although the next scroll step was due"
        );
        offset += 0.25;
        scroll_to(&window, offset);
        if tiles_applied(&state) > 0 {
            break;
        }
        assert!(
            start.elapsed() < PATIENCE,
            "no scroll step took the finished tile within {PATIENCE:?}"
        );
    }
    assert_eq!(
        tiles_applied(&state),
        1,
        "the step must take exactly the one tile"
    );
    window.hide().expect("close tile step window");
}

/// A tile that finishes after the last step,
/// with no step coming,
/// is taken by the poll once the wait for a step has passed:
/// the old tile does not stay on screen.
#[test]
fn a_tile_that_finishes_with_no_step_due_is_taken_by_the_poll() {
    let (window, state) = open(&document());
    let _offset = leave_the_tile(&window, &state);
    settle_tile(&state);
    assert_eq!(
        tiles_applied(&state),
        1,
        "the poll did not take the tile when no step came"
    );
    window.hide().expect("close tile step window");
}
