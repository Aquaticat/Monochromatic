// What:     Unit tests for `queue.rs`, pulled in by
//           `#[cfg(test)] #[path = "queue_tests.rs"] mod tests;` at
//           the bottom of `queue.rs`. Compiles only under
//           `cargo nextest run` / `cargo test`; reaches the module items
//           (including private ones) via `use super::*` because this file is
//           the `tests` CHILD of queue.
// Why:      Keep the tests beside the code without inflating
//           `queue.rs` or its max-lines budget (sibling
//           `*_tests.rs` files are exempt from the linter).
// TS map:   `queue.unit.test.ts` beside `queue.ts`.

// What:     `use super::*;` imports everything from the parent module (the
//           queue) into the test scope, including the `ShuffleMode` it imports.
// Why:      Tests need `Queue`, `ShuffleMode`, etc.
// TS map:   `import * as parent from "./queue";`
use super::*;

// What:     `fn paths(n: usize) -> Vec<PathBuf>` test helper building `n`
//           fake ROOT-LEVEL paths "0".."n-1" (no folder, so they share one
//           `#` letter page).
// Why:      For tests where the page split does not matter, only the count.
// TS map:   `function paths(n: number): string[]`.
fn paths(n: usize) -> Vec<PathBuf> {
    // What:     `(0..n).map(|i| PathBuf::from(i.to_string())).collect()`.
    //           `i.to_string()` allocates a `String`; `PathBuf::from` wraps it.
    //           Tail expression.
    // Why:      Distinct dummy paths with no folder.
    // TS map:   `return [...Array(n).keys()].map(i => String(i));`
    (0..n).map(|i| PathBuf::from(i.to_string())).collect()
}

// What:     `fn track_paths(list: &[&str]) -> Vec<PathBuf>` test helper turning
//           string literals (often with folders like "A/1.flac") into owned
//           paths.
// Why:      Page-confinement tests need real folder structure.
// TS map:   `function trackPaths(list: string[]): string[]`.
fn track_paths(list: &[&str]) -> Vec<PathBuf> {
    // What:     `list.iter().map(|s| PathBuf::from(*s)).collect()`. `|s|` is a
    //           `&&str`; `*s` derefs it to `&str`; `PathBuf::from` wraps it.
    //           Tail expression.
    // Why:      Build the owned path vector preserving folders.
    // TS map:   `return [...list];`
    list.iter().map(|s| PathBuf::from(*s)).collect()
}

// What:     `#[test]` marks the next function as a test case.
// Why:      `cargo test` discovers and runs it.
// TS map:   `test("empty queue ...", () => { ... })`.
#[test]
fn empty_queue_has_no_current_and_advance_is_none() {
    // What:     `let mut q = Queue::with_rng_seed(1);` a mutable, seeded queue.
    // Why:      Deterministic; we will call mutating methods.
    // TS map:   `const q = Queue.withRngSeed(1n);`
    let mut q = Queue::with_rng_seed(1);
    // What:     `assert_eq!(a, b)` panics (failing the test) unless `a == b`.
    // Why:      Empty queue: no current index.
    // TS map:   `expect(q.currentIndex()).toBe(null);`
    assert_eq!(q.current_index(), None);
    // What:     advancing an empty queue yields None.
    // Why:      Nothing to play.
    // TS map:   `expect(q.advance(false)).toBe(null);`
    assert_eq!(q.advance(false), None);
    // What:     `assert!(cond)` fails unless `cond` is true.
    // Why:      Confirm emptiness.
    // TS map:   `expect(q.isEmpty()).toBe(true);`
    assert!(q.is_empty());
}

#[test]
fn set_tracks_starts_at_first() {
    let mut q = Queue::with_rng_seed(1);
    // What:     load 3 tracks.
    // Why:      Set up a non-empty queue.
    // TS map:   `q.setTracks(paths(3));`
    q.set_tracks(paths(3));
    // What:     `Some(0)` is the expected current index.
    // Why:      Playback begins at the first track.
    // TS map:   `expect(q.currentIndex()).toBe(0);`
    assert_eq!(q.current_index(), Some(0));
    // What:     length is 3.
    // Why:      All tracks loaded.
    // TS map:   `expect(q.len()).toBe(3);`
    assert_eq!(q.len(), 3);
}

