// What:     Unit tests for controller peak-swap state, pulled in by
//           `#[cfg(test)] #[path = "controller_tests.rs"] mod tests;` at the
//           bottom of `controller.rs`.
// Why:      Keep tests beside the controller without inflating production code.
// TS map:   `controller.unit.test.ts` beside `controller.ts`.

// What:     `use super::*;`. Import the parent controller module's private and
//           crate-visible items into this child test module.
// Why:      Tests directly inspect `Controller` fields and helper methods.
// TS map:   `import * as controller from "./controller";`
use super::*;

// What:     `use std::path::PathBuf;`. Owned filesystem path buffer.
// Why:      The skip-current sweep test builds a queue of owned fixture paths.
// TS map:   paths are strings in TypeScript.
use std::path::PathBuf;

// What:     `use std::sync::{Arc, Mutex};`. Thread-safe shared owner plus lock.
// Why:      The skip-current sweep test points controller peak cache at disposable state.
// TS map:   a shared locked object.
use std::sync::{Arc, Mutex};

// What:     `use std::sync::mpsc;`. Import Rust's channel module.
// Why:      Tests build manual pending peak receivers without spawning decoder threads.
// TS map:   `import { makeChannel } from "test-channel";`
use std::sync::mpsc;

// What:     `use std::time::Duration;`. A monotonic span of time.
// Why:      Tests pass a tiny timeout instead of waiting the production one-second window.
// TS map:   a millisecond count.
use std::time::Duration;

// What:     `use std::time::{SystemTime, UNIX_EPOCH};`. Clock plus 1970 epoch reference.
// Why:      Build unique disposable cache filenames.
// TS map:   `Date.now()`.
use std::time::{SystemTime, UNIX_EPOCH};

// What:     `use crate::peak_swap::{...};`. Import fallback gain, pending wrapper,
//           and manual result type from the peak-swap module.
// Why:      Tests need to seed pending state and assert gain changes.
// TS map:   `import { fallbackTrackGain, PendingPeakMeasurement, PeakGainResult } from "./peak_swap";`
use crate::peak_swap::{fallback_track_gain, PeakGainResult, PendingPeakMeasurement};

// What:     `use crate::peakcache::{self, PeakCache};`. Import peak-cache module and type.
// Why:      The skip-current sweep test computes fingerprints and creates a temp-backed cache.
// TS map:   `import * as peakcache from "./peakcache"; import { PeakCache } from "./peakcache";`
use crate::peakcache::{self, PeakCache};

// What:     `fn approx_eq(a: f32, b: f32) -> bool`. Float comparison helper.
// Why:      Peak gains are f32 values, so tests compare with a small tolerance.
// TS map:   `function approxEq(a: number, b: number): boolean`.
fn approx_eq(a: f32, b: f32) -> bool {
    // What:     `const TOLERANCE: f32 = 1e-6;`. Small allowed float difference.
    // Why:      Avoid exact equality on floating point values.
    // TS map:   `const TOLERANCE = 1e-6;`
    const TOLERANCE: f32 = 1e-6;
    // What:     `(a - b).abs() < TOLERANCE`. Difference-based comparison. Tail
    //           expression returns the boolean.
    // Why:      Values that differ only by f32 rounding count as equal.
    // TS map:   `return Math.abs(a - b) < TOLERANCE;`
    (a - b).abs() < TOLERANCE
}

// What:     `fn test_controller() -> Controller`. Build a controller with no audio
//           output and a no-op update callback.
// Why:      Peak-swap state does not need PipeWire/cpal or UI machinery.
// TS map:   `function testController(): Controller`.
fn test_controller() -> Controller {
    // What:     `Controller::new(Box::new(|_| {}), None)`. Construct the controller;
    //           `Box::new` heap-boxes the callback closure, and `None` means silent mode.
    // Why:      Give tests a real controller without opening an audio device.
    // TS map:   `return new Controller(() => {}, null);`
    Controller::new(Box::new(|_| {}), None)
}

