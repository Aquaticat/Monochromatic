//! Real Slint window events must invalidate source pixels even when source and logical size are unchanged.

/// Reuse production initialization, viewport callbacks, and raster presentation.
use super::{AppWindow, State, bind_viewport, render};
/// Native toolkit events and component ownership are exercised without a host window.
use slint::{ComponentHandle, platform::{WindowEvent, update_timers_and_animations}};
/// UI state remains on the test's event-loop thread.
use std::{cell::RefCell, rc::Rc};

/// Moving to a different display scale must not leave an old-resolution bitmap until the next keypress.
#[test]
fn source_raster_tracks_scale_without_input_or_resize() {
    let window = AppWindow::new().expect("headless native source window");
    let state = Rc::new(RefCell::new(State::new("=== and 猫", None)));
    bind_viewport(&window, &state);
    window.show().expect("show headless source window");
    render(&window, &state);
    update_timers_and_animations();
    let before = window.get_source_image().size();
    assert!(before.width > 0 && before.height > 0);
    let original_scale = window.window().scale_factor();
    window.window().dispatch_event(WindowEvent::ScaleFactorChanged { scale_factor: original_scale * 2.0 });
    update_timers_and_animations();
    let after = window.get_source_image().size();
    assert_eq!(after.width, before.width * 2, "source bitmap must follow scale without a resize or reading-state change");
    assert_eq!(after.height, before.height * 2);
    window.hide().expect("close headless source window");
}
