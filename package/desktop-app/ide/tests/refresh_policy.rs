//! Reread schedules with chosen times: notifications first, old timers only while unwatched,
//! unfinished writes after a quiet period, and the safety sweep last.

/// What: the two schedules, the change classification, and the named intervals under test.
/// Why: Tests pass their own `Instant`s, so intervals are checked exactly without sleeping.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { SourceRefresh, DirectoryRefresh, SAFETY_SWEEP } from 'ide/refresh_policy';
/// ```
use ide_app::{
    change_watch::SourceChange,
    refresh_policy::{
        DirectoryRefresh, SAFETY_SWEEP, SourceRefresh, UNWATCHED_DIRECTORY_POLL,
        UNWATCHED_SOURCE_POLL, WRITE_QUIET, WRITE_WAIT_LIMIT,
    },
};
/// What: `Duration` is a span and `Instant` a monotonic time point; `+` on them yields a later `Instant`.
/// Why: Every expectation is expressed as an offset from one starting instant.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const later = start + 250;
/// ```
use std::{
    collections::BTreeSet,
    path::PathBuf,
    time::{Duration, Instant},
};

/// One millisecond, for "just before" and "just after" an interval boundary.
const TICK: Duration = Duration::from_millis(1);

/// A source schedule whose first read happened at `start`.
fn source_after_first_read(start: Instant, watched: bool) -> SourceRefresh {
    let mut refresh = SourceRefresh::default();
    assert!(refresh.due(start), "the first read must not wait");
    refresh.requested(start);
    refresh.set_watched(watched);
    return refresh;
}

/// Watched: no timer read before the safety sweep; unwatched: the old 250 ms timer.
#[test]
fn source_timers_depend_on_whether_its_directory_is_watched() {
    let start = Instant::now();
    let watched = source_after_first_read(start, true);
    assert!(
        !watched.due(start + UNWATCHED_SOURCE_POLL),
        "a watched file was polled"
    );
    assert!(!watched.due(start + SAFETY_SWEEP - TICK));
    assert!(
        watched.due(start + SAFETY_SWEEP),
        "the safety reread did not come due"
    );
    let unwatched = source_after_first_read(start, false);
    assert!(!unwatched.due(start + UNWATCHED_SOURCE_POLL - TICK));
    assert!(
        unwatched.due(start + UNWATCHED_SOURCE_POLL),
        "an unwatched file was not polled"
    );
}

/// A settled change is read at once; an unfinished write waits for quiet, but not past the wait limit.
#[test]
fn unfinished_writes_wait_for_quiet_within_a_limit() {
    let start = Instant::now();
    let mut settled = source_after_first_read(start, true);
    settled.changed(SourceChange::Settled, start + TICK);
    assert!(
        settled.due(start + TICK),
        "a finished write was not read at once"
    );
    let mut writing = source_after_first_read(start, true);
    writing.changed(SourceChange::Unsettled, start);
    assert!(
        !writing.due(start + WRITE_QUIET - TICK),
        "an unfinished write was read before going quiet"
    );
    assert!(
        writing.due(start + WRITE_QUIET),
        "a quiet unfinished write was not read"
    );
    let mut continuous = source_after_first_read(start, true);
    let mut at = start;
    while at < start + WRITE_WAIT_LIMIT {
        continuous.changed(SourceChange::Unsettled, at);
        at += Duration::from_millis(50);
    }
    assert!(
        continuous.due(start + WRITE_WAIT_LIMIT),
        "a continuously written file waited past the limit"
    );
}

/// The latest classification wins: delete then rewrite waits, write then close reads at once.
#[test]
fn the_latest_change_classification_wins() {
    let start = Instant::now();
    let mut rewritten = source_after_first_read(start, true);
    rewritten.changed(SourceChange::Settled, start);
    rewritten.changed(SourceChange::Unsettled, start);
    assert!(
        !rewritten.due(start + TICK),
        "a delete followed by an unfinished write was read mid-write"
    );
    let mut closed = source_after_first_read(start, true);
    closed.changed(SourceChange::Unsettled, start);
    closed.changed(SourceChange::Settled, start);
    assert!(closed.due(start), "a write followed by its close waited");
    closed.requested(start + TICK);
    assert!(
        !closed.due(start + TICK + TICK),
        "an admitted read left its notification pending"
    );
}

