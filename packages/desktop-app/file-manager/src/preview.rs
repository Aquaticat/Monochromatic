//! The preview decode/eviction cache, now asynchronous. A preview pane's identity
//! is a colour seed (held in the strip). When a preview enters the window the
//! cache asks the background worker to decode it and shows a placeholder;
//! `drain_results` later collects the finished RGBA bytes and wraps them into a
//! Slint image on the UI thread (a cheap copy). Decoded bitmaps drop on window
//! exit and re-decode on scroll-back. The heavy decode never runs on the UI
//! thread, so a burst of newly-visible previews cannot drop a frame; only the
//! resident decoded bytes are bounded by the viewport.

/// What:     `use std::collections::{HashMap, HashSet};` imports a key/value map
///           and a set.
/// Why:      Decoded bitmaps are keyed by pane id; the pending set tracks in-flight
///           decodes and the live set says which bitmaps to keep.
use std::collections::{HashMap, HashSet};

/// What:     `use std::io::Cursor;` wraps an in-memory buffer so it looks like a
///           seekable file to the PNG encoder.
/// Why:      `DynamicImage::write_to` needs a `Write + Seek` target.
use std::io::Cursor;

/// What:     `use std::rc::Rc;` imports single-thread reference counting.
/// Why:      The cache shares the one `Instrumentation` handle.
use std::rc::Rc;

/// What:     `use std::sync::mpsc::{channel, Receiver, Sender};` imports a
///           multi-producer single-consumer channel constructor and its two ends
///           (sibling: `sync_channel` for bounded backpressure).
/// Why:      The cache sends decode requests to the worker and receives results.
use std::sync::mpsc::{channel, Receiver, Sender};

/// What:     `use anyhow::{Context, Result};` imports the one-parameter error
///           result alias and the `.context(...)` adaptor.
/// Why:      Encode/decode report one readable error channel.
use anyhow::{Context, Result};

/// What:     `use image::{DynamicImage, ImageFormat, RgbaImage};` imports the image
///           crate's owned image enum, its format tag, and the 8-bit RGBA buffer.
/// Why:      The memory-safe in-process encode/decode path.
use image::{DynamicImage, ImageFormat, RgbaImage};

/// What:     `use slint::{Image, Rgba8Pixel, SharedPixelBuffer};` imports Slint's
///           displayable image handle, its 4-byte pixel type, and the pixel buffer.
/// Why:      A preview pane's `image` property needs a `slint::Image`.
use slint::{Image, Rgba8Pixel, SharedPixelBuffer};

/// What:     `use crate::decode_worker::{spawn_decode_worker, DecodeRequest,
///           DecodeResult};` imports the worker starter and its message types.
/// Why:      The cache offloads decoding to that worker.
use crate::decode_worker::{spawn_decode_worker, DecodeRequest, DecodeResult};

/// What:     `use crate::instrument::Instrumentation;` imports the shared counters.
/// Why:      Decode count, resident bytes, and pending count are recorded there.
use crate::instrument::Instrumentation;

/// What:     `pub const PREVIEW_W: u32 = 384;` is the synthetic image width.
/// Why:      Fixes each decoded bitmap at a predictable byte size.
pub const PREVIEW_W: u32 = 384;

/// What:     `pub const PREVIEW_H: u32 = 256;` is the synthetic image height.
/// Why:      With the width, fixes each decoded bitmap at 384*256*4 = 393216 B.
pub const PREVIEW_H: u32 = 256;

