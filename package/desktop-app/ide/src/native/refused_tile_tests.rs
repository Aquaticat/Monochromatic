//! A tile the painter refuses never blanks the source:
//!  the window thread keeps the picture last painted and names the failure,
//!  and a job the worker failed is freed so the next placement asks for the tile again.
//! Nothing here waits on the window thread:
//! every wait advances timers and lets the workers answer.

/// The reader fixture,
/// its wrapped text,
/// the pixels of the shown image,
/// and the waits.
use super::{
    AppWindow,
    overscan_tile_tests::scroll_to,
    theme_tests::switch,
    tile_build::FAIL_NEXT_BUILD,
    wrap_tests::{long_text, open, settled, shown},
};
/// Bounded waiting that advances native timers until a state the test checks holds.
use crate::native::waiting_tests::Waiting;
/// Toolkit events.
use slint::{
    ComponentHandle, platform::update_timers_and_animations,
    private_unstable_api::re_exports::ColorScheme,
};
/// The switch is read by the next build.
use std::sync::atomic::Ordering;

/// Whether any pixel of the visible band of the source image has ink.
fn has_ink(window: &AppWindow) -> bool {
    if window.get_source_image().to_rgba8().is_none() {
        return false;
    }
    for pixel in shown(window) {
        if pixel[3] > 0 {
            return true;
        }
    }
    return false;
}

/// A tile the painter refuses on the window thread leaves the text last painted on screen,
/// names the failure,
/// and the next render builds the tile again.
#[test]
fn a_refused_tile_keeps_the_text_on_screen_and_names_the_failure() {
    let (_project, opened) = open(&long_text(200));
    let window = &opened.window;
    settled(&opened);
    assert!(has_ink(window), "the first tile has no ink");
    assert_eq!(window.get_error_message().to_string(), "");
    // The scheme the window starts in is not known, so the first change makes sure the next one differs.
    switch(window, ColorScheme::Dark);
    settled(&opened);
    FAIL_NEXT_BUILD.store(true, Ordering::SeqCst);
    // A new color scheme repaints the tile on the window thread.
    switch(window, ColorScheme::Light);
    let message = window.get_error_message().to_string();
    assert!(
        message.contains("Cannot render source"),
        "the failure is not named: {message:?}"
    );
    assert!(has_ink(window), "a refused tile blanked the source");
    window.hide().expect("close wrap window");
}

/// A tile the painter refuses on the worker frees its job:
/// the poll stops,
/// the displayed text stays,
/// and the next placement of the view gets its tile.
#[test]
fn a_failed_worker_tile_frees_its_job_and_the_next_placement_gets_its_tile() {
    let (_project, opened) = open(&long_text(800));
    let window = &opened.window;
    settled(&opened);
    FAIL_NEXT_BUILD.store(true, Ordering::SeqCst);
    // Far enough to leave the tile, so the worker builds the next one.
    scroll_to(window, 12_000.0);
    {
        let mut waiting = Waiting::slow();
        while !(window
            .get_error_message()
            .to_string()
            .contains("Cannot render source"))
        {
            waiting.step("the failed worker tile was not reported");
        }
    }
    assert!(
        opened.source.borrow().tile_job.is_none(),
        "the failed job is still held"
    );
    {
        let mut waiting = Waiting::slow();
        while !(!opened.source.borrow().tile_poll.running()) {
            update_timers_and_animations();
            waiting.step("the poll of a failed job did not stop");
        }
    }
    // One more step of the view asks for the tile again, and it arrives.
    scroll_to(window, 12_030.0);
    {
        let mut waiting = Waiting::slow();
        loop {
            update_timers_and_animations();
            {
                let current = opened.source.borrow();
                if current.tile_job.is_none()
                    && current.scroll_wanted.is_none()
                    && current.shown.first > 50
                {
                    break;
                }
            }
            waiting.step("the tile after a failed one did not arrive");
        }
    }
    assert!(has_ink(window), "the text is blank after the retry");
    window.hide().expect("close wrap window");
}
