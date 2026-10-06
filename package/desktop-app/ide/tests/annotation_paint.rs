//! Annotation pixels in the source tile:
//!  one underline style per severity in its ink,
//!  hints and messages on
//! virtual rows above their line and never in a code row,
//!  and inks that follow the scheme.

/// The production layout and packing,
///  underline constants,
///  vertical mapping,
///  shaper,
///  and raster.
use ide_app::{
    annotation::{Label, Mark, Visible},
    annotation_layout::{AnnotationColors, lay_out, pack},
    annotation_paint::DROP,
    document::Document,
    language::diagnostics::Severity,
    row_map::{CODE_ROW, RowMap},
    shaped_text::{ShapedView, TextShaper, Viewport},
    text_raster::{CodeColors, SourcePixels, TextRaster},
    virtual_row::{BLOCK_GAP, Block, MessageRow, ROW_HEIGHT},
};
/// Blocks are shared between the window state and the frames that paint them.
use std::sync::Arc;

/// Dark-scheme annotation inks for the tests;
///  each differs from the source ink.
const DARK: AnnotationColors = AnnotationColors {
    hint: [150, 160, 170, 255],
    error: [255, 110, 120, 255],
    warning: [240, 200, 40, 255],
    information: [90, 200, 250, 255],
    suggestion: [170, 170, 170, 255],
};

/// Light-scheme annotation inks for the tests.
const LIGHT: AnnotationColors = AnnotationColors {
    hint: [90, 96, 104, 255],
    error: [190, 30, 30, 255],
    warning: [140, 90, 0, 255],
    information: [0, 90, 180, 255],
    suggestion: [100, 100, 100, 255],
};

/// What:
///  Shape `source`,
///  lay out `visible` with `inks`,
///  and paint the tile at scale one.
/// Why:
///  The pixels come from exactly the path the native renderer takes.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function painted(source: string, visible: Visible, inks: AnnotationColors): [ShapedView, SourcePixels];
/// ```
fn painted(source: &str, visible: &Visible, inks: AnnotationColors) -> (ShapedView, SourcePixels) {
    let document = Document::new(source);
    let mut shaper = TextShaper::new();
    let viewport = Viewport {
        first: 0,
        count: 2,
        width: 700.0,
        scale: 1.0,
    };
    // Rows are placed by the vertical mapping the visible blocks call for.
    let mut raised = Vec::new();
    for block in &visible.blocks {
        raised.push((block.line, block.height()));
    }
    let map = RowMap::new(document.text().len_lines(), &raised);
    let mut view = shaper.prepare_rows(&document, viewport, &[], &map);
    let frame = lay_out(&view, visible, &mut shaper, inks);
    // `Some(frame)` attaches the positioned annotations to the frame the raster paints.
    view.annotations = Some(frame);
    let colors = CodeColors {
        foreground: [230, 230, 230, 255],
        selected: [255, 255, 255, 255],
        dark: true,
    };
    let pixels = TextRaster::new()
        .paint(&view, colors, 0.0)
        .expect("source tile");
    return (view, pixels);
}

/// What:
///  The block above line `line` of `source` with one hint `hint` (position and text) and one message row
///       per entry of `messages` (start,
///  severity,
///  text),
///  packed by the production shaper.
/// Why:
///  The paint tests need real placements,
///  not invented ones.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function block(source: string, line: number, hint: [number, string], messages: [number, Severity, string][]): Block;
/// ```
fn block(
    source: &str,
    line: usize,
    hint: (usize, &str),
    messages: &[(usize, Severity, &str)],
) -> Arc<Block> {
    let document = Document::new(source);
    let mut shaper = TextShaper::new();
    let row = shaper.row(&document, line, 1.0);
    let labels = [Label {
        position: hint.0,
        text: hint.1.to_string(),
    }];
    let (hint_rows, hints) = pack(&row, &labels, &mut shaper, 1.0);
    let mut rows = Vec::new();
    for (start, severity, text) in messages {
        rows.push(MessageRow {
            start: *start,
            continued: false,
            severity: *severity,
            text: (*text).to_string(),
        });
    }
    return Arc::new(Block {
        line,
        hint_rows,
        hints,
        messages: rows,
        held: (0.0, 0.0),
    });
}

