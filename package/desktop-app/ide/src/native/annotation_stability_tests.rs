//! Which rendered pixels may move when virtual rows appear,
//!  change,
//!  or vanish,
//!  and which may not.
//!
//! Hints and diagnostic messages take rows above their code line,
//!  so they move text.
//!  These tests pin the
//! limits on real window frames:
//!  rows arriving above the view move nothing visible;
//!  rows arriving in view move
//! only what lies beneath them,
//!  by exactly their height;
//!  an external reload keeps the rows' space until
//! annotations of the new text return;
//!  and scrolling across an annotated line is rigid,
//!  pixel by pixel.

/// The production setter and the stamp of the displayed text.
use super::annotate::{displayed, set_annotations};
/// The frame reader.
use super::annotation_paint_tests::frame;
/// Snapshot builders and the text origin shared with the behavior tests.
use super::annotation_tests::{TEXT_LEFT, TEXT_TOP, hint, problem};
/// The complete reader fixture,
///  its opener,
///  and its bounded wait.
use super::find_tests::{Reader, eventually, reader};
/// Snapshot records exactly as the Language module builds them.
use ide_app::language::{
    diagnostics::{Diagnostic, DiagnosticsSnapshot, Severity, SourceGroup},
    hints::{HintsSnapshot, InlayHint},
};
/// The vertical mapping and the heights virtual rows are built from.
use ide_app::{
    row_map::RowMap,
    virtual_row::{BLOCK_GAP, ROW_HEIGHT},
};
/// What:
///  Frames and pixels read back from the rendered window;
///  `update_timers_and_animations` runs the
///       toolkit's pending change handlers and timers.
/// Why:
///  Every assertion here is about rendered pixels.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { type Rgba8Pixel, type SharedPixelBuffer } from 'slint';
/// ```
use slint::{Rgba8Pixel, SharedPixelBuffer, platform::update_timers_and_animations};
/// Disposable fixtures and shared snapshot pointers.
use std::{fs, sync::Arc};

/// Characters per line of the numbered fixture:
///  `line NNN: value` and its terminator.
const LINE: usize = 16;
/// The gutter,
///  severity letters and line numbers,
///  starts this far left of the text.
const GUTTER: f32 = super::sidebar_tests::GUTTER;
/// Advance of one line-number digit at the gutter's 15 px.
const DIGIT: f32 = 9.0;
/// Space between a line number and the text.
const NUMBER_GAP: f32 = 12.0;
/// Rows of a code row above its underline band;
///  glyphs without descenders end there.
const ABOVE_UNDERLINE: usize = 17;

/// What:
///  A reader over `text` saved as plain text in a fresh disposable project;
///  the directory lives as long
///       as the reader.
///  The pair is (directory,
///  reader).
/// Why:
///  A plain-text file gets no syntax colors,
///  so a highlighting answer arriving between two frames cannot
///      change a pixel;
///  every difference these tests see comes from virtual rows.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function fixtureReader(text: string): [TempDir, Reader];
/// ```
fn fixture_reader(text: &str) -> (tempfile::TempDir, Reader) {
    let directory = tempfile::tempdir().expect("disposable stability project");
    fs::write(directory.path().join("notes.txt"), text).expect("stability fixture");
    let opened = reader(directory.path(), "notes.txt");
    return (directory, opened);
}

/// What:
///  Let a quarter of a second pass while the toolkit's timers run.
/// Why:
///  A scroll offset the test assigns counts as the reader scrolling,
///  and rows above the view wait 200 ms
///      after the last scroll before they may move the offset.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function idle(): Promise<void> { await sleep(250); }
/// ```
fn idle() {
    let start = std::time::Instant::now();
    while start.elapsed() < std::time::Duration::from_millis(250) {
        update_timers_and_animations();
        std::thread::sleep(std::time::Duration::from_millis(5));
    }
}

/// `count` numbered lines,
///  each [`LINE`] characters long with its terminator.
fn numbered(count: usize) -> String {
    let mut text = String::new();
    for index in 0..count {
        text.push_str(&format!("line {index:03}: value\n"));
    }
    return text;
}

