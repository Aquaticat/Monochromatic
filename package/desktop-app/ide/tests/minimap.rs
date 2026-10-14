//! The minimap without a window:
//!  its geometry (the picture's scale, the viewport box, the maps between a minimap position, a scroll offset,
//!  and a visual row) and its picture (size, rows, ink, sampling, and the work bound).

/// Canonical source of the texts under test.
use ide_app::document::Document;
/// The visual row counts and the map built from them.
use ide_app::line_rows::LineRows;
/// The geometry, the picture build, and their constants.
use ide_app::minimap::{
    Built, FULL_WORK, Geometry, IMAGE_ALPHA, Input, MIN_BOX, NARROWEST, QUICK_WORK, Target, WIDTH,
    build, width_for,
};
/// The vertical mapping the minimap squeezes.
use ide_app::row_map::{CODE_ROW, RowMap};
/// The shaper that finds where wrapped lines break.
use ide_app::shaped_text::TextShaper;
/// Syntax classes.
use ide_app::source_style::StyleSpan;
/// The palette whose inks the picture uses.
use ide_app::text_raster::{CodeColors, ink};

/// The dark scheme's palette of the tests.
const DARK: CodeColors = CodeColors {
    foreground: [220, 220, 220, 255],
    selected: [255, 255, 255, 255],
    dark: true,
};

/// The light scheme's palette of the tests.
const LIGHT: CodeColors = CodeColors {
    foreground: [30, 30, 30, 255],
    selected: [0, 0, 0, 255],
    dark: false,
};

/// Never cancelled.
fn never() -> bool {
    return false;
}

/// A text of `lines` lines of ordinary code, the last without a terminator.
fn code(lines: usize) -> String {
    let mut text = String::new();
    for number in 0..lines {
        if number > 0 {
            text.push('\n');
        }
        text.push_str(&format!("let value_{number} = compute({number});"));
    }
    return text;
}

/// The map of a text with every line one row.
fn plain_map(document: &Document) -> RowMap {
    return RowMap::plain(document.text().len_lines());
}

/// The picture of `document` at `scale`, in a view `view` pixels tall, with the given palette and budget.
fn picture(
    document: &Document,
    map: &RowMap,
    styles: &[StyleSpan],
    colors: CodeColors,
    scale: f32,
    view: f32,
    work: usize,
) -> Built {
    let mut shaper = TextShaper::new();
    let input = Input {
        document,
        styles,
        map,
        colors,
        wrap: Some(400.0),
        scale,
        view,
        width: WIDTH,
    };
    return build(&mut shaper, &input, work, &never).expect("a picture");
}

/// The four bytes of one pixel.
fn pixel(built: &Built, column: usize, row: usize) -> [u8; 4] {
    let at = (row * built.width as usize + column) * 4;
    return [
        built.bytes[at],
        built.bytes[at + 1],
        built.bytes[at + 2],
        built.bytes[at + 3],
    ];
}

/// Whether any pixel of picture row `row` has ink.
fn inked(built: &Built, row: usize) -> bool {
    return (0..built.width as usize).any(|column| return pixel(built, column, row)[3] > 0);
}

/// The leftmost column of picture row `row` with ink, if any.
fn first_ink(built: &Built, row: usize) -> Option<usize> {
    return (0..built.width as usize).find(|column| return pixel(built, *column, row)[3] > 0);
}

/// Premultiplied bytes of `rgb` at the alpha a glyph of weight `weight` gets in a band of weight `band`.
fn premultiplied(rgb: [u8; 4], class: f32, band: f32) -> [u8; 4] {
    let alpha = (255.0 * IMAGE_ALPHA * class * band).round() as u32;
    let channel = |value: u8| return ((u32::from(value) * alpha + 127) / 255) as u8;
    return [
        channel(rgb[0]),
        channel(rgb[1]),
        channel(rgb[2]),
        alpha as u8,
    ];
}

