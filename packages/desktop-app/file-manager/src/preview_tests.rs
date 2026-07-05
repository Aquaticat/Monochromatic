// What:     Unit tests for `preview.rs`, pulled in by
//           `#[cfg(test)] #[path = "preview_tests.rs"] mod tests;` at the bottom
//           of `preview.rs`. Reaches the parent items via `use super::*`.
// Why:      Cover the decode round-trip and the async request/drain/evict cycle.

// What:     `use super::*;` glob-imports the parent `preview` module's items.
// Why:      Tests call them directly.
use super::*;

// What:     `use std::collections::HashSet;` imports the set type used as the
//           live-window argument to `retain_only`.
// Why:      Build the "which previews stay" sets.
use std::collections::HashSet;

// What:     `use std::thread;` imports thread sleeping.
// Why:      The decode runs on a worker thread; tests wait briefly for results.
use std::thread;

// What:     `use std::time::Duration;` imports a time span type.
// Why:      The wait loop sleeps between drains.
use std::time::Duration;

// What:     `const DECODED_BYTES: usize = (PREVIEW_W * PREVIEW_H * 4) as usize;`
//           is the expected decoded size of one preview.
// Why:      Assert byte accounting against a named expected value.
const DECODED_BYTES: usize = (PREVIEW_W * PREVIEW_H * 4) as usize;

// What:     `fn fresh_cache() -> (Rc<Instrumentation>, PreviewCache)` builds a new
//           instrumentation handle and a cache (which starts a worker) sharing it.
// Why:      Every test needs the counters to read back and the cache to drive.
fn fresh_cache() -> (Rc<Instrumentation>, PreviewCache) {
    // What:     `let instrumentation = Rc::new(Instrumentation::new());` wraps fresh
    //           counters in a shared pointer.
    // Why:      The cache and the test both hold it.
    let instrumentation = Rc::new(Instrumentation::new());
    // What:     `let cache = PreviewCache::new(Rc::clone(&instrumentation));` builds
    //           the cache and spawns its background worker.
    // Why:      The cache mutates counters the test then reads.
    let cache = PreviewCache::new(Rc::clone(&instrumentation));
    // What:     `(instrumentation, cache)` is the returned tuple; tail expression.
    // Why:      Hand both back.
    (instrumentation, cache)
}

// What:     `fn drain_until(cache: &mut PreviewCache, want_bytes: usize)` drains the
//           result channel repeatedly, sleeping briefly, until resident bytes reach
//           `want_bytes` or a timeout panics.
// Why:      The worker decodes asynchronously, so tests poll for the result.
fn drain_until(cache: &mut PreviewCache, want_bytes: usize) {
    // What:     `for _ in 0..400 { ... }` bounds the wait at 400 tries (~2 seconds).
    // Why:      Never hang a test if a decode is lost.
    for _ in 0..400 {
        // What:     `cache.drain_results();` collects any ready decodes.
        // Why:      Move finished bitmaps into the resident set.
        cache.drain_results();
        // What:     `if cache.resident_bytes() >= want_bytes { return; }` stops once
        //           enough has landed.
        // Why:      The decode(s) we asked for are resident.
        if cache.resident_bytes() >= want_bytes {
            return;
        }
        // What:     `thread::sleep(Duration::from_millis(5));` waits between drains.
        // Why:      Give the worker thread time to decode.
        thread::sleep(Duration::from_millis(5));
    }
    // What:     `panic!(...)` fails the test if the decode never landed.
    // Why:      Surface a lost or hung decode instead of a silent stall.
    panic!(
        "decodes did not land: resident {} want {}",
        cache.resident_bytes(),
        want_bytes
    );
}

// What:     `#[test]` on the decode round-trip.
// Why:      Confirm synth -> encode -> decode_to_raw yields the expected bytes.
#[test]
fn decode_to_raw_round_trips_expected_bytes() {
    // What:     `let raw = synthetic_rgba(42);` makes pixels for seed 42.
    // Why:      Source data.
    let raw = synthetic_rgba(42);
    // What:     `let png = encode_png(&raw).expect("encode");` compresses them.
    // Why:      Produce the bytes to decode.
    let png = encode_png(&raw).expect("encode");
    // What:     `let (rgba, width, height) = decode_to_raw(&png).expect("decode");`
    //           decodes and destructures the tuple.
    // Why:      Assert size and dimensions.
    let (rgba, width, height) = decode_to_raw(&png).expect("decode");
    // What:     `assert_eq!(rgba.len(), DECODED_BYTES);` checks the byte size.
    // Why:      Round-trip must preserve dimensions.
    assert_eq!(rgba.len(), DECODED_BYTES);
    // What:     `assert_eq!(width, PREVIEW_W);` and the next line check dimensions.
    // Why:      Confirm the decoded shape.
    assert_eq!(width, PREVIEW_W);
    assert_eq!(height, PREVIEW_H);
}