/// Character offset of column `column` on line `line` of the numbered fixture.
fn at(line: usize, column: usize) -> usize {
    return line * LINE + column;
}

/// Install `hints` and `problems` for the text the reader displays now;
///  the hints answer for every line.
fn inject(reader: &Reader, hints: Vec<InlayHint>, problems: Vec<Diagnostic>) {
    let stamp = displayed(&reader.source.borrow());
    let lines = reader.source.borrow().document.text().len_lines();
    let hint_snapshot = Arc::new(HintsSnapshot {
        stamp,
        first_line: 0,
        last_line: lines,
        hints,
    });
    let problem_snapshot = Arc::new(DiagnosticsSnapshot {
        stamp,
        groups: vec![SourceGroup {
            source: "rustc".to_string(),
            items: problems,
        }],
    });
    // `Some(...)` hands both snapshots over as present values.
    set_annotations(
        &reader.window,
        &reader.source,
        Some(hint_snapshot),
        Some(problem_snapshot),
    );
    update_timers_and_animations();
}

/// The vertical mapping the reader paints with now.
fn map(reader: &Reader) -> RowMap {
    return reader.source.borrow().row_map.clone();
}

/// What:
///  The pixels of window row `y` from the start of the line numbers to the right edge;
///       `&[Rgba8Pixel]` lends that part of the frame.
/// Why:
///  A line is its number and its text;
///  both must move together or not at all.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function band(shown: Frame, y: number): Pixel[];
/// ```
fn band(shown: &SharedPixelBuffer<Rgba8Pixel>, y: f32) -> &[Rgba8Pixel] {
    let width = shown.width() as usize;
    let start = y as usize * width + (TEXT_LEFT - GUTTER) as usize;
    let end = (y as usize + 1) * width;
    return &shown.as_slice()[start..end];
}

/// What:
///  Pixels of a band left of line `line`'s number,
///  where its severity letter stands,
///  in files of fewer than
///       1000 lines.
/// Why:
///  The letter stands 4 px before the line's own number,
///  so its place depends on the number's digit count.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function letterRoom(line: number): number;
/// ```
fn letter_room(line: usize) -> usize {
    // `to_string().len()` counts the digits of the one-based line number.
    let digits = (line + 1).to_string().len();
    return (GUTTER - NUMBER_GAP - DIGIT * digits as f32) as usize;
}

/// What:
///  Check that line `line`'s code row has the same pixels in `after` as in `before`,
///  each at the place
///       its own mapping gives,
///  and answer how far the line moved.
///  `rows` limits the compared part of the row.
/// Why:
///  A line's number and text may move as a whole,
///  never change;
///  the distance is what the tests pin.
///  The
///      gutter's severity letter is left out:
///  a letter comes and goes with its line's diagnostics,
///  also
///      while a reload holds the space of rows that are not painted.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function moved(before: [Frame, RowMap], after: [Frame, RowMap], line: number, rows: number): number;
/// ```
fn moved(
    before: (&SharedPixelBuffer<Rgba8Pixel>, &RowMap),
    after: (&SharedPixelBuffer<Rgba8Pixel>, &RowMap),
    line: usize,
    rows: usize,
) -> f32 {
    let from = TEXT_TOP + before.1.code_top(line);
    let to = TEXT_TOP + after.1.code_top(line);
    // Everything left of the line's number is where its letter may stand.
    let skip = letter_room(line);
    for row in 0..rows {
        assert!(
            band(before.0, from + row as f32)[skip..] == band(after.0, to + row as f32)[skip..],
            "line {line} changed its pixels in row {row} of its code row"
        );
    }
    return to - from;
}

