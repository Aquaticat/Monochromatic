// What:     Headless UI regression tests for the seek/volume `Slider` bindings in
//           `ui/app.slint`, pulled in by
//           `#[cfg(test)] #[path = "ui_binding_tests.rs"] mod ui_binding_tests;`
//           near the top of `main.rs`. Compiles only under `cargo nextest run` /
//           `cargo test`, and reaches the generated `AppWindow` via `crate::` because
//           `slint::include_modules!()` pastes it into the binary crate root.
// Why:      A `Slider`'s `value` must keep tracking the engine-pushed `position` /
//           `volume` AFTER the user first touches the slider. Slint destroys a
//           ONE-WAY binding (`value: root.position`) on the first imperative
//           `set-value`, which froze the seek bar mid-playback
//           (doc/troubleshooting/slint-slider-binding-breaks-on-input.md). The fix
//           switched to two-way `value <=> root.position`; this file is the
//           executable guard that keeps it that way, and the first proof that the
//           in-process `i-slint-backend-testing` seam can drive this app's UI.

// What:     `use i_slint_backend_testing::{init_no_event_loop, ElementHandle};`.
//           The headless testing backend initializer and the element locator/driver.
// Why:      `init_no_event_loop` installs a per-thread backend whose mock renderer
//           needs no window server; `ElementHandle` finds the `Slider` and drives its
//           accessibility actions the way real user input would.
use i_slint_backend_testing::{init_no_event_loop, ElementHandle};

// What:     Slint handles and model types expose generated globals and page labels.
// Why:      LED lifecycle guard must instantiate real generated UI and inspect final path.
use slint::{ComponentHandle, Model, ModelRc, SharedString, VecModel};

// What:     `use std::sync::Once;`. A one-time initialization guard.
// Why:      A Slint backend installs only once per process; `Once` lets every test in
//           this file share a single `init_no_event_loop` call whether the harness
//           runs them in separate processes (nextest) or one (`cargo test`).
use std::sync::Once;

// What:     `static TESTING_BACKEND: Once`. The shared init guard used by `setup`.
// Why:      Guarantee exactly one backend installation across all tests here.
static TESTING_BACKEND: Once = Once::new();

// What:     `fn setup()`. Install the testing backend at most once.
// Why:      Each test calls it before building an `AppWindow`; the `Once` collapses
//           repeated calls to a single install so a second test cannot panic on an
//           already-initialized backend.
fn setup() {
    TESTING_BACKEND.call_once(init_no_event_loop);
}

// What:     `fn thumb(handle: &ElementHandle) -> f32`. Read a `Slider`'s current value
//           through its `accessible-value`, the accessibility view of the thumb.
// Why:      `accessible_value` reports the value the widget actually displays, so it
//           still reads a FROZEN thumb even when the bound property moved on: exactly
//           the signal this regression needs.
fn thumb(handle: &ElementHandle) -> f32 {
    handle
        .accessible_value()
        .and_then(|value| value.parse::<f32>().ok())
        .expect("Slider exposes a numeric accessible-value")
}

// What:     `fn sliders(app: &crate::AppWindow) -> Vec<ElementHandle>`. Collect the two
//           Sliders in declaration order (seek first, volume second).
// Why:      `find_by_element_type_name` matches by INHERITED type, so it needs no
//           element-id debug info to locate the widgets; declaration order is stable
//           depth-first tree order.
fn sliders(app: &crate::AppWindow) -> Vec<ElementHandle> {
    ElementHandle::find_by_element_type_name(app, "Slider").collect()
}

