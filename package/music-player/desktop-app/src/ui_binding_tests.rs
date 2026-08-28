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

// What:     Testing backend initialization, mock-time control, and element driver.
// Why:      `init_no_event_loop` needs no window server; `ElementHandle` drives real
//           generated UI, while mock time triggers the post-layout LED report timer.
use i_slint_backend_testing::{init_no_event_loop, mock_elapsed_time, ElementHandle};

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


// What:     `led_backplate_fills_width_and_rows_track_resize` drives measured LED layouts.
// Why:      Plate paint must always fill available width while deferred reports preserve
//           measured cap-end corners across wrapped and one-row layouts.
#[test]
fn led_backplate_fills_width_and_rows_track_resize() {
    setup();
    let app = crate::AppWindow::new().expect("AppWindow builds under testing backend");
    crate::ui_led_rows::apply(&app);
    app.set_page_control_style(5);
    app.set_page_labels(ModelRc::new(VecModel::from(vec![
        SharedString::from("Alpha"),
        SharedString::from("Beta"),
        SharedString::from("GammaLong"),
        SharedString::from("NightDrive"),
        SharedString::from("StudioMasters"),
        SharedString::from("Zeta"),
    ])));
    app.show().expect("first frame lays out under testing backend");
    let caps = ElementHandle::find_by_element_type_name(&app, "LedSegmentButton").collect::<Vec<_>>();
    assert_eq!(caps.len(), 6, "first layout instantiates every LED cap");
    for delay_ms in [1, 16, 16] {
        mock_elapsed_time(std::time::Duration::from_millis(delay_ms));
    }

    let controls = ElementHandle::find_by_element_type_name(&app, "LedSegmentControls")
        .next()
        .expect("LED controls exist");
    let plate = ElementHandle::find_by_element_id(&app, "LedSegmentControls::led-backplate")
        .next()
        .expect("full-width LED backplate exists");
    assert_eq!(plate.size().width, controls.size().width, "backplate fills wrapped control width");
    assert_eq!(plate.size().height, controls.size().height, "backplate fills wrapped control height");

    let geometry = app.global::<crate::LedRowGeometry>();
    let wrapped_starts = geometry.get_starts();
    let wrapped_row_count = (0..wrapped_starts.row_count())
        .filter(|index| wrapped_starts.row_data(*index) == Some(true))
        .count();
    let wrapped_positions = caps.iter().map(ElementHandle::absolute_position).collect::<Vec<_>>();
    assert!(
        wrapped_row_count >= 2,
        "fixture must wrap after deferred reports; rows={wrapped_row_count}, caps={wrapped_positions:?}"
    );

    app.window().set_size(slint::LogicalSize::new(1800.0, 600.0));
    app.set_page_labels(ModelRc::new(VecModel::from(vec![
        SharedString::from("Alpha"),
        SharedString::from("Beta"),
        SharedString::from("GammaLong"),
    ])));
    let resized_positions =
        ElementHandle::find_by_element_type_name(&app, "LedSegmentButton")
            .map(|cap| cap.absolute_position())
            .collect::<Vec<_>>();
    mock_elapsed_time(std::time::Duration::ZERO);
    for delay_ms in [1, 16, 16] {
        mock_elapsed_time(std::time::Duration::from_millis(delay_ms));
    }

    let resized_starts = geometry.get_starts();
    let resized_row_count = (0..resized_starts.row_count())
        .filter(|index| resized_starts.row_data(*index) == Some(true))
        .count();
    assert_eq!(
        resized_row_count, 1,
        "resized three-cap fixture must repack body-sized legends to one row; rows={resized_row_count}, caps={resized_positions:?}"
    );
    assert_eq!(plate.size().width, controls.size().width, "backplate remains full width after resize");
    assert_eq!(plate.size().height, controls.size().height, "backplate remains full height after resize");
}

