//! The window's side of the minimap, the scroll control beside the source text.
//!
//! The picture of the whole text is built on the minimap worker thread (`minimap_build.rs`); this module posts a
//!  request when what the picture is valid for changes, takes in the finished pixels with one image setter,
//!  and turns a press, a drag, and a page step into scroll offsets with `ide_app::minimap::Geometry`.
//! The viewport box is not touched here: the markup places it from the scroll offset alone, so a scroll step costs
//!  this module nothing.

/// The worker, its request and reply types, and the key a picture is valid for.
use super::minimap_build::{Job, Key, MinimapWorker, Reply};
/// The caret from a pixel position, and the mapping of lines to pixels.
use super::{
    AppWindow, State,
    annotate::displayed,
    input::pointer_position,
    render::{code_colors, render},
    rows, viewport,
};
/// Reading position sides.
use ide_app::document::ReadingAffinity;
/// The geometry of the minimap and the width of a column.
use ide_app::minimap::{Geometry, column_advance};
/// One code row, the unit of the vertical mapping.
use ide_app::row_map::CODE_ROW;
/// The work a line costs to shape, which bounds a click on a very long line.
use ide_app::shaped_text::line_work;
/// A wrap width must be a positive number of pixels.
use ide_app::wrap::has_wrap_width;
/// Toolkit images, weak handles, and the timers.
use slint::{ComponentHandle, Image, Timer, TimerMode};
use std::{cell::RefCell, rc::Rc, sync::Arc, time::Duration};

/// What:
///  Quiet time after the last change of what the picture is valid for before a new request is posted.
/// Why:
///  The measurement of the whole text changes the vertical mapping every few milliseconds while a file opens,
///  and a resize drag changes the size at every step; one request after the changes stop is all the picture needs.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const DEBOUNCE_MS = 120;
/// ```
const DEBOUNCE: Duration = Duration::from_millis(120);

/// Poll period of the worker's replies, the same as the other background pollers.
const POLL: Duration = Duration::from_millis(20);

/// What:
///  Where a drag of the viewport box started: the pointer's distance from the top of the minimap and the scroll
///  offset at that moment.
/// Why:
///  The box follows the pointer one to one from where it was grabbed.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Drag = { startY: number; startOffset: number };
/// ```
#[derive(Clone, Copy)]
struct Drag {
    /// Pointer distance from the top of the minimap at the press.
    start_y: f32,
    /// Scroll offset at the press, or after the jump the press made.
    start_offset: f32,
}

/// What:
///  Everything the window keeps for the minimap besides the picture, which the toolkit holds.
/// Why:
///  One value in the state, so the minimap adds a single field there.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type MinimapState = { size: [number, number]; worker?: Worker; posted?: Key; shown?: Key; drag?: Drag };
/// ```
pub(super) struct MinimapState {
    /// Logical width and height of the minimap column, as the markup last reported them; zero before the layout.
    pub(super) size: (f32, f32),
    /// The worker thread, started with the first request.
    worker: Option<MinimapWorker>,
    /// Polls the worker's replies while one is awaited.
    poll: Timer,
    /// Posts a request after the quiet time.
    debounce: Timer,
    /// What the newest request was for.
    pub(super) posted: Option<Key>,
    /// What the picture on screen is valid for.
    pub(super) shown: Option<Key>,
    /// Number of the last request posted.
    next_id: u64,
    /// Number of the request whose picture is on screen.
    shown_id: u64,
    /// Number of the request whose final picture is awaited, or zero.
    awaited: u64,
    /// The drag in progress.
    drag: Option<Drag>,
    /// Requests posted, counted in debug builds for the structural tests.
    #[cfg(debug_assertions)]
    pub(super) posts: u64,
    /// Pictures set on the window, counted in debug builds.
    #[cfg(debug_assertions)]
    pub(super) images_set: u64,
    /// Finished pictures dropped as stale, counted in debug builds.
    #[cfg(debug_assertions)]
    pub(super) dropped: u64,
    /// The cost of the picture on screen, kept in debug builds.
    #[cfg(debug_assertions)]
    pub(super) last_stats: Option<ide_app::minimap::Stats>,
}

/// A minimap that has built nothing yet.
impl MinimapState {
    /// The state of a window before its first layout.
    pub(super) fn new() -> Self {
        return Self {
            size: (0.0, 0.0),
            worker: None,
            poll: Timer::default(),
            debounce: Timer::default(),
            posted: None,
            shown: None,
            next_id: 0,
            shown_id: 0,
            awaited: 0,
            drag: None,
            #[cfg(debug_assertions)]
            posts: 0,
            #[cfg(debug_assertions)]
            images_set: 0,
            #[cfg(debug_assertions)]
            dropped: 0,
            #[cfg(debug_assertions)]
            last_stats: None,
        };
    }
}

