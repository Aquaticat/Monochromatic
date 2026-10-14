//! The minimap beside the source text in the real window:
//!  the viewport box against the geometry, a press that jumps, a drag of the box, the wheel,
//!  the keyboard after a press, and the worker that builds the picture off the window thread.
//! Nothing here waits on the window thread: every wait advances timers and lets the workers answer.

/// The source reader fixture, its disposable project, and the bounded waits.
use super::find_tests::{Reader, eventually, key, memory_project, reader};
/// Window metrics shared with the layout tests.
use super::sidebar_tests::{HEADER, TEXT_LEFT};
/// The long wrapped text, the waits, and the window's measured state.
use super::wrap_tests::{long_text, open, settled, until};
/// The worker's counters, its gate, its reply type, and the accept rule.
use super::{
    minimap::apply,
    minimap_build::{MINIMAP_GATE, OFF_WORKER_BUILDS, Reply},
    overscan_tile_tests::{scroll_to, settle_tile},
    theme_tests::switch,
    tile_build::PASS_GATE,
};
/// Library types that give the expected values.
use ide_app::minimap::{FULL_WORK, Geometry};
/// Toolkit events, models, and images.
use slint::{
    ComponentHandle, LogicalPosition, SharedPixelBuffer,
    platform::{Key, PointerEventButton, WindowEvent, update_timers_and_animations},
    private_unstable_api::re_exports::ColorScheme,
};
/// Counters, clocks, and files.
use std::{
    fs,
    sync::atomic::Ordering,
    time::{Duration, Instant},
};

/// What:
///  A window position over the minimap, `y` logical pixels from the top of the view and `x` from the minimap's left
///  edge.
/// Why:
///  The minimap stays still on screen while the content scrolls under it, so its place is fixed by the layout:
///  right of the gutter and the text area.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function overMinimap(window: AppWindow, x: number, y: number): Position;
/// ```
fn over(window: &super::AppWindow, x: f32, y: f32) -> LogicalPosition {
    return LogicalPosition::new(TEXT_LEFT + window.get_viewport_width() + x, HEADER + y);
}

/// The geometry of the text the reader shows now, from the vertical mapping and the view's height.
fn geometry(reader: &Reader) -> Geometry {
    return Geometry::new(
        reader.source.borrow().row_map.height(),
        reader.window.get_viewport_height(),
    );
}

/// The anchor and the head of the selection, without the scroll position the reading position also holds.
fn reading(reader: &Reader) -> (usize, usize) {
    let position = reader.source.borrow().document.position();
    return (position.anchor, position.head);
}

/// The scroll offset of the view.
fn offset(reader: &Reader) -> f32 {
    return -reader.window.get_scroll_y();
}

/// Press the left button at `at`.
fn press(reader: &Reader, at: LogicalPosition) {
    reader
        .window
        .window()
        .dispatch_event(WindowEvent::PointerPressed {
            position: at,
            button: PointerEventButton::Left,
        });
}

/// Move the pointer to `at` with the button as it is.
fn travel(reader: &Reader, at: LogicalPosition) {
    reader
        .window
        .window()
        .dispatch_event(WindowEvent::PointerMoved { position: at });
}

/// Release the left button at `at`.
fn lift(reader: &Reader, at: LogicalPosition) {
    reader
        .window
        .window()
        .dispatch_event(WindowEvent::PointerReleased {
            position: at,
            button: PointerEventButton::Left,
        });
}

/// Let every pending render, timer, and worker answer that is already due run.
fn calm(reader: &Reader) {
    settle_tile(&reader.source);
    update_timers_and_animations();
}

/// Wait until a picture for the displayed text is on screen and no request is awaited.
fn picture_shown(reader: &Reader) {
    until("the minimap picture did not arrive", || {
        let current = reader.source.borrow();
        return current.minimap.shown.is_some()
            && current.minimap.posted == current.minimap.shown
            && current.minimap.images_set > 0;
    });
}