// What:     `fn temp_cache(tag: &str) -> PathBuf`. Build a fresh disposable cache path.
// Why:      Tests must never touch the user's real peak cache.
// TS map:   `function tempCache(tag: string): string`.
fn temp_cache(tag: &str) -> PathBuf {
    // What:     `let nanos = ...as_nanos();`. Current time since 1970 in nanoseconds.
    // Why:      Make a collision-resistant filename for parallel test runs.
    // TS map:   `const nanos = BigInt(Date.now()) * 1_000_000n;`
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    // What:     `std::env::temp_dir().join(format!(...))`. Join a formatted filename
    //           under the system temp directory. Tail expression returns it.
    // Why:      Keep disposable cache state out of the repo and real config dir.
    // TS map:   `return join(tmpdir(), `mp-controller-${pid}-${nanos}-${tag}.json`);`
    std::env::temp_dir().join(format!(
        "mp-controller-{}-{}-{}.json",
        std::process::id(),
        nanos,
        tag
    ))
}

// What:     `#[test]` marks the next function as a Rust unit test.
// Why:      The test runner discovers and runs this case.
// TS map:   `test("timeout keeps fallback then later applies", () => { ... })`.
#[test]
fn timeout_keeps_fallback_then_later_result_swaps_gain() {
    // What:     `let mut controller = test_controller();`. Build mutable test state.
    // Why:      The wait and poll helpers mutate peak fields.
    // TS map:   `const controller = testController();`
    let mut controller = test_controller();
    // What:     `controller.peak_generation = 1;`. Seed the current track generation.
    // Why:      The manual result below must match this generation to be accepted.
    // TS map:   `controller.peakGeneration = 1;`
    controller.peak_generation = 1;
    // What:     `let fallback = fallback_track_gain();`. Read the temporary ceiling gain.
    // Why:      Assert the timeout path leaves it unchanged.
    // TS map:   `const fallback = fallbackTrackGain();`
    let fallback = fallback_track_gain();
    // What:     `controller.track_gain = fallback;`. Seed current gain to fallback.
    // Why:      This is the state after loading an uncached track.
    // TS map:   `controller.trackGain = fallback;`
    controller.track_gain = fallback;
    // What:     `let (sender, receiver) = mpsc::channel();`. Create a manual one-shot
    //           channel for a future peak result.
    // Why:      Keep measurement pending through the short timeout, then send a result.
    // TS map:   `const { sender, receiver } = makeChannel();`
    let (sender, receiver) = mpsc::channel();
    // What:     `controller.pending_peak = Some(PendingPeakMeasurement::from_receiver(receiver));`.
    //           Wrap the receiver in `Some` and store it on the controller.
    // Why:      Simulate an in-flight current-track measurement.
    // TS map:   `controller.pendingPeak = PendingPeakMeasurement.fromReceiver(receiver);`
    controller.pending_peak = Some(PendingPeakMeasurement::from_receiver(receiver));

    // What:     `controller.wait_for_pending_peak(Duration::from_millis(1));`. Wait a
    //           tiny test timeout with no value sent yet.
    // Why:      Exercise the timeout branch without paying the production one second.
    // TS map:   `controller.waitForPendingPeak(1);`
    controller.wait_for_pending_peak(Duration::from_millis(1));

    // What:     `assert!(approx_eq(controller.track_gain, fallback));`. Gain stayed fallback.
    // Why:      Timeout must not invent or clear a measured gain.
    // TS map:   `expect(approxEq(controller.trackGain, fallback)).toBe(true);`
    assert!(approx_eq(controller.track_gain, fallback));
    // What:     `assert!(controller.pending_peak.is_some());`. Pending receiver remains.
    // Why:      A later measurement result should still be able to swap gain.
    // TS map:   `expect(controller.pendingPeak !== null).toBe(true);`
    assert!(controller.pending_peak.is_some());

    // What:     `sender.send(PeakGainResult { generation: 1, gain: 0.5 }).unwrap();`.
    //           Send a matching-generation measured gain through the channel.
    // Why:      The next poll should accept it and replace fallback.
    // TS map:   `sender.send({ generation: 1, gain: 0.5 });`
    sender
        .send(PeakGainResult {
            generation: 1,
            gain: 0.5,
        })
        .unwrap();
    // What:     `assert!(controller.poll_pending_peak());`. Poll and expect a live
    //           current-track result to apply.
    // Why:      Confirms late results still swap future decoded samples.
    // TS map:   `expect(controller.pollPendingPeak()).toBe(true);`
    assert!(controller.poll_pending_peak());
    // What:     `assert!(approx_eq(controller.track_gain, 0.5));`. The measured gain landed.
    // Why:      Future decoded samples now use the measured value.
    // TS map:   `expect(approxEq(controller.trackGain, 0.5)).toBe(true);`
    assert!(approx_eq(controller.track_gain, 0.5));
    // What:     `assert!(controller.pending_peak.is_none());`. Receiver was consumed.
    // Why:      The current measurement is complete.
    // TS map:   `expect(controller.pendingPeak === null).toBe(true);`
    assert!(controller.pending_peak.is_none());
}

