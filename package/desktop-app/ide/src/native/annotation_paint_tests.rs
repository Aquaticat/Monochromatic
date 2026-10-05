//! Rendered annotation pixels in both schemes with measured contrast, source pixels untouched by late snapshots,
//! repaints only for visible changes, and a scroll range that reaches hint labels.

/// The production window.
use super::AppWindow;
/// The production setter and the stamp of the displayed text.
use super::annotate::{displayed, set_annotations};
/// Snapshot builders, the fixture, and the text origin shared with the behavior tests.
use super::annotation_tests::{FIXTURE, TEXT_LEFT, TEXT_TOP, annotate, hint, problem};
/// The complete reader fixture.
use super::find_tests::{Reader, reader};
/// Snapshot records.
use ide_app::language::{
    diagnostics::{DiagnosticsSnapshot, Severity, SourceGroup},
    hints::HintsSnapshot,
};
/// What: `ColorScheme` is the toolkit's scheme enum; `WindowInner` is the toolkit's internal side of a window,
///       reached through its unstable re-export module.
/// Why: Slint 1.18.1's portal watcher applies a scheme with `set_color_scheme` on the window's context; the
///      headless backend has no portal, so the test makes the same call.
/// Gotcha: This module is not stable API; a toolkit upgrade can rename it and break only these tests.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { ColorScheme, windowInternals } from 'slint/private';
/// ```
use slint::private_unstable_api::re_exports::{ColorScheme, WindowInner};
/// Frames, pixels, and toolkit colors are read back from the rendered window.
use slint::{
    Color, ComponentHandle, Model, Rgba8Pixel, SharedPixelBuffer,
    platform::update_timers_and_animations,
};
/// Disposable fixtures and shared snapshot pointers.
use std::{fs, sync::Arc};

/// Apply a system color scheme exactly where the portal watcher applies it, then run change handlers.
fn switch(window: &AppWindow, scheme: ColorScheme) {
    WindowInner::from_pub(window.window())
        .context()
        .set_color_scheme(scheme);
    update_timers_and_animations();
}

/// The rendered window frame.
fn frame(window: &AppWindow) -> SharedPixelBuffer<Rgba8Pixel> {
    return window.window().take_snapshot().expect("window frame");
}

/// One frame pixel at whole logical coordinates; the headless window has scale one.
fn pixel(frame: &SharedPixelBuffer<Rgba8Pixel>, x: f32, y: f32) -> Rgba8Pixel {
    let index = y as usize * frame.width() as usize + x as usize;
    return frame.as_slice()[index];
}

/// WCAG 2 relative luminance of an opaque pixel.
fn luminance(pixel: Rgba8Pixel) -> f32 {
    let linear = |channel: u8| {
        let value = f32::from(channel) / 255.0;
        if value <= 0.04045 {
            return value / 12.92;
        }
        return ((value + 0.055) / 1.055).powf(2.4);
    };
    return 0.2126 * linear(pixel.r) + 0.7152 * linear(pixel.g) + 0.0722 * linear(pixel.b);
}

/// WCAG 2 contrast ratio of two opaque pixels.
fn contrast(first: Rgba8Pixel, second: Rgba8Pixel) -> f32 {
    let (lighter, darker) = (
        luminance(first).max(luminance(second)),
        luminance(first).min(luminance(second)),
    );
    return (lighter + 0.05) / (darker + 0.05);
}

/// Whether a frame pixel equals a toolkit color within rounding.
fn near(pixel: Rgba8Pixel, color: Color) -> bool {
    return pixel.r.abs_diff(color.red()) <= 2
        && pixel.g.abs_diff(color.green()) <= 2
        && pixel.b.abs_diff(color.blue()) <= 2;
}

/// A reader over the shared fixture in a fresh disposable project; the directory lives as long as the reader.
fn fixture_reader(text: &str) -> (tempfile::TempDir, Reader) {
    let directory = tempfile::tempdir().expect("disposable paint project");
    fs::write(directory.path().join("main.rs"), text).expect("paint fixture");
    let opened = reader(directory.path(), "main.rs");
    return (directory, opened);
}