/// The minimap is as wide as CodeGlance's 110 pixels, and shrinks to a sixth of a narrow view down to 15.
#[test]
fn the_width_follows_the_view_down_to_fifteen_pixels() {
    assert_eq!(width_for(1000.0), WIDTH);
    assert_eq!(width_for(660.0), WIDTH);
    assert_eq!(width_for(480.0), 80.0);
    assert_eq!(width_for(240.0), 40.0);
    assert_eq!(width_for(60.0), NARROWEST);
    assert_eq!(width_for(0.0), NARROWEST);
}

/// A text that fits the view at four pixels a row is drawn at that scale, and the box covers the view's share.
#[test]
fn a_text_that_fits_is_drawn_at_four_pixels_a_row() {
    // 100 code rows, 2,400 px, in a view of 600: 400 px of picture, a box of 100 px.
    let geometry = Geometry::new(100.0 * CODE_ROW, 600.0);
    assert_eq!(geometry.scale(), 4.0 / CODE_ROW);
    assert_eq!(geometry.track(), 400.0);
    assert!(!geometry.squeezed());
    assert_eq!(geometry.box_height(), 100.0);
    assert_eq!(geometry.room(), 300.0);
    assert_eq!(geometry.max_offset(), 1800.0);
    assert_eq!(geometry.box_top(0.0), 0.0);
    assert_eq!(geometry.box_top(900.0), 150.0);
    assert_eq!(geometry.box_top(1800.0), 300.0);
}

/// A text that fits the view itself is drawn in full, and the box covers all of it at the top.
#[test]
fn a_text_shorter_than_the_view_is_covered_by_the_box() {
    let geometry = Geometry::new(10.0 * CODE_ROW, 600.0);
    assert_eq!(geometry.track(), 40.0);
    assert_eq!(geometry.box_height(), 40.0, "the whole text is in view");
    assert_eq!(geometry.room(), 0.0);
    assert_eq!(geometry.max_offset(), 0.0);
    for offset in [-50.0, 0.0, 70.0, 1e6] {
        assert_eq!(geometry.box_top(offset), 0.0);
    }
    // A text of three rows is smaller than the least box.
    let tiny = Geometry::new(3.0 * CODE_ROW, 600.0);
    assert_eq!(tiny.track(), 12.0);
    assert_eq!(tiny.box_height(), 12.0);
}

/// A text with more rows than the track has pixels is squeezed to the view, and the box keeps its least height.
#[test]
fn a_text_with_more_rows_than_pixels_is_squeezed_and_the_box_keeps_a_floor() {
    let content = 50_000.0 * CODE_ROW;
    let geometry = Geometry::new(content, 600.0);
    assert!(geometry.squeezed());
    assert_eq!(geometry.track(), 600.0);
    assert_eq!(geometry.scale(), 600.0 / content);
    // The view is 600 of 1,200,000 px, a third of a pixel of picture; the box is the least height.
    assert_eq!(geometry.box_height(), MIN_BOX);
    assert_eq!(geometry.room(), 600.0 - MIN_BOX);
    assert_eq!(geometry.box_top(0.0), 0.0);
    assert_eq!(geometry.box_top(geometry.max_offset()), 600.0 - MIN_BOX);
    let middle = geometry.box_top(geometry.max_offset() / 2.0);
    assert!((middle - (600.0 - MIN_BOX) / 2.0).abs() < 1e-3);
}

