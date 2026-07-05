//! The preview decode/eviction cache. Each preview pane's identity is a colour
//! seed plus its small PNG-encoded bytes (kept resident, cheap). The heavy part
//! is the decoded RGBA bitmap: it is produced with the `image` crate only when a
//! preview pane is in-window, dropped when the pane leaves the window, and
//! re-decoded on scroll-back. The cache tracks resident decoded bytes so the
//! spike can show decoded memory stays viewport-bound, not strip-bound.

/// What:     `use std::collections::{HashMap, HashSet};` imports a key/value map
///           and a set (sibling for the map: `BTreeMap`, ordered).
/// Why:      Cache entries are keyed by pane id; the live set says which decoded
///           bitmaps to keep.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // new Map<number, ...>() and new Set<number>()
/// ```
use std::collections::{HashMap, HashSet};

/// What:     `use std::collections::hash_map::Entry;` imports the map's entry
///           enum, whose `Vacant`/`Occupied` variants let one lookup both test
///           for and fill a slot.
/// Why:      The one-hash-lookup way to insert only when a key is missing.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // no direct equivalent; TS uses map.has(k) then map.set(k, v)
/// ```
use std::collections::hash_map::Entry;

/// What:     `use std::io::Cursor;` wraps an in-memory buffer so it looks like a
///           seekable file to the PNG encoder (sibling: a real `File`).
/// Why:      `DynamicImage::write_to` needs a `Write + Seek` target; a `Cursor`
///           over a `Vec<u8>` gives that without touching disk.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // encode into an in-memory Buffer instead of a file
/// ```
use std::io::Cursor;

/// What:     `use std::rc::Rc;` imports single-thread reference counting (sibling
///           `Arc`).
/// Why:      The cache shares the one `Instrumentation` handle.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // shared reference
/// ```
use std::rc::Rc;

/// What:     `use std::time::Instant;` imports a monotonic clock reading (sibling
///           `SystemTime`, the wall clock).
/// Why:      Timing each decode to attribute its cost.
use std::time::Instant;

/// What:     `use anyhow::{Context, Result};` imports the one-parameter error
///           result alias and the `.context(...)` adaptor that attaches a message
///           to an error or a `None`.
/// Why:      Encode/decode can fail; the caller wants one readable error channel.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // try/catch with a rethrown Error carrying context
/// ```
use anyhow::{Context, Result};

/// What:     `use image::{DynamicImage, ImageFormat, RgbaImage};` imports the
///           image crate's owned image enum, its format tag, and the concrete
///           8-bit RGBA buffer type.
/// Why:      This is the memory-safe in-process decode path the plan requires.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { decode, encodePng } from "some-image-lib";
/// ```
use image::{DynamicImage, ImageFormat, RgbaImage};

/// What:     `use slint::{Image, Rgba8Pixel, SharedPixelBuffer};` imports Slint's
///           displayable image handle, its 4-byte pixel type, and the shared
///           pixel buffer that backs an image.
/// Why:      A preview pane's `image` property needs a `slint::Image`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Image } from "slint";
/// ```
use slint::{Image, Rgba8Pixel, SharedPixelBuffer};

/// What:     `use crate::instrument::Instrumentation;` imports the shared counters.
/// Why:      Decode count and resident bytes are recorded there.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Instrumentation } from "./instrument";
/// ```
use crate::instrument::Instrumentation;

/// What:     `pub const PREVIEW_W: u32 = 384;` is the synthetic image width in
///           pixels. `u32` matches the image crate's dimension type.
/// Why:      A fixed size makes the decoded byte cost predictable (w*h*4).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const PREVIEW_W = 384;
/// ```
pub const PREVIEW_W: u32 = 384;

/// What:     `pub const PREVIEW_H: u32 = 256;` is the synthetic image height.
/// Why:      With the width, fixes each decoded bitmap at 384*256*4 = 393216 B.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const PREVIEW_H = 256;
/// ```
pub const PREVIEW_H: u32 = 256;

