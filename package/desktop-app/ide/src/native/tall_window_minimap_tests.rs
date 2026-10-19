//! The minimap of a tall window stays a picture of the text,
//!  the window's own rendering reduced,
//!  and never turns into blocks.
//!  No band it renders passes the raster limit.
//! Nothing here waits on the window thread:
//! every wait advances timers and lets the workers answer.

/// The reader fixture,
/// the wrapped text,
/// and the window sizing.
use super::{
    sidebar_tests::{TEXT_LEFT, minimap_beside},
    wrap_tests::{long_text, open, settled},
};
/// Bounded waiting that advances native timers until a state the test checks holds.
use crate::native::waiting_tests::Waiting;
/// The reader fixture.
use super::find_tests::Reader;
/// The limit on the size of one raster.
use ide_app::text_raster::MAX_RASTER_BYTES;
/// Toolkit events.
use slint::{
    ComponentHandle, LogicalSize,
    platform::{WindowEvent, update_timers_and_animations},
};

/// A window `height` logical pixels tall over four hundred wrapped lines,
/// once its first picture is on screen,
/// and the line measurements have arrived when `measured` asks for them.
/// A window as tall as twelve thousand pixels makes a tile the raster limit cuts,
/// whose measurement pass is not what these tests are about.
fn tall(height: f32, measured: bool) -> (tempfile::TempDir, Reader) {
    let (project, opened) = open(&long_text(400));
    let window = &opened.window;
    window.window().dispatch_event(WindowEvent::Resized {
        size: LogicalSize::new(TEXT_LEFT + 1330.0 + minimap_beside(1330.0), height),
    });
    update_timers_and_animations();
    if measured {
        settled(&opened);
    }
    {
        let mut waiting = Waiting::slow();
        loop {
            {
                let current = opened.source.borrow();
                let track = window.get_minimap_track();
                if current.minimap.shown.is_some()
                    && current.minimap.posted == current.minimap.shown
                    && current.minimap.images_set > 0
                    && track > 1000.0
                {
                    break;
                }
            }
            waiting.step("the minimap picture of the tall window did not arrive");
        }
    }
    return (project, opened);
}

/// What:
///  Count the rows of `pixels` (`width` to a row) that are inked,
///  and among them the rows whose coverage rises and falls along the row like the glyphs of a line do.
/// Why:
///  The picture is the window's rendering averaged,
///  so its coverage is graded;
///  a block would be one flat run of a single coverage,
///  while glyphs make the coverage rise and fall with every word and gap.
fn textured_rows(pixels: &[slint::Rgba8Pixel], width: usize) -> (usize, usize) {
    let mut inked_rows = 0;
    let mut glyph_rows = 0;
    for row in pixels.chunks(width) {
        let mut strongest = 0;
        for pixel in row {
            strongest = strongest.max(pixel.a);
        }
        // Rows between lines carry only the faint tails of descenders and ascenders.
        if strongest < 40 {
            continue;
        }
        inked_rows += 1;
        // Count alternations between clearly inked and clearly lighter pixels.
        let high = strongest / 2;
        let mut alternations = 0;
        let mut inked = row[0].a > high;
        for pixel in &row[1..] {
            let now = if inked {
                pixel.a > high / 2
            } else {
                pixel.a > high
            };
            if now != inked {
                alternations += 1;
                inked = now;
            }
        }
        if alternations >= 4 {
            glyph_rows += 1;
        }
    }
    return (inked_rows, glyph_rows);
}

