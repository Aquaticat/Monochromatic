//! The raster limit of one tile:
//!  the rules that size a clip,
//!  and the guard that cuts a frame to the limit when the lines are taller than the map the caller chose its clip from.
//! No window is opened.

/// Canonical source of the lines under test.
use ide_app::document::Document;
/// The vertical mapping the frames are placed by,
/// and the height of one code row.
use ide_app::row_map::{CODE_ROW, RowMap};
/// The shaper,
/// the viewport,
/// and the rules under test.
use ide_app::shaped_text::{TextShaper, Viewport, band_clip, fit_clip, raster_fits, tile_cap};
/// The palette of the raster,
/// the limit,
/// and the rasterizer whose ink is read back.
use ide_app::text_raster::{CodeColors, MAX_RASTER_BYTES, TextRaster};

/// Display scales of ordinary and fractional displays.
const SCALES: [f32; 7] = [0.5, 1.0, 1.25, 1.5, 1.75, 2.0, 3.0];

/// Raster widths in physical pixels:
/// a very narrow window,
/// ordinary windows,
/// the widths of the owner's report,
/// and widths near the one where the cap is a single code row.
const COLUMNS: [u64; 12] = [
    1, 24, 200, 782, 1354, 1920, 3840, 7680, 100_000, 600_000, 699_000, 1_000_000,
];

/// A palette for painting.
fn colors() -> CodeColors {
    return CodeColors {
        foreground: [240, 240, 240, 255],
        selected: [255, 255, 255, 255],
        dark: true,
    };
}

/// The cap is never under one code row,
/// and a clip made for it fits the raster limit,
/// for every width and scale,
/// including the widths where one code row is all the cap allows.
#[test]
fn a_clip_made_for_the_cap_fits_the_raster_limit_at_every_width_and_scale() {
    for scale in SCALES {
        for columns in COLUMNS {
            let cap = tile_cap(columns, scale);
            assert!(
                cap >= CODE_ROW,
                "columns {columns} scale {scale}: cap {cap}"
            );
            let Some(clip) = band_clip(0.0, 10_000_000.0, (5_000_000.0, 5_010_000.0), cap) else {
                panic!("columns {columns} scale {scale}: ten million pixels fit a raster");
            };
            let rows = ((clip.bottom - clip.top).max(CODE_ROW) * scale).ceil() as u64;
            // A width where even one code row is past the limit has nothing to cut to.
            let one_row = (CODE_ROW * scale).ceil() as u64;
            if raster_fits(columns, one_row) {
                assert!(
                    raster_fits(columns, rows),
                    "columns {columns} scale {scale}: a clip of {rows} rows passes the limit"
                );
            }
        }
    }
}

/// The guard leaves a frame that fits as it is,
/// asked clip included,
/// and cuts one that does not around its middle,
/// to a clip that fits,
/// inside the lines,
/// on whole code rows.
#[test]
fn the_guard_keeps_a_fitting_frame_and_cuts_a_larger_one_around_its_middle() {
    for scale in SCALES {
        for columns in COLUMNS {
            if !raster_fits(columns, (CODE_ROW * scale).ceil() as u64 * 2) {
                continue;
            }
            let cap = tile_cap(columns, scale);
            let first_top = 480.0;
            for lines in [cap * 0.3, cap * 0.99, cap * 1.5, cap * 7.3] {
                let bottom = first_top + (lines / CODE_ROW).ceil() * CODE_ROW;
                let fitted = fit_clip(first_top, bottom, None, columns, scale);
                let whole = ((bottom - first_top) * scale).ceil() as u64;
                match fitted {
                    None => assert!(
                        raster_fits(columns, whole),
                        "columns {columns} scale {scale}: {lines} px passed as they are"
                    ),
                    Some(clip) => {
                        assert!(!raster_fits(columns, whole), "a fitting frame was cut");
                        let rows = ((clip.bottom - clip.top) * scale).ceil() as u64;
                        assert!(raster_fits(columns, rows), "the cut frame passes the limit");
                        assert!(clip.top >= 0.0 && clip.bottom <= bottom - first_top);
                        assert_eq!(clip.top % CODE_ROW, 0.0);
                        assert_eq!(clip.bottom % CODE_ROW, 0.0);
                        let middle = (bottom - first_top) / 2.0;
                        assert!(
                            clip.top <= middle && middle <= clip.bottom,
                            "columns {columns} scale {scale}: the cut [{}, {}] misses the middle {middle}",
                            clip.top,
                            clip.bottom
                        );
                    }
                }
            }
            // A clip that fits is kept, and one that does not is cut around its own middle.
            let asked = band_clip(
                first_top,
                first_top + cap * 6.0,
                (first_top, first_top + cap * 6.0),
                cap,
            );
            let kept = fit_clip(first_top, first_top + cap * 6.0, asked, columns, scale);
            assert_eq!(kept, asked, "a clip that fits was changed");
        }
    }
}