/// How many pixels of rows `rows.0..rows.1` of the tile carry `ink`.
fn count(pixels: &SourcePixels, rows: (usize, usize), ink: [u8; 4]) -> usize {
    let mut found = 0;
    for y in rows.0..rows.1 {
        for x in 0..pixels.width as usize {
            if inked(pixels, x, y, ink) {
                found += 1;
            }
        }
    }
    return found;
}

/// What:
///  Whether the premultiplied pixel at (`x`,
///  `y`) is mostly covered and has `ink` once unpremultiplied.
/// Why:
///  Partly covered edge pixels keep the ink's hue;
///  the source ink is never close to an annotation ink.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function inked(pixels: SourcePixels, x: number, y: number, ink: Rgba): boolean;
/// ```
fn inked(pixels: &SourcePixels, x: usize, y: usize, ink: [u8; 4]) -> bool {
    let offset = (y * pixels.width as usize + x) * 4;
    let alpha = u32::from(pixels.bytes[offset + 3]);
    if alpha < 96 {
        return false;
    }
    // What: `iter().take(3).enumerate()` walks red, green, and blue with their index; `*expected` reads the byte.
    // Why: Alpha is compared separately; only the color channels are unpremultiplied.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // ink.slice(0, 3).forEach((expected, channel) => { ... });
    // ```
    for (channel, expected) in ink.iter().take(3).enumerate() {
        let straight = u32::from(pixels.bytes[offset + channel]) * 255 / alpha;
        if straight.abs_diff(u32::from(*expected)) > 16 {
            return false;
        }
    }
    return true;
}

/// What:
///  For each pixel column of `left..right`,
///  the mean row of its `ink` pixels near the underline,
///       or nothing when the column has none;
///  `Vec<Option<f32>>` is a list of maybe-numbers.
/// Why:
///  Gaps show a broken line style;
///  varying rows show a wave.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function columns(view: ShapedView, pixels: SourcePixels, left: number, right: number, ink: Rgba): (number | undefined)[];
/// ```
fn columns(
    view: &ShapedView,
    pixels: &SourcePixels,
    span: (usize, usize),
    ink: [u8; 4],
) -> Vec<Option<f32>> {
    let center = view.rows[0].baseline + DROP;
    // Rows below the baseline only: capital letters end there, so selected glyph ink is never counted.
    let top = view.rows[0].baseline.ceil() as usize;
    let bottom = ((center + 5.0) as usize).min(23);
    let mut result = Vec::new();
    for x in span.0..span.1 {
        let mut sum = 0.0;
        let mut count = 0.0;
        for y in top..=bottom {
            if inked(pixels, x, y, ink) {
                sum += y as f32;
                count += 1.0;
            }
        }
        // `Some` holds the mean row of a column with underline pixels; `None` marks a gap.
        if count > 0.0 {
            result.push(Some(sum / count));
        } else {
            result.push(None);
        }
    }
    return result;
}