/// What:
///  The first pixel of the source view at which two frames differ,
///  with both colors,
///  or nothing when the
///       source view is the same in both;
///  `Option<String>` is that description or nothing.
/// Why:
///  A failing stability assertion must say where the frame changed,
///  not only that it did.
///  The project
///      tree beside the source view selects the opened file on its own schedule and is not compared.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function difference(first: Frame, second: Frame): string | undefined;
/// ```
fn difference(
    first: &SharedPixelBuffer<Rgba8Pixel>,
    second: &SharedPixelBuffer<Rgba8Pixel>,
) -> Option<String> {
    let mut y = TEXT_TOP;
    while y < first.height() as f32 {
        let before = band(first, y);
        let after = band(second, y);
        for (index, (old, new)) in before.iter().zip(after.iter()).enumerate() {
            if old != new {
                // `Some(...)` carries the description of the first differing pixel.
                return Some(format!(
                    "pixel {},{y} changed from {old:?} to {new:?}",
                    index + (TEXT_LEFT - GUTTER) as usize
                ));
            }
        }
        y += 1.0;
    }
    return None;
}

/// Hints arriving for visible lines move only what lies beneath them,
///  by exactly their block's height,
///  and
/// diagnostics arriving later do the same again;
///  nothing above the first changed line moves,
///  and the caret
/// stays on its line.
#[test]
fn rows_arriving_in_view_move_only_lines_beneath_them() {
    let (_directory, reader) = fixture_reader(&numbered(14));
    let window = &reader.window;
    update_timers_and_animations();
    let plain = (frame(window), map(&reader));
    let caret = (window.get_caret_x(), window.get_caret_y());
    // Hints arrive first: one above line 3 and one above line 6.
    let hints = vec![hint(at(3, 8), ": u32"), hint(at(6, 4), "n:")];
    inject(&reader, hints.clone(), Vec::new());
    let hinted = (frame(window), map(&reader));
    let row = BLOCK_GAP + ROW_HEIGHT;
    let mut movement = Vec::new();
    for line in 0..14 {
        movement.push(moved(
            (&plain.0, &plain.1),
            (&hinted.0, &hinted.1),
            line,
            24,
        ));
    }
    println!("movement when hints arrive for lines 3 and 6: {movement:?}");
    assert_eq!(
        movement[..3],
        [0.0, 0.0, 0.0],
        "a line above the first hint moved"
    );
    assert_eq!(movement[3..6], [row, row, row]);
    for distance in &movement[6..] {
        assert_eq!(*distance, 2.0 * row);
    }
    // Everything above the first block is the very same pixels, not only the code rows.
    let first_block = hinted.1.block_top(3);
    let mut y = TEXT_TOP;
    while y < TEXT_TOP + first_block {
        assert!(
            band(&plain.0, y) == band(&hinted.0, y),
            "a pixel above the first changed line moved in window row {y}"
        );
        y += 1.0;
    }
    assert_eq!((window.get_caret_x(), window.get_caret_y()), caret);
    assert_eq!(window.get_scroll_y(), 0.0);
    // Diagnostics arrive seconds later for some servers: a message on line 6, which already has a hint row,
    // and one on line 9, which has no block yet.
    let problems = vec![
        problem(at(6, 10), at(6, 15), Severity::Error, "E1", "wrong value"),
        problem(at(9, 0), at(9, 4), Severity::Warning, "W1", "unused line"),
    ];
    inject(&reader, hints, problems);
    let diagnosed = (frame(window), map(&reader));
    let mut later = Vec::new();
    for line in 0..14 {
        // Underlines appear on lines 6 and 9; the part of their rows above the underline band is compared.
        let mut rows = 24;
        if line == 6 || line == 9 {
            rows = ABOVE_UNDERLINE;
        }
        later.push(moved(
            (&hinted.0, &hinted.1),
            (&diagnosed.0, &diagnosed.1),
            line,
            rows,
        ));
    }
    println!("movement when diagnostics arrive later for lines 6 and 9: {later:?}");
    assert_eq!(later[..6], [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]);
    assert_eq!(
        later[6..9],
        [ROW_HEIGHT, ROW_HEIGHT, ROW_HEIGHT],
        "a message joining a hint row adds one row, no second gap"
    );
    for distance in &later[9..] {
        assert_eq!(*distance, ROW_HEIGHT + row);
    }
    let first_changed = diagnosed.1.block_top(6);
    let mut above = TEXT_TOP;
    while above < TEXT_TOP + first_changed {
        assert!(
            band(&hinted.0, above) == band(&diagnosed.0, above),
            "a pixel above the first changed line moved in window row {above}"
        );
        above += 1.0;
    }
}