// What:     `#[test] fn seek_thumb_follows_engine_after_user_input()`.
// Why:      The seek bar's core regression: after the user drags it, later engine
//           position ticks must still move the thumb.
#[test]
fn seek_thumb_follows_engine_after_user_input() {
    // What:     install the backend and build the window.
    // Why:      the UI must exist before elements can be located or driven.
    setup();
    let app = crate::AppWindow::new().expect("AppWindow builds under the testing backend");

    // What:     set a non-zero duration.
    // Why:      the seek maximum is `duration > 0 ? duration : 1.0`, so without this
    //           the values below would clamp to the default maximum of 1.0.
    app.set_duration(100.0);

    // What:     push an initial engine position and read the thumb.
    // Why:      the binding must forward an engine write to the thumb before any input.
    app.set_position(10.0);
    let sliders = sliders(&app);
    assert_eq!(sliders.len(), 2, "AppWindow exposes exactly the seek + volume sliders");
    let seek = &sliders[0];
    assert!(
        (thumb(seek) - 10.0).abs() < 0.001,
        "engine position must reach the thumb before any user input"
    );

    // What:     drive the slider's imperative SetValue action.
    // Why:      a real drag/click/key calls the widget's `set-value` imperatively, the
    //           exact write that destroys a one-way binding; reproduce it here.
    seek.set_accessible_value("3");
    assert!((thumb(seek) - 3.0).abs() < 0.001, "user input moves the thumb");

    // What:     push a NEW engine position after the user touched the slider.
    // Why:      this is the write a broken binding silently drops.
    app.set_position(20.0);

    // What:     assert the thumb tracked the new engine position.
    // Why:      one-way `value: root.position` freezes the thumb at 3; the two-way
    //           `value <=> root.position` alias keeps it tracking. This is the guard.
    assert!(
        (thumb(seek) - 20.0).abs() < 0.001,
        "seek thumb froze after user input: the position binding was destroyed (regression of the two-way <=> fix)"
    );
}

// What:     `#[test] fn volume_thumb_follows_engine_after_user_input()`.
// Why:      The volume slider carries the identical latent defect; guard it too.
#[test]
fn volume_thumb_follows_engine_after_user_input() {
    // What:     install the backend and build the window.
    // Why:      same precondition as the seek test.
    setup();
    let app = crate::AppWindow::new().expect("AppWindow builds under the testing backend");

    // What:     push an engine volume and read the thumb.
    // Why:      the volume maximum is a fixed 1.0, so values stay within [0, 1].
    app.set_volume(0.8);
    let sliders = sliders(&app);
    let volume = &sliders[1];
    assert!(
        (thumb(volume) - 0.8).abs() < 0.001,
        "engine volume must reach the thumb before any user input"
    );

    // What:     drive the volume slider's imperative SetValue action.
    // Why:      reproduce the user's first drag, the write that breaks a one-way binding.
    volume.set_accessible_value("0.2");
    assert!((thumb(volume) - 0.2).abs() < 0.001, "user input moves the volume thumb");

    // What:     a restored/engine volume change arrives after the user touched it.
    // Why:      this is the write a broken volume binding would silently drop.
    app.set_volume(0.5);

    // What:     assert the thumb tracked the new engine volume.
    // Why:      guards the two-way `value <=> root.volume` alias against regression.
    assert!(
        (thumb(volume) - 0.5).abs() < 0.001,
        "volume thumb froze after user input: the volume binding was destroyed (regression of the two-way <=> fix)"
    );
}


// What:     `led_plate_exists_on_first_led_layout` instantiates initial LED generation.
// Why:      Change handlers do not fire for every initial property assignment; cap `init`
//           reports must still complete one backplate before first rendered frame.
#[test]
fn led_plate_exists_on_first_led_layout() {
    setup();
    let app = crate::AppWindow::new().expect("AppWindow builds under testing backend");
    crate::ui_led_plate::apply(&app);
    app.set_page_control_style(5);
    app.set_page_labels(ModelRc::new(VecModel::from(vec![
        SharedString::from("Alpha"),
        SharedString::from("Beta"),
        SharedString::from("GammaLong"),
        SharedString::from("NightDrive"),
        SharedString::from("StudioMasters"),
        SharedString::from("Zeta"),
    ])));
    let geometry = app.global::<crate::LedPlateGeometry>();
    assert!(!geometry.get_path().is_empty(), "first LED frame must contain one backplate path");
    let starts = geometry.get_starts();
    let row_start_count = (0..starts.row_count())
        .filter(|index| starts.row_data(*index) == Some(true))
        .count();
    assert!(row_start_count >= 2, "fixture must wrap and report measured row starts");
}