#[test]
fn advance_loops_within_scope_when_repeat_track_off() {
    let mut q = Queue::with_rng_seed(1);
    q.set_tracks(paths(3));
    // What:     natural=false (user pressed Next). Bare names share one `#`
    //           page, so the scope is all three; advance walks 1, 2, then
    //           WRAPS to 0 (no stop-at-end mode any more), then 1.
    // Why:      Off scope loops within the page once exhausted.
    // TS map:   `expect(q.advance(false)).toBe(1);` etc.
    assert_eq!(q.advance(false), Some(1));
    assert_eq!(q.advance(false), Some(2));
    assert_eq!(q.advance(false), Some(0));
    assert_eq!(q.advance(false), Some(1));
}

#[test]
fn repeat_track_replays_on_natural_end_only() {
    let mut q = Queue::with_rng_seed(1);
    q.set_tracks(paths(3));
    // What:     turn "repeat track" on.
    // Why:      A natural end should replay the same track.
    // TS map:   `q.setRepeatTrack(true);`
    q.set_repeat_track(true);
    // What:     natural=true: the track replays itself (stays 0).
    // Why:      Repeat-track semantics.
    // TS map:   `expect(q.advance(true)).toBe(0);`
    assert_eq!(q.advance(true), Some(0));
    // What:     natural=false: the user pressing Next still advances to 1.
    // Why:      Repeat-track must not trap the user on one track.
    // TS map:   `expect(q.advance(false)).toBe(1);`
    assert_eq!(q.advance(false), Some(1));
}

#[test]
fn prev_steps_back_then_wraps_to_last() {
    let mut q = Queue::with_rng_seed(1);
    q.set_tracks(paths(3));
    // What:     move forward to index 1, then back to 0.
    // Why:      Backward stepping.
    // TS map:   advance then prev.
    assert_eq!(q.advance(false), Some(1));
    assert_eq!(q.prev(), Some(0));
    // What:     prev at the start of the scope wraps to the last (index 2).
    // Why:      The scope always loops; there is no stop.
    // TS map:   `expect(q.prev()).toBe(2);`
    assert_eq!(q.prev(), Some(2));
}

#[test]
fn play_index_selects_track() {
    let mut q = Queue::with_rng_seed(1);
    q.set_tracks(paths(5));
    // What:     jump to track 3.
    // Why:      Clicking a row.
    // TS map:   `expect(q.playIndex(3)).toBe(3);`
    assert_eq!(q.play_index(3), Some(3));
    assert_eq!(q.current_index(), Some(3));
    // What:     out-of-range click returns None and does not move.
    // Why:      Robustness.
    // TS map:   `expect(q.playIndex(99)).toBe(null);`
    assert_eq!(q.play_index(99), None);
    assert_eq!(q.current_index(), Some(3));
}

