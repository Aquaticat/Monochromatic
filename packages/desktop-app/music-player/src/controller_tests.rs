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

// What:     `use std::sync::mpsc;`. Import Rust's channel module.
// Why:      Tests build manual pending peak receivers without spawning decoder threads.
// TS map:   `import { makeChannel } from "test-channel";`
use std::sync::mpsc;

// What:     `use std::time::Duration;`. A monotonic span of time.
// Why:      Tests pass a tiny timeout instead of waiting the production one-second window.
// TS map:   a millisecond count.
use std::time::Duration;

// What:     `use crate::peak_swap::{...};`. Import fallback gain, pending wrapper,
//           and manual result type from the peak-swap module.
// Why:      Tests need to seed pending state and assert gain changes.
// TS map:   `import { fallbackTrackGain, PendingPeakMeasurement, PeakGainResult } from "./peak_swap";`
use crate::peak_swap::{fallback_track_gain, PeakGainResult, PendingPeakMeasurement};

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
