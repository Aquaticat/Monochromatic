//! Shared-layout tests prevent painting and pointer interpretation from diverging.

/// Import the native view's exact document and layout interfaces.
use ide_app::document::{Document, ReadingPosition};
/// Geometry tests use parser-shaped ranges without requiring a grammar installation.
use ide_app::view_model::{build_view, hit_test, StyleSpan};

/// Verify tabs, wide text, and combining sequences share source-aware hit geometry.
#[test]
fn grapheme_geometry_and_pointer_targets_agree() {
    let document = Document::new("a\t猫e\u{301}\n");
    // What: & borrows the document and an empty style slice for this call.
    // Why: Building a view must not consume or mutate the source snapshot.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const view = buildView(document, 0, 3, []);
    // ```
    let view = build_view(&document, 0, 3, &[]);
    assert_eq!(view.glyphs.len(), 4);
    assert_eq!(view.glyphs[1].column, 1);
    assert_eq!(view.glyphs[1].width, 3);
    assert_eq!(view.glyphs[2].column, 4);
    assert_eq!(view.glyphs[2].width, 2);
    assert_eq!(view.glyphs[3].text, "e\u{301}");
    assert_eq!(view.glyphs[3].start, 3);
    assert_eq!(view.glyphs[3].end, 5);
    assert_eq!(hit_test(&document, &view, 0, 4.1), 2);
    assert_eq!(hit_test(&document, &view, 0, 5.8), 3);
    assert_eq!(hit_test(&document, &view, 0, 6.8), 5);
}

/// Verify virtual styling does not alter copied text or source positions.
#[test]
fn styling_and_selection_are_separate_from_source() {
    let mut document = Document::new("const cat = '猫';");
    document.select(ReadingPosition { anchor: 6, head: 9, viewport: 0 });
    let spans = [StyleSpan { start: 0, end: 5, style: 1 }];
    let view = build_view(&document, 0, 2, &spans);
    assert_eq!(view.glyphs[0].style, 1);
    assert_eq!(view.glyphs[5].style, 0);
    assert!(view.glyphs[6].selected);
    assert!(!view.glyphs[9].selected);
    assert_eq!(document.selected_text(), "cat");
}

/// Verify the model materializes only the requested source rows.
#[test]
fn viewport_has_no_hidden_whole_document_glyphs() {
    let document = Document::new("first\nsecond\nthird\nfourth");
    let view = build_view(&document, 1, 1, &[]);
    assert_eq!(view.glyphs.len(), 6);
    for glyph in &view.glyphs {
        assert_eq!(glyph.row, 1);
    }
    assert_eq!(view.glyphs[0].start, 6);
}

/// Verify blank lines and CRLF endings do not produce stray visible glyphs.
#[test]
fn line_endings_and_empty_rows_have_valid_hits() {
    let document = Document::new("a\r\n\r\nb");
    let view = build_view(&document, 0, 4, &[]);
    assert_eq!(view.glyphs.len(), 2);
    assert_eq!(hit_test(&document, &view, 1, 20.0), 3);
    assert_eq!(hit_test(&document, &view, 2, 20.0), 6);
}

/// Verify an empty document has a usable beginning without indexing panics.
#[test]
fn empty_document_has_a_valid_caret() {
    let document = Document::new("");
    let view = build_view(&document, 0, 10, &[]);
    assert!(view.glyphs.is_empty());
    assert_eq!(hit_test(&document, &view, 0, 0.0), 0);
    assert_eq!(view.caret_row, 0);
    assert_eq!(view.caret_column, 0);
}
