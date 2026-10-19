//! The minimap's geometry without a window:
//!  the picture's scale,
//! the viewport box,
//! and the maps between a minimap position,
//! a scroll offset,
//!  and a visual row.
//!  The picture has its own test files (`minimap_downscale.rs`, `minimap_picture.rs`).

/// The visual row counts and the map built from them.
use ide_app::line_rows::LineRows;
/// The geometry and its constants.
use ide_app::minimap::{
    Geometry, MIN_BOX, NARROWEST, Target, WIDTH, text_span, text_x, width_for,
};
/// The width of an unwrapped raster.
use ide_app::shaped_text::UNWRAPPED_RASTER_WIDTH;
/// The vertical mapping the minimap squeezes.
use ide_app::row_map::{CODE_ROW, RowMap};

/// The minimap is as wide as CodeGlance's 110 pixels,
/// and shrinks to a sixth of a narrow view down to 15.
#[test]
fn the_width_follows_the_view_down_to_fifteen_pixels() {
    assert_eq!(width_for(1000.0), WIDTH);
    assert_eq!(width_for(660.0), WIDTH);
    assert_eq!(width_for(480.0), 80.0);
    assert_eq!(width_for(240.0), 40.0);
    assert_eq!(width_for(60.0), NARROWEST);
    assert_eq!(width_for(0.0), NARROWEST);
}

/// A text that fits the view at four pixels a row is drawn at that scale,
/// and the box covers the view's share.
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

/// A text that fits the view itself is drawn in full,
/// and the box covers all of it at the top.
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

/// A text with more rows than the track has pixels is squeezed to the view,
/// and the box keeps its least height.
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

/// Dragging the box by a distance moves the view by that distance over the box's room,
/// times the scroll range,
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

/// A position on the minimap shows the visual row of the vertical mapping it lies on,
/// wrapped rows and blocks
///  included,
/// and the row's own position shows that row again.
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

/// In a squeezed minimap many rows share a pixel;
/// the position names one of them,
/// and it is on that pixel.
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

/// The picture is the text's whole width shrunk to the minimap's,
/// so a position across it is the same share of the text's width,
/// held to both edges,
/// and a wrapped text spans its wrap width.
#[test]
fn a_position_across_the_minimap_is_the_same_share_of_the_texts_width() {
    assert_eq!(text_x(0.0, 110.0, 880.0), 0.0);
    assert_eq!(text_x(55.0, 110.0, 880.0), 440.0);
    assert_eq!(text_x(110.0, 110.0, 880.0), 880.0);
    assert_eq!(text_x(27.5, 110.0, 880.0), 220.0);
    assert_eq!(text_x(-30.0, 110.0, 880.0), 0.0);
    assert_eq!(text_x(500.0, 110.0, 880.0), 880.0);
    // A minimap or a text without width maps everything to the left edge.
    assert_eq!(text_x(10.0, 0.0, 880.0), 0.0);
    assert_eq!(text_x(10.0, 110.0, 0.0), 0.0);
    assert_eq!(text_span(Some(673.0)), 673.0);
    assert_eq!(text_span(None), UNWRAPPED_RASTER_WIDTH);
}
