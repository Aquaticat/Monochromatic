//! Unit tests for window-placement math.

use super::*;

// Window length is floor(seconds * rate), clamped to at least one frame.
#[test]
fn window_frames_floors_and_clamps() {
    assert_eq!(window_frames(4.0, 48000), 192000);
    assert_eq!(window_frames(0.5, 44100), 22050);
    // A tiny window or rate never yields zero frames.
    assert_eq!(window_frames(0.0, 48000), 1);
    assert_eq!(window_frames(4.0, 0), 1);
}

// Evenly spaced starts include the very beginning and the final legal start.
#[test]
fn starts_cover_both_ends() {
    let total = 1000_u64;
    let count = 5_usize;
    let frames = 100_u64;
    let starts = window_frame_starts(total, count, frames);
    assert_eq!(starts.len(), count);
    assert_eq!(starts[0], 0);
    assert_eq!(*starts.last().unwrap(), total - frames); // 900
    assert_eq!(starts, vec![0, 225, 450, 675, 900]);
}

// Starts are non-decreasing and never past the final legal start.
#[test]
fn starts_are_monotonic_and_bounded() {
    let total = 7_777_777_u64;
    let count = 14_usize;
    let frames = window_frames(4.0, 48000);
    let last_start = total - frames;
    let starts = window_frame_starts(total, count, frames);
    assert_eq!(starts.len(), count);
    for pair in starts.windows(2) {
        assert!(pair[1] >= pair[0], "starts must be non-decreasing");
    }
    assert!(starts.iter().all(|&start| start <= last_start));
    assert_eq!(starts[0], 0);
    assert_eq!(*starts.last().unwrap(), last_start);
}

// A single window starts at the beginning; zero windows produce no starts.
#[test]
fn degenerate_window_counts() {
    assert_eq!(window_frame_starts(1000, 1, 100), vec![0]);
    assert_eq!(window_frame_starts(1000, 0, 100), Vec::<u64>::new());
}

// A track shorter than one window still produces in-range starts (all at 0).
#[test]
fn track_shorter_than_window_starts_at_zero() {
    let starts = window_frame_starts(50, 4, 100);
    assert_eq!(starts, vec![0, 0, 0, 0]);
}

// The bundled plan carries a consistent window length and start list.
#[test]
fn placement_plan_bundles_length_and_starts() {
    let plan = WindowPlacement::plan(1000, 5, 0.5, 200);
    assert_eq!(plan.window_frames, 100); // floor(0.5 * 200)
    assert_eq!(plan.starts, vec![0, 225, 450, 675, 900]);
}
