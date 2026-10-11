//! Scrolling inside the overscan tile enters no render, paints no tile, shapes no row, and sets no image;
//!  leaving the tile re-centers it exactly once, and the visible pixels equal a fresh render at that offset.

/// Reuse production viewport callbacks, appearance callbacks, and the raster presentation.
use super::{AppWindow, State, bind_appearance, bind_viewport, render};
/// Toolkit windows and component ownership stay on the test's event-loop thread.
use slint::{ComponentHandle, platform::update_timers_and_animations};
/// UI state is shared between the window callbacks and the test.
use std::{cell::RefCell, rc::Rc};

/// Lines of the disposable document; the scrolls in these tests stay far from its end.
const LINES: usize = 5000;
/// Offset the reader starts from, well away from both ends of the document.
const START: f32 = 40_000.0;
/// Logical pixels of one small wheel step.
const STEP: f32 = 3.0;

/// Five thousand numbered lines, each ending with a line feed.
fn document() -> String {
    return (0..LINES).map(|line| format!("line {line}\n")).collect();
}

/// Open a shown window on `text`, with production callbacks and one completed render.
fn open(text: &str) -> (AppWindow, Rc<RefCell<State>>) {
    let window = AppWindow::new().expect("headless native source window");
    let state = Rc::new(RefCell::new(State::new(text, None)));
    bind_viewport(&window, &state);
    bind_appearance(&window, &state);
    window.show().expect("show headless source window");
    render(&window, &state);
    update_timers_and_animations();
    return (window, state);
}

/// Scroll to `offset` and let the toolkit deliver the viewport-changed callback.
fn scroll_to(window: &AppWindow, offset: f32) {
    window.set_scroll_y(-offset);
    update_timers_and_animations();
}

/// Zero the test counters so the assertions count only what follows.
fn reset(state: &Rc<RefCell<State>>) {
    let mut current = state.borrow_mut();
    current.renders = 0;
    current.tiles_painted = 0;
    current.rows_shaped = 0;
    current.images_set = 0;
}

/// Renders, painted tiles, shaped rows, and images set since the last reset, in that order.
fn counts(state: &Rc<RefCell<State>>) -> [u64; 4] {
    let current = state.borrow();
    return [
        current.renders,
        current.tiles_painted,
        current.rows_shaped,
        current.images_set,
    ];
}

/// The rows of the window's visible viewport as RGBA pixels, read from the source image.
fn shown(window: &AppWindow) -> Vec<[u8; 4]> {
    let scale = window.window().scale_factor();
    let image = window
        .get_source_image()
        .to_rgba8()
        .expect("source image pixels");
    let width = image.width() as usize;
    let view_top = -window.get_scroll_y();
    let first = ((view_top - window.get_image_y()) * scale).floor().max(0.0) as usize;
    let last = (((view_top + window.get_viewport_height() - window.get_image_y()) * scale).ceil()
        as usize)
        .min(image.height() as usize);
    let pixels = image.as_slice();
    let mut rows = Vec::new();
    for row in first..last {
        for pixel in &pixels[row * width..(row + 1) * width] {
            rows.push([pixel.r, pixel.g, pixel.b, pixel.a]);
        }
    }
    return rows;
}

/// Small wheel steps inside the tile enter no render, paint no tile, shape no row, and set no image.
#[test]
fn scrolling_inside_the_overscan_tile_does_no_source_work() {
    let (window, state) = open(&document());
    let height = window.get_viewport_height();
    scroll_to(&window, START);
    reset(&state);
    // Half a view height each way stays inside the tile, which holds the view until about 0.75 view heights.
    let steps = (height * 0.5 / STEP) as usize;
    for step in 1..=steps {
        scroll_to(&window, START + step as f32 * STEP);
    }
    for step in (0..steps).rev() {
        scroll_to(&window, START + step as f32 * STEP);
    }
    let [renders, tiles, rows, images] = counts(&state);
    assert_eq!(
        renders, 0,
        "scrolling inside the overscan tile must not enter render"
    );
    assert_eq!(
        tiles, 0,
        "scrolling inside the overscan tile must not paint a tile"
    );
    assert_eq!(
        rows, 0,
        "scrolling inside the overscan tile must not shape a row"
    );
    assert_eq!(
        images, 0,
        "scrolling inside the overscan tile must not set an image"
    );
    window.hide().expect("close headless source window");
}

/// Leaving the tile re-centers it exactly once, shapes only the lines it did not have,
/// and shows the same pixels as a fresh render at the same offset.
#[test]
fn leaving_the_overscan_tile_re_centers_once_with_fresh_pixels() {
    let text = document();
    let (window, state) = open(&text);
    let height = window.get_viewport_height();
    scroll_to(&window, START);
    reset(&state);
    let target = START + height;
    scroll_to(&window, target);
    let [renders, tiles, rows, images] = counts(&state);
    assert_eq!(renders, 1, "leaving the tile enters render once");
    assert_eq!(tiles, 1, "leaving the tile paints exactly one new tile");
    assert_eq!(images, 1, "leaving the tile sets exactly one new image");
    let count = state.borrow().count as u64;
    assert!(
        rows > 0 && rows < count,
        "the re-centered tile shaped {rows} rows of {count}; lines it shares with the previous tile must come from the cache"
    );
    let (fresh_window, _fresh) = open(&text);
    scroll_to(&fresh_window, target);
    assert!(
        shown(&window) == shown(&fresh_window),
        "the visible pixels after scrolling differ from a fresh render at offset {target}"
    );
    window.hide().expect("close headless source window");
    fresh_window
        .hide()
        .expect("close fresh headless source window");
}
