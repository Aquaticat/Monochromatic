//! Which rendered pixels may move when virtual rows appear, change, or vanish, and which may not.
//!
//! Hints and diagnostic messages take rows above their code line, so they move text. These tests pin the
//! limits on real window frames: rows arriving above the view move nothing visible; rows arriving in view move
//! only what lies beneath them, by exactly their height; an external reload keeps the rows' space until
//! annotations of the new text return; and scrolling across an annotated line is rigid, pixel by pixel.

/// The production setter and the stamp of the displayed text.
use super::annotate::{displayed, set_annotations};
/// The frame reader.
use super::annotation_paint_tests::frame;
/// Snapshot builders and the text origin shared with the behavior tests.
use super::annotation_tests::{TEXT_LEFT, TEXT_TOP, hint, problem};
/// The complete reader fixture, its opener, and its bounded wait.
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
/// What: Frames and pixels read back from the rendered window; `update_timers_and_animations` runs the
///       toolkit's pending change handlers and timers.
/// Why: Every assertion here is about rendered pixels.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { type Rgba8Pixel, type SharedPixelBuffer } from 'slint';
/// ```
use slint::{Rgba8Pixel, SharedPixelBuffer, platform::update_timers_and_animations};
/// Disposable fixtures and shared snapshot pointers.
use std::{fs, sync::Arc};

/// Characters per line of the numbered fixture: `line NNN: value` and its terminator.
const LINE: usize = 16;
/// The line numbers start this far left of the text: the 56 px gutter.
const GUTTER: f32 = 56.0;
/// Rows of a code row above its underline band; glyphs without descenders end there.
const ABOVE_UNDERLINE: usize = 17;

/// What: A reader over `text` saved as plain text in a fresh disposable project; the directory lives as long
///       as the reader. The pair is (directory, reader).
/// Why: A plain-text file gets no syntax colors, so a highlighting answer arriving between two frames cannot
///      change a pixel; every difference these tests see comes from virtual rows.
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

/// `count` numbered lines, each [`LINE`] characters long with its terminator.
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

/// Install `hints` and `problems` for the text the reader displays now; the hints answer for every line.
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

/// What: The pixels of window row `y` from the start of the line numbers to the right edge;
///       `&[Rgba8Pixel]` lends that part of the frame.
/// Why: A line is its number and its text; both must move together or not at all.
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

/// What: Check that line `line`'s code row has the same pixels in `after` as in `before`, each at the place
///       its own mapping gives, and answer how far the line moved. `rows` limits the compared part of the row.
/// Why: A line may move as a whole, never change; the distance is what the tests pin.
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
    for row in 0..rows {
        assert!(
            band(before.0, from + row as f32) == band(after.0, to + row as f32),
            "line {line} changed its pixels in row {row} of its code row"
        );
    }
    return to - from;
}

/// Hints arriving for visible lines move only what lies beneath them, by exactly their block's height, and
/// diagnostics arriving later do the same again; nothing above the first changed line moves, and the caret
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

/// Rows arriving, changing, and vanishing above the first visible code row move no visible pixel and repaint
/// nothing: the scroll offset follows them. At the very top of the text the view stays at the top instead.
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
    inject(&reader, hints, error.clone());
    assert_eq!(
        -window.get_scroll_y(),
        offset + 3.0 * row,
        "the offset did not follow the rows that arrived above the view"
    );
    assert!(
        frame(window).as_slice() == before.as_slice(),
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
    assert!(
        frame(window).as_slice() == before.as_slice(),
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
    assert!(
        frame(window).as_slice() == before.as_slice(),
        "a visible pixel moved when rows arrived for the line just above the view"
    );
    // Positive control: a row for a visible line does change the frame.
    inject(&reader, vec![hint(at(103, 4), "d:")], Vec::new());
    assert!(
        frame(window).as_slice() != before.as_slice(),
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

/// After an external change the old rows are not painted, but their space stays, so no line moves; when the
/// same annotations return for the new text the frame is the one from before the change. Nothing jumps twice.
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

/// Scrolling pixel by pixel across consecutive annotated lines moves the whole frame rigidly: each frame is
/// the previous one shifted by one row, also where an annotated line and its block leave the top of the view
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