/// Rows arriving,
///  changing,
///  and vanishing above the first visible code row move no visible pixel and repaint
/// nothing:
///  the scroll offset follows them.
///  At the very top of the text the view stays at the top instead.
#[test]
fn rows_arriving_above_the_view_move_no_visible_pixel() {
    let (_directory, reader) = fixture_reader(&numbered(200));
    let window = &reader.window;
    // Line 100 is cut by the top edge, seven pixels in.
    let offset = 100.0 * 24.0 + 7.0;
    window.set_scroll_y(-offset);
    update_timers_and_animations();
    let before = frame(window);
    let painted = || {
        let source = reader.source.borrow();
        return source.shaped.as_ref().expect("shaped").rows.as_ptr();
    };
    let original = painted();
    let row = BLOCK_GAP + ROW_HEIGHT;
    // Above the materialized lines: hints on lines 10 and 50 and an error on line 97; far below the view: a
    // hint on line 180.
    let hints = vec![
        hint(at(10, 4), "a:"),
        hint(at(50, 4), "b:"),
        hint(at(180, 4), "c:"),
    ];
    let error = vec![problem(
        at(97, 0),
        at(97, 4),
        Severity::Error,
        "E1",
        "wrong",
    )];
    // The test's own scroll counts as the reader scrolling; rows above the view wait until that is over.
    idle();
    inject(&reader, hints, error.clone());
    assert_eq!(
        -window.get_scroll_y(),
        offset + 3.0 * row,
        "the offset did not follow the rows that arrived above the view"
    );
    assert_eq!(
        difference(&before, &frame(window)),
        None,
        "a visible pixel moved when rows arrived above the view"
    );
    assert_eq!(
        painted(),
        original,
        "an unchanged visible part was repainted"
    );
    // A row above the view vanishes: again nothing visible moves.
    inject(
        &reader,
        vec![hint(at(50, 4), "b:"), hint(at(180, 4), "c:")],
        error,
    );
    assert_eq!(-window.get_scroll_y(), offset + 2.0 * row);
    assert_eq!(
        difference(&before, &frame(window)),
        None,
        "a visible pixel moved when a row vanished above the view"
    );
    assert_eq!(painted(), original);
    // Line 99 is materialized as overscan but lies above the top edge: its rows repaint the tile, and still
    // no visible pixel moves.
    let both = vec![
        problem(at(97, 0), at(97, 4), Severity::Error, "E1", "wrong"),
        problem(at(99, 0), at(99, 4), Severity::Warning, "W1", "odd"),
    ];
    inject(
        &reader,
        vec![hint(at(50, 4), "b:"), hint(at(180, 4), "c:")],
        both,
    );
    assert_eq!(-window.get_scroll_y(), offset + 3.0 * row);
    assert_eq!(
        difference(&before, &frame(window)),
        None,
        "a visible pixel moved when rows arrived for the line just above the view"
    );
    // Positive control: a row for a visible line does change the frame.
    inject(&reader, vec![hint(at(103, 4), "d:")], Vec::new());
    assert!(
        difference(&before, &frame(window)).is_some(),
        "a row in view changed nothing (positive control)"
    );
    // At the very top the view stays at the top: rows for the first line push the text down.
    let (_other, top_reader) = fixture_reader(&numbered(40));
    update_timers_and_animations();
    inject(&top_reader, vec![hint(4, "first:")], Vec::new());
    assert_eq!(top_reader.window.get_scroll_y(), 0.0);
    assert_eq!(top_reader.source.borrow().row_map.code_top(0), row);
    assert_eq!(top_reader.window.get_caret_y(), row + 2.0);
}