#[test]
fn shuffle_all_keeps_current_track_and_covers_all() {
    let mut q = Queue::with_rng_seed(12345);
    q.set_tracks(paths(6));
    // What:     advance to track 2, then enable shuffle-all.
    // Why:      Toggling shuffle must keep track 2 current.
    // TS map:   advance twice, setShuffle("all").
    assert_eq!(q.advance(false), Some(1));
    assert_eq!(q.advance(false), Some(2));
    q.set_shuffle(ShuffleMode::All);
    // What:     after shuffling, the current track is still 2.
    // Why:      The contract of set_shuffle.
    // TS map:   `expect(q.currentIndex()).toBe(2);`
    assert_eq!(q.current_index(), Some(2));
    // What:     `let mut seen = std::collections::HashSet::new();` an owned
    //           hash set of usize. `HashSet` is the unordered unique-set type.
    // Why:      Track which indices we have visited.
    // TS map:   `const seen = new Set<number>();`
    let mut seen = std::collections::HashSet::new();
    // What:     `seen.insert(2);` record the current track first.
    // Why:      The current track is not re-emitted until we advance.
    // TS map:   `seen.add(2);`
    seen.insert(2);
    // What:     a counter loop bounded by the queue length.
    // Why:      One full loop of the scope visits every track.
    // TS map:   `for (let i = 0; i < 6; i++) { ... }`
    for _ in 0..6 {
        // What:     `if let Some(t) = q.advance(false) { seen.insert(t); }`
        //           advance and record.
        // Why:      Walk the shuffled order (it wraps and keeps looping).
        // TS map:   `const t = q.advance(false); if (t !== null) seen.add(t);`
        if let Some(t) = q.advance(false) {
            seen.insert(t);
        }
    }
    // What:     `seen.len()` should be 6 (all tracks seen).
    // Why:      Proves shuffle-all spans the whole queue.
    // TS map:   `expect(seen.size).toBe(6);`
    assert_eq!(seen.len(), 6);
}

#[test]
fn turning_shuffle_off_restores_load_order() {
    let mut q = Queue::with_rng_seed(999);
    q.set_tracks(paths(4));
    // What:     shuffle everything, then turn shuffle back off.
    // Why:      Order should return to 0,1,2,3 traversal within the page.
    // TS map:   `q.setShuffle("all"); q.setShuffle("off");`
    q.set_shuffle(ShuffleMode::All);
    q.set_shuffle(ShuffleMode::Off);
    // What:     starting from current (0), advancing gives 1,2,3 in order.
    // Why:      Confirm identity order restored (bare names form one page).
    // TS map:   advance() === 1, 2, 3.
    assert_eq!(q.current_index(), Some(0));
    assert_eq!(q.advance(false), Some(1));
    assert_eq!(q.advance(false), Some(2));
    assert_eq!(q.advance(false), Some(3));
}

// What:     `#[test]` page-confinement under shuffle Off.
// Why:      Off must stay inside the current TOP-LEVEL folder page and loop it,
//           never crossing to another folder.
// TS map:   `test("shuffle off confines to folder", () => { ... })`.
#[test]
fn shuffle_off_confines_to_top_folder_page() {
    let mut q = Queue::with_rng_seed(1);
    // What:     two tracks under folder A (indices 0,1) and one under B (index 2).
    // Why:      Distinct pages A and B.
    // TS map:   `q.setTracks(["A/1.flac","A/2.flac","B/3.flac"]);`
    q.set_tracks(track_paths(&["A/1.flac", "A/2.flac", "B/3.flac"]));
    // What:     current starts at 0 (page A). advance stays in A: 1, then wraps
    //           to 0 (NOT 2), then 1 again.
    // Why:      Off loops the A page and never reaches the B track.
    // TS map:   advance() === 1, 0, 1.
    assert_eq!(q.current_index(), Some(0));
    assert_eq!(q.advance(false), Some(1));
    assert_eq!(q.advance(false), Some(0));
    assert_eq!(q.advance(false), Some(1));
}

