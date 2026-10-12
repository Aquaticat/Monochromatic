// What:     Integration test for `watch.rs`, pulled in by
//           `#[cfg(test)] #[path = "watch_tests.rs"] mod tests;` at the bottom of
//           `watch.rs`. Compiles only under `cargo nextest run` / `cargo test`.
// Why:      Cross the real notify->callback boundary: a SourceWatcher over a throwaway
//           directory must call its change callback when a file appears, proving the live
//           watcher actually fires (not just that it compiles).

// What:     `use super::*;` bring the parent `watch` module's items (SourceWatcher,
//           Duration) into scope.
// Why:      The test constructs a `SourceWatcher` and uses `Duration`.
use super::*;

// What:     `use std::sync::mpsc;`. Channel module.
// Why:      The change callback signals the test thread over a channel.
use std::sync::mpsc;

// What:     `use std::time::{SystemTime, UNIX_EPOCH};`. Clock and epoch reference.
// Why:      Build a unique throwaway directory name.
use std::time::{SystemTime, UNIX_EPOCH};

// What:     `#[test] fn watcher_fires_on_file_creation()`. Watch a temp dir and assert the
//           callback runs after a file is created in it.
// Why:      Verify the notify + debouncer pipeline delivers a change to our callback.
#[test]
fn watcher_fires_on_file_creation() {
    // What:     `let nanos = ...as_nanos();`. Unique suffix for the throwaway directory.
    // Why:      Isolate this run's scratch root (THR: verify on a throwaway).
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock should be after Unix epoch")
        .as_nanos();
    // What:     `let dir = std::env::temp_dir().join(format!("mp_watch_{nanos}"));`. The dir
    //           to watch.
    // Why:      A real directory the OS watcher can observe.
    let dir = std::env::temp_dir().join(format!("mp_watch_{nanos}"));
    // What:     Create the source root before watching it.
    // Why:      The watch target must exist.
    std::fs::create_dir_all(&dir).expect("watch fixture directory should be created");

    // What:     `let (tx, rx) = mpsc::channel::<()>();`. A unit-signal channel.
    // Why:      The callback sends `()` so the test can wait for a change.
    let (tx, rx) = mpsc::channel::<()>();
    // What:     `let mut watcher = SourceWatcher::new(move || { let _ = tx.send(()); }).expect("watcher");`.
    //           Build the watcher with a callback that signals the channel; `.expect` fails
    //           the test if the OS watcher cannot start.
    // Why:      Exercise the real constructor and handler wiring.
    let mut watcher = SourceWatcher::new(move || {
        let _ = tx.send(());
    })
    .expect("OS watcher should start");
    // What:     `watcher.watch(&dir);`. Start watching the throwaway directory.
    // Why:      Arm the watch before creating a file.
    watcher.watch(&dir);
    assert!(watcher.wait_until_registered(1, Duration::from_secs(10)), "the watch should be registered");

    // What:     `std::thread::sleep(Duration::from_millis(ARM_SLACK_MS));`. Brief pause so the
    //           inotify/FSEvents watch is fully armed before the write.
    // Why:      A file created in the gap between watch() and the kernel arming the watch can
    //           be missed; this avoids that race in the test.
    const ARM_SLACK_MS: u64 = 200;
    std::thread::sleep(Duration::from_millis(ARM_SLACK_MS));
    // What:     Create an audio file in the watched directory.
    // Why:      The change the watcher should report.
    std::fs::write(dir.join("new.flac"), b"x").expect("watched fixture should be written");

    // What:     `let got = rx.recv_timeout(Duration::from_secs(WAIT_SECS));`. Wait (bounded)
    //           for the callback. The debounce window is 500ms; the timeout is generous.
    // Why:      A bounded wait is the correct way to await an inherently async OS event.
    const WAIT_SECS: u64 = 10;
    let got = rx.recv_timeout(Duration::from_secs(WAIT_SECS));
    // What:     `assert!(got.is_ok(), ...)`. The callback must have fired.
    // Why:      Proves the notify -> debouncer -> callback path delivers a change.
    assert!(
        got.is_ok(),
        "expected a change callback after creating a file in the watched root"
    );

    // What:     `drop(watcher);` then `std::fs::remove_dir_all(&dir).ok();`. Stop the watcher
    //           and clean up the scratch directory.
    // Why:      Release the OS watch and leave no test droppings.
    drop(watcher);
    std::fs::remove_dir_all(&dir).ok();
}

