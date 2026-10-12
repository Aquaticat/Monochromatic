//! Wrapped lines in the vertical map, the row cache, the passes over it, and the frame's geometry:
//!  per-line visual rows, re-breaking without shaping, rows placed by what was shaped,
//!  hits and selection ink on continuation rows, and the wrap indicator.
//! No window is opened.

/// The marks that become underlines, laid out against the frame's rows.
use ide_app::annotation::{Mark, Visible};
/// Underline runs, with their inks.
use ide_app::annotation_layout::{AnnotationColors, lay_out};
/// Canonical source of the lines under test and the position that selects a range.
use ide_app::document::{Document, ReadingAffinity, ReadingPosition};
/// The severity that picks an underline's line style.
use ide_app::language::diagnostics::Severity;
/// The visual row counts and the map built from them.
use ide_app::line_rows::LineRows;
/// The vertical mapping under test.
use ide_app::row_map::{CODE_ROW, Place, RowMap};
/// Shaper, viewport, the clip of a very tall line, and the rasterizer whose ink is read back.
use ide_app::shaped_text::{Clip, TextShaper, Viewport};
/// Palette of the raster tests, and the limit of one raster.
use ide_app::text_raster::{CodeColors, MAX_RASTER_BYTES, TextRaster};
/// The wrap indicator chain.
use ide_app::wrap_sign::{SIGN_INK, SIGN_PAIRS, Sign, choose_sign};

/// A long line of ordinary code that wraps at the widths used here.
const CODE: &str = "let value = compute_total(first_item, second_item); // a long comment that keeps going and going";

/// A map of ten lines where lines 2, 3, and 7 are wrapped to 3, 2, and 5 rows and line 3 owns a 26 px block.
fn wrapped_map() -> RowMap {
    let mut rows = LineRows::plain(10);
    rows.apply([(2, 3), (3, 2), (7, 5)]);
    return RowMap::new(10, &[(3, 26.0)]).with_rows(&rows);
}

/// Every line counts one row until it is measured, and a changed count reads back.
#[test]
fn rows_start_at_one_and_read_back_what_was_set() {
    let mut rows = LineRows::plain(1000);
    assert_eq!(rows.rows(0), 1);
    assert_eq!(rows.rows(999), 1);
    assert_eq!(rows.rows(5000), 1, "a line the table lacks counts as one");
    assert!(rows.apply([(300, 4)]));
    assert_eq!(rows.rows(300), 4);
    assert_eq!(rows.extra_before(300), 0);
    assert_eq!(rows.extra_before(301), 3);
    assert_eq!(rows.total_extra(), 3);
    assert!(!rows.apply([(300, 4)]), "the same count changes nothing");
    assert!(rows.apply([(300, 0)]), "a count below one is one");
    assert_eq!(rows.rows(300), 1);
    assert_eq!(rows.total_extra(), 0);
}

/// A copy shares its chunks, and changing the copy leaves the original alone.
#[test]
fn a_copy_changes_without_touching_the_original() {
    let mut original = LineRows::plain(2000);
    original.apply([(10, 2), (1500, 3)]);
    let mut copy = original.clone();
    assert!(copy == original);
    copy.apply([(10, 5), (1900, 2)]);
    assert!(copy != original);
    assert_eq!(original.rows(10), 2);
    assert_eq!(original.rows(1900), 1);
    assert_eq!(copy.rows(10), 5);
    assert_eq!(copy.rows(1900), 2);
    assert_eq!(copy.rows(1500), 3, "an untouched chunk is shared");
    assert_eq!(original.total_extra(), 1 + 2);
    assert_eq!(copy.total_extra(), 4 + 2 + 1);
}

