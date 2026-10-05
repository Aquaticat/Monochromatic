//! Annotation geometry from the production shaped rows: underline runs over tabs, CJK, combining marks,
//! and ligatures, multi-line and point ranges, overlap order, and markers and labels after the line's text
//! that never change source geometry.

/// The production layout, its spacing constants, and the selection records it consumes.
use ide_app::{
    annotation::{Label, Mark, Visible},
    annotation_layout::{
        AnnotationColors, AnnotationFrame, ITEM_GAP, LABEL_GAP, MARKER_SIZE, lay_out,
    },
    document::Document,
    language::diagnostics::Severity,
    shaped_text::{ShapedView, TERMINATOR_MARK, TextShaper, Viewport},
};

/// Inks are irrelevant to geometry; any fixed set will do.
const COLORS: AnnotationColors = AnnotationColors {
    hint: [1, 2, 3, 255],
    error: [200, 0, 0, 255],
    warning: [200, 100, 0, 255],
    information: [0, 0, 200, 255],
    suggestion: [90, 90, 90, 255],
};

/// What: Shape `source` and lay out `visible` against it; the tuple returns the document, the view, and the frame.
/// Why: Every assertion compares annotation positions with the geometry the window paints and hit-tests.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function laidOut(source: string, visible: Visible): [Document, ShapedView, AnnotationFrame];
/// ```
fn laid_out(source: &str, visible: &Visible) -> (Document, ShapedView, AnnotationFrame) {
    let document = Document::new(source);
    let mut shaper = TextShaper::new();
    let viewport = Viewport {
        first: 0,
        count: 8,
        width: 900.0,
        scale: 1.0,
    };
    let view = shaper.prepare(&document, viewport, &[]);
    let frame = lay_out(&document, &view, visible, &mut shaper, COLORS);
    return (document, view, frame);
}

/// Compare two pixel positions within a thousandth of a pixel; sums of floats may round differently.
fn close(actual: f32, expected: f32) -> bool {
    return (actual - expected).abs() < 0.001;
}

/// A mark of `severity` over `start..end`.
fn mark(start: usize, end: usize, severity: Severity) -> Mark {
    return Mark {
        start,
        end,
        severity,
    };
}

/// Underline runs equal the selection geometry of their range: a widened tab, a CJK glyph, a letter with a
/// combining mark, and half of a ligature.
#[test]
fn underline_runs_follow_range_geometry_through_tabs_cjk_combining_marks_and_ligatures() {
    // Characters: tab(0) b(1) space(2) 猫(3) 猫(4) space(5) e(6) U+0301(7) x(8) space(9) !(10) =(11).
    // A leading tab is two space advances wide.
    let source = "\tb 猫猫 e\u{301}x !=";
    let cases = [(0, 1), (3, 4), (6, 8), (10, 11), (0, 12)];
    for (start, end) in cases {
        let visible = Visible {
            labels: Vec::new(),
            marks: vec![mark(start, end, Severity::Error)],
        };
        let (_, view, frame) = laid_out(source, &visible);
        let expected = view.range(start, end);
        assert_eq!(frame.underlines.len(), expected.len(), "{start}..{end}");
        for (run, rect) in frame.underlines.iter().zip(expected.iter()) {
            assert_eq!(run.x, rect.x, "{start}..{end}");
            assert_eq!(run.width, rect.width, "{start}..{end}");
            assert!(run.width > 0.0, "{start}..{end} has no width");
        }
    }
    // Half of the `!=` ligature is narrower than the whole ligature, and both have width.
    let (_, view, _) = laid_out(source, &Visible::default());
    let half = view.range(10, 11)[0].width;
    let whole = view.range(10, 12)[0].width;
    assert!(half > 0.0 && half < whole, "half {half}, whole {whole}");
    // The tab is wider than one space advance, because it reaches its stop.
    let tab = view.range(0, 1)[0].width;
    let space = view.range(2, 3)[0].width;
    assert!(tab > space, "tab {tab}, space {space}");
}

/// A range over several lines marks every row, and an empty line inside it gets a terminator-wide run.
#[test]
fn multi_line_range_marks_every_row_including_an_empty_line() {
    // Line starts: 0, 4, 5; the mark runs from `b` on the first line to `e` on the third.
    let source = "abc\n\ndef";
    let visible = Visible {
        labels: Vec::new(),
        marks: vec![mark(1, 7, Severity::Warning)],
    };
    let (_, view, frame) = laid_out(source, &visible);
    let rows: Vec<usize> = frame.underlines.iter().map(|run| return run.row).collect();
    assert_eq!(rows, [0, 0, 1, 2]);
    let first_end = view.rows[0].caret_x(3, 1.0);
    assert_eq!(frame.underlines[1].x, first_end);
    assert_eq!(frame.underlines[1].width, TERMINATOR_MARK);
    assert_eq!(frame.underlines[2].x, 0.0);
    assert_eq!(frame.underlines[2].width, TERMINATOR_MARK);
    let last = view.range(5, 7);
    assert_eq!(frame.underlines[3].x, last[0].x);
    assert_eq!(frame.underlines[3].width, last[0].width);
}