/// While the reader is scrolling,
///  rows arriving above the view wait:
///  assigning the scroll offset would cut the
/// toolkit's scroll animation short.
///  They are shown,
///  with the view kept still,
///  once scrolling has stopped.
/// Rows arriving in view never wait,
///  because they need no change of the offset.
#[test]
fn rows_above_the_view_wait_until_scrolling_has_stopped() {
    let (_directory, reader) = fixture_reader(&numbered(200));
    let window = &reader.window;
    let offset = 100.0 * 24.0 + 7.0;
    let row = BLOCK_GAP + ROW_HEIGHT;
    idle();
    window.set_scroll_y(-offset);
    update_timers_and_animations();
    let before = frame(window);
    // What: A closure that scrolls one pixel away and back, as the reader's wheel would.
    // Why: Taking a frame takes time; the scroll the rows must wait for has to be the latest thing that
    //      happened when they arrive.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const scroll = () => { window.scrollY = -(offset + 1); tick(); window.scrollY = -offset; tick(); };
    // ```
    let scroll = || {
        window.set_scroll_y(-(offset + 1.0));
        update_timers_and_animations();
        window.set_scroll_y(-offset);
        update_timers_and_animations();
    };
    // The reader scrolls, and a hint for line 10 arrives at once.
    scroll();
    inject(&reader, vec![hint(at(10, 4), "a:")], Vec::new());
    assert_eq!(
        -window.get_scroll_y(),
        offset,
        "rows above the view moved the offset while the reader was scrolling"
    );
    assert_eq!(reader.source.borrow().row_map.block_height(10), 0.0);
    assert_eq!(difference(&before, &frame(window)), None);
    // A hint for a visible line arrives together with the one above the view while the reader still scrolls.
    scroll();
    inject(
        &reader,
        vec![hint(at(10, 4), "a:"), hint(at(104, 4), "b:")],
        Vec::new(),
    );
    assert_eq!(
        reader.source.borrow().row_map.block_height(104),
        0.0,
        "a change that also moves the offset waits as a whole"
    );
    // Scrolling has stopped: the rows are shown and nothing above line 104's block moves.
    eventually("rows that waited for scrolling were never shown", || {
        return reader.source.borrow().row_map.block_height(10) == row;
    });
    update_timers_and_animations();
    assert_eq!(-window.get_scroll_y(), offset + row);
    let after = frame(window);
    let shown = map(&reader);
    let mut y = TEXT_TOP;
    while y < TEXT_TOP + shown.block_top(104) - (offset + row) {
        assert!(
            band(&before, y) == band(&after, y),
            "a visible pixel above the new row moved in window row {y}"
        );
        y += 1.0;
    }
    assert_eq!(shown.block_height(104), row);
    // A scroll step whose change handler has not run yet is scrolling too: rows that arrive in the render
    // right after it wait, and are shown once scrolling has stopped.
    idle();
    let resting = -window.get_scroll_y();
    window.set_scroll_y(-(resting + 3.0));
    inject(
        &reader,
        vec![
            hint(at(10, 4), "a:"),
            hint(at(20, 4), "c:"),
            hint(at(104, 4), "b:"),
        ],
        Vec::new(),
    );
    assert_eq!(
        map(&reader).block_height(20),
        0.0,
        "rows above the view were shown during a scroll step whose change handler had not run yet"
    );
    eventually(
        "rows that waited for a scroll step were never shown",
        || {
            return reader.source.borrow().row_map.block_height(20) == row;
        },
    );
}