// What:     `#[test]` marks the next function as a Rust unit test.
// Why:      The test runner discovers and runs this case.
// TS map:   `test("stale generation ignored", () => { ... })`.
#[test]
fn stale_generation_result_is_ignored() {
    // What:     `let mut controller = test_controller();`. Build mutable test state.
    // Why:      The poll helper mutates pending state.
    // TS map:   `const controller = testController();`
    let mut controller = test_controller();
    // What:     `controller.peak_generation = 2;`. Current track has generation 2.
    // Why:      The result below pretends to belong to an older track.
    // TS map:   `controller.peakGeneration = 2;`
    controller.peak_generation = 2;
    // What:     `let fallback = fallback_track_gain();`. Read fallback gain.
    // Why:      Assert stale result does not change it.
    // TS map:   `const fallback = fallbackTrackGain();`
    let fallback = fallback_track_gain();
    // What:     `controller.track_gain = fallback;`. Seed fallback state.
    // Why:      Stale result should leave this value untouched.
    // TS map:   `controller.trackGain = fallback;`
    controller.track_gain = fallback;
    // What:     `let (sender, receiver) = mpsc::channel();`. Create a manual channel.
    // Why:      Feed one stale result to the controller.
    // TS map:   `const { sender, receiver } = makeChannel();`
    let (sender, receiver) = mpsc::channel();
    // What:     `controller.pending_peak = Some(PendingPeakMeasurement::from_receiver(receiver));`.
    //           Store the pending receiver.
    // Why:      Make `poll_pending_peak` read the stale result.
    // TS map:   `controller.pendingPeak = PendingPeakMeasurement.fromReceiver(receiver);`
    controller.pending_peak = Some(PendingPeakMeasurement::from_receiver(receiver));
    // What:     `sender.send(PeakGainResult { generation: 1, gain: 0.5 }).unwrap();`.
    //           Send an older generation.
    // Why:      This simulates a previous track finishing after the current one loaded.
    // TS map:   `sender.send({ generation: 1, gain: 0.5 });`
    sender
        .send(PeakGainResult {
            generation: 1,
            gain: 0.5,
        })
        .unwrap();

    // What:     `assert!(!controller.poll_pending_peak());`. Poll returns false because
    //           the result was not applied.
    // Why:      Stale generation must be ignored.
    // TS map:   `expect(controller.pollPendingPeak()).toBe(false);`
    assert!(!controller.poll_pending_peak());
    // What:     `assert!(approx_eq(controller.track_gain, fallback));`. Gain stayed fallback.
    // Why:      Old track results must not affect the current track.
    // TS map:   `expect(approxEq(controller.trackGain, fallback)).toBe(true);`
    assert!(approx_eq(controller.track_gain, fallback));
    // What:     `assert!(controller.pending_peak.is_none());`. The stale pending result
    //           was consumed and cleared.
    // Why:      There is no useful result left in that receiver.
    // TS map:   `expect(controller.pendingPeak === null).toBe(true);`
    assert!(controller.pending_peak.is_none());
}

