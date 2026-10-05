//! The frame stamp repaints for a different set of visible annotations or inks, and reuses the image for an
//! equal set, whatever happened to the snapshots outside the materialized rows.

/// The stamp, its inputs, and the visible annotation records.
use ide_app::{
    annotation::{Label, Mark, Visible},
    annotation_layout::AnnotationColors,
    document::Document,
    language::diagnostics::Severity,
    shaped_text::Viewport,
    source_frame::FrameStamp,
    source_style::SourceStyles,
    text_raster::CodeColors,
};
/// Visible annotations are shared with the layout.
use std::sync::Arc;

/// Dark annotation inks.
const INKS: AnnotationColors = AnnotationColors {
    hint: [150, 160, 170, 179],
    error: [255, 153, 164, 255],
    warning: [252, 225, 0, 255],
    information: [96, 205, 255, 255],
    suggestion: [180, 180, 180, 255],
};

/// The stamp of `document` with `visible` annotations painted in `inks`.
fn stamp(document: &Document, visible: Visible, inks: AnnotationColors) -> FrameStamp {
    let viewport = Viewport {
        first: 0,
        count: 27,
        width: 1044.0,
        scale: 1.0,
    };
    let colors = CodeColors {
        foreground: [240, 240, 240, 255],
        selected: [255, 255, 255, 255],
        dark: true,
    };
    // `Arc::new` shares the visible list, as the renderer shares it with the layout.
    return FrameStamp::new(document, viewport, 0.0, colors, SourceStyles::from([]))
        .with_annotations(Arc::new(visible), inks);
}

/// One label and one mark.
fn shown(label: &str, severity: Severity) -> Visible {
    return Visible {
        labels: vec![Label {
            position: 3,
            text: label.to_string(),
        }],
        marks: vec![Mark {
            start: 0,
            end: 3,
            severity,
        }],
    };
}

/// Equal visible annotations reuse the image; a different label, mark, or ink repaints.
#[test]
fn visible_annotations_and_inks_are_paint_inputs() {
    let document = Document::new("let x = 1;");
    let original = stamp(&document, shown(": i32", Severity::Error), INKS);
    assert!(original == stamp(&document, shown(": i32", Severity::Error), INKS));
    assert!(
        original != stamp(&document, shown(": u32", Severity::Error), INKS),
        "a different hint label must repaint"
    );
    assert!(
        original != stamp(&document, shown(": i32", Severity::Warning), INKS),
        "a different severity must repaint"
    );
    assert!(
        original != stamp(&document, Visible::default(), INKS),
        "removing annotations must repaint"
    );
    let mut light = INKS;
    light.error = [196, 43, 28, 255];
    assert!(
        original != stamp(&document, shown(": i32", Severity::Error), light),
        "a different annotation ink must repaint"
    );
}