/// The box matches `ide_app::minimap::Geometry` at every scroll offset, and tracks the scroll live: the first offset puts
///  it at the top, the last at the bottom of the track.
#[test]
fn the_box_matches_the_geometry_at_every_offset() {
    let (_project, opened) = open(&long_text(400));
    settled(&opened);
    let window = &opened.window;
    let shape = geometry(&opened);
    assert!(
        shape.max_offset() > 1000.0,
        "the text is longer than the view"
    );
    assert!(
        shape.squeezed(),
        "the picture of this text is squeezed into the view"
    );
    for wanted in [
        0.0,
        1.0,
        377.0,
        shape.max_offset() / 2.0,
        shape.max_offset(),
    ] {
        scroll_to(window, wanted);
        calm(&opened);
        let at = offset(&opened);
        assert!(
            (window.get_minimap_box_top() - shape.box_top(at)).abs() < 0.01,
            "box top {} against {} at offset {at}",
            window.get_minimap_box_top(),
            shape.box_top(at)
        );
        assert!((window.get_minimap_box_height() - shape.box_height()).abs() < 0.01);
        assert!((window.get_minimap_track() - shape.track()).abs() < 0.01);
    }
    scroll_to(window, 0.0);
    assert_eq!(
        window.get_minimap_box_top(),
        0.0,
        "the first offset puts the box at the top"
    );
    scroll_to(window, shape.max_offset());
    assert!(
        (window.get_minimap_box_top() + window.get_minimap_box_height()
            - window.get_minimap_track())
        .abs()
            < 0.01,
        "the last offset puts the box at the bottom of the track"
    );
    window.hide().expect("close minimap window");
}

/// A text shorter than the view has a box as tall as the track, no room to move it, and a press that scrolls nothing.
#[test]
fn a_short_text_has_a_box_as_tall_as_its_track_and_a_press_scrolls_nothing() {
    let (_project, opened) = open("fn main() {\n    println!(\"hi\");\n}\n");
    settled(&opened);
    let window = &opened.window;
    let shape = geometry(&opened);
    assert_eq!(shape.max_offset(), 0.0);
    assert_eq!(window.get_minimap_box_top(), 0.0);
    assert!((window.get_minimap_box_height() - window.get_minimap_track()).abs() < 0.01);
    assert!(
        window.get_minimap_track() < window.get_viewport_height(),
        "the picture of three lines keeps its natural scale and does not fill the view"
    );
    press(&opened, over(window, 10.0, 5.0));
    lift(&opened, over(window, 10.0, 5.0));
    calm(&opened);
    assert_eq!(offset(&opened), 0.0);
    window.hide().expect("close minimap window");
}

/// A press outside the box moves the caret to the row under the pointer and scrolls that row to the middle of the view;
///  a Shift press extends the selection from the old caret; the keyboard still scrolls afterwards.
#[test]
fn a_press_outside_the_box_jumps_to_the_row_and_the_keyboard_still_works() {
    let (_project, opened) = open(&long_text(400));
    settled(&opened);
    let window = &opened.window;
    let shape = geometry(&opened);
    let y = shape.track() * 0.6;
    let (target, expected) = {
        let current = opened.source.borrow();
        let found = shape.target(&current.row_map, y);
        let top = current.row_map.code_top(found.line) + found.row as f32 * 24.0;
        (found, shape.centered(top + 12.0).round())
    };
    assert!(
        y > window.get_minimap_box_top() + window.get_minimap_box_height(),
        "the pressed place is outside the box"
    );
    press(&opened, over(window, 10.0, y));
    lift(&opened, over(window, 10.0, y));
    calm(&opened);
    assert_eq!(offset(&opened), expected, "the pressed row is centered");
    {
        let current = opened.source.borrow();
        let line = current
            .document
            .text()
            .char_to_line(current.document.position().head);
        assert_eq!(line, target.line, "the caret is on the pressed row's line");
        assert_eq!(
            current.document.position().anchor,
            current.document.position().head
        );
    }
    let anchor = opened.source.borrow().document.position().head;
    let second = shape.track() * 0.3;
    window.window().dispatch_event(WindowEvent::KeyPressed {
        text: Key::Shift.into(),
    });
    press(&opened, over(window, 10.0, second));
    lift(&opened, over(window, 10.0, second));
    window.window().dispatch_event(WindowEvent::KeyReleased {
        text: Key::Shift.into(),
    });
    calm(&opened);
    {
        let current = opened.source.borrow();
        let position = current.document.position();
        assert_eq!(position.anchor, anchor, "a Shift press keeps the anchor");
        assert!(
            position.head < anchor,
            "and extends the selection up to the pressed row"
        );
    }
    let before = offset(&opened);
    key(window, Key::PageDown);
    calm(&opened);
    assert!(
        offset(&opened) > before || opened.source.borrow().document.position().head > anchor,
        "PageDown after a press on the minimap moves the view"
    );
    window.hide().expect("close minimap window");
}