/// A point at a line end is marked after the text; a point inside a line is centered on its boundary;
/// a point at the start of a line does not reach left of the text.
#[test]
fn point_ranges_get_a_terminator_wide_run() {
    let source = "let x = 1\nnext";
    let visible = Visible {
        labels: Vec::new(),
        marks: vec![
            mark(9, 9, Severity::Error),
            mark(4, 4, Severity::Error),
            mark(10, 10, Severity::Error),
        ],
    };
    let (_, view, frame) = laid_out(source, &visible);
    let at_end = view.rows[0].caret_x(9, 1.0);
    let inside = view.rows[0].caret_x(4, 1.0);
    assert_eq!(frame.underlines.len(), 3);
    assert_eq!(frame.underlines[0].x, at_end);
    assert!(close(frame.underlines[1].x, inside - TERMINATOR_MARK / 2.0));
    assert_eq!(frame.underlines[2].row, 1);
    assert_eq!(frame.underlines[2].x, 0.0);
    for run in &frame.underlines {
        assert_eq!(run.width, TERMINATOR_MARK);
    }
}

/// Where ranges overlap, the mildest severity is drawn first, so the worst ends on top.
#[test]
fn overlapping_ranges_draw_the_worst_severity_last() {
    let visible = Visible {
        labels: Vec::new(),
        marks: vec![
            mark(0, 6, Severity::Error),
            mark(2, 8, Severity::Hint),
            mark(1, 3, Severity::Warning),
            mark(4, 5, Severity::Information),
        ],
    };
    let (_, _, frame) = laid_out("abcdefghij", &visible);
    let order: Vec<Severity> = frame
        .underlines
        .iter()
        .map(|run| return run.severity)
        .collect();
    assert_eq!(
        order,
        [
            Severity::Hint,
            Severity::Information,
            Severity::Warning,
            Severity::Error,
        ]
    );
}

/// The marker shows the worst severity starting on its line, after the text; labels follow in source order;
/// a range continuing onto the next line puts no marker there.
#[test]
fn marker_and_labels_follow_the_end_of_the_line() {
    let source = "let total = area(2, 3);\nlet other = 4;";
    let visible = Visible {
        labels: vec![
            Label {
                position: 9,
                text: ": u32".to_string(),
            },
            Label {
                position: 17,
                text: "width:".to_string(),
            },
        ],
        marks: vec![mark(4, 9, Severity::Hint), mark(12, 30, Severity::Error)],
    };
    let (_, view, frame) = laid_out(source, &visible);
    let end_x = view.rows[0].caret_x(23, 1.0);
    assert_eq!(frame.markers.len(), 1);
    assert_eq!(frame.markers[0].row, 0);
    assert_eq!(frame.markers[0].severity, Severity::Error);
    assert!(close(frame.markers[0].x, end_x + ITEM_GAP));
    assert_eq!(frame.hints.len(), 2);
    assert!(close(
        frame.hints[0].x,
        end_x + ITEM_GAP + MARKER_SIZE + LABEL_GAP
    ));
    assert!(close(
        frame.hints[1].x,
        frame.hints[0].x + frame.hints[0].width + LABEL_GAP
    ));
    assert!(frame.hints[1].width > frame.hints[0].width);
    assert!(close(frame.extent, frame.hints[1].x + frame.hints[1].width));
    // Labels sit on the common source baseline.
    for label in &frame.hints {
        let natural = label
            .layout
            .lines()
            .next()
            .expect("label line")
            .metrics()
            .baseline;
        assert!(close(natural + label.baseline_shift, view.rows[0].baseline));
    }
}

/// Annotations never change source geometry: every caret x and range is the same with and without them,
/// and a click on a label lands on the end of its line, as any click past the text does.
#[test]
fn source_geometry_is_unchanged_and_label_clicks_land_on_the_line_end() {
    let source = "\tlet 猫 = e\u{301} != x;\nnext";
    let visible = Visible {
        labels: vec![
            Label {
                position: 2,
                text: ": i32".to_string(),
            },
            Label {
                position: 8,
                text: "value:".to_string(),
            },
        ],
        marks: vec![mark(5, 6, Severity::Error)],
    };
    let (document, plain, _) = laid_out(source, &Visible::default());
    let (_, annotated, frame) = laid_out(source, &visible);
    let length = document.text().line(0).len_chars() - 1;
    for position in 0..=length {
        assert_eq!(
            plain.rows[0].caret_x(position, 1.0),
            annotated.rows[0].caret_x(position, 1.0)
        );
        for end in position..=length {
            let before = plain.range(position, end);
            let after = annotated.range(position, end);
            assert_eq!(before.len(), after.len());
        }
    }
    for label in &frame.hints {
        let middle = label.x + label.width / 2.0;
        assert_eq!(annotated.rows[0].hit(middle, 1.0), length);
    }
}