/// A tall window shows a minimap whose picture is as tall as its track,
/// whose rows hold glyph texture,
/// and whose bands stay under the raster limit.
#[test]
fn the_minimap_of_a_tall_window_is_a_picture_of_glyphs_not_blocks() {
    for (height, measured) in [(3500.0, true), (12000.0, false)] {
        let (_project, opened) = tall(height, measured);
        let window = &opened.window;
        let image = window
            .get_minimap_image()
            .to_rgba8()
            .expect("picture pixels");
        assert!(
            image.height() > 1000,
            "the picture is only {} rows tall",
            image.height()
        );
        let (inked_rows, glyph_rows) = textured_rows(image.as_slice(), image.width() as usize);
        assert!(
            inked_rows > 100,
            "the picture of a {height} window holds only {inked_rows} inked rows"
        );
        assert!(
            glyph_rows * 10 >= inked_rows * 9,
            "only {glyph_rows} of {inked_rows} inked rows rise and fall like glyphs at {height}"
        );
        let stats = opened
            .source
            .borrow()
            .minimap
            .last_stats
            .expect("build statistics");
        assert!(
            stats.largest as u64 <= MAX_RASTER_BYTES,
            "a band of {} bytes passed the raster limit at {height}",
            stats.largest
        );
        assert_eq!(stats.failed + stats.skipped, 0, "no band was left out");
        window.hide().expect("close minimap window");
    }
}

/// Positive control for the texture count:
/// a flat block of coverage is not counted as glyphs,
/// and alternating coverage is.
#[test]
fn the_texture_count_tells_a_block_from_glyphs() {
    let flat = vec![
        slint::Rgba8Pixel {
            r: 0,
            g: 0,
            b: 0,
            a: 120,
        };
        40
    ];
    assert_eq!(textured_rows(&flat, 40), (1, 0));
    let mut striped = flat.clone();
    for (index, pixel) in striped.iter_mut().enumerate() {
        if index % 4 < 2 {
            pixel.a = 20;
        }
    }
    assert_eq!(textured_rows(&striped, 40), (1, 1));
}

/// A tall window over a long file asks for more than the quick budget:
/// the first picture after the resize is the coarse one,
/// and the full one follows with the statistics of its build.
#[test]
fn a_tall_window_over_a_long_file_shows_a_coarse_picture_before_the_full_one() {
    // Lines of about two hundred and thirty characters:
    // one sampled line for each pixel row of the tall window already costs more than the quick budget,
    // so a coarse picture that left units out for the budget would show it.
    let mut text = String::new();
    for number in 0..6_000 {
        text.push_str(&format!(
            "fn item_{number}(value: u32) -> u32 {{ value + {number} }} // trailing {}\n",
            "words ".repeat(30)
        ));
    }
    let (_project, opened) = open(&text);
    let window = &opened.window;
    {
        let mut waiting = Waiting::slow();
        while opened.source.borrow().minimap.last_stats.is_none() {
            waiting.step("the first picture of the long file did not arrive");
        }
    }
    let (images, before) = {
        let current = opened.source.borrow();
        (current.minimap.images_set, current.minimap.last_stats)
    };
    window.window().dispatch_event(WindowEvent::Resized {
        size: LogicalSize::new(TEXT_LEFT + 1330.0 + minimap_beside(1330.0), 1500.0),
    });
    update_timers_and_animations();
    {
        let mut waiting = Waiting::slow();
        while opened.source.borrow().minimap.images_set <= images {
            waiting.step("the picture of the tall window did not arrive");
        }
    }
    {
        let current = opened.source.borrow();
        let stats = current.minimap.last_stats.expect("build statistics");
        assert_ne!(
            Some(stats),
            before,
            "the picture of the tall window carries the old statistics"
        );
        // The coarse picture is rendered whole,
        // whatever it costs,
        // unless the full one has already followed it.
        if current.minimap.images_set == images + 1 {
            assert_eq!(
                stats.skipped + stats.failed,
                0,
                "the coarse picture left rows out: {stats:?}"
            );
            assert_eq!(stats.rendered, stats.units);
        }
    }
    // The full picture follows the coarse one as a second picture of the same request.
    {
        let mut waiting = Waiting::slow();
        while opened.source.borrow().minimap.images_set < images + 2 {
            waiting.step("the full picture did not follow the coarse one");
        }
    }
    let stats = opened
        .source
        .borrow()
        .minimap
        .last_stats
        .expect("build statistics");
    assert!(stats.rendered > 0 && stats.failed + stats.skipped == 0);
    assert!(stats.largest as u64 <= MAX_RASTER_BYTES);
    window.hide().expect("close minimap window");
}