/// A press on the box starts a drag without a jump; the box follows the pointer one to one, the view scrolls at every
///  step, both ends clamp, and after the button is released the pointer moves nothing.
#[test]
fn dragging_the_box_scrolls_continuously_and_release_ends_it() {
    let (_project, opened) = open(&long_text(400));
    settled(&opened);
    let window = &opened.window;
    let shape = geometry(&opened);
    scroll_to(window, shape.max_offset() / 4.0);
    calm(&opened);
    let start_offset = offset(&opened);
    let caret = reading(&opened);
    let grabbed = window.get_minimap_box_top() + window.get_minimap_box_height() / 2.0;
    press(&opened, over(window, 10.0, grabbed));
    assert_eq!(
        offset(&opened),
        start_offset,
        "a press on the box does not jump"
    );
    assert_eq!(reading(&opened), caret, "nor does it move the caret");
    let mut last = start_offset;
    for step in 1..=10 {
        let y = grabbed + step as f32 * 7.0;
        travel(&opened, over(window, 10.0, y));
        update_timers_and_animations();
        let at = offset(&opened);
        assert_eq!(
            at,
            shape.drag_offset(start_offset, grabbed, y).round(),
            "step {step}"
        );
        assert!(at > last, "the view moved at step {step}");
        assert!(
            (window.get_minimap_box_top() - shape.box_top(at)).abs() < 0.01,
            "the box follows the view at step {step}"
        );
        last = at;
    }
    travel(&opened, over(window, 10.0, shape.track() + 400.0));
    assert_eq!(
        offset(&opened),
        shape.max_offset(),
        "below the track the view stops at its end"
    );
    travel(&opened, over(window, 10.0, -400.0));
    assert_eq!(
        offset(&opened),
        0.0,
        "above the track the view stops at its start"
    );
    lift(&opened, over(window, 10.0, -400.0));
    travel(&opened, over(window, 10.0, 60.0));
    // A drag report that arrives after the release, as a toolkit may deliver one, is ignored by the native side too.
    window.invoke_minimap_drag(shape.track() * 0.9);
    assert_eq!(
        offset(&opened),
        0.0,
        "after the release the pointer moves nothing"
    );
    assert_eq!(reading(&opened), caret, "a drag never moves the caret");
    calm(&opened);
    window.hide().expect("close minimap window");
}