// What:     `#[test]` proving a requested preview becomes resident after draining.
// Why:      The async request/drain path must deliver a decoded bitmap.
#[test]
fn request_then_drain_makes_resident() {
    // What:     Fresh cache and its counters.
    // Why:      Isolated state.
    let (instr, mut cache) = fresh_cache();
    // What:     `assert!(cache.request_preview(1, 100).is_none());` checks the first
    //           request returns a placeholder (not yet decoded).
    // Why:      The publish never blocks; the image is not ready synchronously.
    assert!(cache.request_preview(1, 100).is_none());
    // What:     `drain_until(&mut cache, DECODED_BYTES);` waits for the decode.
    // Why:      Let the worker finish and collect the result.
    drain_until(&mut cache, DECODED_BYTES);
    // What:     `assert!(cache.request_preview(1, 100).is_some());` now returns the
    //           resident image.
    // Why:      After draining, the bitmap is available.
    assert!(cache.request_preview(1, 100).is_some());
    // What:     `assert_eq!(cache.resident_bytes(), DECODED_BYTES);`.
    // Why:      Exactly one bitmap resident.
    assert_eq!(cache.resident_bytes(), DECODED_BYTES);
    // What:     `assert_eq!(instr.decode_count.get(), 1);` reads the shared counter.
    // Why:      Exactly one decode happened.
    assert_eq!(instr.decode_count.get(), 1);
}

// What:     `#[test]` on the eviction-frees-bytes path.
// Why:      Resident bytes must fall when previews leave the window.
#[test]
fn eviction_frees_resident_bytes() {
    // What:     Fresh cache; the counters are unused here so bind with `_`.
    // Why:      Drive decode then eviction.
    let (_instr, mut cache) = fresh_cache();
    // What:     Request two previews.
    // Why:      Queue two background decodes.
    cache.request_preview(1, 100);
    cache.request_preview(2, 200);
    // What:     Wait for both to land.
    // Why:      Both bitmaps resident now.
    drain_until(&mut cache, 2 * DECODED_BYTES);
    // What:     `assert_eq!(cache.resident_bytes(), 2 * DECODED_BYTES);`.
    // Why:      Both counted.
    assert_eq!(cache.resident_bytes(), 2 * DECODED_BYTES);
    // What:     `let mut live: HashSet<u64> = HashSet::new(); live.insert(1);`
    //           builds the set holding only pane 1.
    // Why:      Simulate pane 2 scrolling out of the window.
    let mut live: HashSet<u64> = HashSet::new();
    live.insert(1);
    // What:     `cache.retain_only(&live);` evicts everything not in `live`.
    // Why:      Drop pane 2's bitmap.
    cache.retain_only(&live);
    // What:     `assert_eq!(cache.resident_bytes(), DECODED_BYTES);`.
    // Why:      Only pane 1 remains.
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
    // What:     Fresh cache and counters.
    // Why:      Isolated state.
    let (instr, mut cache) = fresh_cache();
    // What:     Request pane 7 and wait for it.
    // Why:      First materialization.
    cache.request_preview(7, 7);
    drain_until(&mut cache, DECODED_BYTES);
    // What:     `assert_eq!(instr.decode_count.get(), 1);`.
    // Why:      One decode so far.
    assert_eq!(instr.decode_count.get(), 1);
    // What:     Evict everything.
    // Why:      Pane 7 scrolls out of the window.
    cache.retain_only(&HashSet::new());
    // What:     `assert_eq!(cache.resident_bytes(), 0);`.
    // Why:      Bitmap dropped.
    assert_eq!(cache.resident_bytes(), 0);
    // What:     Request pane 7 again and wait.
    // Why:      Pane 7 scrolls back into the window.
    cache.request_preview(7, 7);
    drain_until(&mut cache, DECODED_BYTES);
    // What:     `assert_eq!(instr.decode_count.get(), 2);`.
    // Why:      A second decode proves re-materialization.
    assert_eq!(instr.decode_count.get(), 2);
    // What:     `assert_eq!(cache.resident_bytes(), DECODED_BYTES);`.
    // Why:      Bitmap resident again.
    assert_eq!(cache.resident_bytes(), DECODED_BYTES);
}

// What:     `#[test]` proving a resident preview is reused, not re-decoded.
// Why:      Repeated publishes must not re-queue an already-decoded preview.
#[test]
fn resident_preview_reused_without_redecode() {
    // What:     Fresh cache and counters.
    // Why:      Isolated state.
    let (instr, mut cache) = fresh_cache();
    // What:     Request pane 3 and wait for it.
    // Why:      Make it resident.
    cache.request_preview(3, 3);
    drain_until(&mut cache, DECODED_BYTES);
    // What:     `cache.request_preview(3, 3);` while resident returns the cached
    //           image and queues no new decode.
    // Why:      Simulate a republish that keeps pane 3 in-window.
    cache.request_preview(3, 3);
    // What:     `cache.drain_results();` drains any stray results (none expected).
    // Why:      Ensure no second decode sneaked in.
    cache.drain_results();
    // What:     `assert_eq!(instr.decode_count.get(), 1);`.
    // Why:      Only one decode; the second request reused the cached bitmap.
    assert_eq!(instr.decode_count.get(), 1);
}