/// Errors are a continuous wave,
///  warnings flat dashes,
///  information flat dots,
///  and hint-severity sparse dots,
/// each in its own ink,
///  so severity is readable without color.
#[test]
fn each_severity_has_its_own_line_style_in_its_ink() {
    // Capital letters have no descenders, so only underline ink can appear below the baseline.
    let source = "ABCDEFHIKLMNOTUVWXZABCDEFHIKLMNOTUVWXZ";
    let length = source.chars().count();
    let mut found = Vec::new();
    for severity in [
        Severity::Error,
        Severity::Warning,
        Severity::Information,
        Severity::Hint,
    ] {
        let visible = Visible {
            blocks: Vec::new(),
            marks: vec![Mark {
                start: 0,
                end: length,
                severity,
            }],
        };
        let (view, pixels) = painted(source, &visible, DARK);
        let right = view.rows[0].caret_x(length, 1.0) as usize;
        // Columns two pixels inside each end avoid partial coverage at the run's edges.
        let measured = columns(&view, &pixels, (2, right - 2), DARK.severity(severity));
        let lit: Vec<f32> = measured.iter().flatten().copied().collect();
        let fraction = lit.len() as f32 / measured.len() as f32;
        let lowest = lit.iter().copied().fold(f32::MAX, f32::min);
        let highest = lit.iter().copied().fold(f32::MIN, f32::max);
        let mut longest = 0;
        let mut current = 0;
        for column in &measured {
            if column.is_some() {
                current += 1;
                longest = longest.max(current);
            } else {
                current = 0;
            }
        }
        println!(
            "underline {severity:?}: {:.2} of columns lit, rows {lowest:.2} to {highest:.2}, longest run {longest}",
            fraction
        );
        found.push((severity, fraction, highest - lowest, longest));
    }
    let (_, error_lit, error_spread, _) = found[0];
    let (_, warning_lit, warning_spread, warning_run) = found[1];
    let (_, information_lit, information_spread, information_run) = found[2];
    let (_, hint_lit, hint_spread, _) = found[3];
    assert!(
        error_lit > 0.95 && error_spread >= 2.0,
        "the error wave is missing"
    );
    assert!(
        warning_lit > 0.5 && warning_lit < 0.85 && warning_spread < 1.0,
        "warning dashes"
    );
    assert!(
        information_lit > 0.3 && information_lit < 0.7 && information_spread < 1.0,
        "information dots"
    );
    assert!(
        information_run < warning_run,
        "information dots are as long as warning dashes"
    );
    assert!(
        hint_lit > 0.1 && hint_lit < 0.4 && hint_spread < 1.0,
        "hint dots"
    );
    assert!(
        information_lit > hint_lit + 0.1,
        "hint dots are as dense as information dots"
    );
}

/// Hints and messages are painted on their own rows above the code row,
///  each in its ink;
///  the gap above the
/// block stays empty;
///  and the code rows carry exactly the pixels they carry without annotations,
///  so nothing
/// that annotates a line is drawn on the line itself or after its end.
#[test]
fn virtual_rows_paint_above_the_code_row_and_never_in_it() {
    let source = "let total = area(2, 3);\nnext";
    let shown = block(
        source,
        0,
        (9, ": u32"),
        &[
            (12, Severity::Error, "Error E0308 (rustc): mismatched types"),
            (4, Severity::Information, "Information: a remark"),
        ],
    );
    let height = shown.height() as usize;
    assert_eq!(shown.height(), BLOCK_GAP + 3.0 * ROW_HEIGHT);
    let annotated = Visible {
        blocks: vec![Arc::clone(&shown)],
        marks: Vec::new(),
    };
    let (view, pixels) = painted(source, &annotated, DARK);
    let (_, bare) = painted(source, &Visible::default(), DARK);
    assert_eq!(view.rows[0].top, shown.height());
    assert_eq!(pixels.height as usize, bare.height as usize + height);
    let gap = BLOCK_GAP as usize;
    let row = ROW_HEIGHT as usize;
    // The gap above the block is empty.
    for y in 0..gap {
        for x in 0..pixels.width as usize {
            let offset = (y * pixels.width as usize + x) * 4;
            assert_eq!(pixels.bytes[offset + 3], 0, "ink in the gap at {x},{y}");
        }
    }
    // One ink per row: the hint row, then the error row, then the information row.
    let bands = [
        (DARK.hint, gap, gap + row),
        (DARK.error, gap + row, gap + 2 * row),
        (DARK.information, gap + 2 * row, gap + 3 * row),
    ];
    for (ink, top, bottom) in bands {
        let own = count(&pixels, (top, bottom), ink);
        assert!(own > 20, "row {top}..{bottom} has {own} pixels of its ink");
        for (other, _, _) in bands {
            if other != ink {
                assert_eq!(
                    count(&pixels, (top, bottom), other),
                    0,
                    "row {top}..{bottom} carries another row's ink"
                );
            }
        }
    }
    // The code rows are pixel for pixel the rows of the text without annotations, moved down by the block.
    let width = pixels.width as usize;
    let rows = 2 * CODE_ROW as usize;
    for y in 0..rows {
        let with = (y + height) * width * 4;
        let without = y * width * 4;
        assert_eq!(
            pixels.bytes[with..with + width * 4],
            bare.bytes[without..without + width * 4],
            "code row pixels differ in tile row {y}"
        );
    }
    // The texts start where their positions are: the hint above character 9, the error above character 12.
    let frame = view.annotations.as_ref().expect("annotation frame");
    assert_eq!(frame.texts[0].x, view.rows[0].caret_x(9, 1.0));
    assert_eq!(frame.texts[1].x, view.rows[0].caret_x(12, 1.0));
    let hint_left = frame.texts[0].x as usize;
    for y in gap..gap + row {
        for x in 0..hint_left.saturating_sub(1) {
            assert!(
                !inked(&pixels, x, y, DARK.hint),
                "hint ink left of its position at {x},{y}"
            );
        }
    }
}