/// In both schemes the error marker is filled with the scheme's error ink and its letter, the error underline
/// is drawn in that ink, and hint text stands out from its box; contrast is measured on rendered pixels.
#[test]
fn marks_and_hints_render_in_both_schemes_with_measured_contrast() {
    let mut inks = Vec::new();
    for scheme in [ColorScheme::Light, ColorScheme::Dark] {
        let (_directory, reader) = fixture_reader(FIXTURE);
        let window = &reader.window;
        switch(window, scheme);
        annotate(&reader);
        update_timers_and_animations();
        let shown = frame(window);
        let error = window.get_error_ink();
        let marker = window
            .get_source_markers()
            .row_data(0)
            .expect("first marker");
        assert_eq!(marker.severity, 0, "line 0's worst problem is the error");
        let left = TEXT_LEFT + marker.x;
        let top = TEXT_TOP + marker.y + 3.0;
        let fill = pixel(&shown, left + 2.0, top + 9.0);
        assert!(
            near(fill, error),
            "{scheme:?}: marker fill {fill:?} is not the error ink {error:?}"
        );
        // The letter is the darkest or lightest pixel inside the box, whichever differs from the fill.
        let mut letter = fill;
        for dy in 3..15 {
            for dx in 4..14 {
                let candidate = pixel(&shown, left + dx as f32, top + dy as f32);
                if contrast(candidate, fill) > contrast(letter, fill) {
                    letter = candidate;
                }
            }
        }
        let background = pixel(&shown, TEXT_LEFT + 700.0, TEXT_TOP + 2.0 * 24.0 + 12.0);
        // Underline pixels under `area(2, 3)` on line 0, in the band below the baseline.
        let view_left =
            reader.source.borrow().shaped.as_ref().expect("shaped").rows[0].caret_x(12, 1.0);
        let mut underline = 0;
        for y in 17..24 {
            for x in 0..60 {
                if near(
                    pixel(
                        &shown,
                        TEXT_LEFT + view_left + x as f32,
                        TEXT_TOP + y as f32,
                    ),
                    error,
                ) {
                    underline += 1;
                }
            }
        }
        // Hint text against its box: the box's padding pixel and the strongest pixel inside the first label.
        let label = window.get_hint_boxes().row_data(0).expect("first hint box");
        let box_left = TEXT_LEFT + label.x;
        let box_fill = pixel(&shown, box_left + 2.0, TEXT_TOP + label.y + 12.0);
        let mut ink = box_fill;
        for dy in 6..20 {
            for dx in 5..(label.width as usize - 5) {
                let candidate = pixel(&shown, box_left + dx as f32, TEXT_TOP + label.y + dy as f32);
                if contrast(candidate, box_fill) > contrast(ink, box_fill) {
                    ink = candidate;
                }
            }
        }
        let marker_ratio = contrast(fill, background);
        let letter_ratio = contrast(letter, fill);
        let hint_ratio = contrast(ink, box_fill);
        let box_ratio = contrast(box_fill, background);
        println!(
            "contrast {scheme:?}: background {background:?}; error marker vs background {marker_ratio:.2}; \
             letter vs marker {letter_ratio:.2}; hint text vs box {hint_ratio:.2}; box vs background {box_ratio:.2}; \
             error underline pixels {underline}"
        );
        assert!(marker_ratio >= 3.0, "{scheme:?}: the marker is too faint");
        assert!(
            letter_ratio >= 4.5,
            "{scheme:?}: the marker letter is too faint"
        );
        assert!(hint_ratio >= 4.5, "{scheme:?}: hint text is too faint");
        assert!(
            underline > 20,
            "{scheme:?}: the error underline was not drawn in the error ink"
        );
        inks.push(error);
    }
    assert_ne!(inks[0], inks[1], "the error ink does not follow the scheme");
}