/// An offset or a position outside the range is held to its ends.
#[test]
fn positions_outside_the_range_are_clamped_at_both_ends() {
    let geometry = Geometry::new(100.0 * CODE_ROW, 600.0);
    assert_eq!(geometry.box_top(-100.0), 0.0);
    assert_eq!(geometry.box_top(1e9), geometry.room());
    assert_eq!(geometry.content_y(-20.0), 0.0);
    assert!((geometry.content_y(1e6) - 100.0 * CODE_ROW).abs() < 1e-2);
    assert_eq!(geometry.y_of(-5.0), 0.0);
    assert_eq!(geometry.y_of(1e9), geometry.track());
    assert_eq!(geometry.drag_offset(500.0, 10.0, -1e6), 0.0);
    assert_eq!(
        geometry.drag_offset(500.0, 10.0, 1e6),
        geometry.max_offset()
    );
    assert_eq!(
        geometry.centered(0.0),
        0.0,
        "the first row cannot be centered"
    );
    assert_eq!(geometry.centered(1e9), geometry.max_offset());
    assert_eq!(geometry.centered(1000.0), 700.0);
}

/// A position on the minimap and the text position it shows are each other's inverse.
#[test]
fn a_minimap_position_and_its_text_position_are_each_others_inverse() {
    for (rows, view) in [
        (100.0, 600.0),
        (5_000.0, 600.0),
        (50_000.0, 800.0),
        (30.0, 900.0),
    ] {
        let geometry = Geometry::new(rows * CODE_ROW, view);
        let track = geometry.track();
        for step in 0..=20 {
            let y = track * step as f32 / 20.0;
            let back = geometry.y_of(geometry.content_y(y));
            assert!(
                (back - y).abs() < 1e-2,
                "{rows} rows in {view}: position {y} came back as {back}"
            );
        }
    }
}

/// Dragging the box by a distance moves the view by that distance over the box's room, times the scroll range,
///  and the box follows the pointer exactly except where the range stops it.
#[test]
fn dragging_the_box_moves_it_with_the_pointer() {
    for (rows, view) in [(100.0, 600.0), (5_000.0, 600.0), (50_000.0, 800.0)] {
        let geometry = Geometry::new(rows * CODE_ROW, view);
        let start = geometry.max_offset() / 3.0;
        let grabbed = geometry.box_top(start) + 7.0;
        for distance in [-30.0_f32, -1.0, 0.0, 1.0, 12.0, 40.0] {
            let offset = geometry.drag_offset(start, grabbed, grabbed + distance);
            let wanted = (geometry.box_top(start) + distance).clamp(0.0, geometry.room());
            assert!(
                (geometry.box_top(offset) - wanted).abs() < 1e-2,
                "{rows} rows: a drag of {distance} put the box at {} instead of {wanted}",
                geometry.box_top(offset)
            );
        }
    }
}

/// A position on the minimap shows the visual row of the vertical mapping it lies on, wrapped rows and blocks
///  included, and the row's own position shows that row again.
#[test]
fn a_position_names_the_visual_row_it_shows_and_the_row_names_its_position_back() {
    let mut rows = LineRows::plain(100);
    rows.apply([(10, 3), (40, 2)]);
    // A block of 48 px stands above line 5.
    let map = RowMap::new(100, &[(5, 48.0)]).with_rows(&rows);
    let geometry = Geometry::new(map.height(), 1000.0);
    assert!(!geometry.squeezed());
    for target in [
        Target { line: 0, row: 0 },
        Target { line: 4, row: 0 },
        Target { line: 5, row: 0 },
        Target { line: 10, row: 0 },
        Target { line: 10, row: 1 },
        Target { line: 10, row: 2 },
        Target { line: 40, row: 1 },
        Target { line: 99, row: 0 },
    ] {
        // The middle of the row's pixels, which are CODE_ROW over six tall.
        let y = geometry.y_of_row(&map, target) + 0.5;
        assert_eq!(geometry.target(&map, y), target, "the row at {y}");
    }
    // The block above line 5 shows line 5's first row.
    let in_block = geometry.y_of(map.block_top(5) + 10.0);
    assert_eq!(geometry.target(&map, in_block), Target { line: 5, row: 0 });
    // Both ends.
    assert_eq!(geometry.target(&map, -10.0), Target { line: 0, row: 0 });
    assert_eq!(geometry.target(&map, 1e6), Target { line: 99, row: 0 });
}