/// The box shows two changes besides the cursor when the pointer is over it: its fill and its border.
#[test]
fn the_box_changes_fill_and_border_under_the_pointer() {
    let (release, gate) = std::sync::mpsc::channel();
    *MINIMAP_GATE.lock().expect("minimap gate") = Some(gate);
    let (_project, opened) = open(&long_text(400));
    settled(&opened);
    let window = &opened.window;
    let top = window.get_minimap_box_top();
    let height = window.get_minimap_box_height();
    let at = |frame: &SharedPixelBuffer<slint::Rgba8Pixel>, x: f32, y: f32| {
        let index = (HEADER + y) as usize * frame.width() as usize
            + (TEXT_LEFT + window.get_viewport_width() + x) as usize;
        return frame.as_slice()[index];
    };
    // The box stands at the top of the track at the first offset, so its border rows are exact.
    assert_eq!(top, 0.0);
    let text_area = LogicalPosition::new(TEXT_LEFT + 100.0, HEADER + 100.0);
    let below = top + height + 60.0;
    travel(&opened, text_area);
    update_timers_and_animations();
    assert!(
        !window.get_minimap_hovered(),
        "the pointer is not over the minimap"
    );
    let rest = window.window().take_snapshot().expect("a frame");
    let plain = at(&rest, 40.0, below);
    let fill_rest = at(&rest, 40.0, height / 2.0);
    assert_ne!(
        fill_rest, plain,
        "the box has a fill beside the plain minimap"
    );
    assert_ne!(
        at(&rest, 40.0, 0.0),
        at(&rest, 40.0, 1.0),
        "the box has a border besides its fill"
    );
    assert_eq!(
        at(&rest, 40.0, 1.0),
        at(&rest, 40.0, 4.0),
        "the border at rest is one pixel wide"
    );
    // A pointer over the minimap, outside the box, already marks the box: the whole minimap is the scroll control.
    travel(&opened, over(window, 40.0, below));
    update_timers_and_animations();
    assert!(
        window.get_minimap_hovered(),
        "the pointer is over the minimap"
    );
    let hovered = window.window().take_snapshot().expect("a frame");
    assert_eq!(
        at(&hovered, 40.0, below),
        plain,
        "the plain minimap does not change under the pointer"
    );
    assert_ne!(
        at(&hovered, 40.0, height / 2.0),
        fill_rest,
        "hover changes the fill"
    );
    assert_eq!(
        at(&hovered, 40.0, 0.0),
        at(&hovered, 40.0, 1.0),
        "hover makes the border two pixels wide"
    );
    assert_ne!(at(&hovered, 40.0, 1.0), at(&hovered, 40.0, 4.0));
    drop(release);
    window.hide().expect("close minimap window");
}

/// A wheel turn over the minimap scrolls the view exactly as one over the text.
#[test]
fn the_wheel_over_the_minimap_scrolls_like_the_wheel_over_the_text() {
    let (_project, opened) = open(&long_text(400));
    settled(&opened);
    let window = &opened.window;
    let finish = |reader: &Reader| {
        let mut previous = f32::MAX;
        for _ in 0..200 {
            update_timers_and_animations();
            std::thread::sleep(Duration::from_millis(10));
            let at = offset(reader);
            if at > 0.0 && at == previous {
                break;
            }
            previous = at;
        }
        return offset(reader);
    };
    let wheel = |at: LogicalPosition| {
        window
            .window()
            .dispatch_event(WindowEvent::PointerScrolled {
                position: at,
                delta_x: 0.0,
                delta_y: -360.0,
            });
    };
    wheel(LogicalPosition::new(TEXT_LEFT + 100.0, HEADER + 100.0));
    let over_text = finish(&opened);
    assert!(over_text > 0.0, "the wheel scrolled the text");
    scroll_to(window, 0.0);
    calm(&opened);
    wheel(over(window, 30.0, 100.0));
    let over_minimap = finish(&opened);
    assert_eq!(
        over_minimap, over_text,
        "the wheel over the minimap scrolled by the same amount"
    );
    window.hide().expect("close minimap window");
}