// What:     Reading a watched directory does not request a rescan, and a real change afterwards does.
// Why:      The rescan's own walk reads every directory. When reads counted as changes each rescan requested another,
//           and at one million tracks that kept a core busy. The change at the end is the positive control: it proves
//           the watcher was able to report anything at all during the quiet period.
#[test]
fn reading_a_watched_directory_is_not_a_change_but_writing_is() {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock should be after Unix epoch")
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("mp_watch_reads_{nanos}"));
    std::fs::create_dir_all(dir.join("sub")).expect("watch fixture directory should be created");
    std::fs::write(dir.join("sub").join("a.flac"), b"x").expect("fixture file should be written");
    let (tx, rx) = mpsc::channel::<()>();
    let mut watcher = SourceWatcher::new(move || {
        let _ = tx.send(());
    })
    .expect("OS watcher should start");
    watcher.watch(&dir);
    assert!(watcher.wait_until_registered(1, Duration::from_secs(10)), "the watch should be registered");
    assert!(rx.recv_timeout(Duration::from_secs(10)).is_ok(), "the registration asks for one catch-up rescan");
    for _ in 0..3 {
        let walked: usize = std::fs::read_dir(&dir).expect("root reads").count() + std::fs::read_dir(dir.join("sub")).expect("subfolder reads").count();
        assert_eq!(walked, 2);
        let contents: Vec<u8> = std::fs::read(dir.join("sub").join("a.flac")).expect("file reads");
        assert_eq!(contents, b"x");
    }
    assert!(
        rx.recv_timeout(Duration::from_millis(2 * DEBOUNCE_MS + 500)).is_err(),
        "reading directories and files must not request a rescan"
    );
    std::fs::write(dir.join("sub").join("b.flac"), b"y").expect("watched fixture should be written");
    assert!(rx.recv_timeout(Duration::from_secs(10)).is_ok(), "a created file must request a rescan");
    drop(watcher);
    std::fs::remove_dir_all(&dir).ok();
}

// What:     A burst of changes requests one rescan, not one per change.
// Why:      Copying an album writes many files; each rescan walks the whole library.
#[test]
fn a_burst_of_changes_requests_one_rescan() {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock should be after Unix epoch")
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("mp_watch_burst_{nanos}"));
    std::fs::create_dir_all(&dir).expect("watch fixture directory should be created");
    let (tx, rx) = mpsc::channel::<()>();
    let mut watcher = SourceWatcher::new(move || {
        let _ = tx.send(());
    })
    .expect("OS watcher should start");
    watcher.watch(&dir);
    assert!(watcher.wait_until_registered(1, Duration::from_secs(10)), "the watch should be registered");
    assert!(rx.recv_timeout(Duration::from_secs(10)).is_ok(), "the registration asks for one catch-up rescan");
    for number in 0..20 {
        std::fs::write(dir.join(format!("{number}.flac")), b"x").expect("burst fixture should be written");
    }
    assert!(rx.recv_timeout(Duration::from_secs(10)).is_ok(), "the burst must request a rescan");
    assert!(rx.recv_timeout(Duration::from_millis(2 * DEBOUNCE_MS)).is_err(), "and only one");
    drop(watcher);
    std::fs::remove_dir_all(&dir).ok();
}

// What:     Registering a watch is followed by exactly one rescan request, with no change made.
// Why:      A change made while the registration was still running is not seen by the watch; at one million tracks the
//           registration ends long after the scan, so the one rescan catches up. A second request would mean the
//           rescan's own reads are being counted as changes again.
#[test]
fn a_registration_is_followed_by_exactly_one_catch_up_rescan() {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock should be after Unix epoch")
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("mp_watch_catchup_{nanos}"));
    std::fs::create_dir_all(dir.join("sub")).expect("watch fixture directory should be created");
    std::fs::write(dir.join("sub").join("a.flac"), b"x").expect("fixture file should be written");
    let (tx, rx) = mpsc::channel::<()>();
    let mut watcher = SourceWatcher::new(move || {
        let _ = tx.send(());
    })
    .expect("OS watcher should start");
    watcher.watch(&dir);
    assert!(rx.recv_timeout(Duration::from_secs(10)).is_ok(), "one catch-up rescan follows the registration");
    // The rescan this triggers reads every directory, as the real one does.
    assert_eq!(std::fs::read_dir(dir.join("sub")).expect("subfolder reads").count(), 1);
    assert!(rx.recv_timeout(Duration::from_millis(2 * DEBOUNCE_MS + 500)).is_err(), "and no second one");
    drop(watcher);
    std::fs::remove_dir_all(&dir).ok();
}