// What:     `#[test]` marks the next function as a Rust unit test.
// Why:      The test runner discovers and runs this case.
// TS map:   `test("play start waits", () => { ... })`.
#[test]
fn play_start_waits_for_pending_peak_result() {
    // What:     `let mut controller = test_controller();`. Build mutable test state.
    // Why:      `set_playing` mutates gain and playing fields.
    // TS map:   `const controller = testController();`
    let mut controller = test_controller();
    // What:     `controller.peak_generation = 3;`. Seed current track generation.
    // Why:      The manual peak result must match this generation.
    // TS map:   `controller.peakGeneration = 3;`
    controller.peak_generation = 3;
    // What:     `controller.track_gain = fallback_track_gain();`. Seed fallback gain.
    // Why:      Starting playback should replace it if the result is ready.
    // TS map:   `controller.trackGain = fallbackTrackGain();`
    controller.track_gain = fallback_track_gain();
    // What:     `let (sender, receiver) = mpsc::channel();`. Create a manual channel.
    // Why:      Send a ready result before calling `set_playing(true)`.
    // TS map:   `const { sender, receiver } = makeChannel();`
    let (sender, receiver) = mpsc::channel();
    // What:     `controller.pending_peak = Some(PendingPeakMeasurement::from_receiver(receiver));`.
    //           Store a pending receiver on the controller.
    // Why:      `set_playing(true)` should consume it before setting playback on.
    // TS map:   `controller.pendingPeak = PendingPeakMeasurement.fromReceiver(receiver);`
    controller.pending_peak = Some(PendingPeakMeasurement::from_receiver(receiver));
    // What:     `sender.send(PeakGainResult { generation: 3, gain: 0.5 }).unwrap();`.
    //           Send the matching result.
    // Why:      The start wait should apply this measured gain.
    // TS map:   `sender.send({ generation: 3, gain: 0.5 });`
    sender
        .send(PeakGainResult {
            generation: 3,
            gain: 0.5,
        })
        .unwrap();

    // What:     `controller.set_playing(true);`. Start playback through the real helper.
    // Why:      Covers the Play/CLI start boundary.
    // TS map:   `controller.setPlaying(true);`
    controller.set_playing(true);

    // What:     `assert!(controller.playing);`. Playback flag is on.
    // Why:      Start command should still start playback.
    // TS map:   `expect(controller.playing).toBe(true);`
    assert!(controller.playing);
    // What:     `assert!(approx_eq(controller.track_gain, 0.5));`. Gain was applied.
    // Why:      Ready peak results should win before output starts.
    // TS map:   `expect(approxEq(controller.trackGain, 0.5)).toBe(true);`
    assert!(approx_eq(controller.track_gain, 0.5));
    // What:     `assert!(controller.pending_peak.is_none());`. Pending handle cleared.
    // Why:      The result was consumed.
    // TS map:   `expect(controller.pendingPeak === null).toBe(true);`
    assert!(controller.pending_peak.is_none());
}

