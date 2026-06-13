// What:     Integration test for `engine.rs`, pulled in by
//           `#[cfg(test)] #[path = "engine_tests.rs"] mod tests;` at the bottom of
//           `engine.rs`. Compiles only under `cargo nextest run` / `cargo test`.
// Why:      Cross the WHOLE live-update seam in one test: the file watcher's change
//           callback -> `CommandSender::send(Command::Rescan)` -> channel -> `unpark`
//           wakes the parked worker -> drain loop -> `Controller`'s `Rescan` handler ->
//           `Update::Queue`. Every other test exercises only one half of this (watch_tests
//           proves notify->callback; controller_tests calls `handle_command` directly), so
//           nothing else proves the parked worker actually wakes and re-derives the queue.

// What:     `use super::*;` bring the parent `engine` module's items (Engine) and the names
//           it imports (Command, Update) into scope.
// Why:      The test spawns an `Engine`, sends a `Command`, and matches an `Update`.
use super::*;

// What:     `use std::sync::mpsc;`. Channel module.
// Why:      The update callback forwards queue lengths to the test thread over a channel.
use std::sync::mpsc;

// What:     `use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};`. A span, a
//           monotonic clock reading, a wall clock, and the epoch reference.
// Why:      `Duration` bounds the wait, `Instant` builds the deadline, `SystemTime`/
//           `UNIX_EPOCH` build a unique throwaway directory name.
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

// What:     `fn wait_for_len(rx: &mpsc::Receiver<usize>, want: usize, secs: u64) -> bool`.
//           Read queue-length updates until one equals `want`, or `secs` elapse. Returns
//           whether `want` was seen in time.
// Why:      The engine emits several updates (now-playing, position, queue); the test cares
//           only about a `Queue` update of a specific length, and an OS filesystem event is
//           inherently async, so a bounded wait that skips other lengths is the correct way
//           to await it.
fn wait_for_len(rx: &mpsc::Receiver<usize>, want: usize, secs: u64) -> bool {
    // What:     `let deadline = Instant::now() + Duration::from_secs(secs);`. The instant the
    //           wait gives up.
    // Why:      Bound total waiting across however many non-matching updates arrive first.
    let deadline = Instant::now() + Duration::from_secs(secs);
    // What:     `loop { ... }`. Keep receiving until a match, the deadline, or a closed
    //           channel.
    // Why:      A `while`-style cursor over an unbounded event stream (not a structural
    //           walk), so a loop, not recursion.
    loop {
        // What:     `let now = Instant::now(); if now >= deadline { return false; }`. Stop if
        //           time is up.
        // Why:      Never wait past the budget.
        let now = Instant::now();
        if now >= deadline {
            return false;
        }
        // What:     `match rx.recv_timeout(deadline - now) { ... }`. Wait for the next update
        //           for the remaining budget.
        // Why:      Shrink the per-wait timeout as the deadline nears so total wait stays
        //           bounded.
        match rx.recv_timeout(deadline - now) {
            // What:     `Ok(len) if len == want => return true`. The wanted queue length
            //           arrived.
            // Why:      Success: the seam delivered the expected `Update::Queue`.
            Ok(len) if len == want => return true,
            // What:     `Ok(_) => continue`. A different update (a different length): ignore
            //           and keep waiting.
            // Why:      Only the target length proves the assertion; others are noise.
            Ok(_) => continue,
            // What:     `Err(_) => return false`. Timed out or the engine dropped its sender.
            // Why:      Either way the wanted update will not come.
            Err(_) => return false,
        }
    }
}

