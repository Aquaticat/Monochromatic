//! Always-on soft wrap in the real window:
//!  the wrap width, the gutter's indicator, the worker that measures every line,
//!  the vertical extent that settles as chunks arrive, resizes that only break rows again,
//!  and pointer placement on continuation rows.
//! Nothing here waits on the window thread: every wait advances timers and lets the workers answer.

/// The production window and its state.
use super::{AppWindow, State};
/// The complete reader fixture and its disposable project.
use super::find_tests::{Reader, memory_project, reader};
/// Window resizing and layout settling for exact sizes.
use super::sidebar_tests::{GUTTER, HEADER, TEXT_LEFT, resize};
/// The wrap width rule and the worker's gates and limits.
use super::{
    tile::current_key,
    tile_build::PASS_GATE,
    tile_pass::TAKE_LIMIT,
    viewport::{CARET_ROOM, place, wrap_width},
};
/// Library types that give the expected values.
use ide_app::{row_map::RowMap, shaped_text::TextShaper};
/// Toolkit events and models.
use slint::{
    ComponentHandle, LogicalPosition, Model,
    platform::{Key, PointerEventButton, WindowEvent, update_timers_and_animations},
};
/// Shared state, files, and clocks.
use std::{
    cell::RefCell,
    fs,
    rc::Rc,
    time::{Duration, Instant},
};

/// Longest wait for a worker answer; the host can be under heavy load.
const PATIENCE: Duration = Duration::from_secs(90);

/// A line that wraps to several rows at the width of the test window (about 700 px of text).
fn long_line(number: usize) -> String {
    return format!(
        "let line_{number} = compute_total(first_item, second_item, third_item); // {}",
        "word ".repeat(40)
    );
}

/// `count` long lines.
fn long_text(count: usize) -> String {
    let mut text = String::new();
    for number in 0..count {
        text.push_str(&long_line(number));
        text.push('\n');
    }
    return text;
}

/// Advance timers until `ready` holds, failing with `message` after `PATIENCE`.
fn until(message: &str, mut ready: impl FnMut() -> bool) {
    let start = Instant::now();
    loop {
        update_timers_and_animations();
        if ready() {
            return;
        }
        assert!(start.elapsed() < PATIENCE, "{message}");
        std::thread::sleep(Duration::from_millis(2));
    }
}

/// Whether the worker has measured the whole text at the current wrap width and nothing is queued.
fn measured(state: &Rc<RefCell<State>>, scale: f32) -> bool {
    let current = state.borrow();
    let posted = current.pass_posted.map(|(key, _)| return key);
    return posted == Some(current_key(&current, scale))
        && current.tile_job.is_none()
        && current.scroll_wanted.is_none()
        && current
            .tile_worker
            .as_ref()
            .is_some_and(|worker| return !worker.is_busy());
}

/// Wait until the pass has finished and the last output is applied.
fn settled(reader: &Reader) {
    let scale = reader.window.window().scale_factor();
    until("the measurement pass did not finish", || {
        return measured(&reader.source, scale);
    });
    // The render an applied output asks for has run when no timer is left pending.
    update_timers_and_animations();
}

