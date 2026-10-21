//! The minimap of a tall window stays a picture of the text,
//!  the window's own shaped lines drawn small,
//!  and never turns into blocks.
//!  The texture it is drawn into never passes the device's limit.
//! Nothing here waits on the window thread:
//! every wait advances timers and lets the workers answer.

/// The reader fixture.
use super::find_tests::Reader;
/// The reader fixture,
/// the wrapped text,
/// the window sizing,
/// and the reads of the minimap's texture.
use super::{
    minimap_tests::{bands_of, picture_still},
    sidebar_tests::{TEXT_LEFT, minimap_beside},
    tile_reads::{draw_minimap, minimap_pixels},
    wrap_tests::{long_text, open, settled},
};
/// Bounded waiting that advances native timers until a state the test checks holds.
use crate::native::waiting_tests::Waiting;
/// The device's texture limit.
use ide_app::shaped_text::texture_dimension;
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
    draw_minimap(window);
    // The picture of the window before it was resized is also posted and shown;
    // under load the test could read it before the picture of the tall window arrived.
    {
        let mut waiting = Waiting::slow();
        while window.get_minimap_picture_height() <= 1000.0 {
            waiting.step("the texture of the tall window was not drawn");
            draw_minimap(window);
        }
    }
    return (project, opened);
}

/// What:
///  Count the rows of `pixels` (`width` to a row) that are inked,
///  and among them the rows whose coverage rises and falls along the row like the glyphs of a line do.
/// Why:
///  The picture is the glyphs' coverage,
///  so it is graded;
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

