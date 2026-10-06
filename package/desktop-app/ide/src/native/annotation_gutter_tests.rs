//! The gutter's severity letters: the worst severity of the diagnostics starting on a line, as `E`, `W`, `I`, or
//! `H` in that severity's ink, in front of the line number. The letter column exists on every line, so source
//! text and line numbers keep their x when diagnostics arrive.

/// The production setter and the stamp of the displayed text.
use super::annotate::{displayed, set_annotations};
/// Rendered frames, scheme switching, pixel reading, and contrast from the paint tests.
use super::annotation_paint_tests::{contrast, fixture_reader, frame, near, pixel, switch};
/// The shared fixture, its snapshots, the text origin, and the diagnostic builder.
use super::annotation_tests::{FIXTURE, TEXT_LEFT, TEXT_TOP, annotate, problem};
/// Width of the whole gutter, letter column and line numbers.
use super::sidebar_tests::GUTTER;
/// Snapshot records.
use ide_app::language::diagnostics::{DiagnosticsSnapshot, Severity, SourceGroup};
/// The toolkit's scheme values, reached through its unstable re-export module as the paint tests do.
use slint::private_unstable_api::re_exports::ColorScheme;
/// What: `Model` gives the window's list its `iter`; the rest reads frames and toolkit colors.
/// Why: The test checks both what native code hands over and what the window draws.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { type Model, type Color } from 'slint';
/// ```
use slint::{Color, Model, Rgba8Pixel, SharedPixelBuffer, platform::update_timers_and_animations};
/// Shared snapshot pointers.
use std::sync::Arc;

/// Width of the gutter's severity-letter column at its left edge.
const MARK_COLUMN: f32 = 16.0;

/// What: Pixels of the letter cell of `line` (the mark column beside its code row) that match `ink`, and the
///       strongest contrast any pixel of the cell reaches against `background`. `code_top` is the row's top.
/// Why: A letter is drawn when its ink appears in the cell; its legibility is measured on the same pixels.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function letterCell(shown: Frame, codeTop: number, ink: Color, background: Pixel): [number, number];
/// ```
fn letter_cell(
    shown: &SharedPixelBuffer<Rgba8Pixel>,
    code_top: f32,
    ink: Color,
    background: Rgba8Pixel,
) -> (usize, f32) {
    let mut matching = 0;
    let mut strongest: f32 = 1.0;
    for dy in 0..24 {
        for dx in 0..MARK_COLUMN as usize {
            let found = pixel(
                shown,
                TEXT_LEFT - GUTTER + dx as f32,
                TEXT_TOP + code_top + dy as f32,
            );
            if near(found, ink) {
                matching += 1;
            }
            strongest = strongest.max(contrast(found, background));
        }
    }
    return (matching, strongest);
}

/// What: The leftmost window column right of the letter column with ink different from `background` in the
///       code row starting at `code_top`, or nothing.
/// Why: The first ink of a row is its line number; comparing it and the text start before and after the letters
///      appear shows that nothing moved sideways.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function firstInk(shown: Frame, codeTop: number, from: number, background: Pixel): number | undefined;
/// ```
fn first_ink(
    shown: &SharedPixelBuffer<Rgba8Pixel>,
    code_top: f32,
    from: f32,
    background: Rgba8Pixel,
) -> Option<usize> {
    for x in from as usize..(TEXT_LEFT + 60.0) as usize {
        for dy in 4..20 {
            if contrast(
                pixel(shown, x as f32, TEXT_TOP + code_top + dy as f32),
                background,
            ) > 1.5
            {
                // `Some(x)` is the first column with ink.
                return Some(x);
            }
        }
    }
    return None;
}

/// In both schemes the gutter shows `E` beside a line with an error and a milder problem, `W` beside a line whose
/// worst problem is a warning (also when a warning range continues onto the next line, which shows nothing for
/// it), `I` beside a line with information, nothing beside a clean line, and `H` once a hint is the only
/// problem; each letter is in its severity's ink at least 4.5:1 against the background. Line numbers and text
/// keep their x.
#[test]
fn gutter_letters_show_the_worst_severity_in_front_of_the_line_number() {
    for scheme in [ColorScheme::Light, ColorScheme::Dark] {
        let (_directory, reader) = fixture_reader(FIXTURE);
        let window = &reader.window;
        switch(window, scheme);
        update_timers_and_animations();
        let plain = frame(window);
        // The clean last line's letter cell shows the background in both frames.
        let empty_top = reader.source.borrow().row_map.code_top(3);
        let background = pixel(
            &plain,
            TEXT_LEFT - GUTTER + 8.0,
            TEXT_TOP + empty_top + 12.0,
        );
        let number_before = first_ink(&plain, 0.0, TEXT_LEFT - GUTTER + MARK_COLUMN, background);
        let text_before = first_ink(&plain, 0.0, TEXT_LEFT - 4.0, background);
        annotate(&reader);
        update_timers_and_animations();
        let shown = frame(window);
        // `iter().collect()` copies the window's list into a plain list.
        let marks: Vec<i32> = window.get_line_marks().iter().collect();
        assert_eq!(
            &marks[..4],
            [1, 2, 3, 0],
            "{scheme:?}: marks handed to the window"
        );
        let tops: Vec<f32> = (0..4)
            .map(|line| return reader.source.borrow().row_map.code_top(line))
            .collect();
        let inks = [
            window.get_error_ink(),
            window.get_warning_ink(),
            window.get_information_ink(),
        ];
        for (line, ink) in inks.iter().enumerate() {
            let (matching, strongest) = letter_cell(&shown, tops[line], *ink, background);
            println!(
                "gutter {scheme:?}: line {line} letter pixels in its ink {matching}, contrast {strongest:.2}"
            );
            assert!(
                matching > 5,
                "{scheme:?}: line {line} shows no letter in its severity's ink"
            );
            assert!(
                strongest >= 4.5,
                "{scheme:?}: line {line}'s letter reaches only {strongest:.2}:1"
            );
        }
        let (_, clean) = letter_cell(&shown, tops[3], inks[0], background);
        assert!(clean < 1.05, "{scheme:?}: a clean line shows a letter");
        assert_eq!(
            first_ink(
                &shown,
                tops[0],
                TEXT_LEFT - GUTTER + MARK_COLUMN,
                background
            ),
            number_before,
            "{scheme:?}: the line number moved sideways when diagnostics arrived"
        );
        assert_eq!(
            first_ink(&shown, tops[0], TEXT_LEFT - 4.0, background),
            text_before,
            "{scheme:?}: text moved sideways when diagnostics arrived"
        );
        // A hint as the only problem, on the last line, shows `H` there and nothing elsewhere.
        let stamp = displayed(&reader.source.borrow());
        let only_hint = DiagnosticsSnapshot {
            stamp,
            groups: vec![SourceGroup {
                source: "rustc".to_string(),
                items: vec![problem(55, 55, Severity::Hint, "H2", "a note")],
            }],
        };
        // `None` installs no hints; `Arc::new` shares the snapshot.
        set_annotations(window, &reader.source, None, Some(Arc::new(only_hint)));
        update_timers_and_animations();
        let marks: Vec<i32> = window.get_line_marks().iter().collect();
        assert_eq!(&marks[..4], [0, 0, 0, 4], "{scheme:?}: a hint's mark");
        let hinted = frame(window);
        let last_top = reader.source.borrow().row_map.code_top(3);
        let (matching, _) = letter_cell(&hinted, last_top, window.get_suggestion_ink(), background);
        assert!(
            matching > 5,
            "{scheme:?}: the hint letter is not in the hint severity's ink"
        );
    }
}