/// Inside a selection the underline keeps its line style but takes the selected-text ink,
///  as selected glyphs do;
/// outside the selection it keeps the severity ink.
#[test]
fn selected_underlines_take_the_selected_ink() {
    let source = "ABCDEFHIKLMNOTUVWXZ";
    let mut document = Document::new(source);
    // `ReadingPosition` selects the first nine characters, as a drag or Shift+Right would.
    document.select(ide_app::document::ReadingPosition {
        anchor: 0,
        head: 9,
        viewport: 0,
    });
    let mut shaper = TextShaper::new();
    let viewport = Viewport {
        first: 0,
        count: 2,
        width: 700.0,
        scale: 1.0,
    };
    let mut view = shaper.prepare(&document, viewport, &[]);
    let visible = Visible {
        blocks: Vec::new(),
        marks: vec![Mark {
            start: 0,
            end: 19,
            severity: Severity::Error,
        }],
    };
    let frame = lay_out(&view, &visible, &mut shaper, LIGHT);
    view.annotations = Some(frame);
    let selected = [255, 255, 255, 255];
    let colors = CodeColors {
        foreground: [30, 30, 30, 255],
        selected,
        dark: false,
    };
    let pixels = TextRaster::new()
        .paint(&view, colors, 0.0)
        .expect("source tile");
    let boundary = view.rows[0].caret_x(9, 1.0) as usize;
    let end = view.rows[0].caret_x(19, 1.0) as usize;
    let inside = columns(&view, &pixels, (2, boundary - 2), selected);
    let inside_severity = columns(&view, &pixels, (2, boundary - 2), LIGHT.error);
    let outside = columns(&view, &pixels, (boundary + 2, end - 2), LIGHT.error);
    let lit = |list: &Vec<Option<f32>>| return list.iter().flatten().count();
    println!(
        "selected underline: {} selected-ink columns and {} error-ink columns inside, {} error-ink columns outside",
        lit(&inside),
        lit(&inside_severity),
        lit(&outside)
    );
    assert!(
        lit(&inside) > 40,
        "the selected underline is not in the selected ink"
    );
    assert_eq!(
        lit(&inside_severity),
        0,
        "the severity ink shows on the selection fill"
    );
    assert!(
        lit(&outside) > 40,
        "the unselected underline lost its severity ink"
    );
}

/// The same annotations painted with the light inks contain the light inks and none of the dark ones,
///  and back.
#[test]
fn annotation_inks_follow_the_scheme() {
    let source = "ABCDEFHIK";
    let visible = Visible {
        blocks: vec![block(
            source,
            0,
            (3, "hint"),
            &[(0, Severity::Error, "Error: wrong")],
        )],
        marks: vec![Mark {
            start: 0,
            end: 9,
            severity: Severity::Error,
        }],
    };
    for (inks, other) in [(DARK, LIGHT), (LIGHT, DARK)] {
        let (_, pixels) = painted(source, &visible, inks);
        let all = (0, pixels.height as usize);
        let own_error = count(&pixels, all, inks.error);
        let own_hint = count(&pixels, all, inks.hint);
        let foreign = count(&pixels, all, other.error) + count(&pixels, all, other.hint);
        assert!(
            own_error > 40 && own_hint > 20 && foreign == 0,
            "own error {own_error}, own hint {own_hint}, foreign {foreign}"
        );
    }
}