// What:     `#[test]` within-page shuffle covers only the current page.
// Why:      WithinPage shuffles the page's tracks but never escapes it.
// TS map:   `test("within page shuffle stays on page", () => { ... })`.
#[test]
fn shuffle_within_page_covers_only_current_page() {
    let mut q = Queue::with_rng_seed(777);
    // What:     three tracks in A (0,1,2) and one in B (3).
    // Why:      A page of size 3 plus a separate B page.
    // TS map:   `q.setTracks(["A/1","A/2","A/3","B/4"]);`
    q.set_tracks(track_paths(&["A/1.flac", "A/2.flac", "A/3.flac", "B/4.flac"]));
    // What:     enable within-page shuffle (anchored on current track 0, in A).
    // Why:      Scope becomes a shuffle of {0,1,2}.
    // TS map:   `q.setShuffle("withinPage");`
    q.set_shuffle(ShuffleMode::WithinPage);
    assert_eq!(q.current_index(), Some(0));
    // What:     `let mut seen = std::collections::HashSet::new();`. Visited set.
    // Why:      Confirm the page's three tracks are covered and 3 never is.
    // TS map:   `const seen = new Set<number>();`
    let mut seen = std::collections::HashSet::new();
    // What:     seed with the current track, then advance three times.
    // Why:      A 3-element scope is fully covered by wrapping advances.
    // TS map:   `seen.add(q.currentIndex()); for (3) seen.add(q.advance(false));`
    seen.insert(q.current_index().unwrap());
    for _ in 0..3 {
        seen.insert(q.advance(false).unwrap());
    }
    // What:     `assert!(!seen.contains(&3));`. The B track (index 3) is never
    //           played. `&3` borrows the literal for the lookup.
    // Why:      WithinPage must not cross to the B page.
    // TS map:   `expect(seen.has(3)).toBe(false);`
    assert!(!seen.contains(&3));
    // What:     all three A indices were seen.
    // Why:      The page is fully covered.
    // TS map:   `expect(seen.size).toBe(3);`
    assert_eq!(seen.len(), 3);
}

// What:     `#[test]` shuffle-all crosses page boundaries.
// Why:      All must span every page, unlike Off/WithinPage.
// TS map:   `test("shuffle all crosses pages", () => { ... })`.
#[test]
fn shuffle_all_crosses_pages() {
    let mut q = Queue::with_rng_seed(55);
    // What:     two tracks in A (0,1) and one in B (2).
    // Why:      Two pages to span.
    // TS map:   `q.setTracks(["A/1","A/2","B/3"]);`
    q.set_tracks(track_paths(&["A/1.flac", "A/2.flac", "B/3.flac"]));
    // What:     shuffle the whole queue.
    // Why:      Scope is all three across both pages.
    // TS map:   `q.setShuffle("all");`
    q.set_shuffle(ShuffleMode::All);
    // What:     collect the current track plus three advances.
    // Why:      A 3-element scope is fully covered by wrapping advances.
    // TS map:   `const seen = new Set(); seen.add(cur); for (3) seen.add(advance);`
    let mut seen = std::collections::HashSet::new();
    seen.insert(q.current_index().unwrap());
    for _ in 0..3 {
        seen.insert(q.advance(false).unwrap());
    }
    // What:     all of {0,1,2} seen, including the B track.
    // Why:      Proves All ignores page boundaries.
    // TS map:   `expect(seen.size).toBe(3);`
    assert_eq!(seen.len(), 3);
    assert!(seen.contains(&2));
}

// What:     `#[test]` clicking a track on another page switches the scope.
// Why:      play_index must rebuild the scope around the clicked track's page.
// TS map:   `test("play_index switches page", () => { ... })`.
#[test]
fn play_index_switches_page_scope() {
    let mut q = Queue::with_rng_seed(1);
    // What:     two tracks in A (0,1) and one in B (2). Start on A.
    // Why:      Click into the B page and confirm playback confines there.
    // TS map:   `q.setTracks(["A/1","A/2","B/3"]);`
    q.set_tracks(track_paths(&["A/1.flac", "A/2.flac", "B/3.flac"]));
    // What:     jump to the B track (index 2).
    // Why:      Switch scope to page B.
    // TS map:   `q.playIndex(2);`
    assert_eq!(q.play_index(2), Some(2));
    assert_eq!(q.current_index(), Some(2));
    // What:     B has only one track, so advance wraps back to 2, never to A.
    // Why:      Off confines to the (now B) page.
    // TS map:   `expect(q.advance(false)).toBe(2);`
    assert_eq!(q.advance(false), Some(2));
    assert_eq!(q.advance(false), Some(2));
}