// What:     `#[test]` marks the next function as a Rust unit test.
// Why:      The test runner discovers and runs this case.
// TS map:   `test("background sweep skips current", () => { ... })`.
#[test]
fn background_sweep_skips_current_track() {
    // What:     `let cache_path = temp_cache("skip-current");`. Disposable cache file path.
    // Why:      Keep the test away from real config state.
    // TS map:   `const cachePath = tempCache("skip-current");`
    let cache_path = temp_cache("skip-current");
    // What:     `let mut controller = test_controller();`. Build mutable controller.
    // Why:      The test replaces its cache and queue.
    // TS map:   `const controller = testController();`
    let mut controller = test_controller();
    // What:     `controller.peaks = Arc::new(Mutex::new(PeakCache::from_path(Some(cache_path.clone()))));`.
    //           Replace the controller's peak cache with a temp-backed shared cache.
    // Why:      Background sweep writes to disposable state.
    // TS map:   `controller.peaks = shared(lock(PeakCache.fromPath(cachePath)));`
    controller.peaks = Arc::new(Mutex::new(PeakCache::from_path(Some(cache_path.clone()))));
    // What:     `let current = PathBuf::from("fixtures/tone.flac");`. First queue track.
    // Why:      Queue starts at index 0, so this is the current track to skip.
    // TS map:   `const current = "fixtures/tone.flac";`
    let current = PathBuf::from("fixtures/tone.flac");
    // What:     `let other = PathBuf::from("fixtures/tone.mp3");`. Second queue track.
    // Why:      Background sweep should measure this non-current track.
    // TS map:   `const other = "fixtures/tone.mp3";`
    let other = PathBuf::from("fixtures/tone.mp3");
    // What:     `controller.queue.set_tracks(vec![current.clone(), other.clone()]);`.
    //           Replace queue with two owned fixture paths.
    // Why:      Establish current plus non-current tracks.
    // TS map:   `controller.queue.setTracks([current, other]);`
    controller.queue.set_tracks(vec![current.clone(), other.clone()]);

    // What:     `controller.start_queue_measurement();`. Launch background sweep.
    // Why:      Exercise its skip-current filtering.
    // TS map:   `controller.startQueueMeasurement();`
    controller.start_queue_measurement();

    // What:     `let current_key = peakcache::fingerprint(&current).unwrap();`. Key for
    //           the current track.
    // Why:      Assert it stays uncached by this sweep.
    // TS map:   `const currentKey = fingerprint(current);`
    let current_key = peakcache::fingerprint(&current).unwrap();
    // What:     `let other_key = peakcache::fingerprint(&other).unwrap();`. Key for
    //           the non-current track.
    // Why:      Poll for this one to confirm the sweep ran.
    // TS map:   `const otherKey = fingerprint(other);`
    let other_key = peakcache::fingerprint(&other).unwrap();
    // What:     `let mut other_found = false;`. Whether non-current measurement landed.
    // Why:      Poll loop records success.
    // TS map:   `let otherFound = false;`
    let mut other_found = false;
    // What:     `for _ in 0..100 { ... }`. Poll briefly for the background worker.
    // Why:      The worker runs on another thread and should finish the tiny fixture.
    // TS map:   `for (let i = 0; i < 100; i++) { ... }`
    for _ in 0..100 {
        // What:     `if controller.peaks.lock().unwrap().get(&other_key).is_some() { ... }`.
        //           Check whether the non-current track was cached.
        // Why:      Detect sweep completion without sleeping a fixed long time.
        // TS map:   `if (cache.get(otherKey) !== undefined) { ... }`
        if controller.peaks.lock().unwrap().get(&other_key).is_some() {
            other_found = true;
            break;
        }
        // What:     `std::thread::sleep(Duration::from_millis(50));`. Sleep before polling again.
        // Why:      Avoid busy-spinning while the background worker decodes.
        // TS map:   `await sleep(50);`
        std::thread::sleep(Duration::from_millis(50));
    }
    // What:     `assert!(other_found);`. Non-current track was measured.
    // Why:      Prove the background sweep actually did work.
    // TS map:   `expect(otherFound).toBe(true);`
    assert!(other_found);
    // What:     `assert!(controller.peaks.lock().unwrap().get(&current_key).is_none());`.
    //           Check current track remains absent from the cache.
    // Why:      Dedicated current-track measurement, not background sweep, owns that path.
    // TS map:   `expect(cache.get(currentKey)).toBeUndefined();`
    assert!(controller.peaks.lock().unwrap().get(&current_key).is_none());

    // What:     `let _ = std::fs::remove_file(&cache_path);`. Best-effort cleanup.
    // Why:      Leave no temp cache file behind.
    // TS map:   `try { unlinkSync(cachePath); } catch {}`
    let _ = std::fs::remove_file(&cache_path);
}

