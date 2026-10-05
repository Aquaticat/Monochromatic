//! Annotation pixels in the source tile: one underline style per severity in its ink, hint labels only after
//! the line's text, and inks that follow the scheme.

/// The production layout, underline constants, shaper, and raster.
use ide_app::{
    annotation::{Label, Mark, Visible},
    annotation_layout::{AnnotationColors, lay_out},
    annotation_paint::DROP,
    document::Document,
    language::diagnostics::Severity,
    shaped_text::{ShapedView, TextShaper, Viewport},
    text_raster::{CodeColors, SourcePixels, TextRaster},
};

/// Dark-scheme annotation inks for the tests; each differs from the source ink.
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

/// What: Shape `source`, lay out `visible` with `inks`, and paint the tile at scale one.
/// Why: The pixels come from exactly the path the native renderer takes.
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
    let mut view = shaper.prepare(&document, viewport, &[]);
    let frame = lay_out(&document, &view, visible, &mut shaper, inks);
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

/// What: Whether the premultiplied pixel at (`x`, `y`) is mostly covered and has `ink` once unpremultiplied.
/// Why: Partly covered edge pixels keep the ink's hue; the source ink is never close to an annotation ink.
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
    for channel in 0..3 {
        let straight = u32::from(pixels.bytes[offset + channel]) * 255 / alpha;
        if straight.abs_diff(u32::from(ink[channel])) > 16 {
            return false;
        }
    }
    return true;
}

/// What: For each pixel column of `left..right`, the mean row of its `ink` pixels near the underline,
///       or nothing when the column has none; `Vec<Option<f32>>` is a list of maybe-numbers.
/// Why: Gaps show a broken line style; varying rows show a wave.
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
    let top = (center - 5.0).max(0.0) as usize;
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

/// Errors are a continuous wave, warnings flat dashes, information flat dots, and hint-severity sparse dots,
/// each in its own ink, so severity is readable without color.
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
            labels: Vec::new(),
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
    assert!(error_lit > 0.95 && error_spread >= 2.0, "the error wave is missing");
    assert!(warning_lit > 0.5 && warning_lit < 0.85 && warning_spread < 1.0, "warning dashes");
    assert!(information_lit > 0.3 && information_lit < 0.7 && information_spread < 1.0, "information dots");
    assert!(information_run < warning_run, "information dots are as long as warning dashes");
    assert!(hint_lit > 0.1 && hint_lit < 0.4 && hint_spread < 1.0, "hint dots");
    assert!(information_lit > hint_lit + 0.1, "hint dots are as dense as information dots");
}

/// Hint labels are painted in the hint ink after the line's text only; without labels nothing is painted there.
#[test]
fn hint_labels_paint_after_the_line_end_in_the_hint_ink() {
    let source = "let total = area(2, 3);";
    let labelled = Visible {
        labels: vec![Label {
            position: 9,
            text: ": u32".to_string(),
        }],
        marks: Vec::new(),
    };
    let (view, pixels) = painted(source, &labelled, DARK);
    let end = view.rows[0].caret_x(23, 1.0) as usize;
    let mut before = 0;
    let mut after = 0;
    for y in 0..24 {
        for x in 0..pixels.width as usize {
            if inked(&pixels, x, y, DARK.hint) {
                if x <= end {
                    before += 1;
                } else {
                    after += 1;
                }
            }
        }
    }
    println!("hint ink pixels: {before} inside the text, {after} after it");
    assert_eq!(before, 0);
    assert!(after > 20);
    let (_, bare) = painted(source, &Visible::default(), DARK);
    for y in 0..24 {
        for x in end + 2..bare.width as usize {
            let offset = (y * bare.width as usize + x) * 4;
            assert_eq!(bare.bytes[offset + 3], 0, "ink after the text at {x},{y} without annotations");
        }
    }
}

/// The same marks painted with the light inks contain the light error ink and not the dark one, and back.
#[test]
fn annotation_inks_follow_the_scheme() {
    let source = "ABCDEFHIK";
    let visible = Visible {
        labels: vec![Label {
            position: 3,
            text: "hint".to_string(),
        }],
        marks: vec![Mark {
            start: 0,
            end: 9,
            severity: Severity::Error,
        }],
    };
    for (inks, other) in [(DARK, LIGHT), (LIGHT, DARK)] {
        let (_, pixels) = painted(source, &visible, inks);
        let mut own = 0;
        let mut foreign = 0;
        for y in 0..24 {
            for x in 0..pixels.width as usize {
                if inked(&pixels, x, y, inks.error) || inked(&pixels, x, y, inks.hint) {
                    own += 1;
                }
                if inked(&pixels, x, y, other.error) || inked(&pixels, x, y, other.hint) {
                    foreign += 1;
                }
            }
        }
        assert!(own > 20 && foreign == 0, "own {own}, foreign {foreign}");
    }
}
