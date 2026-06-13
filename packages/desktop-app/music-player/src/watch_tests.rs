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
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    // What:     `let dir = std::env::temp_dir().join(format!("mp_watch_{nanos}"));`. The dir
    //           to watch.
    // Why:      A real directory the OS watcher can observe.
    let dir = std::env::temp_dir().join(format!("mp_watch_{nanos}"));
    // What:     `std::fs::create_dir_all(&dir).unwrap();`. Create it before watching.
    // Why:      The watch target must exist.
    std::fs::create_dir_all(&dir).unwrap();

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

    // What:     `std::thread::sleep(Duration::from_millis(ARM_SLACK_MS));`. Brief pause so the
    //           inotify/FSEvents watch is fully armed before the write.
    // Why:      A file created in the gap between watch() and the kernel arming the watch can
    //           be missed; this avoids that race in the test.
    const ARM_SLACK_MS: u64 = 200;
    std::thread::sleep(Duration::from_millis(ARM_SLACK_MS));
    // What:     `std::fs::write(dir.join("new.flac"), b"x").unwrap();`. Create a file.
    // Why:      The change the watcher should report.
    std::fs::write(dir.join("new.flac"), b"x").unwrap();

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
