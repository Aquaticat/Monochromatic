//! The minimap of a tall window stays a picture of the text,
//!  one pixel for each source column,
//!  and never turns into blocks.
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
/// Toolkit events.
use slint::{
    ComponentHandle, LogicalSize,
    platform::{WindowEvent, update_timers_and_animations},
};

/// A tall window shows a minimap whose picture is as tall as its track,
/// and whose rows hold glyph pixels:
/// ink and gaps alternate along a row as the characters and the spaces of the line do,
/// where a block would be one uniform run.
#[test]
fn the_minimap_of_a_tall_window_is_a_picture_of_glyphs_not_blocks() {
    let (_project, opened) = open(&long_text(400));
    let window = &opened.window;
    window.window().dispatch_event(WindowEvent::Resized {
        size: LogicalSize::new(TEXT_LEFT + 1330.0 + minimap_beside(1330.0), 3500.0),
    });
    update_timers_and_animations();
    settled(&opened);
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
    let image = window
        .get_minimap_image()
        .to_rgba8()
        .expect("picture pixels");
    let width = image.width() as usize;
    assert!(
        image.height() > 1000,
        "the picture is only {} rows tall",
        image.height()
    );
    let pixels = image.as_slice();
    let mut inked_rows = 0;
    let mut glyph_rows = 0;
    for row in pixels.chunks(width) {
        let mut transitions = 0;
        let mut any = false;
        for pair in row.windows(2) {
            if (pair[0].a > 0) != (pair[1].a > 0) {
                transitions += 1;
            }
        }
        for pixel in row {
            if pixel.a > 0 {
                any = true;
            }
        }
        if any {
            inked_rows += 1;
            // Words and the gaps between them make ink and blanks alternate along a row of glyph pixels.
            if transitions >= 4 {
                glyph_rows += 1;
            }
        }
    }
    assert!(
        inked_rows > 100,
        "the picture holds only {inked_rows} inked rows"
    );
    assert!(
        glyph_rows * 10 >= inked_rows * 9,
        "only {glyph_rows} of {inked_rows} inked rows alternate ink and blanks like glyphs"
    );
    window.hide().expect("close minimap window");
}