// What:     `#[test]` `display_paths` must hand the UI paths relative to the
//           common root, not bare filenames, so pagination can group by folder.
// Why:      Same source of truth the scope and the UI tabs both rely on.
// TS map:   `test("display_paths ...", () => { ... })`.
#[test]
fn display_paths_strips_common_prefix() {
    // What:     `let mut q = Queue::with_rng_seed(1);`. A deterministic queue.
    // Why:      We load real-looking paths and read the display list back.
    // TS map:   `const q = Queue.withRngSeed(1n);`
    let mut q = Queue::with_rng_seed(1);
    // What:     `q.set_tracks(vec![PathBuf::from("..."), ...]);`. Load two tracks
    //           in different artist folders under a shared `/music` root.
    //           `vec![...]` builds the vector; `PathBuf::from(s)` wraps each
    //           `&str` as an owned path (MOVING the vector into the queue).
    // Why:      Their only shared prefix is `/music`.
    // TS map:   `q.setTracks(["/music/A/Alb/01.flac", "/music/B/Alb/01.flac"]);`
    q.set_tracks(vec![
        PathBuf::from("/music/A/Alb/01.flac"),
        PathBuf::from("/music/B/Alb/01.flac"),
    ]);
    // What:     `assert_eq!(q.display_paths(), vec!["A/Alb/01.flac".to_string(), ...]);`.
    //           `.to_string()` makes each expected literal an owned `String` to
    //           match the `Vec<String>` returned. `assert_eq!` fails unless equal.
    // Why:      `/music` is stripped; the relative folders survive, in order.
    // TS map:   `expect(q.displayPaths()).toEqual(["A/Alb/01.flac", "B/Alb/01.flac"]);`
    assert_eq!(
        q.display_paths(),
        vec!["A/Alb/01.flac".to_string(), "B/Alb/01.flac".to_string()]
    );
}

// What:     `#[test]` clearing the selection deselects without losing the tracks.
// Why:      Opening a library auto-selects nothing; the queue must report no current track
//           yet still hold every track for the UI list, and selection must work afterward.
// TS map:   `test("clear selection deselects but keeps tracks", () => { ... })`.
#[test]
fn clear_selection_deselects_but_keeps_tracks() {
    // What:     `let mut q = Queue::with_rng_seed(1);` a mutable, seeded queue.
    // Why:      Deterministic; we call mutating methods.
    // TS map:   `const q = Queue.withRngSeed(1n);`
    let mut q = Queue::with_rng_seed(1);
    // What:     load 3 tracks (which anchors the cursor on track 0).
    // Why:      Set up a non-empty queue with a selection to clear.
    // TS map:   `q.setTracks(paths(3));`
    q.set_tracks(paths(3));
    // What:     `Some(0)` is the current index after loading.
    // Why:      Confirm the pre-clear state so the clear is meaningful.
    // TS map:   `expect(q.currentIndex()).toBe(0);`
    assert_eq!(q.current_index(), Some(0));
    // What:     `q.clear_selection();` drops the cursor and scope.
    // Why:      The behaviour under test (a normal open auto-selects nothing).
    // TS map:   `q.clearSelection();`
    q.clear_selection();
    // What:     `None` is the current index after clearing.
    // Why:      Nothing is auto-selected once cleared.
    // TS map:   `expect(q.currentIndex()).toBe(null);`
    assert_eq!(q.current_index(), None);
    // What:     length is still 3.
    // Why:      The tracks survive the clear; only the selection is gone.
    // TS map:   `expect(q.len()).toBe(3);`
    assert_eq!(q.len(), 3);
    // What:     advancing with no cursor yields None.
    // Why:      Next / auto-advance must not invent a track when nothing is selected.
    // TS map:   `expect(q.advance(false)).toBe(null);`
    assert_eq!(q.advance(false), None);
    // What:     `Some(2)` is returned when tapping track 2.
    // Why:      Selection works after a clear (rebuilds the scope around the tapped track).
    // TS map:   `expect(q.playIndex(2)).toBe(2);`
    assert_eq!(q.play_index(2), Some(2));
    // What:     `Some(2)` is the current index after the tap.
    // Why:      Confirm the cursor moved to the tapped track.
    // TS map:   `expect(q.currentIndex()).toBe(2);`
    assert_eq!(q.current_index(), Some(2));
}
