//! A tile the painter refuses never blanks the source:
//!  the window thread keeps the picture last painted and names the failure,
//!  and a job the worker failed is freed so the next placement asks for the tile again,
//!  and a tile the shaper had to cut carries a stamp that names the clip it was cut to.
//! Nothing here waits on the window thread:
//! every wait advances timers and lets the workers answer.

/// The reader fixture,
/// its wrapped text,
/// the pixels of the shown image,
/// and the waits.
use super::{
    AppWindow, State,
    overscan_tile_tests::scroll_to,
    render::{Paint, job, stamp_for},
    tall_window_tests::{hold_the_pass, mixed, resize_without_frame, settled_tile},
    theme_tests::switch,
    tile::TileBounds,
    tile_build::{FAIL_NEXT_BUILD, build_tile},
    tile_reads::shown,
    wrap_tests::{long_text, open, settled},
};
/// Bounded waiting that advances native timers until a state the test checks holds.
use crate::native::waiting_tests::Waiting;
/// Toolkit events.
use slint::{
    ComponentHandle, platform::update_timers_and_animations,
    private_unstable_api::re_exports::ColorScheme,
};
/// The switch is read by the next build.
use std::{cell::RefCell, rc::Rc, sync::atomic::Ordering};

/// Whether any pixel of the visible band of the tile has ink.
fn has_ink(window: &AppWindow, source: &Rc<RefCell<State>>) -> bool {
    if source.borrow().gpu.read_tile().is_none() && !source.borrow().gpu.has_pending() {
        return false;
    }
    for pixel in shown(window, source) {
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
    assert!(has_ink(window, &opened.source), "the first tile has no ink");
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
    assert!(
        has_ink(window, &opened.source),
        "a refused tile blanked the source"
    );
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
        // The window's message is cleared by the next render, which can follow the failure within the same timer
        // pass, so the test waits for the failure the state recorded when it named it.
        let mut waiting = Waiting::slow();
        while !(!opened.source.borrow().worker_failures.is_empty()) {
            waiting.step("the failed worker tile was not reported");
        }
    }
    assert!(
        opened.source.borrow().worker_failures[0].contains("Cannot render source"),
        "the failed worker tile was not named: {:?}",
        opened.source.borrow().worker_failures
    );
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
    assert!(
        has_ink(window, &opened.source),
        "the text is blank after the retry"
    );
    window.hide().expect("close wrap window");
}

/// A tile the shaper cuts to the raster limit is stamped with the clip it was cut to:
/// the window compares that stamp to the inputs it would paint with now,
/// and a stamp of the clip that was asked for would discard every cut tile,
/// however fresh.
#[test]
fn a_tile_cut_by_the_shaper_is_stamped_with_the_clip_it_was_cut_to() {
    let (_project, opened) = open(&mixed(6000));
    let release = hold_the_pass();
    let window = &opened.window;
    resize_without_frame(&opened, 1330.0, 3000.0);
    settled_tile(&opened);
    {
        let mut current = opened.source.borrow_mut();
        let paint = Paint::new(window, &current);
        let asked = TileBounds {
            first: 0,
            count: 2000,
            clip: None,
            ..current.shown
        };
        let queued = job(&current, asked, &paint);
        let built = build_tile(&mut current.shaper, queued).expect("the cut tile is painted");
        assert_eq!(built.requested, asked, "the tile names the job it answers");
        assert!(
            built.bounds.clip.is_some(),
            "the shaper did not cut a tile of two thousand wrapped lines"
        );
        assert!(
            stamp_for(&current, built.bounds, &paint) == built.stamp,
            "the stamp of a cut tile does not name the clip it was cut to"
        );
    }
    drop(release);
    window.hide().expect("close wrap window");
}