/// Wrapped lines push everything beneath them down by their extra rows, and nothing above.
#[test]
fn wrapped_lines_push_later_lines_down() {
    let map = wrapped_map();
    assert_eq!(map.code_top(0), 0.0);
    assert_eq!(map.code_top(2), 48.0, "nothing above line 2 moved");
    assert_eq!(map.code_bottom(2), 48.0 + 3.0 * CODE_ROW);
    assert_eq!(
        map.block_top(3),
        48.0 + 72.0,
        "line 3 starts under line 2's three rows"
    );
    assert_eq!(map.code_top(3), 120.0 + 26.0);
    assert_eq!(map.code_bottom(3), 120.0 + 26.0 + 48.0);
    assert_eq!(map.code_top(4), 194.0);
    assert_eq!(map.code_top(8), 194.0 + 3.0 * 24.0 + 5.0 * 24.0);
    // Ten lines, nine of one row, plus 2 + 1 + 4 extra rows and one block.
    assert_eq!(map.height(), (10.0 + 7.0) * CODE_ROW + 26.0);
    assert_eq!(map.rows_of(7), 5);
    assert_eq!(map.rows_of(99), 1);
}

/// Every pixel belongs to exactly one line, whatever the line's height.
#[test]
fn every_pixel_belongs_to_one_line_with_wrapped_lines() {
    let map = wrapped_map();
    let mut previous = 0;
    let mut y: f32 = 0.0;
    while y < map.height() {
        let place = map.locate(y);
        assert!(
            place.line == previous || place.line == previous + 1,
            "line {} after {previous} at {y}",
            place.line
        );
        assert!(y >= map.block_top(place.line) && y < map.code_bottom(place.line));
        assert_eq!(place.in_block, y < map.code_top(place.line));
        previous = place.line;
        y += 0.5;
    }
    assert_eq!(previous, 9);
    assert_eq!(
        map.locate(map.code_top(2) + 40.0),
        Place {
            line: 2,
            in_block: false
        }
    );
    assert_eq!(map.visual_row_at(2, map.code_top(2) + 40.0), 1);
    assert_eq!(map.visual_row_at(2, map.code_top(2) + 71.9), 2);
    assert_eq!(
        map.visual_row_at(2, map.code_top(2) + 500.0),
        2,
        "below the rows is the last row"
    );
    assert_eq!(map.visual_row_at(2, -5.0), 0);
}

/// A page step counts visual rows, and a block counts with the first row of its line.
#[test]
fn a_page_step_counts_visual_rows_with_the_blocks_above_their_first_rows() {
    let map = wrapped_map();
    let (rows, pixels) = map.page(map.code_top(2), 150.0, true);
    assert_eq!(
        rows, 5,
        "line 2 takes three rows (72 px), line 3 takes 26 + 24 for its first row and 24 for its second"
    );
    assert_eq!(pixels, 72.0 + 50.0 + 24.0);
    let (three, taken) = map.page(map.code_top(2), 100.0, true);
    assert_eq!(
        (three, taken),
        (3, 72.0),
        "the first row of line 3 carries its 26 px block, so it would end at 122 px and does not fit"
    );
}

/// A table for a million lines answers a position in a handful of lookups and copies in microseconds.
#[test]
fn a_million_lines_stay_cheap() {
    let mut rows = LineRows::plain(1_000_000);
    rows.apply((0..1_000_000).step_by(1000).map(|line| return (line, 3)));
    let map = RowMap::plain(1_000_000).with_rows(&rows);
    let copy = map.clone();
    assert!(copy == map);
    assert_eq!(map.code_top(2000), 2000.0 * 24.0 + 2.0 * 2.0 * 24.0);
    let place = map.locate(map.code_top(777_000) + 30.0);
    assert_eq!(place.line, 777_000);
    assert_eq!(map.rows_of(777_000), 3);
}

/// A viewport of `count` lines from `first`, wrapped at `wrap` logical pixels.
fn viewport(first: usize, count: usize, wrap: f32) -> Viewport {
    return Viewport {
        first,
        count,
        width: wrap + 24.0,
        scale: 1.0,
        wrap: Some(wrap),
        clip: None,
    };
}