/// In a squeezed minimap many rows share a pixel; the position names one of them, and it is on that pixel.
#[test]
fn in_a_squeezed_minimap_a_position_names_a_row_that_lies_on_it() {
    let map = RowMap::plain(50_000);
    let geometry = Geometry::new(map.height(), 600.0);
    assert!(geometry.squeezed());
    for y in [0.0_f32, 0.5, 100.0, 299.5, 599.9] {
        let target = geometry.target(&map, y);
        let top = geometry.y_of_row(&map, target);
        assert!(
            top <= y + 1e-3 && y - top < 1.0 + 1e-3,
            "position {y} named line {} at {top}",
            target.line
        );
    }
    assert!((24_999..=25_000).contains(&geometry.target(&map, 300.0).line));
}

/// The picture's size is the track at the display scale and the width in columns at the display scale.
#[test]
fn the_picture_is_the_track_at_the_display_scale() {
    let document = Document::new(&code(100));
    let map = plain_map(&document);
    let one = picture(&document, &map, &[], DARK, 1.0, 600.0, FULL_WORK);
    assert_eq!((one.width, one.height), (110, 400));
    let two = picture(&document, &map, &[], DARK, 2.0, 600.0, FULL_WORK);
    assert_eq!((two.width, two.height), (220, 800));
    let many = Document::new(&code(20_000));
    let squeezed = picture(&many, &plain_map(&many), &[], DARK, 1.0, 600.0, FULL_WORK);
    assert_eq!(squeezed.height, 600, "a long text is squeezed to the view");
}

/// At four pixels a row the first pixel row of each source row is empty and the other three carry the ink.
#[test]
fn a_short_text_is_drawn_with_the_first_pixel_of_each_row_empty() {
    let document = Document::new(&code(10));
    let map = plain_map(&document);
    let built = picture(&document, &map, &[], DARK, 1.0, 600.0, FULL_WORK);
    assert_eq!(built.height, 40);
    for row in 0..10 {
        assert!(!inked(&built, row * 4), "the first pixel row of row {row}");
        for band in 1..4 {
            assert!(
                inked(&built, row * 4 + band),
                "pixel row {band} of row {row}"
            );
        }
    }
    // The first glyph is the ASCII `l` in the default ink at the clean renderer's weights.
    assert_eq!(
        pixel(&built, 0, 1),
        premultiplied(DARK.foreground, 0.8, 0.6),
        "weight 0.8 for ASCII, 0.6 for the band"
    );
    // A blank draws nothing: `let value` has its space at column 3.
    assert_eq!(pixel(&built, 3, 1)[3], 0);
}

/// The ink of a glyph is the source palette's ink for its syntax class, in both schemes.
#[test]
fn glyphs_take_the_syntax_ink_of_the_scheme() {
    let document = Document::new("let x = 1;\n");
    let map = plain_map(&document);
    // `let` is class 5, a keyword hue; the rest has no class.
    let styles = [StyleSpan {
        start: 0,
        end: 3,
        style: 5,
    }];
    for colors in [DARK, LIGHT] {
        let built = picture(&document, &map, &styles, colors, 1.0, 600.0, FULL_WORK);
        assert_eq!(pixel(&built, 0, 1), premultiplied(ink(5, colors), 0.8, 0.6));
        assert_eq!(pixel(&built, 2, 1), premultiplied(ink(5, colors), 0.8, 0.6));
        assert_eq!(
            pixel(&built, 4, 1),
            premultiplied(colors.foreground, 0.8, 0.6)
        );
    }
    assert_ne!(
        ink(5, DARK),
        ink(5, LIGHT),
        "the two schemes have their own ink"
    );
}