/// A tall window shows a minimap whose picture covers its track,
/// whose rows hold glyph texture,
/// and whose texture stays within the device's limit.
#[test]
fn the_minimap_of_a_tall_window_is_a_picture_of_glyphs_not_blocks() {
    for (height, measured) in [(3500.0, true), (12000.0, false)] {
        let (_project, opened) = tall(height, measured);
        let window = &opened.window;
        let image = minimap_pixels(window, &opened.source).expect("picture pixels");
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
        assert!(
            image.height() <= texture_dimension(),
            "a texture of {} rows passes the device's limit",
            image.height()
        );
        let stats = opened
            .source
            .borrow()
            .minimap
            .last_stats
            .expect("build statistics");
        assert_eq!(stats.skipped, 0, "no line was left out at {height}");
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

/// Lines of about two hundred and thirty characters wrap to a second row in a window this wide,
/// and cost far more than the lines of ordinary code.
fn long_file(lines: usize) -> String {
    let mut text = String::new();
    for number in 0..lines {
        text.push_str(&format!(
            "fn item_{number}(value: u32) -> u32 {{ value + {number} }} // trailing {}\n",
            "words ".repeat(30)
        ));
    }
    return text;
}

/// Wait for the first picture of the reader,
/// then resize its window to `height` and wait for the picture of that
/// height,
/// drawn.
fn resized_to(opened: &Reader, height: f32, track: f32) {
    let window = &opened.window;
    {
        let mut waiting = Waiting::slow();
        while opened.source.borrow().minimap.last_stats.is_none() {
            waiting.step("the first picture of the long file did not arrive");
        }
    }
    let images = opened.source.borrow().minimap.images_set;
    window.window().dispatch_event(WindowEvent::Resized {
        size: LogicalSize::new(TEXT_LEFT + 1330.0 + minimap_beside(1330.0), height),
    });
    update_timers_and_animations();
    {
        let mut waiting = Waiting::slow();
        loop {
            {
                let current = opened.source.borrow();
                // The picture is for the minimap's size as it now stands, not for the size before the resize.
                let size = current.minimap.size;
                let sized = match current.minimap.shown {
                    Some(shown) => shown.size == (size.0.to_bits(), size.1.to_bits()),
                    None => false,
                };
                if current.minimap.images_set > images
                    && current.minimap.posted == current.minimap.shown
                    && window.get_minimap_track() > track
                    && sized
                {
                    break;
                }
            }
            waiting.step("the picture of the tall window did not arrive");
        }
    }
    // The picture checked is the one that stood still while the line measurements finished.
    picture_still(opened);
    draw_minimap(window);
}

/// A tall window over a long file draws only the lines near the visible part of the picture,
/// all within the work budget,
/// and leaves none out.
#[test]
fn a_tall_window_over_a_long_file_draws_a_window_of_bands() {
    let (_project, opened) = open(&long_file(6_000));
    let window = &opened.window;
    resized_to(&opened, 3500.0, 3000.0);
    let stats = opened
        .source
        .borrow()
        .minimap
        .last_stats
        .expect("build statistics");
    assert_eq!(stats.skipped, 0, "no line was left out");
    assert_eq!(stats.shaped + stats.reused, stats.lines);
    assert!(
        stats.units * 4 < bands_of(&opened),
        "{} of {} bands were built for one view",
        stats.units,
        bands_of(&opened)
    );
    window.hide().expect("close minimap window");
}

/// A window taller than the device's texture limit gets a picture cut to the limit:
/// the texture is made,
/// no error is shown,
/// and the picture covers the top of the track and not the rest.
#[test]
fn a_picture_taller_than_the_device_limit_is_cut_to_the_limit() {
    let (_project, opened) = open(&long_file(6_000));
    let window = &opened.window;
    // The window is 12,000 px tall at scale 1: its track is 12,000 px, past the harness device's 8192.
    resized_to(&opened, 12_000.0, 9_000.0);
    let limit = texture_dimension();
    assert_eq!(
        limit, 8192,
        "the native tests run on a device capped to 8192 px"
    );
    let track = window.get_minimap_track() * window.window().scale_factor();
    assert!(track > limit as f32, "the track is {track} px");
    let image = minimap_pixels(window, &opened.source).expect("a texture");
    assert!(
        image.height() <= limit,
        "a texture of {} rows passes the limit {limit}",
        image.height()
    );
    assert!(
        image.height() as f32 > limit as f32 * 0.5,
        "the picture is only {} rows of a track of {track}",
        image.height()
    );
    assert!(
        (image.height() as f32) < track,
        "the cut picture should not cover the whole track"
    );
    assert_eq!(
        window.get_minimap_picture_height(),
        image.height() as f32,
        "the markup places the texture it was given"
    );
    assert_eq!(
        opened.source.borrow().gpu.minimap_size(),
        Some((image.width(), image.height())),
        "the texture is the size of the picture the markup places"
    );
    assert_eq!(
        window.get_error_message().to_string(),
        "",
        "the cut picture is not an error"
    );
    // The slice is several renders, and none of them came out blank.
    let chunks = opened.source.borrow().gpu.minimap_chunks_rendered();
    let wanted = u64::from(image.height().div_ceil(ide_app::minimap::CHUNK_ROWS));
    assert!(
        wanted > 1 && chunks >= wanted,
        "{chunks} chunks rendered for a texture of {wanted} chunks"
    );
    let width = image.width() as usize;
    let pixels = image.as_slice();
    let mut inked_by_chunk = Vec::new();
    for chunk in 0..wanted as usize {
        let first = chunk * ide_app::minimap::CHUNK_ROWS as usize * width;
        let last = ((chunk + 1) * ide_app::minimap::CHUNK_ROWS as usize * width).min(pixels.len());
        inked_by_chunk.push(
            pixels[first..last]
                .iter()
                .filter(|pixel| return pixel.a > 0)
                .count(),
        );
    }
    assert!(
        inked_by_chunk.iter().all(|inked| return *inked > 0),
        "a chunk of the slice is blank: inked pixels by chunk {inked_by_chunk:?}, texture {}x{}, {chunks} chunks rendered, {} slices, statistics {:?}",
        image.width(),
        image.height(),
        opened.source.borrow().gpu.minimaps_rendered(),
        opened.source.borrow().minimap.last_stats
    );
    window.hide().expect("close minimap window");
}