/// A frame that wraps places its rows by what it shaped, even when the map counts every line as one row.
#[test]
fn a_frame_places_wrapped_rows_by_their_own_heights() {
    let text = format!("short\n{CODE}\nshort\n{CODE}\nend\n");
    let document = Document::new(&text);
    let mut shaper = TextShaper::new();
    let plain = RowMap::plain(document.text().len_lines());
    let view = shaper.prepare_rows(&document, viewport(0, 6, 300.0), &[], &plain);
    let mut expected_top = 0.0;
    for row in &view.rows {
        assert_eq!(
            row.top, expected_top,
            "row {} sits right under the row before it",
            row.row
        );
        assert_eq!(view.map.rows_of(row.row), row.visual_rows());
        expected_top += row.visual_rows() as f32 * CODE_ROW;
    }
    assert!(view.rows[1].visual_rows() > 1, "the long line wraps");
    assert_eq!(view.origin, 0.0);
    assert_eq!(view.height as f32, view.map.block_top(6).max(CODE_ROW));
    assert!(
        view.map != plain,
        "the frame's map carries the measured rows"
    );
}

/// Bringing lines in shapes them once, and asking again at the same width shapes nothing.
#[test]
fn measuring_twice_shapes_once() {
    let text = format!("{CODE}\n").repeat(40);
    let document = Document::new(&text);
    let mut shaper = TextShaper::new();
    let first = shaper.measure_lines(&document, 0..40, 1.0, Some(300.0), &[]);
    assert_eq!(first.shaped, 40);
    assert_eq!(first.rebroken, 0);
    assert_eq!(first.lines.len(), 40);
    assert!(first.lines.iter().all(|(_, rows)| return *rows > 1));
    let again = shaper.measure_lines(&document, 0..40, 1.0, Some(300.0), &[]);
    assert_eq!((again.shaped, again.rebroken), (0, 0));
    assert_eq!(again.lines, first.lines);
}

/// A new width breaks the kept rows again, shapes none, and ends with the rows a fresh shape gives.
#[test]
fn a_new_width_breaks_kept_rows_again_without_shaping() {
    let spaced = "        let value = compute_total(first_item, second_item); // trailing words keep it going on";
    let blanks = "                                                                      x";
    let mut lines = Vec::new();
    for index in 0..30 {
        lines.push(format!("{}{}", " ".repeat(index % 7), CODE));
    }
    lines.push(spaced.to_string());
    lines.push(blanks.to_string());
    lines.push("\tlet tabbed = 1; // a leading tab and then enough words to wrap around at least once more".to_string());
    let text = lines.join("\n");
    let document = Document::new(&text);
    let count = document.text().len_lines();
    let mut kept = TextShaper::new();
    let mut fresh = TextShaper::new();
    kept.measure_lines(&document, 0..count, 1.0, Some(420.0), &[]);
    let shaped_before = kept.shaped_rows();
    for width in [300.0, 180.0, 640.0, 90.0] {
        let moved = kept.measure_lines(&document, 0..count, 1.0, Some(width), &[]);
        assert_eq!(
            moved.shaped, 0,
            "width {width}: no line may be shaped again"
        );
        assert_eq!(
            moved.rebroken as usize, count,
            "width {width}: every kept row is broken again"
        );
        fresh.forget_rows();
        let wanted = fresh.measure_lines(&document, 0..count, 1.0, Some(width), &[]);
        assert_eq!(
            moved.lines, wanted.lines,
            "width {width}: row counts equal a fresh shaping"
        );
        // The rows the cache now holds are the re-broken ones; a fresh shaping must agree with each of them.
        let plain = RowMap::plain(count);
        let view = kept.prepare_rows(&document, viewport(0, count, width), &[], &plain);
        for kept_row in &view.rows {
            let fresh_row = fresh.wrapped_row(&document, kept_row.row, 1.0, width);
            assert_eq!(kept_row.visual_rows(), fresh_row.visual_rows());
            for index in 0..kept_row.visual_rows() {
                assert_eq!(
                    kept_row.visual_row_bytes(index),
                    fresh_row.visual_row_bytes(index),
                    "width {width}, line {}, row {index}: same break",
                    kept_row.row
                );
                let start =
                    kept_row.visual_row_sources(index).expect("row").start + kept_row.source_start;
                let (left, right) = (
                    kept_row.caret_at(start, ReadingAffinity::Downstream, 1.0),
                    fresh_row.caret_at(start, ReadingAffinity::Downstream, 1.0),
                );
                assert!(
                    (left.x - right.x).abs() < 0.01,
                    "width {width}: row start x {} vs {}",
                    left.x,
                    right.x
                );
            }
        }
    }
    assert_eq!(kept.shaped_rows(), shaped_before, "no resize shaped a line");
    assert!(kept.rebroken_rows() >= 4 * count as u64);
}

