//! Bounded glyph images retain exact subpixel placement across source frames.

/// Propagate an oversized glyph instead of retaining unbounded image memory.
use anyhow::{Result, bail};
/// What: HashMap owns key/value entries, like Map in TypeScript.
/// Why: Glyph identities need lookup rather than a scan of previously rendered images.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const images = new Map<GlyphKey, Image | undefined>();
/// ```
use std::collections::HashMap;
/// Swash provides both cached images and the scaler used on cache misses.
use swash::scale::{Render, Scaler, Source, StrikeWith, image::Image};

/// Every outline-affecting input; theme colors are applied during compositing.
#[derive(Hash, PartialEq, Eq)]
pub(crate) struct GlyphKey {
    /// Font blob identity, not just the selected primary font family.
    pub font: u64,
    /// Collection face index distinguishes faces within one font blob.
    pub face: u32,
    /// Physical font-size bits include the display scale without float rounding.
    pub size: u32,
    /// Variable-font coordinates alter glyph outlines.
    pub variations: Vec<i16>,
    /// Font-local glyph ID, not a Unicode character.
    pub glyph: u16,
    /// Exact fractional x bits retain existing antialiasing.
    pub x: u32,
    /// Exact fractional baseline bits retain fallback-font placement.
    pub y: u32,
}

/// Store empty glyph results too, avoiding repeated work for spaces.
#[derive(Default)]
pub(crate) struct GlyphCache {
    /// What: Option<Image> distinguishes ink from a successfully empty glyph.
    /// Why: None is a cached result, not a missing map entry.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// private images = new Map<GlyphKey, Image | undefined>();
    /// ```
    images: HashMap<GlyphKey, Option<Image>>,
    /// What: usize indexes memory, unlike fixed-width u32/u64 or signed i32/i64.
    /// Why: Byte counts use the same address-sized integer as Vec::len().
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// private bytes = 0;
    /// ```
    bytes: usize,
}

/// Reuse exact glyph images while enforcing the entry and byte budgets.
impl GlyphCache {
    /// Borrow an image until the next cache operation, rendering only on a miss.
    /// The anonymous Scaler lifetime means its borrowed font cannot outlive its owner.
    pub(crate) fn image(
        &mut self,
        key: GlyphKey,
        scaler: &mut Scaler<'_>,
    ) -> Result<&Option<Image>> {
        // What: &key lends the key for lookup; inserting later transfers ownership.
        // Why: A cache hit must not allocate or reconstruct a glyph image.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (!images.has(key)) { /* render and insert */ }
        // ```
        if !self.images.contains_key(&key) {
            // What: &[] lends a fixed source-preference array to the renderer.
            // Why: Preserve color glyph support before falling back to monochrome outlines.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const renderer = new Render([colorOutline, colorBitmap, outline]);
            // ```
            let mut renderer = Render::new(&[
                Source::ColorOutline(0),
                Source::ColorBitmap(StrikeWith::BestFit),
                Source::Outline,
            ]);
            renderer.format(swash::zeno::Format::Alpha);
            // Recover the exact fractional coordinates rather than quantizing positions.
            let x = f32::from_bits(key.x);
            let y = f32::from_bits(key.y);
            renderer.offset(swash::zeno::Vector::new(x, y));
            let image = renderer.render(scaler, key.glyph);
            // What: if let extracts a present image while & preserves its ownership.
            // Why: Empty glyphs have zero image bytes but still consume an entry.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // let bytes = 0; if (image !== undefined) bytes = image.data.length;
            // ```
            let mut bytes = 0;
            if let Some(rendered) = &image {
                bytes = rendered.data.len();
            }
            if bytes > 16 * 1024 * 1024 {
                bail!(
                    "Source glyph image exceeds the 16 MiB glyph limit; reduce the display scale"
                );
            }
            if self.bytes + bytes > 16 * 1024 * 1024 || self.images.len() >= 4096 {
                self.images.clear();
                self.bytes = 0;
            }
            self.bytes += bytes;
            // What: entry transfers the key; or_insert stores the image and lends its value.
            // Why: Return the inserted image without copying either the pixels or the key.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // images.set(key, image); return image;
            // ```
            return Ok(self.images.entry(key).or_insert(image));
        }
        // What: Ok wraps success; expect asserts the map lookup already checked as present.
        // Why: Cached empty glyphs remain distinguishable from absent entries.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return images.get(key);
        // ```
        return Ok(self.images.get(&key).expect("checked glyph cache entry"));
    }
}