/// What:
///  What a picture made now would be valid for, or nothing while the minimap has no size.
/// Why:
///  A request is posted only when this differs from the last one; it holds no scroll offset, so a scroll step
///  never changes it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function keyOf(window: AppWindow, current: State): Key | undefined;
/// ```
fn key_of(window: &AppWindow, current: &State) -> Option<Key> {
    let (width, height) = current.minimap.size;
    if width < 1.0 || height < 1.0 {
        return None;
    }
    return Some(Key {
        stamp: displayed(current),
        styles: Arc::as_ptr(&current.styles).cast::<()>() as usize,
        rows: current.row_key,
        wrap: if has_wrap_width(current.width) {
            current.width.to_bits()
        } else {
            0
        },
        colors: code_colors(window),
        scale: window.window().scale_factor().to_bits(),
        size: (width.to_bits(), height.to_bits()),
    });
}

/// Start the repeated poll of the worker's replies unless it is already running.
fn start_poll(window: &AppWindow, state: &Rc<RefCell<State>>, current: &mut State) {
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

/// Post a request for the picture `key` describes, starting the worker on first use.
fn post(window: &AppWindow, state: &Rc<RefCell<State>>, current: &mut State, key: Key) {
    if current.minimap.worker.is_none() {
        match MinimapWorker::new(current.shaper.fork()) {
            Ok(worker) => current.minimap.worker = Some(worker),
            Err(error) => {
                tracing::error!(%error, "minimap worker could not start");
                return;
            }
        }
    }
    current.minimap.next_id += 1;
    let id = current.minimap.next_id;
    let job = Job {
        id,
        key,
        document: current.document.clone(),
        styles: Arc::clone(&current.styles),
        typography: current.shaper.typography().clone(),
        map: current.row_map.clone(),
        colors: key.colors,
        wrap: has_wrap_width(current.width).then_some(current.width),
        scale: window.window().scale_factor(),
        size: current.minimap.size,
    };
    let Some(worker) = current.minimap.worker.as_mut() else {
        return;
    };
    if let Err(error) = worker.post(job) {
        tracing::error!(%error, "minimap request failed");
        current.minimap.worker = None;
        current.minimap.posted = None;
        return;
    }
    current.minimap.posted = Some(key);
    current.minimap.awaited = id;
    #[cfg(debug_assertions)]
    {
        current.minimap.posts += 1;
    }
    tracing::debug!(
        id,
        lines = current.row_map.lines(),
        height = current.row_map.height(),
        "posted a minimap request"
    );
    start_poll(window, state, current);
}

/// Post the request that is due now, if what the picture is valid for changed since the last one.
fn flush(window: &AppWindow, state: &Rc<RefCell<State>>) {
    let mut current = state.borrow_mut();
    let Some(key) = key_of(window, &current) else {
        return;
    };
    if current.minimap.posted == Some(key) {
        return;
    }
    post(window, state, &mut current, key);
}

/// What:
///  Called after every render and when the minimap is resized:
///  post a request at once for the first picture of a file and for a new palette or scale,
///  and after the quiet time for every other change.
///  A step that changes nothing the picture depends on costs a comparison of a few words.
/// Why:
///  The picture follows the text, the syntax classes, the wrap width, the vertical mapping, and the size;
///  the scroll offset is none of them, because the viewport box moves in the markup.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function note(window: AppWindow, state: Shared<State>): void;
/// ```
pub(super) fn note(window: &AppWindow, state: &Rc<RefCell<State>>) {
    let mut current = state.borrow_mut();
    let Some(key) = key_of(window, &current) else {
        return;
    };
    if current.minimap.posted == Some(key) {
        return;
    }
    // Another file, a new palette, or a new scale: the picture on screen is wrong, not just old.
    let at_once = current.minimap.posted.is_none_or(|previous| {
        return previous.stamp.file != key.stamp.file
            || previous.colors != key.colors
            || previous.scale != key.scale;
    });
    if current
        .minimap
        .shown
        .is_some_and(|shown| return shown.stamp.file != key.stamp.file)
    {
        current.minimap.shown = None;
        drop(current);
        window.set_minimap_image(Image::default());
        let mut again = state.borrow_mut();
        again.minimap.debounce.stop();
        post(window, state, &mut again, key);
        return;
    }
    if at_once {
        current.minimap.debounce.stop();
        post(window, state, &mut current, key);
        return;
    }
    let weak_window = window.as_weak();
    let weak_state = Rc::downgrade(state);
    current
        .minimap
        .debounce
        .start(TimerMode::SingleShot, DEBOUNCE, move || {
            let (Some(active), Some(shared)) = (weak_window.upgrade(), weak_state.upgrade()) else {
                return;
            };
            flush(&active, &shared);
        });
}

/// Take in the finished pictures: each one that is still valid for the displayed text is set on the window.
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

/// What:
///  Set a finished picture on the window when it is for the displayed text and not older than the one on screen;
///  otherwise count it as dropped.
///  This is the window thread's whole cost of a picture: one comparison and one image setter.
/// Why:
///  A picture of an older text, or of an older request, must never replace a newer one.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function apply(window: AppWindow, state: Shared<State>, reply: Reply): void;
/// ```
fn apply(window: &AppWindow, state: &Rc<RefCell<State>>, reply: Reply) {
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

/// What:
///  Scroll the view to `offset`, held to the scroll range, on the window thread's synchronous path:
///  the tile for the new place is built before the next frame, as for a caret key or a revealed range.
/// Why:
///  A drag of the box over a long text moves the view by several view heights at a step; a tile built by the
///  worker would be out of date when it arrived, and the text would stay blank while the pointer moved.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function scrollTo(window: AppWindow, state: Shared<State>, offset: number): void;
/// ```
fn scroll_to(window: &AppWindow, state: &Rc<RefCell<State>>, offset: f32) {
    let height = window.get_viewport_height();
    let width = window.get_viewport_width();
    let before = -window.get_scroll_y();
    let mut current = state.borrow_mut();
    let wanted = offset
        .clamp(0.0, rows::limit(&current.row_map, height))
        .round();
    if wanted == before {
        return;
    }
    viewport::place(&mut current, wanted, width, height);
    drop(current);
    window.set_scroll_y(-wanted);
    render(window, state);
}

/// What:
///  A press outside the viewport box: move the caret to the visual row under the pointer and the column under it
///  (one column for each pixel), extend the selection from the old caret when Shift is held,
///  and scroll that row to the middle of the view. The answer is the scroll offset it took.
/// Why:
///  CodeGlance Pro's defaults (`jumpOnMouseDown = MOUSE_DOWN`, `clickType = CODE_POSITION`, `moveOnly = false`):
///  the caret goes to the clicked position, which is then centered, and a Shift press selects up to it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function jump(window: AppWindow, state: Shared<State>, y: number, x: number, shift: boolean): number;
/// ```
fn jump(window: &AppWindow, state: &Rc<RefCell<State>>, y: f32, x: f32, shift: bool) -> f32 {
    let height = window.get_viewport_height();
    let width = window.get_viewport_width();
    let scale = window.window().scale_factor();
    let mut current = state.borrow_mut();
    let geometry = Geometry::new(current.row_map.height(), height);
    let target = geometry.target(&current.row_map, y);
    let top = current.row_map.code_top(target.line) + target.row as f32 * CODE_ROW;
    let advance = column_advance(&mut current.shaper, scale);
    // A line too long to shape within a click's allowance puts the caret at its start.
    let (hit, side) = if line_work(&current.document, target.line) == usize::MAX {
        (
            current.document.text().line_to_char(target.line),
            ReadingAffinity::Downstream,
        )
    } else {
        pointer_position(
            &mut current,
            target.line,
            (x.max(0.0).floor() * advance, top + CODE_ROW / 2.0),
            scale,
        )
    };
    let mut position = current.document.position();
    position.head = hit;
    if !shift {
        position.anchor = hit;
    }
    position.affinity = side;
    current.document.select(position);
    let offset = geometry
        .centered(top + CODE_ROW / 2.0)
        .clamp(0.0, rows::limit(&current.row_map, height))
        .round();
    tracing::debug!(
        line = target.line,
        row = target.row,
        y,
        x,
        shift,
        offset,
        "minimap press jumped"
    );
    viewport::place(&mut current, offset, width, height);
    drop(current);
    window.set_scroll_y(-offset);
    render(window, state);
    return offset;
}

/// Bind the minimap's pointer, drag, step, and size callbacks.
pub(super) fn bind(window: &AppWindow, shared: &Rc<RefCell<State>>) {
    let press_state = Rc::clone(shared);
    let press_window = window.as_weak();
    window.on_minimap_press(move |y, x, shift, inside| {
        let Some(active) = press_window.upgrade() else {
            return;
        };
        let mut offset = -active.get_scroll_y();
        if !inside {
            offset = jump(&active, &press_state, y, x, shift);
        }
        // The box follows the pointer from here, from the place the press left it.
        press_state.borrow_mut().minimap.drag = Some(Drag {
            start_y: y,
            start_offset: offset,
        });
        tracing::debug!(y, inside, offset, "minimap press");
    });
    let drag_state = Rc::clone(shared);
    let drag_window = window.as_weak();
    window.on_minimap_drag(move |y| {
        let Some(active) = drag_window.upgrade() else {
            return;
        };
        let current = drag_state.borrow();
        let Some(drag) = current.minimap.drag else {
            return;
        };
        let geometry = Geometry::new(current.row_map.height(), active.get_viewport_height());
        let offset = geometry.drag_offset(drag.start_offset, drag.start_y, y);
        drop(current);
        scroll_to(&active, &drag_state, offset);
    });
    let release_state = Rc::clone(shared);
    window.on_minimap_release(move || {
        release_state.borrow_mut().minimap.drag = None;
    });
    let step_state = Rc::clone(shared);
    let step_window = window.as_weak();
    window.on_minimap_step(move |direction| {
        let Some(active) = step_window.upgrade() else {
            return;
        };
        let height = active.get_viewport_height();
        scroll_to(
            &active,
            &step_state,
            -active.get_scroll_y() + direction as f32 * height,
        );
    });
    let size_state = Rc::clone(shared);
    let size_window = window.as_weak();
    window.on_minimap_resized(move |width, height| {
        let Some(active) = size_window.upgrade() else {
            return;
        };
        size_state.borrow_mut().minimap.size = (width, height);
        note(&active, &size_state);
    });
}
