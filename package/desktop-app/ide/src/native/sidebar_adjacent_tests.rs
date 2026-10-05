//! Tree rows and source text directly beside the divider keep their own clicks at every sidebar width.

/// Shared window fixture, pointer helpers, and the pinned layout measurements.
use super::sidebar_tests::{
    DIVIDER, HEADER, MINIMUM, SOURCE_MINIMUM, click, drag_to, fixture, motion, press, release,
    settle,
};
/// Generated window and tree row types from the shipped markup.
use super::{AppWindow, ui::TreeEntry};
/// What: `Rgba8Pixel` is one pixel of four bytes; `SharedPixelBuffer<Rgba8Pixel>` is a rendered frame
/// (the `<...>` names the element type, like `Array<Pixel>`).
/// Why: Painting outside the sidebar is visible only in rendered pixels, not in window properties.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Frame = { width: number; pixels: Pixel[] };
/// ```
use slint::{
    ComponentHandle, ModelRc, Rgba8Pixel, SharedPixelBuffer, SharedString, VecModel,
    platform::{PointerEventButton, update_timers_and_animations},
};
/// The replacement tree model is shared with the window like the fixture's own model.
use std::rc::Rc;

/// What: `&SharedPixelBuffer<Rgba8Pixel>` lends the frame; the four `usize` bounds are whole pixels
/// (`usize` is the index type, siblings `u32` and `i32`); the answer is `true` when any pixel inside
/// the bounds differs from `background`.
/// Why: Text and badges are "something painted here"; an untouched region is "nothing painted here".
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function painted(frame: Frame, bounds: [number, number, number, number], background: Pixel): boolean;
/// ```
fn painted(
    frame: &SharedPixelBuffer<Rgba8Pixel>,
    bounds: [usize; 4],
    background: Rgba8Pixel,
) -> bool {
    // What: `as usize` converts the frame's `u32` width to the index type; `as_slice()` borrows all pixels.
    // Why: Pixel (x, y) lives at index `y * width + x`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const width = frame.width; const pixels = frame.pixels;
    // ```
    let width = frame.width() as usize;
    let pixels = frame.as_slice();
    for y in bounds[2]..bounds[3] {
        for x in bounds[0]..bounds[1] {
            if pixels[y * width + x] != background {
                return true;
            }
        }
    }
    return false;
}

/// Render the window and return the frame; the headless window renders one pixel per logical pixel.
fn frame(window: &AppWindow) -> SharedPixelBuffer<Rgba8Pixel> {
    settle(window);
    // What: `expect` returns the rendered frame or fails the test with this message.
    // Why: Pixel assertions need an actual frame.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const frame = window.takeSnapshot();
    // ```
    let rendered = window.window().take_snapshot().expect("sidebar frame");
    assert_eq!(
        rendered.width(),
        1100,
        "pixel checks assume one pixel per logical pixel"
    );
    return rendered;
}

/// The last tree pixel activates its row, both divider edges do nothing else, and the first source pixel
/// places the caret, at the default, narrowest, and widest sidebar.
#[test]
fn clicks_beside_the_divider_reach_tree_rows_and_source_at_every_width() {
    // Six rows do not overflow, so no tree scrollbar sits between the rows and the divider.
    let shared = fixture(6);
    // What: `&shared.window` borrows the window out of the fixture record.
    // Why: The helpers take a borrowed window, and the fixture keeps owning it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const window = shared.window;
    // ```
    let window = &shared.window;
    let mut row = 1;
    for target in [256.0, MINIMUM, 1100.0 - DIVIDER - SOURCE_MINIMUM] {
        drag_to(window, target);
        let width = window.get_sidebar_width();
        assert_eq!(width, target, "the drag did not reach the tested width");
        // What: `row as f32` converts the integer row to a float for pixel arithmetic.
        // Why: Tree rows are 48px tall below the 32px project label.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const y = HEADER + row * 48 + 24;
        // ```
        let y = HEADER + row as f32 * 48.0 + 24.0;
        shared.activated.set(-1);
        click(window, width - 1.0, y);
        assert_eq!(
            shared.activated.get(),
            row,
            "the last tree pixel before the divider did not activate its row at width {width}"
        );
        shared.activated.set(-1);
        let before = shared.source.borrow().document.position();
        click(window, width, y);
        click(window, width + DIVIDER - 1.0, y);
        assert_eq!(
            shared.activated.get(),
            -1,
            "the divider activated a tree row at width {width}"
        );
        assert_eq!(
            shared.source.borrow().document.position(),
            before,
            "the divider moved the source caret at width {width}"
        );
        assert_eq!(
            window.get_sidebar_width(),
            width,
            "clicks on the divider edges resized the sidebar"
        );
        // Source lines are 24px tall below the 32px file label; the first source pixel is line-number gutter.
        let line = row as usize + 3;
        click(
            window,
            width + DIVIDER,
            HEADER + line as f32 * 24.0 + 12.0,
        );
        // What: `borrow()` reads the shared state; `line_to_char` is the character index where a line starts.
        // Why: A gutter click places the caret at the start of the clicked line.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const expected = lineStart(source.current.document, line);
        // ```
        let state = shared.source.borrow();
        let expected = state.document.text().line_to_char(line);
        assert_eq!(
            state.document.position().head,
            expected,
            "the first source pixel after the divider did not place the caret on its line at width {width}"
        );
        drop(state);
        row += 1;
    }
    window.hide().expect("close sidebar window");
}