// What:     `#[test] fn narrow_page_controls_fold_every_style_and_reveal_selection()`
//           asks Slint's testing backend to lay out every persisted page-control style
//           inside the real narrow `AppWindow`, then drives the disclosure through its
//           accessibility action. `#[test]` registers this function with Rust's test
//           harness; unlike a TypeScript test callback, the attribute performs registration.
// Why:      Issue #457 spans all style branches, overflow and no-overflow geometry,
//           selected-page auto-reveal, accessibility text, and transient state across
//           style and breakpoint changes. One generated-window test crosses those bindings.
//
// In TS you'd write (pseudocode):
// ```ts
// test("folds every narrow page-control style and reveals selection", () => { ... });
// ```
#[test]
fn narrow_page_controls_fold_every_style_and_reveal_selection() {
    // Install the shared headless backend and instantiate the generated Slint window.
    setup();
    let app = crate::AppWindow::new().expect("AppWindow builds under testing backend");

    // What:     `ModelRc::new(VecModel::from(vec![...]))` builds Slint's reference-counted
    //           read-only model wrapper around an owned mutable vector model. `SharedString`
    //           is Slint's reference-counted UTF-8 string, rather than Rust's owned `String`
    //           or borrowed `&str`; `vec![...]` creates the owned growable array.
    // Why:      Long labels force every included style past one row at the narrow width,
    //           while Slint requires a model rather than a Rust array for repeated UI items.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const labels = ["Alpha Orchestra", "Bravo Ensemble", /* remaining labels */];
    // ```
    let labels = ModelRc::new(VecModel::from(vec![
        SharedString::from("Alpha Orchestra"),
        SharedString::from("Bravo Ensemble"),
        SharedString::from("Charlie Collective"),
        SharedString::from("Delta Sessions"),
        SharedString::from("Echo Recordings"),
        SharedString::from("Foxtrot Archive"),
        SharedString::from("Golf Sound Library"),
        SharedString::from("Hotel Mastering"),
    ]));
    app.set_page_labels(labels);
    app.window().set_size(slint::LogicalSize::new(640.0, 800.0));
    app.show().expect("narrow frame lays out under testing backend");

    // What:     `for (style, collapsed_height) in [(...), ...]` iterates owned pairs.
    //           Rust's array and tuple syntax correspond to a fixed JS array of pairs;
    //           the loop destructures each pair into immutable bindings.
    // Why:      Every persisted style branch must expose the same fold interaction, with
    //           LED retaining its 60px hardware row while other styles reserve 48px.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const [style, collapsedHeight] of [[0, 48], /* ... */]) { ... }
    // ```
    for (style, collapsed_height) in [(0, 48.0), (1, 48.0), (2, 48.0), (3, 48.0), (4, 48.0), (5, 60.0)] {
        app.set_page_control_style(style);
        app.set_page_controls_expanded(false);

        // Locate the visible fold root and its accessible collapsed disclosure.
        let fold = ElementHandle::find_by_element_type_name(&app, "FoldablePageControls")
            .next()
            .expect("narrow overflow creates foldable page controls");
        let disclosure = ElementHandle::find_by_accessible_label(&app, "Show all pages")
            .next()
            .expect("overflow exposes collapsed disclosure semantics");
        assert_eq!(fold.size().height, collapsed_height, "style {style} starts at one row");

        // Invoke the same default action assistive technology uses, then confirm both
        // observable state and the expanded accessibility label change without selection.
        disclosure.invoke_accessible_default_action();
        assert!(app.get_page_controls_expanded(), "style {style} disclosure expands controls");
        assert!(
            ElementHandle::find_by_accessible_label(&app, "Show fewer pages").next().is_some(),
            "style {style} exposes expanded disclosure semantics",
        );
        assert!(
            fold.size().height > collapsed_height,
            "style {style} expansion reveals additional wrapped rows",
        );
    }

    // Preserve explicit expansion when the visual style changes during this process.
    app.set_page_control_style(4);
    assert!(app.get_page_controls_expanded(), "style changes retain transient expansion");
    assert!(
        ElementHandle::find_by_accessible_label(&app, "Show fewer pages").next().is_some(),
        "retained expansion keeps the up-chevron semantics",
    );

    // Wide mode removes the fold surface without clearing its transient state.
    app.window().set_size(slint::LogicalSize::new(1000.0, 800.0));
    assert!(
        ElementHandle::find_by_element_type_name(&app, "FoldablePageControls").next().is_none(),
        "desktop wide mode keeps the existing unfurled controls",
    );
    assert!(app.get_page_controls_expanded(), "breakpoint transition retains expansion");

    // Re-enter narrow mode, collapse, and select the final Chromium tab. The horizontal
    // viewport must position that source-ordered final tab inside the fold's visible bounds.
    app.window().set_size(slint::LogicalSize::new(640.0, 800.0));
    app.set_page_controls_expanded(false);
    app.set_selected_page(7);
    let fold = ElementHandle::find_by_element_type_name(&app, "FoldablePageControls")
        .next()
        .expect("narrow mode restores foldable controls");
    let final_tab = ElementHandle::find_by_element_type_name(&app, "ChromiumTab")
        .last()
        .expect("Chromium fixture renders its final tab");
    let fold_left = fold.absolute_position().x;
    let fold_right = fold_left + fold.size().width;
    let tab_left = final_tab.absolute_position().x;
    let tab_right = tab_left + final_tab.size().width;
    assert!(tab_left >= fold_left + 56.0, "selected final tab starts after disclosure gutter");
    assert!(tab_right <= fold_right, "selected final tab is auto-revealed inside collapsed strip");

    // A one-label model fits without folding, so no disclosure or artificial gutter remains.
    app.set_page_labels(ModelRc::new(VecModel::from(vec![SharedString::from("Only page")])));
    assert!(
        ElementHandle::find_by_accessible_label(&app, "Show all pages").next().is_none(),
        "no-overflow controls omit collapsed disclosure",
    );
    assert!(
        ElementHandle::find_by_accessible_label(&app, "Show fewer pages").next().is_none(),
        "no-overflow controls omit expanded disclosure",
    );
}