/// What:     `pub fn synthetic_rgba(seed: u32) -> Vec<u8>` builds a raw RGBA byte
///           buffer (4 bytes per pixel) from a colour seed.
/// Why:      Gives each preview pane distinct pixels without any real file; the
///           background worker calls it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function syntheticRgba(seed: number): Uint8Array { ... }
/// ```
pub fn synthetic_rgba(seed: u32) -> Vec<u8> {
    // What:     `let mut raw: Vec<u8> = Vec::with_capacity((PREVIEW_W * PREVIEW_H *
    //           4) as usize);` preallocates the exact byte count.
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
            //           u8;` mixes the seed with position; `wrapping_add` avoids
            //           overflow panics.
            // Why:      Blue varies per pane (via seed) and per pixel.
            let b = (seed.wrapping_add(x).wrapping_add(y) & 0xff) as u8;
            // What:     `raw.push(r);` etc. append the four channel bytes, alpha 255.
            // Why:      RGBA layout expected by the encoder and Slint.
            raw.push(r);
            raw.push(g);
            raw.push(b);
            raw.push(255);
        }
    }
    // What:     `raw` is the tail expression, returning the owned buffer.
    // Why:      Hand the pixels to the caller.
    raw
}

/// What:     `pub fn encode_png(raw: &[u8]) -> Result<Vec<u8>>` compresses a raw
///           RGBA buffer into PNG bytes. `&[u8]` borrows the pixels read-only.
/// Why:      Stands in for the on-disk compressed bytes the worker then decodes.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function encodePng(raw: Uint8Array): Uint8Array { ... }
/// ```
pub fn encode_png(raw: &[u8]) -> Result<Vec<u8>> {
    // What:     `RgbaImage::from_raw(PREVIEW_W, PREVIEW_H, raw.to_vec())` builds an
    //           owned image buffer; `.to_vec()` copies the borrowed slice; the call
    //           returns `Option`, and `.context(...)?` turns `None` into an error.
    // Why:      The encoder needs an owned image buffer.
    let image = RgbaImage::from_raw(PREVIEW_W, PREVIEW_H, raw.to_vec())
        .context("raw buffer did not match preview dimensions")?;
    // What:     `let dynamic = DynamicImage::ImageRgba8(image);` wraps the concrete
    //           buffer in the format-agnostic enum variant.
    // Why:      `write_to` is defined on `DynamicImage`.
    let dynamic = DynamicImage::ImageRgba8(image);
    // What:     `let mut out: Vec<u8> = Vec::new();` is the destination buffer.
    // Why:      The PNG bytes are written here.
    let mut out: Vec<u8> = Vec::new();
    // What:     `dynamic.write_to(&mut Cursor::new(&mut out), ImageFormat::Png)`
    //           encodes into the cursor-wrapped buffer; `?` propagates errors.
    // Why:      Produce the compressed bytes.
    dynamic
        .write_to(&mut Cursor::new(&mut out), ImageFormat::Png)
        .context("encode preview png")?;
    // What:     `Ok(out)` wraps the bytes in the success variant; tail expression.
    // Why:      Return the encoded PNG.
    Ok(out)
}

/// What:     `pub fn decode_to_raw(png_bytes: &[u8]) -> Result<(Vec<u8>, u32, u32)>`
///           decodes PNG bytes to raw RGBA plus its dimensions. The tuple returns
///           all three.
/// Why:      This is the expensive step; the worker runs it off the UI thread, so
///           it returns plain bytes (a `slint::Image` is built later on the UI
///           thread).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function decodeToRaw(pngBytes: Uint8Array): [Uint8Array, number, number] { ... }
/// ```
pub fn decode_to_raw(png_bytes: &[u8]) -> Result<(Vec<u8>, u32, u32)> {
    // What:     `image::load_from_memory(png_bytes)?` decodes the PNG; `?`
    //           propagates a decode error.
    // Why:      Turn compressed bytes into pixels.
    let dynamic = image::load_from_memory(png_bytes).context("decode preview png")?;
    // What:     `let rgba = dynamic.to_rgba8();` converts to a concrete RGBA buffer.
    // Why:      Slint wants RGBA pixels.
    let rgba = dynamic.to_rgba8();
    // What:     `let (width, height) = rgba.dimensions();` destructures the `(u32,
    //           u32)` pair.
    // Why:      The Slint buffer will need the dimensions.
    let (width, height) = rgba.dimensions();
    // What:     `Ok((rgba.into_raw(), width, height))`. `into_raw` consumes the
    //           buffer, yielding its owned byte vector; wrapped in `Ok`; tail.
    // Why:      Hand raw bytes plus dimensions back.
    Ok((rgba.into_raw(), width, height))
}