/// The picture is built on the worker thread, its size is the minimap's, and what it cost stays inside its bounds.
#[test]
fn the_picture_is_built_on_the_worker_and_stays_inside_its_bounds() {
    let (_project, opened) = open(&long_text(2000));
    settled(&opened);
    picture_shown(&opened);
    let window = &opened.window;
    assert_eq!(
        OFF_WORKER_BUILDS.load(Ordering::SeqCst),
        0,
        "a picture was built off the worker"
    );
    let image = window
        .get_minimap_image()
        .to_rgba8()
        .expect("picture pixels");
    let stats = opened
        .source
        .borrow()
        .minimap
        .last_stats
        .expect("build statistics");
    assert_eq!(image.width() as f32, window.get_minimap_width());
    assert_eq!(image.height() as usize, stats.pixel_rows);
    assert!(
        (image.height() as f32 - window.get_minimap_track()).abs() <= 1.0,
        "the picture is as tall as the track"
    );
    assert!(stats.work <= FULL_WORK);
    assert!(
        stats.lines <= stats.pixel_rows,
        "no more lines are drawn than the picture has rows"
    );
    assert!(
        image.as_slice().iter().any(|pixel| return pixel.a > 0),
        "the picture holds ink"
    );
    window.hide().expect("close minimap window");
}

/// Scrolling posts no request and sets no picture: only the box moves.
#[test]
fn scrolling_posts_no_request_and_sets_no_picture() {
    let (_project, opened) = open(&long_text(2000));
    settled(&opened);
    picture_shown(&opened);
    let window = &opened.window;
    let (posts, images) = {
        let current = opened.source.borrow();
        (current.minimap.posts, current.minimap.images_set)
    };
    let shape = geometry(&opened);
    for step in 0..40 {
        scroll_to(window, shape.max_offset() * step as f32 / 40.0);
        calm(&opened);
    }
    for _ in 0..30 {
        update_timers_and_animations();
        std::thread::sleep(Duration::from_millis(10));
    }
    let current = opened.source.borrow();
    assert_eq!(
        current.minimap.posts, posts,
        "a scroll posted a minimap request"
    );
    assert_eq!(
        current.minimap.images_set, images,
        "a scroll set a minimap picture"
    );
    drop(current);
    window.hide().expect("close minimap window");
}

/// A worker held at its gate never blocks the view: the window opens, scrolls, and takes a press while no picture
///  exists, and the picture appears once the worker is released.
#[test]
fn a_held_worker_never_blocks_the_view() {
    let (release, gate) = std::sync::mpsc::channel();
    *MINIMAP_GATE.lock().expect("minimap gate") = Some(gate);
    let (_project, opened) = open(&long_text(600));
    settled(&opened);
    let window = &opened.window;
    until("the held worker was not asked for a picture", || {
        return opened.source.borrow().minimap.posts > 0;
    });
    let shape = geometry(&opened);
    scroll_to(window, shape.max_offset() / 2.0);
    calm(&opened);
    assert_eq!(
        opened.source.borrow().minimap.images_set,
        0,
        "no picture while the worker is held"
    );
    let y = shape.track() * 0.8;
    press(&opened, over(window, 10.0, y));
    lift(&opened, over(window, 10.0, y));
    calm(&opened);
    assert!(
        offset(&opened) > shape.max_offset() / 2.0,
        "the press scrolled the view while the worker was held"
    );
    let _ = release.send(());
    picture_shown(&opened);
    assert_eq!(OFF_WORKER_BUILDS.load(Ordering::SeqCst), 0);
    drop(release);
    window.hide().expect("close minimap window");
}