/// What:     `pub fn synthetic_rgba(seed: u32) -> Vec<u8>` builds a raw RGBA byte
///           buffer (4 bytes per pixel) from a colour seed.
/// Why:      Gives each preview pane distinct pixels without any real file.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function syntheticRgba(seed: number): Uint8Array { ... }
/// ```
pub fn synthetic_rgba(seed: u32) -> Vec<u8> {
    // What:     `let mut raw: Vec<u8> = Vec::with_capacity((PREVIEW_W * PREVIEW_H
    //           * 4) as usize);` preallocates the exact byte count. `as usize`
    //           narrows the `u32` product to the vector's index type.
    // Why:      Avoid repeated reallocation while filling pixels.
    let mut raw: Vec<u8> = Vec::with_capacity((PREVIEW_W * PREVIEW_H * 4) as usize);
    // What:     `for y in 0..PREVIEW_H` iterates image rows.
    // Why:      Fill top to bottom.
    for y in 0..PREVIEW_H {
        // What:     `for x in 0..PREVIEW_W` iterates pixels in the row.
        // Why:      Fill left to right.
        for x in 0..PREVIEW_W {
            // What:     `let r = ((x * 255) / PREVIEW_W) as u8;` is a horizontal
            //           gradient; `as u8` narrows the `u32` to a byte channel.
            // Why:      Red rises left to right.
            let r = ((x * 255) / PREVIEW_W) as u8;
            // What:     `let g = ((y * 255) / PREVIEW_H) as u8;` is a vertical
            //           gradient.
            // Why:      Green rises top to bottom.
            let g = ((y * 255) / PREVIEW_H) as u8;
            // What:     `let b = (seed.wrapping_add(x).wrapping_add(y) & 0xff) as
            //           u8;` mixes the seed with position. `wrapping_add` avoids
            //           overflow panics; `& 0xff` keeps the low byte.
            // Why:      Blue varies per pane (via seed) and per pixel.
            let b = (seed.wrapping_add(x).wrapping_add(y) & 0xff) as u8;
            // What:     `raw.push(r);` etc. append the four channel bytes; the
            //           last is a fully-opaque alpha of 255.
            // Why:      RGBA layout expected by the encoder and Slint.
            raw.push(r);
            raw.push(g);
            raw.push(b);
            raw.push(255);
        }
    }
    // What:     `raw` is the tail expression (no `;`), returning the owned buffer.
    // Why:      Hand the pixels to the caller.
    raw
}

/// What:     `pub fn encode_png(raw: &[u8]) -> Result<Vec<u8>>` compresses a raw
///           RGBA buffer into PNG bytes. `&[u8]` borrows the pixels read-only.
/// Why:      The PNG bytes are the pane's cheap, always-resident identity.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function encodePng(raw: Uint8Array): Uint8Array { ... }
/// ```
pub fn encode_png(raw: &[u8]) -> Result<Vec<u8>> {
    // What:     `RgbaImage::from_raw(PREVIEW_W, PREVIEW_H, raw.to_vec())` builds
    //           an owned image buffer; `.to_vec()` copies the borrowed slice into
    //           an owned `Vec<u8>`; the call returns `Option`, and
    //           `.context(...)?` turns a `None` into an error and unwraps `Some`.
    // Why:      The encoder needs an owned image buffer.
    let image = RgbaImage::from_raw(PREVIEW_W, PREVIEW_H, raw.to_vec())
        .context("raw buffer did not match preview dimensions")?;
    // What:     `let dynamic = DynamicImage::ImageRgba8(image);` wraps the concrete
    //           buffer in the image crate's format-agnostic enum variant.
    // Why:      `write_to` is defined on `DynamicImage`.
    let dynamic = DynamicImage::ImageRgba8(image);
    // What:     `let mut out: Vec<u8> = Vec::new();` is the destination buffer.
    // Why:      The PNG bytes are written here.
    let mut out: Vec<u8> = Vec::new();
    // What:     `dynamic.write_to(&mut Cursor::new(&mut out), ImageFormat::Png)`
    //           encodes into the cursor-wrapped buffer; `&mut` lends both
    //           mutably; `?` propagates any encode error.
    // Why:      Produce the compressed identity bytes.
    dynamic
        .write_to(&mut Cursor::new(&mut out), ImageFormat::Png)
        .context("encode preview png")?;
    // What:     `Ok(out)` wraps the bytes in the success variant; tail expression.
    // Why:      Return the encoded PNG.
    Ok(out)
}