/// Snapshots that arrive after the text move no source pixel: every row above its baseline, left of its
/// line end, is identical before and after, and the caret stays where it was.
#[test]
fn late_snapshots_move_no_source_pixel() {
    let (_directory, reader) = fixture_reader(FIXTURE);
    let window = &reader.window;
    let caret = (window.get_caret_x(), window.get_caret_y());
    let before = window
        .get_source_image()
        .to_rgba8_premultiplied()
        .expect("source pixels");
    annotate(&reader);
    let after = window
        .get_source_image()
        .to_rgba8_premultiplied()
        .expect("source pixels");
    assert_eq!((window.get_caret_x(), window.get_caret_y()), caret);
    let source = reader.source.borrow();
    let view = source.shaped.as_ref().expect("shaped source");
    let width = before.width() as usize;
    let mut compared = 0;
    let mut changed_after_ends = 0;
    for row in &view.rows {
        let end = row.caret_x(row.source_start + row.source_len(), 1.0) as usize;
        let top = (row.row - view.viewport.first) * 24;
        for y in top..top + row.baseline as usize {
            for x in 0..width {
                let index = y * width + x;
                if x < end {
                    assert_eq!(
                        before.as_slice()[index],
                        after.as_slice()[index],
                        "a source pixel moved at {x},{y}"
                    );
                    compared += 1;
                } else if before.as_slice()[index] != after.as_slice()[index] {
                    changed_after_ends += 1;
                }
            }
        }
    }
    assert!(compared > 1000);
    assert!(
        changed_after_ends > 20,
        "the annotations were not painted (positive control)"
    );
}

/// A snapshot whose only change lies outside the materialized rows does not repaint; one inside does;
/// handing back the same snapshots does nothing.
#[test]
fn only_visible_annotation_changes_repaint() {
    let mut text = String::new();
    for index in 0..200 {
        text.push_str(&format!("line {index}: value\n"));
    }
    let (_directory, reader) = fixture_reader(&text);
    let window = &reader.window;
    let painted = || {
        return reader
            .source
            .borrow()
            .shaped
            .as_ref()
            .expect("shaped")
            .rows
            .as_ptr();
    };
    let original = painted();
    let stamp = displayed(&reader.source.borrow());
    // Character offset of line 150, far below the materialized rows.
    let far = text
        .lines()
        .take(150)
        .map(|line| return line.chars().count() + 1)
        .sum::<usize>();
    let outside = Some(Arc::new(DiagnosticsSnapshot {
        stamp,
        groups: vec![SourceGroup {
            source: "rustc".to_string(),
            items: vec![problem(far, far + 4, Severity::Error, "E1", "far below")],
        }],
    }));
    set_annotations(window, &reader.source, None, outside.clone());
    assert_eq!(
        painted(),
        original,
        "a change outside the materialized rows repainted the source"
    );
    assert_eq!(window.get_source_markers().row_count(), 0);
    let inside = Some(Arc::new(DiagnosticsSnapshot {
        stamp,
        groups: vec![SourceGroup {
            source: "rustc".to_string(),
            items: vec![
                problem(far, far + 4, Severity::Error, "E1", "far below"),
                problem(16, 20, Severity::Warning, "W1", "near"),
            ],
        }],
    }));
    set_annotations(window, &reader.source, None, inside.clone());
    let repainted = painted();
    assert_ne!(repainted, original, "a visible change did not repaint");
    assert_eq!(window.get_source_markers().row_count(), 1);
    set_annotations(window, &reader.source, None, inside);
    assert_eq!(painted(), repainted, "the same snapshots repainted");
}

/// Hint labels after the widest line widen the scroll range, so they can be scrolled into view.
#[test]
fn hint_labels_after_the_widest_line_extend_the_scroll_range() {
    let (_directory, reader) = fixture_reader("a much wider first line of source text\nshort\n");
    let window = &reader.window;
    let plain = window.get_document_width();
    let stamp = displayed(&reader.source.borrow());
    let hints = Some(Arc::new(HintsSnapshot {
        stamp,
        first_line: 0,
        last_line: 3,
        hints: vec![hint(5, ": a rather long inferred type label")],
    }));
    set_annotations(window, &reader.source, hints, None);
    let widened = window.get_document_width();
    let label = window.get_hint_boxes().row_data(0).expect("hint box");
    println!(
        "scroll width {plain} without the label, {widened} with it; label ends at {}",
        label.x + label.width
    );
    assert!(
        widened >= label.x + label.width,
        "the label is outside the scroll range"
    );
    assert!(widened > plain);
}