/// A new wrap width rebuilds the picture without blocking the view, and the picture then has the new track.
#[test]
fn a_new_wrap_width_rebuilds_the_picture() {
    let (_project, opened) = open(&long_text(400));
    settled(&opened);
    picture_shown(&opened);
    let window = &opened.window;
    let before = opened.source.borrow().minimap.shown.expect("a picture key");
    let height = window.get_minimap_track();
    super::sidebar_tests::resize(window, 760.0, 660.0);
    settled(&opened);
    until("the picture did not follow the new width", || {
        let current = opened.source.borrow();
        return current
            .minimap
            .shown
            .is_some_and(|shown| return shown.rows != before.rows)
            && current.minimap.shown == current.minimap.posted;
    });
    let after = opened.source.borrow().minimap.shown.expect("a picture key");
    assert_ne!(
        after.wrap, before.wrap,
        "the picture is for the new wrap width"
    );
    assert_ne!(
        window.get_minimap_track(),
        height,
        "the longer text has another track"
    );
    let image = window
        .get_minimap_image()
        .to_rgba8()
        .expect("picture pixels");
    assert_eq!(image.width() as f32, window.get_minimap_width());
    assert!((image.height() as f32 - window.get_minimap_track()).abs() <= 1.0);
    assert_eq!(OFF_WORKER_BUILDS.load(Ordering::SeqCst), 0);
    window.hide().expect("close minimap window");
}

/// A picture of an older text, of an older request, or of another file is dropped, and a newer one is shown.
#[test]
fn a_stale_picture_is_dropped_and_a_current_one_is_shown() {
    let (_project, opened) = open(&long_text(400));
    settled(&opened);
    picture_shown(&opened);
    let window = &opened.window;
    let (picture, id, stats) = {
        let current = opened.source.borrow();
        (
            current.minimap.shown.expect("a picture key"),
            current.minimap.shown_id,
            current.minimap.last_stats.expect("statistics"),
        )
    };
    let reply = |number: u64, stamp_shift: u64| {
        let mut moved = picture;
        moved.stamp.revision += stamp_shift;
        return Reply {
            id: number,
            key: moved,
            last: true,
            pixels: SharedPixelBuffer::new(4, 4),
            stats,
            elapsed: Duration::ZERO,
        };
    };
    let shown_before = opened.source.borrow().minimap.images_set;
    apply(window, &opened.source, reply(id + 5, 1));
    apply(window, &opened.source, reply(id.saturating_sub(1), 0));
    {
        let current = opened.source.borrow();
        assert_eq!(
            current.minimap.images_set, shown_before,
            "a stale picture was set"
        );
        assert_eq!(current.minimap.dropped, 2);
    }
    apply(window, &opened.source, reply(id + 6, 0));
    let current = opened.source.borrow();
    assert_eq!(current.minimap.images_set, shown_before + 1);
    assert_eq!(current.minimap.shown_id, id + 6);
    drop(current);
    window.hide().expect("close minimap window");
}

/// Syntax classes arriving rebuild the picture with the new colors, and the picture follows the scheme: light ink is
///  darker than dark ink.
#[test]
fn highlights_and_the_scheme_rebuild_the_picture_in_the_palette_inks() {
    let project = memory_project("minimap-theme-");
    let mut text = String::new();
    for number in 0..300 {
        text.push_str(&format!(
            "const value{number} = compute({number}, \"text\"); // note\n"
        ));
    }
    fs::write(project.path().join("a.ts"), &text).expect("theme fixture");
    let opened = reader(project.path(), "a.ts");
    eventually("TypeScript highlighting did not arrive", || {
        return !opened.source.borrow().styles.is_empty();
    });
    switch(&opened.window, ColorScheme::Dark);
    let styled = |reader: &Reader| {
        let current = reader.source.borrow();
        let styles = std::sync::Arc::as_ptr(&current.styles).cast::<()>() as usize;
        return current
            .minimap
            .shown
            .is_some_and(|shown| return shown.styles == styles)
            && current.minimap.posted == current.minimap.shown;
    };
    until("the picture did not follow the highlights", || {
        return styled(&opened);
    });
    let brightness = |reader: &Reader| {
        let image = reader
            .window
            .get_minimap_image()
            .to_rgba8()
            .expect("picture pixels");
        let mut total = 0.0_f32;
        let mut count = 0.0_f32;
        for pixel in image.as_slice() {
            if pixel.a > 0 {
                let alpha = f32::from(pixel.a);
                total += (0.299 * f32::from(pixel.r)
                    + 0.587 * f32::from(pixel.g)
                    + 0.114 * f32::from(pixel.b))
                    / alpha;
                count += 1.0;
            }
        }
        assert!(count > 100.0, "the picture holds ink");
        return total / count;
    };
    let dark_key = opened.source.borrow().minimap.shown.expect("a picture key");
    let dark = brightness(&opened);
    switch(&opened.window, ColorScheme::Light);
    until("the picture did not follow the scheme", || {
        let current = opened.source.borrow();
        return current
            .minimap
            .shown
            .is_some_and(|shown| return shown.colors != dark_key.colors)
            && current.minimap.shown == current.minimap.posted;
    });
    let light = brightness(&opened);
    assert!(
        light < dark - 0.15,
        "light-scheme ink ({light}) is darker than dark-scheme ink ({dark})"
    );
    opened.window.hide().expect("close minimap window");
}