/// What:     `pub fn decode_to_image(png_bytes: &[u8]) -> Result<(Image, usize)>`
///           decodes PNG bytes to a Slint image and reports its decoded byte
///           size. The tuple `(Image, usize)` returns both.
/// Why:      Decoding is the heavy, evictable work; the byte size feeds the
///           resident-memory accounting.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function decodeToImage(pngBytes: Uint8Array): [Image, number] { ... }
/// ```
pub fn decode_to_image(png_bytes: &[u8]) -> Result<(Image, usize)> {
    // What:     `image::load_from_memory(png_bytes)` decodes the PNG into a
    //           `DynamicImage`; `?` propagates a decode error.
    // Why:      Turn identity bytes back into pixels.
    let dynamic = image::load_from_memory(png_bytes).context("decode preview png")?;
    // What:     `let rgba = dynamic.to_rgba8();` converts to a concrete 8-bit RGBA
    //           buffer regardless of the source format.
    // Why:      Slint wants RGBA pixels.
    let rgba = dynamic.to_rgba8();
    // What:     `let (width, height) = rgba.dimensions();` destructures the
    //           returned `(u32, u32)` pair.
    // Why:      The Slint buffer needs the dimensions.
    let (width, height) = rgba.dimensions();
    // What:     `let raw: Vec<u8> = rgba.into_raw();` consumes the image buffer,
    //           yielding its owned byte vector.
    // Why:      We copy these bytes into the Slint pixel buffer.
    let raw: Vec<u8> = rgba.into_raw();
    // What:     `let byte_len = raw.len();` records the decoded byte size.
    // Why:      This is the exact resident cost of this bitmap.
    let byte_len = raw.len();
    // What:     `let mut buffer = SharedPixelBuffer::<Rgba8Pixel>::new(width,
    //           height);` allocates a Slint pixel buffer of RGBA pixels.
    // Why:      Slint images are backed by this buffer type.
    let mut buffer = SharedPixelBuffer::<Rgba8Pixel>::new(width, height);
    // What:     `buffer.make_mut_bytes().copy_from_slice(&raw);` exposes the
    //           buffer as a `&mut [u8]` and copies the decoded bytes in.
    // Why:      Fill the Slint buffer with the decoded pixels.
    buffer.make_mut_bytes().copy_from_slice(&raw);
    // What:     `let image = Image::from_rgba8(buffer);` wraps the pixel buffer in
    //           a displayable Slint image (no GPU upload happens here).
    // Why:      This is what the pane's `image` property shows.
    let image = Image::from_rgba8(buffer);
    // What:     `Ok((image, byte_len))` returns the image and its size; tail.
    // Why:      Caller stores both.
    Ok((image, byte_len))
}

/// What:     `pub struct DecodedPreview` pairs a resident decoded image with its
///           byte size.
/// Why:      Eviction needs to subtract the exact bytes it drops.
pub struct DecodedPreview {
    /// What:     `pub image: Image` is the displayable Slint image.
    /// Why:      Handed to the pane view while resident.
    pub image: Image,
    /// What:     `pub bytes: usize` is this bitmap's decoded byte size.
    /// Why:      Subtracted from the resident total on eviction.
    pub bytes: usize,
}

/// What:     `pub struct PreviewCache` holds the encoded (identity) bytes, the
///           decoded (resident) bitmaps, a running resident-byte total, and the
///           shared instrumentation.
/// Why:      One object owns the whole decode/evict lifecycle.
pub struct PreviewCache {
    /// What:     `encoded: HashMap<u64, Vec<u8>>` maps pane id to its PNG bytes.
    /// Why:      Cheap identity kept resident so a scroll-back re-decode is local.
    encoded: HashMap<u64, Vec<u8>>,
    /// What:     `decoded: HashMap<u64, DecodedPreview>` maps pane id to its
    ///           resident bitmap.
    /// Why:      Only in-window previews live here.
    decoded: HashMap<u64, DecodedPreview>,
    /// What:     `resident_bytes: usize` is the sum of decoded byte sizes.
    /// Why:      The number the HUD reports and the spike bounds.
    resident_bytes: usize,
    /// What:     `instrumentation: Rc<Instrumentation>` is the shared counters.
    /// Why:      Mirror resident bytes and decode count for the HUD.
    instrumentation: Rc<Instrumentation>,
}

