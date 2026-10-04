//! Source-image invalidation must preserve caret geometry without needless painting.

/// Consumer APIs use the same stamp as the native rendering boundary.
use ide_app::{
    document::{Document, ReadingPosition},
    shaped_text::Viewport,
    source_frame::FrameStamp,
    source_style::{SourceStyles, StyleSpan},
    text_raster::CodeColors,
};

/// Source-image fixture with explicit physical geometry and system colors.
fn stamp(document: &Document) -> FrameStamp {
    // Borrow source and empty syntax without transferring their ownership.
    return FrameStamp::new(document, viewport(), 0.0, colors(), SourceStyles::from([]));
}

/// Standard logical viewport, with a nonintegral scale to exercise physical identity.
fn viewport() -> Viewport {
    return Viewport {
        first: 0,
        count: 27,
        width: 1044.0,
        scale: 1.25,
    };
}

/// Native dark foreground and selection ink.
fn colors() -> CodeColors {
    return CodeColors {
        foreground: [240, 240, 240, 255],
        selected: [255, 255, 255, 255],
        dark: true,
    };
}

/// Moving an empty selection changes caret position, not source-image pixels.
#[test]
fn caret_only_movement_reuses_image() {
    // What: mut permits selection updates; Document still exposes no file-writing operation.
    // Why: Exercise actual reading-state changes rather than two fabricated cache keys.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const document = new Document('猫 and Latin');
    // const before = stamp(document); document.select({anchor: 5, head: 5, viewport: 0});
    // ```
    let mut document = Document::new("猫 and Latin");
    let before = stamp(&document);
    document.select(ReadingPosition {
        anchor: 5,
        head: 5,
        viewport: 0,
    });
    // Assert the exact rendering gate remains closed for caret-only movement.
    assert!(before == stamp(&document));
}

/// Both adding and removing selection need new foreground pixels.
#[test]
fn selection_invalidates_but_direction_does_not() {
    let mut document = Document::new("猫 and Latin");
    let empty = stamp(&document);
    document.select(ReadingPosition {
        anchor: 1,
        head: 5,
        viewport: 0,
    });
    let selected = stamp(&document);
    assert!(empty != selected);
    document.select(ReadingPosition {
        anchor: 5,
        head: 1,
        viewport: 0,
    });
    assert!(selected == stamp(&document));
    document.select(ReadingPosition {
        anchor: 5,
        head: 5,
        viewport: 0,
    });
    assert!(selected != stamp(&document));
}

/// Every tile, palette, and syntax input affects paint identity.
#[test]
fn materialization_scale_theme_and_syntax_invalidate() {
    let document = Document::new("猫 and Latin");
    let original = stamp(&document);
    let mut area = viewport();
    area.first = 1;
    assert!(original != FrameStamp::new(&document, area, 0.0, colors(), SourceStyles::from([])));
    area = viewport();
    area.count += 1;
    assert!(original != FrameStamp::new(&document, area, 0.0, colors(), SourceStyles::from([])));
    area = viewport();
    area.width += 1.0;
    assert!(original != FrameStamp::new(&document, area, 0.0, colors(), SourceStyles::from([])));
    area = viewport();
    area.scale = 1.5;
    assert!(original != FrameStamp::new(&document, area, 0.0, colors(), SourceStyles::from([])));
    assert!(
        original
            != FrameStamp::new(
                &document,
                viewport(),
                0.25,
                colors(),
                SourceStyles::from([])
            )
    );
    let mut palette = colors();
    palette.dark = false;
    assert!(
        original != FrameStamp::new(&document, viewport(), 0.0, palette, SourceStyles::from([]))
    );
    palette = colors();
    palette.foreground = [0, 0, 0, 255];
    assert!(
        original != FrameStamp::new(&document, viewport(), 0.0, palette, SourceStyles::from([]))
    );
    palette = colors();
    palette.selected = [0, 0, 0, 255];
    assert!(
        original != FrameStamp::new(&document, viewport(), 0.0, palette, SourceStyles::from([]))
    );
    let styles = [StyleSpan {
        start: 0,
        end: 1,
        style: 1,
    }];
    assert!(
        original
            != FrameStamp::new(
                &document,
                viewport(),
                0.0,
                colors(),
                SourceStyles::from(styles)
            )
    );
}

/// Reloads must invalidate even when reading position and geometry do not change.
#[test]
fn source_revision_invalidates() {
    let mut document = Document::new("old source");
    let original = stamp(&document);
    let reload = document.prepare_reload("new source");
    document.apply_reload(reload);
    assert!(original != stamp(&document));
}