/// Rows broken again at a new width at scale 2 count as many rows as a fresh shaping gives:
///  the continuation indent is the same on both paths.
#[test]
fn a_new_width_breaks_kept_rows_like_a_fresh_shaping_at_scale_two() {
    let mut lines = Vec::new();
    for index in 0..30 {
        lines.push(format!("{}{}", " ".repeat(2 + index % 9), CODE));
    }
    let text = lines.join("\n");
    let document = Document::new(&text);
    let count = document.text().len_lines();
    let mut kept = TextShaper::new();
    let mut fresh = TextShaper::new();
    kept.measure_lines(&document, 0..count, 2.0, Some(420.0), &[]);
    for width in [300.0, 180.0, 640.0] {
        let moved = kept.measure_lines(&document, 0..count, 2.0, Some(width), &[]);
        assert_eq!(moved.shaped, 0, "width {width}: no line is shaped again");
        fresh.forget_rows();
        let wanted = fresh.measure_lines(&document, 0..count, 2.0, Some(width), &[]);
        assert_eq!(
            moved.lines, wanted.lines,
            "scale 2 width {width}: broken again like a fresh shaping"
        );
    }
}

/// A click inside a continuation row resolves in that row, and the caret there is drawn on that row.
#[test]
fn hits_and_carets_on_continuation_rows_resolve_in_their_row() {
    let document = Document::new(CODE);
    let mut shaper = TextShaper::new();
    let plain = RowMap::plain(1);
    let view = shaper.prepare_rows(&document, viewport(0, 1, 200.0), &[], &plain);
    let row = &view.rows[0];
    assert!(row.visual_rows() >= 3);
    for index in 0..row.visual_rows() {
        let bytes = row.visual_row_bytes(index).expect("row exists");
        let y = row.visual_row_offset(index, 1.0) + CODE_ROW / 2.0;
        let hit = view.hit_at(&document, 0, 20.0, y);
        let local = hit - row.source_start;
        let byte = row.projection.source_to_byte[local];
        assert!(
            bytes.contains(&byte) || (index + 1 == row.visual_rows() && byte == bytes.end),
            "row {index}: a click at x 20 landed in byte {byte}, outside {bytes:?}"
        );
    }
    // The caret at the first character of the second row is on that row, one code row down.
    let second = row.visual_row_sources(1).expect("second row").start;
    let mut moved = Document::new(CODE);
    moved.select(ReadingPosition {
        anchor: second,
        head: second,
        viewport: 0,
        affinity: ReadingAffinity::Downstream,
    });
    let lower = view.caret(&moved);
    moved.select(ReadingPosition {
        anchor: second,
        head: second,
        viewport: 0,
        affinity: ReadingAffinity::Upstream,
    });
    let upper = view.caret(&moved);
    assert_eq!(lower.y, CODE_ROW + 2.0, "downstream draws on the lower row");
    assert_eq!(upper.y, 2.0, "upstream draws on the upper row");
    assert!(upper.x > lower.x);
}

