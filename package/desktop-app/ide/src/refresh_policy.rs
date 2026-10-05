//! When to reread shown directories and the displayed file. No I/O happens here: the native ticks ask
//! these schedules which read to start next and tell them which reads started.

/// Shown-directory scheduling: notified first, then unwatched on a timer, then the safety sweep.
mod directories;
/// Displayed-file scheduling: settled changes now, unfinished writes after a quiet period.
mod source;

/// The native tree tick asks this schedule which directory to list next.
pub use directories::DirectoryRefresh;
/// The native reload tick asks this schedule whether to reread the displayed file.
pub use source::SourceRefresh;

/// What: `Duration` is a span of time (`Instant`, a sibling, is a point in time).
/// Why: Named spans keep every interval in one place with its reason.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const SAFETY_SWEEP_MS = 10_000;
/// ```
use std::time::Duration;

/// Every shown directory and the displayed file are reread this often even with live watches.
/// inotify never reports some changes at all: network and FUSE mounts, writes through `mmap`,
/// and unmounts (notify 8.2.0 does not map `IN_UNMOUNT`); this bounds how long those stay stale.
/// Cost per sweep: one listing per shown directory and one source read, against 20 listings and
/// 40 source reads per 10 s under the old 500 ms and 250 ms polling.
pub const SAFETY_SWEEP: Duration = Duration::from_secs(10);

/// A notified item is not reread sooner than this after its previous read started.
/// A single change is still read at the next 20 ms tick; a folder or file changing continuously is
/// reread at most 10 times per second (the old polling read a file 4 and a folder at most 2 times per second),
/// which bounds listing, diff, highlighting, and repaint work during a build or a busy log.
pub const REREAD_GAP: Duration = Duration::from_millis(100);

/// The displayed file is reread this often while its directory has no live watch (the previous polling rate).
pub const UNWATCHED_SOURCE_POLL: Duration = Duration::from_millis(250);

/// One unwatched shown directory is reread this often, round robin (the previous polling rate).
pub const UNWATCHED_DIRECTORY_POLL: Duration = Duration::from_millis(500);

/// An unfinished write to the displayed file is read once no further write arrived for this long.
/// editord's watcher uses the same 150 ms `awaitWriteFinish` stability threshold.
pub const WRITE_QUIET: Duration = Duration::from_millis(150);

/// A file written continuously without closing is still read at least this often (the previous polling rate).
pub const WRITE_WAIT_LIMIT: Duration = Duration::from_millis(250);