/// A tab moves four columns, a glyph other than printable ASCII weighs half, and control characters draw nothing.
#[test]
fn tabs_move_four_columns_and_other_glyphs_weigh_half() {
    let document = Document::new("\tx\n\u{e9}\u{1}x\n");
    let map = plain_map(&document);
    let built = picture(&document, &map, &[], DARK, 1.0, 600.0, FULL_WORK);
    assert_eq!(first_ink(&built, 1), Some(4), "a tab moves four columns");
    assert_eq!(
        pixel(&built, 0, 5),
        premultiplied(DARK.foreground, 0.4, 0.6)
    );
    assert_eq!(
        pixel(&built, 1, 5)[3],
        0,
        "a control character draws nothing"
    );
    assert_eq!(
        pixel(&built, 2, 5),
        premultiplied(DARK.foreground, 0.8, 0.6)
    );
}

/// A line is cut at the width of the picture, and a line far longer than it costs the build no shaping.
#[test]
fn a_line_is_cut_at_the_width_and_costs_no_shaping() {
    let document = Document::new(&format!("{}\n", "x".repeat(200_000)));
    let map = plain_map(&document);
    let mut shaper = TextShaper::new();
    let input = Input {
        document: &document,
        styles: &[],
        map: &map,
        colors: DARK,
        wrap: Some(400.0),
        scale: 1.0,
        view: 600.0,
        width: WIDTH,
    };
    let built = build(&mut shaper, &input, FULL_WORK, &never).expect("a picture");
    assert_eq!(built.width, 110);
    assert_eq!(first_ink(&built, 1), Some(0));
    assert!(pixel(&built, 109, 1)[3] > 0, "the last column is drawn");
    assert_eq!(built.stats.shaped_lines, 0);
    assert_eq!(built.stats.work, 0);
}

/// A wrapped line gets one band of pixel rows for each visual row the map holds, a continuation row starts one
///  column past the line's indent, and a block above a line is blank.
#[test]
fn wrapped_lines_draw_one_band_for_each_visual_row() {
    let line = "    let value = compute_total(first_item, second_item); // a long comment that keeps going and going";
    let document = Document::new(&format!("{line}\nshort\n"));
    let mut shaper = TextShaper::new();
    let lines = document.text().len_lines();
    let measured = shaper.measure_lines(&document, 0..lines, 1.0, Some(400.0), &[]);
    let mut rows = LineRows::plain(lines);
    rows.apply(measured.lines.iter().copied());
    let wrapped = rows.rows(0);
    assert!(
        wrapped >= 3,
        "the fixture wraps to {wrapped} rows at 400 px"
    );
    let map = RowMap::plain(lines).with_rows(&rows);
    let input = Input {
        document: &document,
        styles: &[],
        map: &map,
        colors: DARK,
        wrap: Some(400.0),
        scale: 1.0,
        view: 900.0,
        width: WIDTH,
    };
    let built = build(&mut shaper, &input, FULL_WORK, &never).expect("a picture");
    assert_eq!(built.stats.shaped_lines, 1);
    assert_eq!(built.stats.rough_lines, 0);
    // The picture is four pixels a row: `wrapped` bands of text, then the short line's band.
    for row in 0..wrapped + 1 {
        assert!(!inked(&built, row * 4), "gap above row {row}");
        assert!(inked(&built, row * 4 + 2), "band of row {row}");
    }
    // The first row starts after the four blanks of indent; a continuation row one column past them.
    assert_eq!(first_ink(&built, 2), Some(4));
    assert_eq!(
        first_ink(&built, 4 + 2),
        Some(5),
        "indent 4 plus one for the mark"
    );
}

/// A block of virtual rows above a line is blank in the picture and the line below it is drawn.
#[test]
fn a_block_of_virtual_rows_leaves_a_blank_stretch() {
    let document = Document::new(&code(4));
    // 48 px above line 1 is 8 px of picture.
    let map = RowMap::new(4, &[(1, 48.0)]);
    let built = picture(&document, &map, &[], DARK, 1.0, 600.0, FULL_WORK);
    assert_eq!(built.height, ((4.0 * CODE_ROW + 48.0) / 6.0) as u32);
    assert!(inked(&built, 1), "line 0");
    for row in 4..12 {
        assert!(!inked(&built, row), "pixel row {row} is in the block");
    }
    assert!(inked(&built, 13), "line 1 follows the block");
}

