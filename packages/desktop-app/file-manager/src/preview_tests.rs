// What:     Unit tests for `preview.rs`, pulled in by
//           `#[cfg(test)] #[path = "preview_tests.rs"] mod tests;` at the bottom
//           of `preview.rs`. Reaches the parent items via `use super::*`.
// Why:      Cover the decode round-trip and the resident-byte accounting.

// What:     `use super::*;` glob-imports the parent `preview` module's items
//           (`PreviewCache`, `decode_to_image`, the constants, and so on).
// Why:      Tests call them directly.
use super::*;

// What:     `use std::collections::HashSet;` imports the set type used as the
//           live-window argument to `retain_only`.
// Why:      Build the "which previews stay" sets.
use std::collections::HashSet;

// What:     `const DECODED_BYTES: usize = (PREVIEW_W * PREVIEW_H * 4) as usize;`
//           is the expected decoded size of one preview (`as usize` narrows the
//           `u32` product).
// Why:      Assert byte accounting against a named expected value.
const DECODED_BYTES: usize = (PREVIEW_W * PREVIEW_H * 4) as usize;

// What:     `fn fresh_cache() -> (Rc<Instrumentation>, PreviewCache)` builds a new
//           instrumentation handle and a cache sharing it, returning both.
// Why:      Every test needs the counters to read back and the cache to drive.
//
// In TS you'd write (pseudocode):
// ```ts
// function freshCache(): [Instrumentation, PreviewCache] { ... }
// ```
fn fresh_cache() -> (Rc<Instrumentation>, PreviewCache) {
    // What:     `let instrumentation = Rc::new(Instrumentation::new());` wraps a
    //           fresh counter set in a shared pointer.
    // Why:      The cache and the test both hold it.
    let instrumentation = Rc::new(Instrumentation::new());
    // What:     `let cache = PreviewCache::new(Rc::clone(&instrumentation));`
    //           builds the cache; `Rc::clone` bumps the refcount so both keep a
    //           handle to the same counters.
    // Why:      The cache mutates counters the test then reads.
    let cache = PreviewCache::new(Rc::clone(&instrumentation));
    // What:     `(instrumentation, cache)` is the returned tuple; tail expression.
    // Why:      Hand both back.
    (instrumentation, cache)
}

// What:     `#[test]` marks the decode round-trip test.
// Why:      Confirm synth -> encode -> decode yields the expected byte size.
#[test]
fn decode_round_trips_expected_bytes() {
    // What:     `let raw = synthetic_rgba(42);` makes pixels for seed 42.
    // Why:      Source data.
    let raw = synthetic_rgba(42);
    // What:     `let png = encode_png(&raw).expect("encode");`. `.expect(...)`
    //           unwraps the `Ok` or panics with the message (failing the test).
    // Why:      Encoding synthetic data must succeed.
    let png = encode_png(&raw).expect("encode");
    // What:     `let (_image, byte_len) = decode_to_image(&png).expect("decode");`
    //           decodes and destructures; `_image` discards the image (the
    //           leading `_` silences the unused warning).
    // Why:      We only assert the byte size here.
    let (_image, byte_len) = decode_to_image(&png).expect("decode");
    // What:     `assert_eq!(byte_len, DECODED_BYTES);` checks the decoded size.
    // Why:      Round-trip must preserve dimensions.
    assert_eq!(byte_len, DECODED_BYTES);
}