/// Open a reader on `text` and wait for the first layout to give the view its width.
fn open(text: &str) -> (tempfile::TempDir, Reader) {
    let project = memory_project("wrap-view-");
    fs::write(project.path().join("a.txt"), text).expect("fixture file");
    let opened = reader(project.path(), "a.txt");
    until("the view did not report a width", || {
        return opened.source.borrow().width > 0.0;
    });
    return (project, opened);
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

/// The vertical extent a fresh shaper gives `text` when every line is measured at the state's wrap width.
fn expected_extent(state: &Rc<RefCell<State>>, scale: f32) -> f32 {
    let current = state.borrow();
    let lines = current.document.text().len_lines();
    let mut shaper = TextShaper::new();
    let found = shaper.measure_lines(
        &current.document,
        0..lines,
        scale,
        Some(current.width),
        &[],
    );
    let mut rows = current.row_map.line_rows().clone();
    rows.apply(found.lines);
    return RowMap::plain(lines).with_rows(&rows).height();
}

/// The wrap width is the text area's width without the caret room, and a width of zero keeps the last one.
#[test]
fn the_wrap_width_is_the_text_area_minus_the_caret_room_and_zero_keeps_the_last() {
    let (_project, opened) = open(&long_text(5));
    let window = &opened.window;
    let width = opened.source.borrow().width;
    assert_eq!(width, window.get_viewport_width() - CARET_ROOM);
    assert_eq!(wrap_width(0.0), None, "a view without width cannot wrap");
    assert_eq!(wrap_width(-5.0), None);
    assert_eq!(wrap_width(CARET_ROOM), None, "no width is left after the caret room");
    assert_eq!(wrap_width(500.0), Some(500.0 - CARET_ROOM));
    {
        let mut current = opened.source.borrow_mut();
        place(&mut current, 0.0, 0.0, window.get_viewport_height());
        assert_eq!(current.width, width, "a width of zero kept the last width");
    }
    window.hide().expect("close wrap window");
}

/// The gutter has one entry per visual row, the number on the first row of a line only,
///  and the indicator image is set in the sign color.
#[test]
fn the_gutter_numbers_first_rows_and_marks_continuation_rows() {
    let (_project, opened) = open(&long_text(30));
    settled(&opened);
    let window = &opened.window;
    let numbers: Vec<i32> = window.get_row_numbers().iter().collect();
    let tops: Vec<f32> = window.get_row_tops().iter().collect();
    assert_eq!(numbers.len(), tops.len());
    assert_eq!(numbers.first(), Some(&1));
    assert!(numbers.iter().any(|number| return *number == 0), "continuation rows exist");
    let current = opened.source.borrow();
    let view = current.shaped.as_ref().expect("shaped view");
    let mut entry = 0;
    for row in &view.rows {
        assert_eq!(current.row_map.rows_of(row.row), row.visual_rows());
        for visual in 0..row.visual_rows() {
            let expected = if visual == 0 { row.row as i32 + 1 } else { 0 };
            assert_eq!(numbers[entry], expected, "line {} row {visual}", row.row);
            assert_eq!(tops[entry], current.row_map.code_top(row.row) + visual as f32 * 24.0);
            entry += 1;
        }
    }
    assert_eq!(entry, numbers.len());
    drop(current);
    let sign = window
        .get_wrap_sign()
        .to_rgba8_premultiplied()
        .expect("sign image");
    let mut inked = 0;
    for pixel in sign.as_slice() {
        if pixel.a > 0 {
            inked += 1;
            assert!(
                u32::from(pixel.r).abs_diff(0xC0 * u32::from(pixel.a) / 255) <= 1,
                "the sign is painted in c0c0c0"
            );
        }
    }
    assert!(inked > 4, "the wrap indicator has ink");
    window.hide().expect("close wrap window");
}

/// A line that fits has no continuation row and no indicator.
#[test]
fn short_lines_have_no_continuation_rows() {
    let (_project, opened) = open("short\nlines\nonly\n");
    settled(&opened);
    let numbers: Vec<i32> = opened.window.get_row_numbers().iter().collect();
    assert_eq!(numbers, vec![1, 2, 3, 4]);
    opened.window.hide().expect("close wrap window");
}

/// Rows above the view that change height as the pass reaches them move no visible pixel.
#[test]
fn rows_above_the_view_changing_height_move_no_visible_pixel() {
    // Short lines first, then a long stretch that wraps to several rows each, then short lines again.
    let mut text = String::new();
    for number in 0..100 {
        text.push_str(&format!("short {number}\n"));
    }
    for number in 100..300 {
        text.push_str(&long_line(number));
        text.push('\n');
    }
    for number in 300..420 {
        text.push_str(&format!("short {number}\n"));
    }
    let (_project, opened) = open(&text);
    let window = &opened.window;
    let scale = window.window().scale_factor();
    // Hold the pass while the view moves into the long stretch, whose lines are not measured yet.
    let (release, gate) = std::sync::mpsc::channel();
    *PASS_GATE.lock().expect("pass gate") = Some(gate);
    let start = 320.0 * 24.0;
    window.set_scroll_y(-start);
    until("the tile for the new view did not arrive", || {
        update_timers_and_animations();
        let current = opened.source.borrow();
        return current.tile_job.is_none()
            && current.scroll_wanted.is_none()
            && current.shown.first + current.shown.count > 320
            && current.shown.first <= 320;
    });
    // The tile holds exact heights; the line number at the view's top stays under the pointer.
    let top_line = opened.source.borrow().row_map.line_at(-window.get_scroll_y());
    let screen = |state: &Rc<RefCell<State>>| {
        return state.borrow().row_map.code_top(top_line) + window.get_scroll_y();
    };
    let before_screen = screen(&opened.source);
    let before_pixels = shown(window);
    let before_extent = opened.source.borrow().row_map.height();
    // Release the pass: lines above the view get their heights, and the offset follows them.
    drop(release);
    settled(&opened);
    let after_screen = screen(&opened.source);
    let after_extent = opened.source.borrow().row_map.height();
    assert!(after_extent > before_extent, "the pass changed the extent");
    assert_eq!(
        before_screen, after_screen,
        "the line at the top of the view moved on screen"
    );
    assert!(
        before_pixels == shown(window),
        "visible pixels changed when rows above the view changed height"
    );
    assert_eq!(after_extent, expected_extent(&opened.source, scale));
    window.hide().expect("close wrap window");
}

/// The vertical extent grows as chunks arrive and ends where a full measurement puts it.
#[test]
fn the_extent_settles_as_chunks_arrive() {
    let (release, gate) = std::sync::mpsc::channel();
    *PASS_GATE.lock().expect("pass gate") = Some(gate);
    let (_project, opened) = open(&long_text(700));
    let window = &opened.window;
    let scale = window.window().scale_factor();
    let mut extents = vec![opened.source.borrow().row_map.height()];
    let mut applied = opened.source.borrow().pass_applied;
    for _ in 0..8 {
        if release.send(()).is_err() {
            break;
        }
        until("a released chunk was not applied", || {
            return opened.source.borrow().pass_applied > applied
                || measured(&opened.source, scale);
        });
        applied = opened.source.borrow().pass_applied;
        extents.push(opened.source.borrow().row_map.height());
    }
    drop(release);
    settled(&opened);
    extents.push(opened.source.borrow().row_map.height());
    for pair in extents.windows(2) {
        assert!(pair[1] >= pair[0], "the extent never shrinks while lines are measured: {extents:?}");
    }
    assert!(
        extents.last() > extents.first(),
        "unmeasured lines count as one row, so the extent grew: {extents:?}"
    );
    assert!(
        extents.windows(2).filter(|pair| return pair[1] > pair[0]).count() >= 2,
        "the extent grew in more than one step: {extents:?}"
    );
    assert_eq!(*extents.last().expect("extent"), expected_extent(&opened.source, scale));
    window.hide().expect("close wrap window");
}

/// Opening a very long file never blocks the window thread: the pass runs on the worker, the window takes a bounded
/// amount from it per callback, and shapes no line beyond its first tile.
#[test]
fn opening_fifty_thousand_lines_never_blocks_the_window_thread() {
    let mut text = String::new();
    for number in 0..50_000 {
        text.push_str(&format!(
            "fn item_{number}(value: u32) -> u32 {{ value + {number} }} // trailing words words words words words words\n"
        ));
    }
    let (release, gate) = std::sync::mpsc::channel();
    *PASS_GATE.lock().expect("pass gate") = Some(gate);
    let started = Instant::now();
    let (_project, opened) = open(&text);
    let window = &opened.window;
    let opening = started.elapsed();
    let shaped_at_open = opened.source.borrow().rows_shaped;
    assert!(
        shaped_at_open < 200,
        "the window thread shaped {shaped_at_open} lines to open the file; only its first tile may be shaped there"
    );
    // Let the worker run far ahead of the window, then take what it measured in one poll.
    for _ in 0..4000 {
        let _ = release.send(());
    }
    until("the worker did not measure ahead of the window", || {
        return opened
            .source
            .borrow()
            .tile_worker
            .as_ref()
            .is_some_and(|worker| return worker.pending_pass_lines() > TAKE_LIMIT + TAKE_LIMIT / 2);
    });
    let mut slowest = Duration::ZERO;
    for _ in 0..40 {
        let tick = Instant::now();
        update_timers_and_animations();
        slowest = slowest.max(tick.elapsed());
        std::thread::sleep(Duration::from_millis(5));
    }
    let current = opened.source.borrow();
    assert!(current.pass_applied > 0, "the pass reached the window");
    assert!(
        current.pass_most_lines <= TAKE_LIMIT,
        "one callback applied {} lines, past the bound of {TAKE_LIMIT}",
        current.pass_most_lines
    );
    assert!(
        current.rows_shaped < 200,
        "the window thread shaped {} lines while the pass ran",
        current.rows_shaped
    );
    assert!(
        slowest < Duration::from_millis(1500),
        "a window-thread callback took {slowest:?} while the worker measured the file (opening took {opening:?})"
    );
    drop(current);
    drop(release);
    window.hide().expect("close wrap window");
}

/// A new width breaks the kept rows again on the worker: nothing is shaped again, and the extent follows.
#[test]
fn a_resize_breaks_kept_rows_again_without_shaping() {
    let (_project, opened) = open(&long_text(1500));
    settled(&opened);
    let window = &opened.window;
    let scale = window.window().scale_factor();
    let (shaped, rebroken, window_rows, tile_rows, width) = {
        let current = opened.source.borrow();
        (
            current.pass_shaped,
            current.pass_rebroken,
            current.rows_shaped,
            current.worker_rows_shaped,
            current.width,
        )
    };
    assert!(shaped > 1000, "the first pass shaped the file");
    resize(window, 900.0, 660.0);
    until("the new width did not reach the state", || {
        return opened.source.borrow().width != width;
    });
    settled(&opened);
    let current = opened.source.borrow();
    assert_eq!(current.pass_shaped, shaped, "the resize shaped lines again");
    assert!(
        current.pass_rebroken >= rebroken + 1000,
        "the resize broke only {} kept rows again",
        current.pass_rebroken - rebroken
    );
    assert_eq!(current.rows_shaped, window_rows, "the window thread shaped lines for the resize");
    assert_eq!(current.worker_rows_shaped, tile_rows, "the worker's tile shaped lines for the resize");
    drop(current);
    assert_eq!(
        opened.source.borrow().row_map.height(),
        expected_extent(&opened.source, scale)
    );
    window.hide().expect("close wrap window");
}

/// A scroll re-center during the pass is still built on the worker: the window thread shapes and paints nothing,
///  the finished tile is accepted although the map was corrected by the tile's own lines.
#[test]
fn a_recenter_while_the_pass_runs_is_built_on_the_worker() {
    let (release, gate) = std::sync::mpsc::channel();
    *PASS_GATE.lock().expect("pass gate") = Some(gate);
    let (_project, opened) = open(&long_text(3000));
    let window = &opened.window;
    until("the first tile did not settle", || {
        let current = opened.source.borrow();
        return current.tile_job.is_none() && current.scroll_wanted.is_none();
    });
    {
        let mut current = opened.source.borrow_mut();
        current.renders = 0;
        current.tiles_painted = 0;
        current.rows_shaped = 0;
        current.images_set = 0;
        current.worker_tiles = 0;
        current.tiles_applied = 0;
        current.tiles_discarded = 0;
    }
    let height = window.get_viewport_height();
    window.set_scroll_y(-(3.0 * height));
    update_timers_and_animations();
    {
        let current = opened.source.borrow();
        assert_eq!(current.tiles_painted, 0, "the window thread painted a tile");
        assert_eq!(current.rows_shaped, 0, "the window thread shaped lines for a re-center");
        assert_eq!(current.images_set, 0, "the window thread set an image");
    }
    until("the worker's tile was not swapped in", || {
        return opened.source.borrow().tiles_applied == 1 || opened.source.borrow().tiles_discarded > 0;
    });
    let current = opened.source.borrow();
    assert_eq!(current.tiles_discarded, 0, "the worker's tile was discarded");
    assert_eq!(current.tiles_applied, 1);
    assert_eq!(current.tiles_painted, 0);
    assert_eq!(current.rows_shaped, 0);
    let view = current.shaped.as_ref().expect("swapped-in view");
    for row in &view.rows {
        assert_eq!(current.row_map.rows_of(row.row), row.visual_rows());
    }
    assert!(view.rows.iter().any(|row| return row.visual_rows() > 1));
    drop(current);
    drop(release);
    window.hide().expect("close wrap window");
}

/// The caret bar is as wide as the room the wrap width keeps for it, so a caret after a full row is not cut off.
#[test]
fn the_caret_after_a_full_row_stays_inside_the_view() {
    // A token without break opportunities fills every row to the width; each glyph is 9 px wide.
    let (_project, opened) = open(&format!("{}\n", "m".repeat(400)));
    let window = &opened.window;
    // A text area of 9 * 70 + 1 = 631 px: without caret room a row would hold the glyphs up to 630 px.
    resize(window, 946.0, 660.0);
    until("the wrap width did not follow the resize", || {
        return opened.source.borrow().width == 631.0 - CARET_ROOM;
    });
    settled(&opened);
    assert_eq!(window.get_viewport_width(), 631.0);
    let scale = window.window().scale_factor();
    let current = opened.source.borrow();
    let row = &current.shaped.as_ref().expect("view").rows[0];
    assert!(row.visual_rows() > 3, "the token wraps over several rows");
    for visual in 0..row.visual_rows() {
        let end = row.source_start + row.visual_row_sources(visual).expect("row").end;
        let x = row.x_on_row(end, visual, scale);
        assert!(
            x + 2.0 <= 631.0,
            "the caret after a full row is cut by the view edge: row {visual} ends at {x}"
        );
    }
    drop(current);
    window.hide().expect("close wrap window");
}

/// The window point over visual row `visual` of the first line, `x` logical pixels into the text.
fn point(window: &AppWindow, visual: usize, x: f32) -> LogicalPosition {
    return LogicalPosition::new(
        TEXT_LEFT + x,
        HEADER + visual as f32 * 24.0 + 12.0 + window.get_scroll_y(),
    );
}

/// A click on a continuation row places the caret in that row, and a click right of a row's end keeps its side.
#[test]
fn a_click_on_a_continuation_row_places_the_caret_in_that_row() {
    let (_project, opened) = open(&long_text(10));
    settled(&opened);
    let window = &opened.window;
    assert_eq!(GUTTER, 58.0);
    let rows = opened.source.borrow().row_map.rows_of(0);
    assert!(rows >= 3, "the first line wraps to {rows} rows");
    for visual in 0..rows {
        window.window().dispatch_event(WindowEvent::PointerPressed {
            position: point(window, visual, 40.0),
            button: PointerEventButton::Left,
        });
        window.window().dispatch_event(WindowEvent::PointerReleased {
            position: point(window, visual, 40.0),
            button: PointerEventButton::Left,
        });
        update_timers_and_animations();
        let current = opened.source.borrow();
        let head = current.document.position().head;
        let view = current.shaped.as_ref().expect("view");
        let row = &view.rows[0];
        let sources = row.visual_row_sources(visual).expect("row exists");
        assert!(
            sources.contains(&head),
            "a click on visual row {visual} placed the caret at {head}, outside {sources:?}"
        );
        drop(current);
        assert_eq!(window.get_caret_y(), visual as f32 * 24.0 + 2.0, "caret row {visual}");
    }
    // Far right of the first row: the caret stands at the end of that row, not at the start of the next.
    let far = LogicalPosition::new(TEXT_LEFT + 750.0, HEADER + 12.0 + window.get_scroll_y());
    window.window().dispatch_event(WindowEvent::PointerPressed {
        position: far,
        button: PointerEventButton::Left,
    });
    window.window().dispatch_event(WindowEvent::PointerReleased {
        position: far,
        button: PointerEventButton::Left,
    });
    update_timers_and_animations();
    assert_eq!(window.get_caret_y(), 2.0, "the caret stays on the upper row at its end");
    window.hide().expect("close wrap window");
}

/// The view cannot move horizontally: a Shift+wheel turn scrolls nothing, and a plain wheel turn still scrolls.
#[test]
fn shift_wheel_does_not_scroll_and_there_is_no_horizontal_motion() {
    let (_project, opened) = open(&long_text(400));
    settled(&opened);
    let window = &opened.window;
    let at = point(window, 3, 100.0);
    window.window().dispatch_event(WindowEvent::KeyPressed {
        text: Key::Shift.into(),
    });
    window.window().dispatch_event(WindowEvent::PointerScrolled {
        position: at,
        delta_x: 0.0,
        delta_y: -300.0,
    });
    for _ in 0..40 {
        update_timers_and_animations();
        std::thread::sleep(Duration::from_millis(10));
    }
    window.window().dispatch_event(WindowEvent::KeyReleased {
        text: Key::Shift.into(),
    });
    assert_eq!(window.get_scroll_y(), 0.0, "Shift+wheel scrolled the view");
    window.window().dispatch_event(WindowEvent::PointerScrolled {
        position: at,
        delta_x: 0.0,
        delta_y: -300.0,
    });
    until("a plain wheel turn did not scroll the view", || {
        return window.get_scroll_y() < 0.0;
    });
    window.hide().expect("close wrap window");
}