/// A text with far more rows than the track has pixels is sampled: the lines drawn and the shaping are bounded by
///  the track's height, whatever the text's length, and the work stays inside the budget.
#[test]
fn a_long_text_is_sampled_within_the_track_and_the_budget() {
    let document = Document::new(&code(50_000));
    let lines = document.text().len_lines();
    let mut rows = LineRows::plain(lines);
    // Every third line is wrapped to two rows.
    rows.apply(
        (0..lines)
            .filter(|line| return line % 3 == 0)
            .map(|line| return (line, 2)),
    );
    let map = RowMap::plain(lines).with_rows(&rows);
    let mut shaper = TextShaper::new();
    let input = Input {
        document: &document,
        styles: &[],
        map: &map,
        colors: DARK,
        wrap: Some(300.0),
        scale: 2.0,
        view: 700.0,
        width: WIDTH,
    };
    let built = build(&mut shaper, &input, FULL_WORK, &never).expect("a picture");
    assert_eq!(built.height, 1400);
    assert!(
        built.stats.lines <= built.stats.pixel_rows,
        "one line for each pixel row at most"
    );
    assert!(built.stats.shaped_lines <= built.stats.lines);
    assert!(built.stats.shaped_lines > 0, "wrapped lines were shaped");
    assert!(built.stats.work <= FULL_WORK);
    // Both ends of the text are drawn.
    assert!(inked(&built, 0) || inked(&built, 1));
    assert!(inked(&built, 1398) || inked(&built, 1399) || inked(&built, 1397));
}

/// With no work to spend, wrapped lines are cut into rows of equal width: nothing is shaped, the bands are still
///  there, and a build with enough work reports no rough line.
#[test]
fn a_line_the_budget_cannot_pay_is_cut_into_equal_rows() {
    let line = "word ".repeat(80);
    let document = Document::new(&format!("{line}\nshort\n"));
    let lines = document.text().len_lines();
    let mut shaper = TextShaper::new();
    let measured = shaper.measure_lines(&document, 0..lines, 1.0, Some(400.0), &[]);
    let mut rows = LineRows::plain(lines);
    rows.apply(measured.lines.iter().copied());
    let wrapped = rows.rows(0);
    assert!(wrapped >= 2);
    let map = RowMap::plain(lines).with_rows(&rows);
    let rough = picture(&document, &map, &[], DARK, 1.0, 900.0, 0);
    assert_eq!(rough.stats.shaped_lines, 0);
    assert_eq!(rough.stats.rough_lines, 1);
    assert_eq!(rough.stats.work, 0);
    for row in 0..wrapped {
        assert!(inked(&rough, row * 4 + 2), "band of row {row}");
    }
    let quick = picture(&document, &map, &[], DARK, 1.0, 900.0, QUICK_WORK);
    assert_eq!(quick.stats.rough_lines, 0);
    assert_eq!(quick.stats.shaped_lines, 1);
    assert!(quick.stats.work > 0 && quick.stats.work <= QUICK_WORK);
}

/// A build asked to stop stops, and answers nothing.
#[test]
fn a_cancelled_build_answers_nothing() {
    let document = Document::new(&code(100));
    let map = plain_map(&document);
    let mut shaper = TextShaper::new();
    let input = Input {
        document: &document,
        styles: &[],
        map: &map,
        colors: DARK,
        wrap: Some(400.0),
        scale: 1.0,
        view: 600.0,
        width: WIDTH,
    };
    assert!(build(&mut shaper, &input, FULL_WORK, &|| return true).is_none());
}