/// Far reveal, row clicks after a reveal, and the tree scrollbar beside the divider work at both bounds.
#[test]
fn tree_windowing_and_scrollbar_follow_the_sidebar_width() {
    let shared = fixture(60);
    let window = &shared.window;
    for target in [MINIMUM, 1100.0 - DIVIDER - SOURCE_MINIMUM] {
        drag_to(window, target);
        let width = window.get_sidebar_width();
        assert_eq!(width, target, "the drag did not reach the tested width");
        for index in [43, 59, 2] {
            window.invoke_reveal_tree(index);
            settle(window);
            let top = window.get_tree_scroll_y() + index as f32 * 48.0;
            assert!(
                top >= -0.1 && top + 48.0 <= window.get_tree_viewport_height() + 0.1,
                "row {index} is not fully revealed at width {width}: top {top}"
            );
            // The overflowing tree shows a 14px scrollbar at its right edge; rows end left of it.
            shared.activated.set(-1);
            click(window, width - 20.0, HEADER + top + 24.0);
            assert_eq!(
                shared.activated.get(),
                index,
                "a revealed row did not take its click at width {width}"
            );
        }
        window.invoke_reveal_tree(0);
        settle(window);
        let scrolled = window.get_tree_scroll_y();
        press(window, width - 5.0, HEADER + 100.0, PointerEventButton::Left);
        motion(window, width - 5.0, HEADER + 200.0);
        release(window, width - 5.0, HEADER + 200.0, PointerEventButton::Left);
        settle(window);
        assert!(
            window.get_tree_scroll_y() < scrolled,
            "the tree scrollbar beside the divider did not scroll at width {width}"
        );
        assert_eq!(
            window.get_sidebar_width(),
            width,
            "dragging the tree scrollbar resized the sidebar"
        );
    }
    window.hide().expect("close sidebar window");
}

/// At the narrowest sidebar a long name and a slot badge still paint, and nothing paints over the divider.
#[test]
fn long_names_and_slot_badges_stay_inside_the_narrowest_sidebar() {
    let shared = fixture(6);
    let window = &shared.window;
    // What: `vec![...]` builds an array; `..TreeEntry::default()` fills the unnamed fields.
    // Why: One deep row with a slot badge and a name far wider than the sidebar is the worst case.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const rows = [{ ...defaultEntry, label: longName, depth: 2, recency: '3' }];
    // ```
    let rows = vec![TreeEntry {
        label: SharedString::from(
            "an-extremely-long-file-name-that-cannot-fit-inside-a-narrow-sidebar.txt",
        ),
        depth: 2,
        recency: SharedString::from("3"),
        ..TreeEntry::default()
    }];
    window.set_tree_entries(ModelRc::from(Rc::new(VecModel::from(rows))));
    drag_to(window, MINIMUM);
    // Leave the divider so its hover emphasis does not change the line's width.
    motion(window, 800.0, 500.0);
    update_timers_and_animations();
    let rendered = frame(window);
    let width = rendered.width() as usize;
    // The window background, sampled in the divider cell away from its line.
    let background = rendered.as_slice()[300 * width + 164];
    let top = HEADER as usize;
    let bottom = top + 48;
    // Depth 2 puts the badge column at 40..64 and the name from 64 to 12px before the sidebar edge.
    assert!(
        painted(&rendered, [40, 64, top, bottom], background),
        "the slot badge is not painted at the narrowest sidebar"
    );
    assert!(
        painted(&rendered, [64, 148, top, bottom], background),
        "the long name is not painted at the narrowest sidebar"
    );
    assert!(
        !painted(&rendered, [148, 160, top, bottom], background),
        "the long name painted into the row's trailing padding"
    );
    // The idle line is the single pixel column 24px into the divider cell.
    assert!(
        !painted(&rendered, [160, 184, top, bottom], background)
            && !painted(&rendered, [185, 208, top, bottom], background),
        "the long name painted over the divider"
    );
    assert!(
        painted(&rendered, [184, 185, top, bottom], background),
        "the divider line is not painted"
    );
    window.hide().expect("close sidebar window");
}