/// Selected ink reaches the glyphs of every visual row of a selected wrapped line.
#[test]
fn selected_ink_reaches_continuation_rows() {
    let mut document = Document::new(CODE);
    let end = document.text().len_chars();
    document.select(ReadingPosition {
        anchor: 0,
        head: end,
        viewport: 0,
        affinity: ide_app::document::ReadingAffinity::Downstream,
    });
    let mut shaper = TextShaper::new();
    let plain = RowMap::plain(1);
    let view = shaper.prepare_rows(&document, viewport(0, 1, 200.0), &[], &plain);
    assert!(view.rows[0].visual_rows() >= 3);
    assert_eq!(
        view.selections.len(),
        view.rows[0].visual_rows(),
        "one rectangle per visual row"
    );
    let colors = CodeColors {
        foreground: [0, 0, 0, 255],
        selected: [255, 0, 0, 255],
        dark: false,
    };
    let pixels = TextRaster::new().paint(&view, colors, 0.0).expect("raster");
    let width = pixels.width as usize;
    for index in 0..view.rows[0].visual_rows() {
        let top = index * CODE_ROW as usize;
        let mut red = 0;
        let mut black = 0;
        for y in top..top + CODE_ROW as usize {
            for x in 0..width {
                let at = (y * width + x) * 4;
                let (r, g) = (pixels.bytes[at], pixels.bytes[at + 1]);
                if pixels.bytes[at + 3] > 128 {
                    if r > 128 && g < 64 {
                        red += 1;
                    } else if r < 64 {
                        black += 1;
                    }
                }
            }
        }
        assert!(red > 20, "row {index} has selected ink");
        assert_eq!(black, 0, "row {index} has no unselected ink left");
    }
}

/// Tabs end on their stops at every width and scale, on every row they end on.
#[test]
fn tab_correction_settles_at_every_width() {
    let text = "a\tb\tc\td\te\tf\tg\th\ti\tj\tk\tl\tm\tn\to\tp\tq\tr\ts\tt\tu\tv\tw\tx\ty\tz\t\t\tlong_identifier_after_tabs\t\tx";
    let mixed = "\t\tfn\tcompute(\tvalue:\tu32)\t->\tu32\t{\t\tlet\ttotal\t=\tvalue\t*\t2;\t\treturn\ttotal;\t}";
    let mut broken = Vec::new();
    for scale in [1.0_f32, 2.0] {
        let mut shaper = TextShaper::new();
        let space = {
            let probe = Document::new(" ");
            shaper.row(&probe, 0, scale).caret_x(1, scale)
        };
        for source in [text, mixed] {
            let document = Document::new(source);
            let mut width = 40.0;
            while width < 700.0 {
                let row = shaper.wrapped_row(&document, 0, scale, width);
                for byte in row.projection.tabs.clone() {
                    let source_after = row.projection.byte_to_source[byte + 1];
                    let end = row.caret_at(
                        row.source_start + source_after,
                        ReadingAffinity::Upstream,
                        scale,
                    );
                    let start_row = {
                        let mut found = 0;
                        for index in 0..row.visual_rows() {
                            if row.visual_row_bytes(index).expect("row").start <= byte {
                                found = index;
                            }
                        }
                        found
                    };
                    if end.row != start_row {
                        continue;
                    }
                    let stop = space * 2.0;
                    let remainder = (end.x / stop).fract();
                    if !(remainder.abs() < 0.02 || (1.0 - remainder).abs() < 0.02) {
                        broken.push((scale, width, byte, end.x));
                    }
                }
                width += 7.0;
            }
        }
    }
    assert!(
        broken.is_empty(),
        "{} tabs ended off their stops: {broken:?}",
        broken.len()
    );
}