/// What:     `fn raw_to_image(raw: &[u8], width: u32, height: u32) -> Image` copies
///           decoded RGBA bytes into a Slint image. Runs on the UI thread.
/// Why:      A cheap memory copy, the only preview work left on the UI thread.
fn raw_to_image(raw: &[u8], width: u32, height: u32) -> Image {
    // What:     `let mut buffer = SharedPixelBuffer::<Rgba8Pixel>::new(width,
    //           height);` allocates a Slint pixel buffer.
    // Why:      Slint images are backed by this buffer type.
    let mut buffer = SharedPixelBuffer::<Rgba8Pixel>::new(width, height);
    // What:     `buffer.make_mut_bytes().copy_from_slice(raw);` exposes the buffer as
    //           `&mut [u8]` and copies the decoded bytes in.
    // Why:      Fill the Slint buffer with the decoded pixels.
    buffer.make_mut_bytes().copy_from_slice(raw);
    // What:     `Image::from_rgba8(buffer)` wraps the buffer in a Slint image; tail.
    // Why:      This is what the pane's `image` property shows.
    Image::from_rgba8(buffer)
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

/// What:     `pub struct PreviewCache` holds resident decoded bitmaps, the set of
///           in-flight decode requests, a resident-byte total, the shared
///           counters, and both ends the cache owns of the worker channels.
/// Why:      One object owns the async decode/evict lifecycle.
pub struct PreviewCache {
    /// What:     `decoded: HashMap<u64, DecodedPreview>` maps pane id to its
    ///           resident bitmap.
    /// Why:      Only in-window, already-decoded previews live here.
    decoded: HashMap<u64, DecodedPreview>,
    /// What:     `pending: HashSet<u64>` holds pane ids with a decode in flight.
    /// Why:      Avoid requesting the same preview twice while it decodes.
    pending: HashSet<u64>,
    /// What:     `resident_bytes: usize` is the sum of decoded byte sizes.
    /// Why:      The number the HUD reports and the spike bounds.
    resident_bytes: usize,
    /// What:     `instrumentation: Rc<Instrumentation>` is the shared counters.
    /// Why:      Mirror resident bytes, decode count, and pending count.
    instrumentation: Rc<Instrumentation>,
    /// What:     `request_tx: Sender<DecodeRequest>` sends work to the worker.
    /// Why:      Requesting a decode is a channel send, not a blocking call.
    request_tx: Sender<DecodeRequest>,
    /// What:     `result_rx: Receiver<DecodeResult>` receives finished decodes.
    /// Why:      The UI drains it each frame to collect ready bitmaps.
    result_rx: Receiver<DecodeResult>,
}

/// What:     `impl PreviewCache` attaches the cache's methods.
/// Why:      The controller drives request-on-entry, drain-per-frame, and
///           evict-on-exit through them.
impl PreviewCache {
    /// What:     `pub fn new(instrumentation: Rc<Instrumentation>) -> Self` builds an
    ///           empty cache and starts the background worker.
    /// Why:      One cache and one worker per app instance.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// constructor(instrumentation) { this.worker = spawnDecodeWorker(...); }
    /// ```
    pub fn new(instrumentation: Rc<Instrumentation>) -> Self {
        // What:     `let (request_tx, request_rx) = channel();` makes the
        //           request channel; the pair is (sender, receiver).
        // Why:      The cache keeps the sender; the worker takes the receiver.
        let (request_tx, request_rx) = channel();
        // What:     `let (result_tx, result_rx) = channel();` makes the result
        //           channel the other direction.
        // Why:      The worker keeps the sender; the cache keeps the receiver.
        let (result_tx, result_rx) = channel();
        // What:     `spawn_decode_worker(request_rx, result_tx);` starts the worker
        //           thread, moving both channel ends it owns into it.
        // Why:      Decoding runs off the UI thread from now on.
        spawn_decode_worker(request_rx, result_tx);
        // What:     `Self { ... }` builds the cache; tail expression.
        // Why:      Nothing is decoded or pending before the first publish.
        Self {
            decoded: HashMap::new(),
            pending: HashSet::new(),
            resident_bytes: 0,
            instrumentation,
            request_tx,
            result_rx,
        }
    }

    /// What:     `pub fn request_preview(&mut self, pane_id: u64, seed: u32) ->
    ///           Option<Image>` returns the resident image if decoded, otherwise
    ///           requests a background decode and returns `None` (a placeholder).
    /// Why:      Called for each in-window preview pane during a publish; it never
    ///           blocks on decoding.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// requestPreview(paneId, seed): Image | undefined { ... }
    /// ```
    pub fn request_preview(&mut self, pane_id: u64, seed: u32) -> Option<Image> {
        // What:     `if let Some(decoded) = self.decoded.get(&pane_id) { return
        //           Some(decoded.image.clone()); }`. `.clone()` on a Slint image is
        //           a cheap refcount bump.
        // Why:      Already-decoded previews are returned immediately.
        if let Some(decoded) = self.decoded.get(&pane_id) {
            return Some(decoded.image.clone());
        }
        // What:     `if !self.pending.contains(&pane_id) { ... }` requests a decode
        //           only if one is not already in flight.
        // Why:      Do not queue duplicate work for the same pane.
        if !self.pending.contains(&pane_id) {
            // What:     `let _ = self.request_tx.send(DecodeRequest { pane_id, seed
            //           });`. `send` returns `Err` only if the worker is gone;
            //           `let _ =` ignores that.
            // Why:      Hand the work to the background worker.
            let _ = self.request_tx.send(DecodeRequest { pane_id, seed });
            // What:     `self.pending.insert(pane_id);` records the in-flight decode.
            // Why:      Track it so the HUD shows queue depth and we do not re-queue.
            self.pending.insert(pane_id);
            // What:     `self.instrumentation.pending_decodes.set(self.pending.len());`
            //           mirrors the pending count.
            // Why:      HUD gauge of background work.
            self.instrumentation.pending_decodes.set(self.pending.len());
        }
        // What:     `None` is the returned tail: no image yet, show a placeholder.
        // Why:      The pane renders a placeholder until the decode lands.
        None
    }

    /// What:     `pub fn drain_results(&mut self) -> Vec<u64>` collects every
    ///           finished decode waiting in the channel, makes each resident, and
    ///           returns the pane ids that landed.
    /// Why:      The controller refreshes exactly the columns owning those panes,
    ///           so a decode updates one column, not the whole model.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// drainResults(): number[] { /* while (msg = tryRecv()) { ... } */ }
    /// ```
    pub fn drain_results(&mut self) -> Vec<u64> {
        // What:     `let mut landed: Vec<u64> = Vec::new();` collects landed ids.
        // Why:      The caller refreshes the owning columns.
        let mut landed: Vec<u64> = Vec::new();
        // What:     `while let Ok(result) = self.result_rx.try_recv() { ... }` pulls
        //           results without blocking; `try_recv` returns `Err` when empty.
        // Why:      Drain everything ready, but never wait.
        while let Ok(result) = self.result_rx.try_recv() {
            // What:     `self.pending.remove(&result.pane_id);` clears the in-flight
            //           mark for this pane.
            // Why:      Its decode finished.
            self.pending.remove(&result.pane_id);
            // What:     `let bytes = result.raw.len();` is this bitmap's byte size.
            // Why:      Resident-byte accounting.
            let bytes = result.raw.len();
            // What:     `let image = raw_to_image(&result.raw, result.width,
            //           result.height);` wraps the bytes into a Slint image (cheap).
            // Why:      Make it displayable.
            let image = raw_to_image(&result.raw, result.width, result.height);
            // What:     `if let Some(old) = self.decoded.insert(...) { ... }` stores
            //           the bitmap and reclaims bytes if one already existed.
            // Why:      Keep the resident total exact.
            if let Some(old) = self
                .decoded
                .insert(result.pane_id, DecodedPreview { image, bytes })
            {
                self.resident_bytes -= old.bytes;
            }
            // What:     `self.resident_bytes += bytes;` adds the new bitmap.
            // Why:      Account for it.
            self.resident_bytes += bytes;
            // What:     `self.instrumentation.decode_count.set(... + 1);` tallies one
            //           decode.
            // Why:      Rising after scroll-back proves re-decoding.
            self.instrumentation
                .decode_count
                .set(self.instrumentation.decode_count.get() + 1);
            // What:     `landed.push(result.pane_id);` records the landed pane.
            // Why:      Return it to the caller.
            landed.push(result.pane_id);
        }
        // What:     `if !landed.is_empty() { ... }` mirrors the changed totals once.
        // Why:      Avoid touching the counters when nothing landed.
        if !landed.is_empty() {
            self.instrumentation.decoded_image_bytes.set(self.resident_bytes);
            self.instrumentation.pending_decodes.set(self.pending.len());
        }
        // What:     `landed` is the returned tail.
        // Why:      The caller refreshes the owning columns.
        landed
    }

    /// What:     `pub fn retain_only(&mut self, live: &HashSet<u64>)` drops every
    ///           decoded bitmap and every pending request whose pane is no longer
    ///           in the window.
    /// Why:      Off-window previews free their decoded memory, and their in-flight
    ///           decodes stop being tracked (the result, if it lands, is discarded).
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// retainOnly(live: Set<number>) { /* delete decoded+pending not in live */ }
    /// ```
    pub fn retain_only(&mut self, live: &HashSet<u64>) {
        // What:     `let mut removed_bytes: usize = 0;` accumulates freed bytes.
        // Why:      Subtract them from the resident total after pruning.
        let mut removed_bytes: usize = 0;
        // What:     `self.decoded.retain(|pane_id, decoded| { ... })` keeps only
        //           entries whose closure returns `true`.
        // Why:      Evict in one pass while tallying freed bytes.
        self.decoded.retain(|pane_id, decoded| {
            // What:     `let keep = live.contains(pane_id);` tests membership.
            // Why:      In-window previews stay resident.
            let keep = live.contains(pane_id);
            // What:     `if !keep { removed_bytes += decoded.bytes; }` tallies drops.
            // Why:      Keep the resident total exact.
            if !keep {
                removed_bytes += decoded.bytes;
            }
            // What:     `keep` is the closure's tail: keep or drop.
            // Why:      `retain` removes entries where this is `false`.
            keep
        });
        // What:     `self.resident_bytes -= removed_bytes;` shrinks the total.
        // Why:      Reflect the freed memory.
        self.resident_bytes -= removed_bytes;
        // What:     `self.pending.retain(|pane_id| live.contains(pane_id));` stops
        //           tracking decodes for panes that left the window.
        // Why:      A scrolled-out preview's decode is no longer awaited; if its
        //           result still lands, `drain_results` inserts it and the next
        //           `retain_only` evicts it.
        self.pending.retain(|pane_id| live.contains(pane_id));
        // What:     Mirror the reduced resident bytes and pending count.
        // Why:      Keep the HUD accurate.
        self.instrumentation.decoded_image_bytes.set(self.resident_bytes);
        self.instrumentation.pending_decodes.set(self.pending.len());
    }

    /// What:     `pub fn resident_bytes(&self) -> usize` reports resident decoded
    ///           memory.
    /// Why:      Tests assert against it.
    pub fn resident_bytes(&self) -> usize {
        // What:     `self.resident_bytes` tail expression returns the total.
        // Why:      Expose the running sum.
        self.resident_bytes
    }
}

/// What:     `#[cfg(test)] #[path = "preview_tests.rs"] mod tests;` declares the
///           test-only submodule in the flat sibling file `preview_tests.rs`.
/// Why:      Keep byte-accounting and re-decode coverage beside the code.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // preview.unit.test.ts, run only by the test runner
/// ```
#[cfg(test)]
#[path = "preview_tests.rs"]
mod tests;