/// Opening fifty thousand long lines builds a bounded picture off the window thread: no window-thread callback is slow,
///  and the picture's cost follows its height, not the length of the text.
#[test]
fn fifty_thousand_lines_give_a_bounded_picture_without_blocking_the_window() {
    let mut text = String::new();
    for number in 0..50_000 {
        text.push_str(&format!(
            "fn item_{number}(value: u32) -> u32 {{ value + {number} }} // trailing words words words words words words\n"
        ));
    }
    let started = Instant::now();
    let (_project, opened) = open(&text);
    let window = &opened.window;
    let mut slowest = Duration::ZERO;
    until("the picture of fifty thousand lines did not arrive", || {
        let tick = Instant::now();
        update_timers_and_animations();
        slowest = slowest.max(tick.elapsed());
        let current = opened.source.borrow();
        return current.minimap.images_set > 0;
    });
    let first = started.elapsed();
    assert!(
        slowest < Duration::from_millis(1500),
        "a window-thread callback took {slowest:?} (first picture after {first:?})"
    );
    let stats = opened
        .source
        .borrow()
        .minimap
        .last_stats
        .expect("statistics");
    assert!(stats.pixel_rows as f32 <= window.get_viewport_height() + 1.0);
    assert!(stats.lines <= stats.pixel_rows);
    assert!(stats.work <= FULL_WORK);
    assert_eq!(OFF_WORKER_BUILDS.load(Ordering::SeqCst), 0);
    window.hide().expect("close minimap window");
}

/// While the measurement of a long text changes the vertical mapping, the picture follows it at a steady pace: a request
///  for about each quarter second, never one for each chunk of the measurement, and none on the window thread.
#[test]
fn the_picture_follows_the_measurement_at_a_steady_pace() {
    let (release, gate) = std::sync::mpsc::channel();
    *PASS_GATE.lock().expect("pass gate") = Some(gate);
    let (_project, opened) = open(&long_text(6000));
    let window = &opened.window;
    picture_shown(&opened);
    let before = opened.source.borrow().minimap.posts;
    let started = Instant::now();
    let mut chunks = 0;
    while started.elapsed() < Duration::from_millis(1600) {
        let _ = release.send(());
        chunks += 1;
        for _ in 0..12 {
            update_timers_and_animations();
            std::thread::sleep(Duration::from_millis(5));
        }
    }
    let posts = opened.source.borrow().minimap.posts - before;
    assert!(
        chunks >= 20,
        "the measurement was released in {chunks} chunks"
    );
    assert!(
        posts >= 3,
        "{posts} requests in a second and a half of changing rows: the picture waited for the measurement to end"
    );
    assert!(
        posts <= 10,
        "{posts} requests for {chunks} chunks: the pace is not bounded"
    );
    assert_eq!(OFF_WORKER_BUILDS.load(Ordering::SeqCst), 0);
    drop(release);
    window.hide().expect("close minimap window");
}