/// The wrap indicator is the first pair both of whose symbols the fonts display, else an arrow.
#[test]
fn the_sign_is_the_first_displayable_pair_or_an_arrow() {
    let all = |_: char| return true;
    assert_eq!(choose_sign(all), Sign::Glyph('\u{2925}'));
    let without_first = |character: char| return character != '\u{2926}';
    assert_eq!(choose_sign(without_first), Sign::Glyph('\u{21B3}'));
    let only_last_pair =
        |character: char| return SIGN_PAIRS[3].0 == character || SIGN_PAIRS[3].1 == character;
    assert_eq!(choose_sign(only_last_pair), Sign::Glyph('\u{21AA}'));
    let after_only = |character: char| return character == '\u{2925}';
    assert_eq!(
        choose_sign(after_only),
        Sign::Arrow,
        "a pair needs both of its symbols, as in IntelliJ's TextBasedSoftWrapPainter"
    );
    let none = |_: char| return false;
    assert_eq!(choose_sign(none), Sign::Arrow);
}

/// The shaper tells a displayable character from one no font has.
#[test]
fn coverage_is_read_from_the_shaped_glyphs() {
    let mut shaper = TextShaper::new();
    assert!(shaper.can_display('A', 1.0));
    assert!(shaper.can_display('\u{2192}', 1.0) || !shaper.can_display('\u{10FFFE}', 1.0));
    assert!(
        !shaper.can_display('\u{10FFFE}', 1.0),
        "a noncharacter has no glyph in any font"
    );
}

/// The sign image carries ink in the sign color, for a symbol and for the drawn arrow, at both scales.
#[test]
fn the_sign_image_is_painted_in_the_sign_color() {
    let mut shaper = TextShaper::new();
    let mut raster = TextRaster::new();
    let chosen = shaper.choose_sign(1.0);
    for sign in [chosen, Sign::Arrow] {
        for scale in [1.0_f32, 2.0] {
            let pixels = shaper
                .sign_pixels(&mut raster, sign, scale, 12.0)
                .expect("sign");
            assert_eq!(pixels.height as f32, CODE_ROW * scale);
            let mut inked = 0;
            for chunk in pixels.bytes.chunks(4) {
                if chunk[3] > 0 {
                    inked += 1;
                    // Premultiplied: each channel is the sign color scaled by the pixel's alpha.
                    for channel in 0..3 {
                        let expected = u32::from(SIGN_INK[channel]) * u32::from(chunk[3]) / 255;
                        assert!(
                            u32::from(chunk[channel]).abs_diff(expected) <= 1,
                            "{sign:?} at {scale}: channel {channel} is {} for alpha {}",
                            chunk[channel],
                            chunk[3]
                        );
                    }
                }
            }
            assert!(inked > 4, "{sign:?} at scale {scale} has ink");
        }
    }
}

/// An underline across a wrap break is laid out once for each visual row it crosses, each on its own row.
#[test]
fn underlines_across_a_wrap_break_stand_on_their_own_rows() {
    let document = Document::new(CODE);
    let mut shaper = TextShaper::new();
    let plain = RowMap::plain(1);
    let view = shaper.prepare_rows(&document, viewport(0, 1, 200.0), &[], &plain);
    let row = &view.rows[0];
    let second = row.visual_row_sources(1).expect("second row").start;
    let mark = Mark {
        start: second - 3,
        end: second + 3,
        severity: Severity::Error,
    };
    let visible = Visible {
        blocks: Vec::new(),
        marks: vec![mark],
    };
    let colors = AnnotationColors {
        hint: [1, 2, 3, 255],
        error: [200, 0, 0, 255],
        warning: [200, 100, 0, 255],
        information: [0, 0, 200, 255],
        suggestion: [90, 90, 90, 255],
    };
    let frame = lay_out(&view, &visible, &mut shaper, colors);
    let mut offsets: Vec<f32> = frame
        .underlines
        .iter()
        .map(|run| return run.offset)
        .collect();
    offsets.sort_by(f32::total_cmp);
    assert_eq!(
        offsets.len(),
        2,
        "one run for each visual row the mark crosses"
    );
    assert_eq!(
        offsets[0], 0.0,
        "the run on the upper row stays on the first row"
    );
    assert_eq!(
        offsets[1], CODE_ROW,
        "the run on the lower row is not drawn on its own visual row"
    );
    // Painted, the lower run's ink lands in the lower row's pixel band and none of it in the rows below.
    let pixels = TextRaster::new()
        .paint(
            &{
                let mut framed = shaper.prepare_rows(&document, viewport(0, 1, 200.0), &[], &plain);
                framed.annotations = Some(frame);
                framed
            },
            CodeColors {
                foreground: [0, 0, 0, 255],
                selected: [255, 255, 255, 255],
                dark: false,
            },
            0.0,
        )
        .expect("raster");
    let width = pixels.width as usize;
    let mut red_rows = Vec::new();
    for y in 0..pixels.height as usize {
        let mut red = 0;
        for x in 0..width {
            let at = (y * width + x) * 4;
            if pixels.bytes[at] > 150 && pixels.bytes[at + 1] < 60 && pixels.bytes[at + 3] > 150 {
                red += 1;
            }
        }
        if red > 0 {
            red_rows.push(y / CODE_ROW as usize);
        }
    }
    red_rows.dedup();
    assert_eq!(
        red_rows,
        vec![0, 1],
        "the error ink stands on exactly the two rows the mark crosses"
    );
}