/// Owned paths in visible order, as the native tree builds them.
fn paths(names: &[&str]) -> Vec<PathBuf> {
    let mut owned = Vec::new();
    for name in names {
        owned.push(PathBuf::from(name));
    }
    return owned;
}

/// Notified directories come first, in visible order; directories no longer shown are dropped.
#[test]
fn notified_directories_are_read_first_in_visible_order() {
    let start = Instant::now();
    let shown = paths(&["/p", "/p/a", "/p/b"]);
    let watched: BTreeSet<PathBuf> = shown.iter().cloned().collect();
    let mut refresh = DirectoryRefresh::default();
    assert!(
        !refresh.start_sweep_if_due(&shown, start),
        "the first sweep must wait a full interval"
    );
    assert_eq!(
        refresh.next(&shown, &watched, start),
        None,
        "watched directories were polled"
    );
    refresh.changed(PathBuf::from("/p/b"));
    refresh.changed(PathBuf::from("/p/hidden"));
    refresh.changed(PathBuf::from("/p/a"));
    assert_eq!(
        refresh.next(&shown, &watched, start),
        Some(PathBuf::from("/p/a"))
    );
    assert_eq!(
        refresh.next(&shown, &watched, start),
        Some(PathBuf::from("/p/b"))
    );
    assert_eq!(
        refresh.next(&shown, &watched, start),
        None,
        "a directory that is not shown was read"
    );
    refresh.changed_all(&shown);
    for path in &shown {
        assert_eq!(refresh.next(&shown, &watched, start).as_ref(), Some(path));
    }
}

/// Unwatched shown directories keep the old 500 ms round robin; watched ones are not polled.
#[test]
fn unwatched_directories_keep_the_old_round_robin() {
    let start = Instant::now();
    let shown = paths(&["/p", "/p/a", "/p/b"]);
    let watched: BTreeSet<PathBuf> = paths(&["/p", "/p/b"]).into_iter().collect();
    let mut refresh = DirectoryRefresh::default();
    assert_eq!(
        refresh.next(&shown, &watched, start),
        Some(PathBuf::from("/p/a"))
    );
    assert_eq!(
        refresh.next(&shown, &watched, start + UNWATCHED_DIRECTORY_POLL - TICK),
        None
    );
    assert_eq!(
        refresh.next(&shown, &watched, start + UNWATCHED_DIRECTORY_POLL),
        Some(PathBuf::from("/p/a")),
        "the unwatched directory was not polled again on the old timer"
    );
}

/// The safety sweep rereads every shown directory after notified ones.
#[test]
fn the_safety_sweep_rereads_everything_after_notifications() {
    let start = Instant::now();
    let shown = paths(&["/p", "/p/a"]);
    let watched: BTreeSet<PathBuf> = shown.iter().cloned().collect();
    let mut refresh = DirectoryRefresh::default();
    assert!(!refresh.start_sweep_if_due(&shown, start));
    assert!(!refresh.start_sweep_if_due(&shown, start + SAFETY_SWEEP - TICK));
    assert!(
        refresh.start_sweep_if_due(&shown, start + SAFETY_SWEEP),
        "the safety sweep did not start"
    );
    refresh.changed(PathBuf::from("/p/a"));
    let later = start + SAFETY_SWEEP;
    assert_eq!(
        refresh.next(&shown, &watched, later),
        Some(PathBuf::from("/p/a")),
        "the sweep overtook a notification"
    );
    assert_eq!(
        refresh.next(&shown, &watched, later),
        Some(PathBuf::from("/p"))
    );
    assert_eq!(
        refresh.next(&shown, &watched, later),
        Some(PathBuf::from("/p/a"))
    );
    assert_eq!(refresh.next(&shown, &watched, later), None);
}