// What:     `#[test] fn rescan_reflects_disk_and_preserves_selection_by_path()`. Drive the
//           `Command::Rescan` reconcile over a real disposable directory.
// Why:      The live-update core must reflect added/removed files and keep the Selected
//           Track selected by path (clearing it only when its file leaves the root).
// TS map:   `test("rescan reflects disk and preserves selection by path", () => { ... })`
#[test]
fn rescan_reflects_disk_and_preserves_selection_by_path() {
    // What:     `let nanos = ...as_nanos();`. A unique suffix for a throwaway directory.
    // Why:      Each run gets its own scratch root (THR: verify on a throwaway).
    // TS map:   `const nanos = Date.now();`
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    // What:     `let dir = std::env::temp_dir().join(format!("mp_rescan_{nanos}"));`. The
    //           disposable Source Root.
    // Why:      A real directory so `expand_paths` actually scans it.
    // TS map:   `const dir = join(os.tmpdir(), `mp_rescan_${nanos}`);`
    let dir = std::env::temp_dir().join(format!("mp_rescan_{nanos}"));
    // What:     `std::fs::create_dir_all(&dir).unwrap();`. Create it.
    // Why:      The root must exist before scanning.
    // TS map:   `mkdirSync(dir, { recursive: true });`
    std::fs::create_dir_all(&dir).unwrap();
    // What:     two audio-extension files written with one byte each.
    // Why:      `expand_paths` keeps only audio extensions; content is irrelevant here.
    // TS map:   `writeFileSync(a, "x"); writeFileSync(b, "x");`
    let a = dir.join("a.flac");
    let b = dir.join("b.flac");
    std::fs::write(&a, b"x").unwrap();
    std::fs::write(&b, b"x").unwrap();

    // What:     build a silent controller and point its Source Root at the scratch dir.
    // Why:      Drive the real `Rescan` handler without audio or UI.
    // TS map:   `const c = testController(); c.sourceRoot = dir;`
    let mut controller = test_controller();
    controller.source_root = Some(dir.clone());
    // What:     `controller.handle_command(Command::Rescan);`. Run the reconcile.
    // Why:      Build the queue from the directory.
    // TS map:   `c.handleCommand({ kind: "rescan" });`
    controller.handle_command(Command::Rescan);
    // What:     both files present after the scan.
    // Why:      The queue mirrors the directory.
    // TS map:   `expect(c.queue.tracks().length).toBe(2);`
    assert_eq!(controller.queue.tracks().len(), 2);
    assert!(controller.queue.tracks().contains(&a));
    assert!(controller.queue.tracks().contains(&b));

    // What:     select `b` by its scanned position.
    // Why:      Establish a Selected Track to preserve across the next rescan.
    // TS map:   `c.queue.playIndex(indexOf(b));`
    let bi = controller.queue.tracks().iter().position(|p| *p == b).unwrap();
    controller.queue.play_index(bi);
    assert_eq!(controller.queue.current_path(), Some(&b));

    // What:     add a file that sorts before the others, then rescan.
    // Why:      Adding a file shifts `b`'s index; the selection must follow by path.
    // TS map:   `writeFileSync(zero, "x"); c.handleCommand({ kind: "rescan" });`
    let zero = dir.join("0.flac");
    std::fs::write(&zero, b"x").unwrap();
    controller.handle_command(Command::Rescan);
    // What:     the new file is in the queue and `b` is still the selection.
    // Why:      Live add is reflected; selection preserved by path despite the index shift.
    // TS map:   `expect(c.queue.tracks().contains(zero)).toBe(true); expect(c.queue.currentPath()).toBe(b);`
    assert!(controller.queue.tracks().contains(&zero));
    assert_eq!(controller.queue.current_path(), Some(&b));

    // What:     remove the selected file `b`, then rescan.
    // Why:      The Selected Track's file left the root, so the selection must clear.
    // TS map:   `unlinkSync(b); c.handleCommand({ kind: "rescan" });`
    std::fs::remove_file(&b).unwrap();
    controller.handle_command(Command::Rescan);
    // What:     `b` is gone from the queue and nothing is selected.
    // Why:      Live remove is reflected; the missing selection is cleared.
    // TS map:   `expect(c.queue.tracks().contains(b)).toBe(false); expect(c.queue.currentPath()).toBeNull();`
    assert!(!controller.queue.tracks().contains(&b));
    assert_eq!(controller.queue.current_path(), None);

    // What:     `std::fs::remove_dir_all(&dir).ok();`. Best-effort cleanup of the scratch dir.
    // Why:      Leave no test droppings.
    // TS map:   `try { rmSync(dir, { recursive: true }); } catch {}`
    std::fs::remove_dir_all(&dir).ok();
}