// What:     `#[test]` on the eviction-frees-bytes path.
// Why:      Resident bytes must fall when previews leave the window.
#[test]
fn eviction_frees_resident_bytes() {
    // What:     `let (instr, mut cache) = fresh_cache();`. `mut cache` because the
    //           cache methods take `&mut self`.
    // Why:      Drive decode then eviction.
    let (instr, mut cache) = fresh_cache();
    // What:     `cache.image_for(1, 100).expect("decode 1");` decodes pane 1.
    // Why:      Make one bitmap resident.
    cache.image_for(1, 100).expect("decode 1");
    // What:     `cache.image_for(2, 200).expect("decode 2");` decodes pane 2.
    // Why:      Two resident bitmaps now.
    cache.image_for(2, 200).expect("decode 2");
    // What:     `assert_eq!(cache.resident_bytes(), 2 * DECODED_BYTES);`.
    // Why:      Both bitmaps counted.
    assert_eq!(cache.resident_bytes(), 2 * DECODED_BYTES);
    // What:     `assert_eq!(instr.decode_count.get(), 2);` reads the shared
    //           counter; `.get()` reads a `Cell`.
    // Why:      Exactly two decodes happened.
    assert_eq!(instr.decode_count.get(), 2);
    // What:     `let mut live: HashSet<u64> = HashSet::new(); live.insert(1);`
    //           builds the set holding only pane 1.
    // Why:      Simulate pane 2 scrolling out of the window.
    let mut live: HashSet<u64> = HashSet::new();
    live.insert(1);
    // What:     `cache.retain_only(&live);` evicts everything not in `live`.
    // Why:      Drop pane 2's bitmap.
    cache.retain_only(&live);
    // What:     `assert_eq!(cache.resident_bytes(), DECODED_BYTES);`.
    // Why:      Only pane 1 remains resident.
    assert_eq!(cache.resident_bytes(), DECODED_BYTES);
    // What:     `cache.retain_only(&HashSet::new());` evicts all.
    // Why:      Nothing in-window now.
    cache.retain_only(&HashSet::new());
    // What:     `assert_eq!(cache.resident_bytes(), 0);`.
    // Why:      Resident memory fully freed.
    assert_eq!(cache.resident_bytes(), 0);
}

// What:     `#[test]` on the scroll-back re-decode path.
// Why:      A preview that left and returned must decode again, not persist.
#[test]
fn scroll_back_redecodes() {
    // What:     Fresh cache and its counters.
    // Why:      Isolated state.
    let (instr, mut cache) = fresh_cache();
    // What:     Decode pane 7 once.
    // Why:      First materialization.
    cache.image_for(7, 7).expect("decode first");
    // What:     `assert_eq!(instr.decode_count.get(), 1);`.
    // Why:      One decode so far.
    assert_eq!(instr.decode_count.get(), 1);
    // What:     Evict everything.
    // Why:      Pane 7 scrolls out of the window.
    cache.retain_only(&HashSet::new());
    // What:     `assert_eq!(cache.resident_bytes(), 0);`.
    // Why:      Bitmap dropped.
    assert_eq!(cache.resident_bytes(), 0);
    // What:     Ask for pane 7 again.
    // Why:      Pane 7 scrolls back into the window.
    cache.image_for(7, 7).expect("decode second");
    // What:     `assert_eq!(instr.decode_count.get(), 2);`.
    // Why:      A second decode proves re-materialization.
    assert_eq!(instr.decode_count.get(), 2);
    // What:     `assert_eq!(cache.resident_bytes(), DECODED_BYTES);`.
    // Why:      Bitmap resident again.
    assert_eq!(cache.resident_bytes(), DECODED_BYTES);
}

// What:     `#[test]` proving a resident preview is reused, not re-decoded.
// Why:      Repeated republishes must not thrash the decoder.
#[test]
fn resident_preview_reused_without_redecode() {
    // What:     Fresh cache and counters.
    // Why:      Isolated state.
    let (instr, mut cache) = fresh_cache();
    // What:     Decode pane 3.
    // Why:      Make it resident.
    cache.image_for(3, 3).expect("decode once");
    // What:     Ask again while still resident.
    // Why:      Simulate a republish that keeps pane 3 in-window.
    cache.image_for(3, 3).expect("reuse");
    // What:     `assert_eq!(instr.decode_count.get(), 1);`.
    // Why:      Only one decode; the second call reused the cached bitmap.
    assert_eq!(instr.decode_count.get(), 1);
}