/// A wrapped line so tall that its tile would pass the raster limit is refused with a diagnostic, never a panic.
///  The limit is 64 MiB of pixels: at a text width of 782 px that is about 894 rows at scale 1 (about 75,000
///  characters in one line) and about 223 rows at scale 2 (about 18,700).
#[test]
fn a_tile_past_the_raster_limit_is_refused_not_painted() {
    // 15,000 characters at 100 px, scale 3: 1,350 rows of 72 physical pixels, 300 px wide, 117 MB.
    let document = Document::new(&"x".repeat(15_000));
    let mut shaper = TextShaper::new();
    let plain = RowMap::plain(1);
    let view = shaper.prepare_rows(
        &document,
        Viewport {
            first: 0,
            count: 1,
            width: 100.0,
            scale: 3.0,
            wrap: Some(100.0),
            clip: None,
        },
        &[],
        &plain,
    );
    assert!(view.rows[0].visual_rows() > 1000);
    let colors = CodeColors {
        foreground: [0, 0, 0, 255],
        selected: [255, 255, 255, 255],
        dark: false,
    };
    let refused = TextRaster::new().paint(&view, colors, 0.0);
    let message = refused.err().map(|error| return format!("{error:#}"));
    assert!(
        message
            .as_deref()
            .is_some_and(|text| return text.contains("64 MiB")),
        "the oversized tile was not refused with the raster limit: {message:?}"
    );
}

/// Words of the shape `word12 ` until the text holds `length` characters, in one line without a terminator.
fn words(length: usize) -> String {
    let mut text = String::new();
    let mut number = 0;
    while text.len() < length {
        text.push_str(&format!("word{number} "));
        number += 1;
    }
    text.truncate(length);
    return text;
}

/// The palette of the pixel checks.
const PALETTE: CodeColors = CodeColors {
    foreground: [0, 0, 0, 255],
    selected: [255, 255, 255, 255],
    dark: false,
};