/// Lines that wrap to many rows,
/// shaped against a map that counts each of them as one row,
/// as the window's map does before its background pass reached them:
/// the frame is cut to the limit and paints,
/// where the clip the caller asked for (none) would have been refused.
#[test]
fn a_frame_taller_than_its_map_held_is_cut_to_the_limit_and_painted() {
    let line = "word ".repeat(60);
    let text = format!("{}\n", line.trim_end()).repeat(300);
    let document = Document::new(&text);
    let lines = document.text().len_lines();
    let map = RowMap::plain(lines);
    let mut shaper = TextShaper::new();
    let viewport = Viewport {
        first: 0,
        count: lines,
        width: 224.0,
        scale: 1.0,
        wrap: Some(200.0),
        clip: None,
    };
    let view = shaper.prepare_rows(&document, viewport, &[], &map);
    let whole = view.map.block_top(lines.min(300));
    assert!(
        u64::from(view.width) * (whole as u64) * 4 > MAX_RASTER_BYTES,
        "the fixture's lines ({whole} px at {} columns) are within one raster",
        view.width
    );
    assert!(
        u64::from(view.width) * u64::from(view.height) * 4 <= MAX_RASTER_BYTES,
        "the frame is {}x{}, past the limit",
        view.width,
        view.height
    );
    let clip = view.viewport.clip.expect("the frame was cut");
    assert_eq!(view.origin, clip.top);
    assert_eq!(view.height as f32, clip.bottom - clip.top);
    let mut raster = TextRaster::new();
    let pixels = raster
        .paint(&view, colors(), 0.0)
        .expect("a frame within the limit paints");
    assert!(
        pixels.bytes.chunks(4).any(|pixel| pixel[3] > 0),
        "the cut frame has no ink"
    );
}

/// A caller's clip that is itself too tall is cut too,
/// and a clip that fits is left alone.
#[test]
fn a_clip_asked_for_that_passes_the_limit_is_cut_and_one_that_fits_is_kept() {
    let line = "word ".repeat(60);
    let text = format!("{}\n", line.trim_end()).repeat(300);
    let document = Document::new(&text);
    let lines = document.text().len_lines();
    let map = RowMap::plain(lines);
    let mut shaper = TextShaper::new();
    let mut viewport = Viewport {
        first: 0,
        count: lines,
        width: 224.0,
        scale: 1.0,
        wrap: Some(200.0),
        clip: Some(ide_app::shaped_text::Clip {
            top: 0.0,
            bottom: 90_000.0,
        }),
    };
    let tall = shaper.prepare_rows(&document, viewport, &[], &map);
    let cut = tall.viewport.clip.expect("a clip");
    assert!(cut.bottom - cut.top < 90_000.0);
    assert!(u64::from(tall.width) * u64::from(tall.height) * 4 <= MAX_RASTER_BYTES);
    let small = ide_app::shaped_text::Clip {
        top: 240.0,
        bottom: 1_200.0,
    };
    viewport.clip = Some(small);
    let kept = shaper.prepare_rows(&document, viewport, &[], &map);
    assert_eq!(kept.viewport.clip, Some(small));
}
