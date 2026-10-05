//! Stall-detection tests using injected times, with no display, sleeping, or host state.

use super::*;

/// A parent that presented within the threshold keeps ownership of the frame cadence.
#[test]
fn presenting_parent_needs_no_fallback() {
    assert!(!parent_stalled(false, Duration::ZERO));
    assert!(!parent_stalled(false, FRAME_INTERVAL));
    assert!(!parent_stalled(false, STALL_THRESHOLD - Duration::from_nanos(1)));
}

/// A locked or hidden parent stops presenting; the hosted client must still be paced.
#[test]
fn silent_parent_triggers_fallback_from_the_threshold_on() {
    assert!(parent_stalled(false, STALL_THRESHOLD));
    assert!(parent_stalled(false, Duration::from_secs(3600)));
}

/// While recording, the recorder's own timer defines the cadence, however long the parent is silent.
#[test]
fn recorder_keeps_ownership_of_the_frame_cadence() {
    assert!(!parent_stalled(true, STALL_THRESHOLD));
    assert!(!parent_stalled(true, Duration::from_secs(3600)));
}

/// The fallback starts once the parent goes silent and stops when the parent presents again.
#[test]
fn fallback_follows_parent_presentation() {
    let start = Instant::now();
    let mut pacing = FramePacing::new(start);
    assert!(!pacing.fallback_due(false, start + FRAME_INTERVAL));
    assert!(pacing.fallback_due(false, start + STALL_THRESHOLD));
    // The fallback's own ticks do not count as presentation, so it keeps pacing every frame.
    assert!(pacing.fallback_due(false, start + STALL_THRESHOLD + FRAME_INTERVAL));
    let resumed = start + Duration::from_secs(5);
    pacing.parent_presented(resumed);
    assert!(!pacing.fallback_due(false, resumed + FRAME_INTERVAL));
    assert!(pacing.fallback_due(false, resumed + STALL_THRESHOLD));
}

/// A time earlier than the last presentation is treated as no silence, never as a panic.
#[test]
fn earlier_time_is_not_a_stall() {
    let start = Instant::now();
    let mut pacing = FramePacing::new(start + Duration::from_secs(1));
    assert!(!pacing.fallback_due(false, start));
}

/// The frame interval is derived from the advertised 60 Hz output refresh.
#[test]
fn frame_interval_matches_the_advertised_refresh() {
    assert_eq!(FRAME_INTERVAL, Duration::from_nanos(16_666_666));
    assert!(STALL_THRESHOLD >= FRAME_INTERVAL * 2);
}