// What:     `#[test] fn watcher_drives_rescan_update_through_engine()`. Open a throwaway
//           directory as the Source Root through a real `Engine`, then create a file in it
//           and assert a `Queue` update reflecting the new file arrives.
// Why:      Prove the live-update path end to end: the watcher actually wakes the parked
//           worker and the worker actually re-derives and re-emits the queue.
#[test]
fn watcher_drives_rescan_update_through_engine() {
    // What:     `let nanos = ...as_nanos();`. Unique suffix for the throwaway directory.
    // Why:      Isolate this run's scratch root (THR: verify on a throwaway).
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    // What:     `let dir = std::env::temp_dir().join(format!("mp_engine_{nanos}"));`. The
    //           Source Root to open and watch.
    // Why:      A real directory the OS watcher can observe.
    let dir = std::env::temp_dir().join(format!("mp_engine_{nanos}"));
    // What:     `std::fs::create_dir_all(&dir).unwrap();`. Create it before opening.
    // Why:      The Source Root must exist to be scanned and watched.
    std::fs::create_dir_all(&dir).unwrap();
    // What:     `std::fs::write(dir.join("a.flac"), b"").unwrap();`. One zero-byte audio file
    //           present before the open. The scan filters by extension (`is_audio_file`), so
    //           an empty `.flac` counts as a track without needing real audio.
    // Why:      Give the initial scan exactly one track to report.
    std::fs::write(dir.join("a.flac"), b"").unwrap();

    // What:     `let (tx, rx) = mpsc::channel::<usize>();`. A channel of queue lengths.
    // Why:      The engine's update callback runs on the worker thread; it forwards each
    //           `Update::Queue`'s length so the test thread can await specific lengths.
    let (tx, rx) = mpsc::channel::<usize>();
    // What:     `let engine = Engine::spawn(move |update| { ... });`. Start the worker with a
    //           callback that forwards only `Update::Queue` lengths and drops other updates.
    // Why:      Exercise the real `Engine` (which wires the watcher in `run`), not a stub.
    let engine = Engine::spawn(move |update| {
        // What:     `if let Update::Queue(paths) = update { let _ = tx.send(paths.len()); }`.
        //           Forward the count for queue updates; ignore everything else. `let _ =`
        //           drops the send error that occurs only after the test thread is gone.
        // Why:      The test asserts on queue size, not on now-playing/position updates.
        if let Update::Queue(paths) = update {
            let _ = tx.send(paths.len());
        }
    });

    // What:     `engine.send(Command::OpenRoot { root: dir.clone(), select: None, play: false });`.
    //           Open the directory as the Source Root. The handler scans it (emitting
    //           `Update::Queue`) AND arms the watcher on it.
    // Why:      Establish the watched root; the resulting `Queue(1)` also confirms the watch
    //           is armed (the handler watches before it emits).
    engine.send(Command::OpenRoot {
        root: dir.clone(),
        select: None,
        play: false,
    });

    // What:     `const WAIT_SECS: u64 = 10;`. The bounded wait for each expected update. The
    //           debounce window is 500ms; ten seconds is generous slack for OS event
    //           delivery under load.
    // Why:      A fixed, comfortable upper bound keeps the test reliable without hanging.
    const WAIT_SECS: u64 = 10;
    // What:     `assert!(wait_for_len(&rx, 1, WAIT_SECS), ...)`. The open scan must report one
    //           track. Receiving it also proves the watcher is now armed on the root.
    // Why:      Gate the second phase on the watch being live, avoiding a create-before-arm
    //           race.
    assert!(
        wait_for_len(&rx, 1, WAIT_SECS),
        "expected Queue(1) after opening a root with one audio file"
    );

    // What:     `std::fs::write(dir.join("b.flac"), b"").unwrap();`. Add a second audio file
    //           to the watched root.
    // Why:      This on-disk change is what the watcher must turn into a live `Rescan`.
    std::fs::write(dir.join("b.flac"), b"").unwrap();
    // What:     `assert!(wait_for_len(&rx, 2, WAIT_SECS), ...)`. A `Queue(2)` update must
    //           arrive without any further command from the test: watcher -> Rescan ->
    //           re-derived queue -> emit.
    // Why:      This is the seam under test; only an end-to-end pass proves the parked worker
    //           woke and re-scanned.
    assert!(
        wait_for_len(&rx, 2, WAIT_SECS),
        "expected Queue(2) after a file appeared in the watched root (live rescan seam)"
    );

    // What:     `drop(engine);` then `std::fs::remove_dir_all(&dir).ok();`. Stop the worker
    //           (its `Drop` sends `Quit`, unparks, and joins) and remove the scratch root.
    // Why:      Tear down the watcher and audio output and leave no test droppings.
    drop(engine);
    std::fs::remove_dir_all(&dir).ok();
}
