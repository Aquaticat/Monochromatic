//! Repeatable raster comparison and stage timings for a viewport-sized source fixture.

/// What:
///  Imports the same document,
///  shaping,
///  and raster APIs used by the native window.
/// Why:
///  A toolkit-only timing would miss application work before each image update.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Document, TextShaper, TextRaster } from './ide';
/// ```
use ide_app::{
    document::Document,
    shaped_text::{TextShaper, Viewport},
    text_raster::{CodeColors, TextRaster},
};
/// What:
///  Instant measures monotonic elapsed time,
///  unlike wall-clock SystemTime.
/// Why:
///  Clock corrections must not change the reported stage durations.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const start = performance.now();
/// ```
use std::time::Instant;

/// Compare repeated renders byte-for-byte while reporting shape and raster costs.
/// Timings are evidence,
///  not a machine-dependent pass/fail threshold.
#[test]
fn repeated_viewport_renders_preserve_pixels() {
    // What: repeat allocates an owned String; &str would only borrow literal bytes.
    // Why: A viewport-sized input must exercise repeated Latin and fallback glyphs.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const source = 'Line: smooth pixel scrolling, 猫 and Latin.\n'.repeat(32);
    // ```
    let source = "Line: smooth pixel scrolling, 猫 and Latin.\n".repeat(32);
    // What: & lends source immutably; Document builds its own canonical rope.
    // Why: The fixture remains available without transferring its string ownership.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const document = new Document(source);
    // ```
    let document = Document::new(&source);
    // What: mut permits cache updates through each owned engine.
    // Why: Repeated frames must reuse the same contexts as the native window.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const shaper = new TextShaper(); const raster = new TextRaster();
    // ```
    let mut shaper = TextShaper::new();
    // Initialize raster resources once, not once per frame.
    let mut raster = TextRaster::new();
    let viewport = Viewport {
        first: 0,
        count: 27,
        width: 1300.0,
        scale: 1.0,
    };
    let colors = CodeColors {
        foreground: [240, 240, 240, 255],
        selected: [255, 255, 255, 255],
        dark: true,
    };
    // What: Vec<u8> owns variable-length bytes, unlike borrowed &[u8] or fixed [u8; N].
    // Why: Retain the first output independently of subsequent frames.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let previous = new Uint8Array();
    // ```
    let mut previous = Vec::new();
    // What: 0..4 iterates a bounded half-open range, not a materialized array.
    // Why: Include a cold render and unchanged-input samples without a stress loop.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (let sample = 0; sample < 4; sample++) { /* render */ }
    // ```
    for sample in 0..4 {
        // Capture the start of source shaping.
        let start = Instant::now();
        // Lend the document and empty classification slice for this frame.
        let view = shaper.prepare(&document, viewport, &[]);
        let shaped = start.elapsed();
        // What: expect extracts success or fails this test with contextual output.
        // Why: Raster errors must not be mistaken for faster successful frames.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const pixels = raster.paint(view, colors, 0);
        // ```
        let pixels = raster
            .paint(&view, colors, 0.0)
            .expect("render viewport fixture");
        let painted = start.elapsed() - shaped;
        // Test diagnostics deliberately report measured stage durations.
        eprintln!("viewport sample {sample}: shape={shaped:?} raster={painted:?}");
        if sample > 0 {
            // What: assert_eq! fails the test if outputs differ.
            // Why: Cache reuse must not alter antialiasing or fallback glyph pixels.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // assert.deepEqual(pixels.bytes, previous);
            // ```
            assert_eq!(pixels.bytes, previous);
        }
        // Move the owned byte vector instead of cloning its allocation.
        previous = pixels.bytes;
    }
}