/// A clipped tile's raster holds exactly the pixels its band has in the unclipped raster of the same lines,
///  its origin and height follow the clip, and a clip changes nothing about the rows' places.
#[test]
fn a_clipped_tile_holds_the_pixels_of_its_band() {
    let document = Document::new(&format!("short\n{}", words(9000)));
    let mut shaper = TextShaper::new();
    let plain = RowMap::plain(2);
    let whole = shaper.prepare_rows(&document, viewport(1, 1, 300.0), &[], &plain);
    let rows = whole.rows[0].visual_rows();
    assert!(rows > 40, "the fixture wraps to many rows: {rows}");
    let band = Clip {
        top: 10.0 * CODE_ROW,
        bottom: 30.0 * CODE_ROW,
    };
    let clipped = shaper.prepare_rows(
        &document,
        Viewport {
            clip: Some(band),
            ..viewport(1, 1, 300.0)
        },
        &[],
        &plain,
    );
    assert_eq!(clipped.origin, CODE_ROW + band.top);
    assert_eq!(clipped.height as f32, band.bottom - band.top);
    assert_eq!(clipped.width, whole.width);
    assert_eq!(
        clipped.rows[0].top, whole.rows[0].top,
        "a clip moves no row"
    );
    let mut raster = TextRaster::new();
    let full = raster.paint(&whole, PALETTE, 0.0).expect("whole raster");
    let part = raster
        .paint(&clipped, PALETTE, 0.0)
        .expect("clipped raster");
    let row_bytes = full.width as usize * 4;
    let from = band.top as usize * row_bytes;
    let to = band.bottom as usize * row_bytes;
    assert_eq!(part.bytes.len(), to - from);
    assert!(
        part.bytes == full.bytes[from..to],
        "the clipped raster differs from its band of the whole raster"
    );
    assert!(
        part.bytes.chunks(4).any(|pixel| return pixel[3] > 0),
        "the band has ink"
    );
    // A rebase keeps the clip's distance below the first line's block.
    let mut moved = shaper.prepare_rows(
        &document,
        Viewport {
            clip: Some(band),
            ..viewport(1, 1, 300.0)
        },
        &[],
        &plain,
    );
    let lowered = RowMap::new(2, &[(0, 26.0)]);
    assert!(moved.rebase(&lowered));
    assert_eq!(moved.origin, 26.0 + CODE_ROW + band.top);
}

/// At the real limit a line that no raster can hold is refused whole and painted in a clip, at both display scales:
///  the band's raster is within the limit, and every code row of it has ink.
#[test]
fn a_line_past_the_real_limit_paints_inside_a_clip() {
    let document = Document::new(&words(100_000));
    let mut shaper = TextShaper::new();
    let plain = RowMap::plain(1);
    for scale in [1.0_f32, 2.0] {
        let base = Viewport {
            scale,
            ..viewport(0, 1, 782.0)
        };
        let whole = shaper.prepare_rows(&document, base, &[], &plain);
        let rows = whole.rows[0].visual_rows();
        let columns = u64::from(whole.width);
        let limit_rows = MAX_RASTER_BYTES / 4 / columns;
        assert!(
            (rows as f32 * CODE_ROW * scale) as u64 > limit_rows,
            "scale {scale}: {rows} rows of the line fit one raster of {limit_rows} rows"
        );
        let refused = TextRaster::new().paint(&whole, PALETTE, 0.0);
        assert!(
            refused.is_err(),
            "scale {scale}: the whole line was painted past the limit"
        );
        // A band of 200 code rows from the middle of the line: well inside the limit at both scales.
        let top = (rows as f32 / 2.0).floor() * CODE_ROW;
        let band = Clip {
            top,
            bottom: top + 150.0 * CODE_ROW,
        };
        let clipped = shaper.prepare_rows(
            &document,
            Viewport {
                clip: Some(band),
                ..base
            },
            &[],
            &plain,
        );
        let pixels = TextRaster::new()
            .paint(&clipped, PALETTE, 0.0)
            .expect("the clipped band is painted");
        assert!(
            u64::from(pixels.width) * u64::from(pixels.height) * 4 <= MAX_RASTER_BYTES,
            "scale {scale}: the clipped raster passes the limit"
        );
        assert_eq!(pixels.height as f32, 150.0 * CODE_ROW * scale);
        let row_pixels = (CODE_ROW * scale) as usize;
        let width = pixels.width as usize;
        for code_row in 0..150 {
            let mut inked = false;
            for y in code_row * row_pixels..(code_row + 1) * row_pixels {
                inked |= pixels.bytes[y * width * 4..(y + 1) * width * 4]
                    .chunks(4)
                    .any(|pixel| return pixel[3] > 0);
            }
            assert!(
                inked,
                "scale {scale}: code row {code_row} of the band has no ink"
            );
        }
    }
}