/// What:     `impl PreviewCache` attaches the cache's methods.
/// Why:      The controller drives decode-on-entry and evict-on-exit through them.
impl PreviewCache {
    /// What:     `pub fn new(instrumentation: Rc<Instrumentation>) -> Self` builds
    ///           an empty cache sharing the given counters.
    /// Why:      One cache per app instance.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// constructor(instrumentation) { ... }
    /// ```
    pub fn new(instrumentation: Rc<Instrumentation>) -> Self {
        // What:     `Self { ... }` builds the cache with empty maps and zero
        //           resident bytes; tail expression.
        // Why:      Nothing is decoded before the first republish.
        Self {
            encoded: HashMap::new(),
            decoded: HashMap::new(),
            resident_bytes: 0,
            instrumentation,
        }
    }

    /// What:     `pub fn image_for(&mut self, pane_id: u64, seed: u32) ->
    ///           Result<Image>` returns the resident decoded image for a preview
    ///           pane, decoding (and recording the decode) if needed. `&mut self`
    ///           because it may insert into the cache.
    /// Why:      Called for each in-window preview pane during a republish.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// imageFor(paneId, seed): Image { ... }
    /// ```
    pub fn image_for(&mut self, pane_id: u64, seed: u32) -> Result<Image> {
        // What:     `if let Entry::Vacant(slot) = self.encoded.entry(pane_id) { ... }`
        //           lazily builds and stores the identity PNG on first sight.
        //           `.entry(pane_id)` returns an `Entry` enum; the `Vacant`
        //           variant means no value is stored yet, and `slot` is a handle
        //           that can fill it. Using the entry API (instead of a
        //           `contains_key` + `insert` pair) does one hash lookup.
        // Why:      Encode once per pane, then reuse.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (!this.encoded.has(paneId)) this.encoded.set(paneId, encodePng(syntheticRgba(seed)));
        // ```
        if let Entry::Vacant(slot) = self.encoded.entry(pane_id) {
            // What:     `let raw = synthetic_rgba(seed);` makes the pixels.
            // Why:      Source data for the one-time encode.
            let raw = synthetic_rgba(seed);
            // What:     `let png = encode_png(&raw)?;` compresses them; `?`
            //           propagates any error.
            // Why:      Store the compact identity bytes.
            let png = encode_png(&raw)?;
            // What:     `slot.insert(png);` fills the vacant entry with the bytes.
            // Why:      Identity now resident and cheap.
            slot.insert(png);
        }
        // What:     `if let Some(decoded) = self.decoded.get(&pane_id) { return
        //           Ok(decoded.image.clone()); }`. `if let Some(...)` matches the
        //           present case; `.clone()` on a Slint image is a cheap
        //           reference-count bump, not a pixel copy.
        // Why:      Already-decoded previews are returned without re-decoding.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const decoded = this.decoded.get(paneId);
        // if (decoded) return decoded.image;
        // ```
        if let Some(decoded) = self.decoded.get(&pane_id) {
            return Ok(decoded.image.clone());
        }
        // What:     `let png_bytes = self.encoded.get(&pane_id).context(...)?;`
        //           fetches the identity bytes just ensured; `.context(...)?`
        //           turns an unexpected `None` into an error.
        // Why:      Decode source.
        let png_bytes = self
            .encoded
            .get(&pane_id)
            .context("encoded preview missing after ensure")?;
        // What:     `let decode_start = Instant::now();` reads a monotonic clock
        //           before the decode.
        // Why:      Attribute the decode cost separately from the windowing cost.
        let decode_start = Instant::now();
        // What:     `let (image, byte_len) = decode_to_image(png_bytes)?;` decodes
        //           and destructures the returned tuple.
        // Why:      Produce the resident bitmap and learn its size.
        let (image, byte_len) = decode_to_image(png_bytes)?;
        // What:     `self.instrumentation.last_decode_us.set(self.instrumentation
        //           .last_decode_us.get() + decode_start.elapsed().as_micros() as
        //           u64);` adds this decode's microseconds to the per-publish
        //           accumulator (the controller zeroes it before each publish).
        // Why:      Track how much of a publish was synchronous decode.
        self.instrumentation.last_decode_us.set(
            self.instrumentation.last_decode_us.get() + decode_start.elapsed().as_micros() as u64,
        );
        // What:     `self.resident_bytes += byte_len;` grows the resident total.
        // Why:      Account for the new bitmap.
        self.resident_bytes += byte_len;
        // What:     `self.instrumentation.decoded_image_bytes.set(self.resident_bytes);`
        //           mirrors the total into the shared counter.
        // Why:      The HUD reads it.
        self.instrumentation.decoded_image_bytes.set(self.resident_bytes);
        // What:     `self.instrumentation.decode_count.set(self.instrumentation
        //           .decode_count.get() + 1);` increments the decode tally.
        // Why:      A rising count after scroll-back proves re-decoding.
        self.instrumentation
            .decode_count
            .set(self.instrumentation.decode_count.get() + 1);
        // What:     `self.decoded.insert(pane_id, DecodedPreview { image:
        //           image.clone(), bytes: byte_len });` stores the resident entry;
        //           `image.clone()` bumps the refcount so both cache and caller
        //           hold it.
        // Why:      Keep it resident until eviction.
        self.decoded.insert(
            pane_id,
            DecodedPreview {
                image: image.clone(),
                bytes: byte_len,
            },
        );
        // What:     `Ok(image)` returns the image to the caller; tail expression.
        // Why:      The pane view displays it.
        Ok(image)
    }