/// After an external change the old rows are not painted,
///  but their space stays,
///  so no line moves;
///  when the
/// same annotations return for the new text the frame is the one from before the change.
///  Nothing jumps twice.
#[test]
fn a_reload_holds_row_space_until_annotations_return() {
    let (directory, reader) = fixture_reader(&numbered(14));
    let window = &reader.window;
    let hints = vec![hint(at(3, 8), ": u32"), hint(at(6, 4), "n:")];
    let problems = vec![problem(
        at(6, 10),
        at(6, 15),
        Severity::Error,
        "E1",
        "wrong value",
    )];
    inject(&reader, hints.clone(), problems.clone());
    let annotated = (frame(window), map(&reader));
    let revision = reader.source.borrow().document.revision();
    // Line 12 changes without changing its length, so every annotated position stays valid.
    let changed = numbered(14).replace("line 012: value", "line 012: other");
    fs::write(directory.path().join("notes.txt"), &changed).expect("external change");
    eventually("the external change was not reloaded", || {
        return reader.source.borrow().document.revision() > revision;
    });
    update_timers_and_animations();
    let held = (frame(window), map(&reader));
    assert_eq!(held.1, annotated.1, "the reload changed where lines are");
    let mut movement = Vec::new();
    for line in 0..12 {
        // The underline of line 6 is stale and gone; the rest of every code row is unchanged.
        let mut rows = 24;
        if line == 6 {
            rows = ABOVE_UNDERLINE;
        }
        movement.push(moved(
            (&annotated.0, &annotated.1),
            (&held.0, &held.1),
            line,
            rows,
        ));
    }
    println!("movement at an external reload, rows held: {movement:?}");
    for distance in &movement {
        assert_eq!(*distance, 0.0, "a line moved at the reload");
    }
    // The held space is empty: every pixel of line 6's block is the row's own first pixel, the background.
    let block_top = TEXT_TOP + held.1.block_top(6);
    let mut y = block_top;
    while y < TEXT_TOP + held.1.code_top(6) {
        let pixels = band(&held.0, y);
        for found in &pixels[GUTTER as usize..] {
            assert!(
                *found == pixels[GUTTER as usize],
                "a stale row was painted for the new text in window row {y}"
            );
        }
        y += 1.0;
    }
    // The same annotations arrive for the new text: every line above the changed one is as before the change.
    inject(&reader, hints, problems);
    let returned = (frame(window), map(&reader));
    let mut back = TEXT_TOP;
    while back < TEXT_TOP + returned.1.block_top(12) {
        assert!(
            band(&annotated.0, back) == band(&returned.0, back),
            "window row {back} differs after the annotations returned"
        );
        back += 1.0;
    }
}

/// Scrolling pixel by pixel across consecutive annotated lines moves the whole frame rigidly:
///  each frame is
/// the previous one shifted by one row,
///  also where an annotated line and its block leave the top of the view
/// and the materialized tile changes.
#[test]
fn scrolling_across_annotated_lines_is_rigid() {
    let (_directory, reader) = fixture_reader(&numbered(80));
    let window = &reader.window;
    let hints = vec![hint(at(5, 8), ": u32"), hint(at(6, 4), "n:")];
    let problems = vec![problem(
        at(5, 10),
        at(5, 15),
        Severity::Error,
        "E1",
        "wrong value\nexpected another",
    )];
    inject(&reader, hints, problems);
    let height = frame(window).height() as f32;
    // From a few pixels above line 5's block to a few pixels into line 7's code row.
    let start = map(&reader).block_top(5) as usize - 6;
    let end = map(&reader).code_top(7) as usize + 6;
    window.set_scroll_y(-(start as f32));
    update_timers_and_animations();
    let mut previous = frame(window);
    let first_tile = reader.source.borrow().first;
    let mut tiles = 0;
    for offset in start + 1..=end {
        window.set_scroll_y(-(offset as f32));
        update_timers_and_animations();
        let current = frame(window);
        let mut y = TEXT_TOP + 1.0;
        while y < height - 1.0 {
            assert!(
                band(&current, y) == band(&previous, y + 1.0),
                "the frame at offset {offset} is not the previous one shifted by one row (window row {y})"
            );
            y += 1.0;
        }
        if reader.source.borrow().first != first_tile {
            tiles += 1;
        }
        previous = current;
    }
    assert!(
        tiles > 0,
        "the materialized tile never changed, so the test did not cross a tile boundary"
    );
    println!(
        "scrolled {} offsets across the blocks of lines 5 and 6 with rigid frames",
        end - start
    );
}