    /// What:     `pub fn retain_only(&mut self, live: &HashSet<u64>)` drops every
    ///           decoded bitmap whose pane is not in the live (in-window) set.
    /// Why:      Off-window previews must free their decoded memory.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// retainOnly(live: Set<number>) { /* delete decoded not in live */ }
    /// ```
    pub fn retain_only(&mut self, live: &HashSet<u64>) {
        // What:     `let mut removed_bytes: usize = 0;` accumulates freed bytes.
        // Why:      Subtract them from the resident total after pruning.
        let mut removed_bytes: usize = 0;
        // What:     `self.decoded.retain(|pane_id, decoded| { ... })` keeps only
        //           entries whose closure returns `true`. `|pane_id, decoded|` is
        //           the closure receiving each key and `&mut` value.
        // Why:      Evict in one pass while tallying freed bytes.
        // Gotcha:   The closure captures `removed_bytes` and `live` by reference;
        //           this is the Rust equivalent of a filter with a side effect.
        self.decoded.retain(|pane_id, decoded| {
            // What:     `let keep = live.contains(pane_id);` tests membership.
            // Why:      In-window previews stay resident.
            let keep = live.contains(pane_id);
            // What:     `if !keep { removed_bytes += decoded.bytes; }` tallies the
            //           bytes about to be dropped.
            // Why:      Keep the resident total exact.
            if !keep {
                removed_bytes += decoded.bytes;
            }
            // What:     `keep` is the closure's tail expression: keep or drop.
            // Why:      `retain` removes entries where this is `false`.
            keep
        });
        // What:     `self.resident_bytes -= removed_bytes;` shrinks the total.
        // Why:      Reflect the freed memory.
        self.resident_bytes -= removed_bytes;
        // What:     `self.instrumentation.decoded_image_bytes.set(self.resident_bytes);`
        //           mirrors the new total.
        // Why:      The HUD reads the reduced number.
        self.instrumentation.decoded_image_bytes.set(self.resident_bytes);
    }

    /// What:     `pub fn resident_bytes(&self) -> usize` reports current resident
    ///           decoded memory.
    /// Why:      Tests assert against it.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// residentBytes(): number { return this.resident_bytes; }
    /// ```
    pub fn resident_bytes(&self) -> usize {
        // What:     `self.resident_bytes` tail expression returns the total.
        // Why:      Expose the running sum.
        self.resident_bytes
    }
}

/// What:     `#[cfg(test)] #[path = "preview_tests.rs"] mod tests;` declares the
///           test-only submodule in the flat sibling file `preview_tests.rs`.
/// Why:      Keep byte-accounting and re-decode coverage beside the code without
///           inflating this file (sibling `*_tests.rs` are linter-exempt).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // preview.unit.test.ts, run only by the test runner
/// ```
#[cfg(test)]
#[path = "preview_tests.rs"]
mod tests;
