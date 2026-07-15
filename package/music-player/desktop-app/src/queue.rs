//! The play queue: an ordered list of tracks plus a cursor, with shuffle and
//! "repeat track" behaviour. Pure logic, no audio, no I/O, so it is fully
//! unit-tested.
//!
//! Playback has a SCOPE that it loops over, chosen by the shuffle mode:
//!
//! - `ShuffleMode::Off` and `ShuffleMode::WithinPage` confine playback to the
//!   current track's PAGE (its top-level folder under the loaded root, or its
//!   A-Z/`#` letter bucket for a root-level track; the same grouping the UI tabs
//!   use, computed by the `pagination` module). `Off` plays the page in load
//!   order; `WithinPage` shuffles the page. Either way, reaching the end of the
//!   page loops back to its start.
//! - `ShuffleMode::All` scopes playback to the whole queue, shuffled, and loops
//!   the whole queue.
//!
//! Shuffle is JUST IN TIME and WITHOUT REPLACEMENT: there is no precomputed
//! permutation. Each cycle plays every track in the scope once, in a random order
//! chosen one pick at a time, then starts a fresh cycle. `order` doubles as the
//! play history, so `prev` steps back through it and a `next` after `prev`
//! retraces forward before drawing a new random pick. See
//! `doc/decision/music-player-jit-shuffle.md`.
//!
//! "Repeat track" is independent: when on, a track that ends NATURALLY replays
//! itself; a manual Next/Prev still moves within the scope.
//!
//! Design decision (deliberate): because `Off`/`WithinPage` are page-confined
//! and always loop the page, there is no way to play the whole queue in load
//! order and loop the whole queue (non-shuffle + repeat-all). When not
//! shuffling, the user stays inside the current folder/page on purpose.

/// What:     `use std::path::PathBuf;` imports the OWNED filesystem-path type
///           (heap-allocated, growable). Sibling: `&Path`, a borrowed view.
/// Why:      The queue stores the actual file paths it will hand to the decoder.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type PathBuf = string;
/// ```
use std::path::PathBuf;

/// What:     `use std::collections::HashSet;` the hash-set type.
/// Why:      The just-in-time shuffle pick excludes tracks already played this cycle; a set
///           gives O(1) membership over a possibly large (whole-queue) scope.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // const played = new Set<number>();
/// ```
use std::collections::HashSet;

/// What:     `use crate::command::ShuffleMode;` imports our own enum from the sibling
///           module. `crate::` means "from the root of this package".
/// Why:      The queue's scope and ordering depend on the shuffle mode.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { ShuffleMode } from "./command";
/// ```
use crate::command::ShuffleMode;

/// What:     `pub struct Queue { ... }` declares a public record type with named fields.
///           The fields are private (no `pub`), so only this module can touch them
///           directly.
/// Why:      Bundles the queue's state behind methods that keep it consistent.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class Queue {
///   private tracks: string[];
///   private order: number[];
///   private pos: number | null;
///   private shuffle: ShuffleMode;
///   private repeatTrack: boolean;
///   private rngState: bigint;
/// }
/// ```
pub struct Queue {
    /// What:     `tracks: Vec<PathBuf>`. An OWNED, growable array of owned paths. Sibling:
    ///           `&[PathBuf]`, a borrowed slice that owns nothing.
    /// Why:      The tracks in the order the user loaded them; the displayed queue list
    ///           uses this order.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// private tracks: string[];
    /// ```
    tracks: Vec<PathBuf>,
    /// What:     `order: Vec<usize>`. A growable array of indices into `tracks`. `usize` is
    ///           the pointer-sized unsigned int used for indexing (siblings: `u32`, `u64`).
    /// Why:      The CURRENT SCOPE's playback order: the load-order indices of the tracks
    ///           playback walks right now (the current page for Off/WithinPage, or the whole
    ///           queue for All), sequential or shuffled.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// private order: number[];
    /// ```
    order: Vec<usize>,
    /// What:     `pos: Option<usize>`. "maybe an index": `Some(p)` or `None`.
    /// Why:      The cursor's position WITHIN `order`. `None` means the queue is empty /
    ///           nothing selected.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// private pos: number | null;
    /// ```
    pos: Option<usize>,
    /// What:     `shuffle: ShuffleMode`. The three-state shuffle/scope setting (Off /
    ///           WithinPage / All). `ShuffleMode` is `Copy`.
    /// Why:      Decides both the scope (page vs whole queue) and the ordering (sequential
    ///           vs shuffled).
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// private shuffle: ShuffleMode;
    /// ```
    shuffle: ShuffleMode,
    /// What:     `repeat_track: bool`. When true, a track that ends naturally replays
    ///           itself.
    /// Why:      The "repeat track" checkbox; independent of the shuffle scope.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// private repeatTrack: boolean;
    /// ```
    repeat_track: bool,
    /// What:     `rng_state: u64`. An unsigned 64-bit integer (siblings: `u32`, `usize`,
    ///           `i64`). Used as the running state of a tiny PRNG.
    /// Why:      Shuffling needs randomness; a self-contained PRNG avoids a dependency and
    ///           stays seedable for deterministic tests.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// private rngState: bigint;
    /// ```
    rng_state: u64,
    /// What:     `cycle_start: usize`. An index into `order` marking where the current shuffle
    ///           CYCLE began (a cycle plays every scope track once before repeating). Only
    ///           meaningful in the shuffle modes; `0` and unused for `Off`.
    /// Why:      The just-in-time without-replacement pick excludes tracks played since this
    ///           point; when the scope is exhausted, `cycle_start` jumps forward to start a new
    ///           cycle. `order[cycle_start..]` is "played this cycle".
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// private cycleStart: number;
    /// ```
    cycle_start: usize,
}

/// What:     `impl Queue { ... }`. The queue's methods (an `impl` block holds a type's
///           behaviour).
/// Why:      Group the queue's operations with its state.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class Queue { /* methods */ }
/// ```
impl Queue {
    /// What:     `pub fn new() -> Queue` is the public constructor. `-> Queue` is the return
    ///           type.
    /// Why:      Creates an empty queue seeded from the clock so first-run shuffles differ
    ///           between launches.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// static new(): Queue { return new Queue(seedFromClock()); }
    /// ```
    pub fn new() -> Queue {
        // What:     `let seed = std::time::SystemTime::now().duration_since(UNIX_EPOCH).map(...).unwrap_or(...);`.
        //           `SystemTime::now()` is the wall clock; the chain turns "now" into a
        //           64-bit seed (see each combinator below).
        // Why:      We derive a changing seed from the current time.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const seed = BigInt(Date.now());
        // ```
        let seed = std::time::SystemTime::now()
            // What:     `.duration_since(std::time::UNIX_EPOCH)` returns `Result<Duration, _>`
            //           (Ok with the elapsed time since 1970, or Err if the clock is before
            //           1970).
            // Why:      Turns "now" into "nanoseconds since 1970".
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // // Date.now() is already ms since 1970
            // ```
            .duration_since(std::time::UNIX_EPOCH)
            // What:     `.map(|d| d.as_nanos() as u64)` transforms the Ok value if present.
            //           `|d| ...` is a closure taking the `Duration` `d`. `d.as_nanos()` is a
            //           `u128`; `as u64` truncates it to 64 bits.
            // Why:      We only need 64 bits of entropy for the PRNG seed.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // // ...mapped to a 64-bit number
            // ```
            .map(|d| d.as_nanos() as u64)
            // What:     `.unwrap_or(0x9e3779b97f4a7c15)` extracts the Ok number, or
            //           substitutes this constant (a well-known mixing constant) if the
            //           clock was weird. `_or` DROPS the error.
            // Why:      A non-zero fallback seed; xorshift must never start at 0.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // // ?? 0x9e3779b97f4a7c15n
            // ```
            .unwrap_or(0x9e3779b97f4a7c15);
        // What:     `Queue::with_rng_seed(seed)` calls the seeded constructor. No trailing
        //           `;`, so it is the tail expression / return.
        // Why:      Share construction logic with the test constructor.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return Queue.withRngSeed(seed);
        // ```
        Queue::with_rng_seed(seed)
    }

    /// What:     `pub fn with_rng_seed(seed: u64) -> Queue` builds a queue with a
    ///           caller-chosen PRNG seed.
    /// Why:      Tests pass a fixed seed to get a deterministic shuffle.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// static withRngSeed(seed: bigint): Queue { ... }
    /// ```
    pub fn with_rng_seed(seed: u64) -> Queue {
        // What:     `Queue { ... }`. A struct literal constructs the record. `Vec::new()`
        //           makes an empty owned array; `None` is the empty `Option`.
        //           `ShuffleMode::Off` is the path-qualified variant. No `;`, so this is the
        //           return value.
        // Why:      Start empty, not shuffled, repeat-track off.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { tracks: [], order: [], pos: null, shuffle: "off",
        //          repeatTrack: false, rngState: seed === 0n ? 1n : seed };
        // ```
        Queue {
            tracks: Vec::new(),
            order: Vec::new(),
            pos: None,
            shuffle: ShuffleMode::Off,
            repeat_track: false,
            // What:     `rng_state: if seed == 0 { 1 } else { seed }`. An `if/else`
            //           EXPRESSION that evaluates to one of the two branch values (no `;`).
            // Why:      xorshift gets stuck forever at state 0, so forbid it.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // rngState: seed === 0n ? 1n : seed,
            // ```
            rng_state: if seed == 0 { 1 } else { seed },
            // What:     `cycle_start: 0`. No shuffle cycle has begun yet.
            // Why:      Set properly by `rebuild_scope_order` the first time a shuffle scope is
            //           anchored.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // cycleStart: 0,
            // ```
            cycle_start: 0,
        }
    }

    /// What:     `fn next_rand(&mut self) -> u64`. `&mut self` is a MUTABLE borrow of the
    ///           queue: the method may change `self`'s fields but does not own/consume it.
    ///           Private (no `pub`).
    /// Why:      Advances and returns the PRNG state (xorshift64).
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// private nextRand(): bigint { /* xorshift on this.rngState */ }
    /// ```
    fn next_rand(&mut self) -> u64 {
        // What:     `let mut x = self.rng_state;` binds a LOCAL MUTABLE copy. `mut` marks
        //           it reassignable; without it, bindings are read-only by default.
        // Why:      We mutate a local then store it back, the classic xorshift.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let x = this.rngState;
        // ```
        let mut x = self.rng_state;
        // What:     `x ^= x << 13;` is xor-assign with a left-shift. `^` is bitwise XOR,
        //           `<<` is bitwise left shift. On `u64` these are plain wrapping bit ops
        //           (no overflow concept for shifts).
        // Why:      One of the three xorshift mixing steps.
        // Gotcha:   `<<` on a 64-bit Rust int wraps within 64 bits; in TS you must mask
        //           with `BigInt.asUintN(64, ...)` to match.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // x = BigInt.asUintN(64, x ^ (x << 13n));
        // ```
        x ^= x << 13;
        // What:     `x ^= x >> 7;` xor-assign with a right shift.
        // Why:      Second xorshift step.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // x = BigInt.asUintN(64, x ^ (x >> 7n));
        // ```
        x ^= x >> 7;
        // What:     `x ^= x << 17;` xor-assign with a left shift.
        // Why:      Third xorshift step.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // x = BigInt.asUintN(64, x ^ (x << 17n));
        // ```
        x ^= x << 17;
        // What:     `self.rng_state = x;` writes the new state back through the mutable
        //           borrow.
        // Why:      Persist the PRNG progress for the next call.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.rngState = x;
        // ```
        self.rng_state = x;
        // What:     `x` alone on the last line is the tail expression: its value is returned.
        // Why:      Caller uses the fresh random number.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return x;
        // ```
        x
    }

    /// Number of tracks in the queue.
    // What:     `pub fn len(&self) -> usize`. `&self` is a read-only (shared) borrow; the
    //           method cannot mutate the queue.
    // Why:      Callers ask how many tracks there are.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // get length(): number { return this.tracks.length; }
    // ```
    pub fn len(&self) -> usize {
        // What:     `self.tracks.len()` returns the array length as `usize`. Tail expression
        //           -> return value.
        // Why:      Report the count.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.tracks.length;
        // ```
        self.tracks.len()
    }

    /// Tracks in load order (as opened), regardless of shuffle.
    // What:     `pub fn tracks(&self) -> &[PathBuf]`. Returns a BORROWED slice (`&[PathBuf]`,
    //           sibling of the owned `Vec<PathBuf>`) of the load-order paths. Read-only
    //           borrow; the caller may not mutate them.
    // Why:      The session save needs the queue's file paths to persist.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // get tracks(): readonly string[] { return this.tracks; }
    // ```
    pub fn tracks(&self) -> &[PathBuf] {
        // What:     `&self.tracks` borrows the `Vec` as a slice (the `Vec` derefs to
        //           `&[PathBuf]`). Tail expression -> return value.
        // Why:      Hand out a read-only view of the paths.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.tracks;
        // ```
        &self.tracks
    }

    /// Whether the queue has no tracks.
    // What:     `pub fn is_empty(&self) -> bool`. Read-only borrow.
    // Why:      Convenience predicate; clippy also prefers this beside `len`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // get isEmpty(): boolean { return this.tracks.length === 0; }
    // ```
    pub fn is_empty(&self) -> bool {
        // What:     `self.tracks.is_empty()` -> bool. Tail expression.
        // Why:      Report emptiness.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.tracks.length === 0;
        // ```
        self.tracks.is_empty()
    }

    /// Whether "repeat track" is on.
    // What:     `pub fn repeat_track(&self) -> bool`. Read-only borrow.
    // Why:      The engine mirrors this flag to the UI checkbox.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // repeatTrack(): boolean { return this.repeatTrack; }
    // ```
    pub fn repeat_track(&self) -> bool {
        // What:     `self.repeat_track` reads the `Copy` bool. Tail expression.
        // Why:      Expose the flag.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.repeatTrack;
        // ```
        self.repeat_track
    }

    /// Current shuffle mode.
    // What:     `pub fn shuffle_mode(&self) -> ShuffleMode`. Read-only borrow.
    // Why:      The engine mirrors the mode to the UI radio group.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // shuffleMode(): ShuffleMode { return this.shuffle; }
    // ```
    pub fn shuffle_mode(&self) -> ShuffleMode {
        // What:     `self.shuffle` reads the `Copy` enum out. Tail expression.
        // Why:      Expose the mode.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.shuffle;
        // ```
        self.shuffle
    }

    /// What:     `pub fn display_paths(&self) -> Vec<String>` returns owned display strings
    ///           in load order: each track's path relative to the queue's common root (e.g.
    ///           `Artist/Album/01.flac`, or just `01.flac` when the whole queue is one
    ///           folder).
    /// Why:      The UI shows the folder a track lives in, not just its filename, so
    ///           pagination can group by folder; the absolute prefix is stripped.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// displayPaths(): string[] { return relativeDisplayPaths(this.tracks); }
    /// ```
    pub fn display_paths(&self) -> Vec<String> {
        // What:     `crate::relpath::relative_display_paths(&self.tracks)`. Call the pure
        //           path helper. `crate::` means "from this package's root"; `&self.tracks`
        //           lends the `Vec<PathBuf>` (which coerces to the `&[PathBuf]` slice the
        //           helper takes) read-only. Tail expression -> return.
        // Why:      One source of truth for the common-prefix stripping, reused and
        //           unit-tested in the `relpath` module.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return relativeDisplayPaths(this.tracks);
        // ```
        crate::relpath::relative_display_paths(&self.tracks)
    }

    /// What:     `pub fn current_index(&self) -> Option<usize>` returns the LOAD-ORDER index
    ///           of the current track (into `tracks`), or None.
    /// Why:      The UI highlights this row; NowPlaying carries it.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// currentIndex(): number | null {
    ///   return this.pos === null ? null : this.order[this.pos];
    /// }
    /// ```
    pub fn current_index(&self) -> Option<usize> {
        // What:     `self.pos.map(|p| self.order[p])`. `self.pos` is `Option<usize>`;
        //           `.map` runs the closure only if `Some`. `self.order[p]` indexes the
        //           scope order array. Tail -> return.
        // Why:      Translate the cursor's order-position into a track index.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.pos === null ? null : this.order[this.pos];
        // ```
        self.pos.map(|p| self.order[p])
    }

    /// What:     `pub fn current_path(&self) -> Option<&PathBuf>` returns a BORROWED
    ///           reference to the current path, or None. `&PathBuf` is a shared borrow tied
    ///           to `self`'s lifetime.
    /// Why:      The engine needs the path to open the file, without copying it.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// currentPath(): string | null {
    ///   const i = this.currentIndex();
    ///   return i === null ? null : this.tracks[i];
    /// }
    /// ```
    pub fn current_path(&self) -> Option<&PathBuf> {
        // What:     `self.current_index().map(|i| &self.tracks[i])`. `self.current_index()`
        //           gives `Option<usize>`; `.map(|i| &self.tracks[i])` borrows the element.
        //           `&` here lends the path to the caller (no ownership transfer).
        // Why:      Avoid cloning the path on every access.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const i = this.currentIndex(); return i === null ? null : this.tracks[i];
        // ```
        self.current_index().map(|i| &self.tracks[i])
    }

    /// What:     `pub fn set_repeat_track(&mut self, on: bool)` mutates state.
    /// Why:      The UI checkbox toggles "repeat track"; record the new flag.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// setRepeatTrack(on: boolean): void { this.repeatTrack = on; }
    /// ```
    pub fn set_repeat_track(&mut self, on: bool) {
        // What:     `self.repeat_track = on;`. Plain field assignment through the mutable
        //           borrow.
        // Why:      Store it; `advance` reads it on a natural end.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.repeatTrack = on;
        // ```
        self.repeat_track = on;
    }

    /// What:     `pub fn set_tracks(&mut self, tracks: Vec<PathBuf>)`. The parameter is taken
    ///           BY VALUE (ownership moves into the queue).
    /// Why:      Replacing the queue when the user opens new files.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// setTracks(tracks: string[]): void {
    ///   this.tracks = tracks;
    ///   this.rebuildScopeOrder(tracks.length ? 0 : null);
    /// }
    /// ```
    pub fn set_tracks(&mut self, tracks: Vec<PathBuf>) {
        // What:     `self.tracks = tracks;` moves the new vector in, dropping (freeing) the
        //           old one.
        // Why:      Adopt the new track list.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.tracks = tracks;
        // ```
        self.tracks = tracks;
        // What:     `self.rebuild_scope_order(Some(0));` builds the scope order around the
        //           first track. `Some(0)` wraps index 0; the helper handles the empty queue
        //           (order empty, cursor None).
        // Why:      Start playback at the first track's page (or whole queue).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.rebuildScopeOrder(0);
        // ```
        self.rebuild_scope_order(Some(0));
    }

    /// What:     `pub fn clear_selection(&mut self)`. Drop the current-track selection: after
    ///           this, no track is current and there is no playback scope until the user picks
    ///           one. `&mut self` is a MUTABLE borrow of the queue (we reassign its fields).
    /// Why:      Opening a library should auto-select NOTHING. The controller calls this after
    ///           `set_tracks` on a normal open, and the restore path calls it when the saved
    ///           session had no current track, so a fresh queue highlights and loads nothing.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// clearSelection(): void { this.rebuildScopeOrder(null); }
    /// ```
    pub fn clear_selection(&mut self) {
        // What:     `self.rebuild_scope_order(None);`. Rebuild the scope with a `None` anchor;
        //           `None` is the absent variant of `Option<usize>`, which `rebuild_scope_order`
        //           treats as "no current track" (empties `order`, sets `pos = None`).
        // Why:      Reuse the single method that owns the scope/cursor invariant instead of
        //           poking the fields here.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.rebuildScopeOrder(null);
        // ```
        self.rebuild_scope_order(None);
    }

    /// What:     `fn scope_indices(&self, anchor: usize) -> Vec<usize>` returns the
    ///           load-order indices that make up the playback scope around the `anchor`
    ///           track, in ascending load order. Private helper.
    /// Why:      `All` scopes the whole queue; `Off`/`WithinPage` scope the anchor's page
    ///           (its top-level folder / letter bucket), so playback stays inside one folder
    ///           unless shuffling everything.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// private scopeIndices(anchor: number): number[] {
    ///   if (this.shuffle === "all") return [...Array(this.tracks.length).keys()];
    ///   const pages = paginate(this.displayPaths());
    ///   const p = pageOfIndex(pages, anchor);
    ///   return p === null
    ///     ? [...Array(this.tracks.length).keys()]
    ///     : pages[p].entries.map(e => e.index);
    /// }
    /// ```
    fn scope_indices(&self, anchor: usize) -> Vec<usize> {
        // What:     `if self.shuffle == ShuffleMode::All { ... }`. `==` compares the `Copy`
        //           enum (it derives `PartialEq`).
        // Why:      `All` ignores pages: the scope is every track.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.shuffle === "all") return [...Array(this.tracks.length).keys()];
        // ```
        if self.shuffle == ShuffleMode::All {
            // What:     `(0..self.tracks.len()).collect()`. `(a..b)` is a half-open RANGE;
            //           `.collect()` gathers it into a `Vec<usize>` (the return type fixes
            //           the element type). `return` makes this the function's value.
            // Why:      Every load-order index, ascending.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return [...Array(this.tracks.length).keys()];
            // ```
            return (0..self.tracks.len()).collect();
        }
        // What:     `let names = self.display_paths();`. The relative display strings, one
        //           per track, in load order.
        // Why:      Pagination groups these into pages.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const names = this.displayPaths();
        // ```
        let names = self.display_paths();
        // What:     `let pages = crate::pagination::paginate(&names);`. Group the names into
        //           pages (the same pure function the UI tab bar uses, so the playback scope
        //           and the visible page can never drift). `&names` lends the vector.
        // Why:      We need the set of indices sharing the anchor's page.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const pages = paginate(names);
        // ```
        let pages = crate::pagination::paginate(&names);
        // What:     `match crate::pagination::page_of_index(&pages, anchor) { ... }`. Find
        //           which page holds the anchor; returns `Option<usize>`.
        // Why:      That page IS the scope.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const p = pageOfIndex(pages, anchor);
        // ```
        match crate::pagination::page_of_index(&pages, anchor) {
            // What:     `Some(p) => pages[p].entries.iter().map(|e| e.index).collect()`. Found
            //           the page at position `p`; `.entries.iter()` borrows each `PageEntry`;
            //           `.map(|e| e.index)` pulls the load-order index out; `.collect()`
            //           gathers them into a `Vec<usize>`. Entries are already in ascending
            //           load order (pagination preserves order). Tail of the arm.
            // Why:      The page's track indices form the confined scope.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return pages[p].entries.map((e) => e.index);
            // ```
            Some(p) => pages[p].entries.iter().map(|e| e.index).collect(),
            // What:     `None => (0..self.tracks.len()).collect()`. The anchor was not found
            //           on any page (only happens for an empty/invalid anchor); fall back to
            //           the whole queue.
            // Why:      Defensive: never produce an empty scope for a real track.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return [...Array(this.tracks.length).keys()];
            // ```
            None => (0..self.tracks.len()).collect(),
        }
    }

    /// What:     `fn pick_next_shuffle(&mut self, current: usize) -> usize`. Choose the next
    ///           shuffle track JUST IN TIME and WITHOUT REPLACEMENT: a uniformly random scope
    ///           track not yet played this cycle; when the cycle is exhausted, start a fresh one
    ///           (avoiding an immediate repeat of `current` unless the scope has one track).
    /// Why:      Replaces the precomputed shuffled permutation with one pick at a time, so live
    ///           queue changes need no order bookkeeping.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// private pickNextShuffle(current: number): number {
    ///   const scope = this.scopeIndices(current);
    ///   const played = new Set(this.order.slice(this.cycleStart));
    ///   let remaining = scope.filter((i) => !played.has(i));
    ///   if (remaining.length === 0) {
    ///     this.cycleStart = this.order.length;
    ///     remaining = scope.filter((i) => i !== current);
    ///     if (remaining.length === 0) remaining = scope;
    ///   }
    ///   return remaining[Number(this.nextRand() % BigInt(remaining.length))];
    /// }
    /// ```
    fn pick_next_shuffle(&mut self, current: usize) -> usize {
        // What:     `let scope = self.scope_indices(current);`. The scope's load-order indices
        //           (the page for `WithinPage`, the whole queue for `All`).
        // Why:      The pool to pick from.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const scope = this.scopeIndices(current);
        // ```
        let scope = self.scope_indices(current);
        // What:     `let played: HashSet<usize> = self.order[self.cycle_start..].iter().copied().collect();`.
        //           The tracks played since the current cycle began. `.copied()` turns
        //           `&usize` into `usize`; `.collect()` builds an owned set (so it does not
        //           keep borrowing `self.order`).
        // Why:      Excluded from this cycle's remaining picks.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const played = new Set(this.order.slice(this.cycleStart));
        // ```
        let played: HashSet<usize> = self.order[self.cycle_start..].iter().copied().collect();
        // What:     `let mut remaining: Vec<usize> = scope.iter().copied().filter(|i| !played.contains(i)).collect();`.
        //           Scope tracks not yet played this cycle.
        // Why:      The candidates for the next pick.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let remaining = scope.filter((i) => !played.has(i));
        // ```
        let mut remaining: Vec<usize> =
            scope.iter().copied().filter(|i| !played.contains(i)).collect();
        // What:     `if remaining.is_empty() { ... }`. Cycle exhausted: begin a new one.
        // Why:      Without replacement means a full cycle covers the whole scope; then reshuffle.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (!remaining.length) { ... }
        // ```
        if remaining.is_empty() {
            // What:     `self.cycle_start = self.order.len();`. The new cycle starts after the
            //           history written so far.
            // Why:      Subsequent picks measure "played this cycle" from here.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.cycleStart = this.order.length;
            // ```
            self.cycle_start = self.order.len();
            // What:     `remaining = scope.iter().copied().filter(|&i| i != current).collect();`.
            //           All scope tracks except the one that just finished.
            // Why:      A fresh cycle should not immediately replay the current track.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // remaining = scope.filter((i) => i !== current);
            // ```
            remaining = scope.iter().copied().filter(|&i| i != current).collect();
            // What:     `if remaining.is_empty() { remaining = scope; }`. A single-track scope
            //           has nothing else; replay it.
            // Why:      Avoid an empty candidate list when the scope is one track.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (!remaining.length) remaining = scope;
            // ```
            if remaining.is_empty() {
                remaining = scope;
            }
        }
        // What:     `let j = (self.next_rand() % remaining.len() as u64) as usize;`. A uniform
        //           index into `remaining`.
        // Why:      Random choice among the candidates.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const j = Number(this.nextRand() % BigInt(remaining.length));
        // ```
        let j = (self.next_rand() % remaining.len() as u64) as usize;
        // What:     `remaining[j]`. The chosen load-order index. Tail -> return.
        // Why:      Hand back the next track to play.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return remaining[j];
        // ```
        remaining[j]
    }

    /// What:     `fn rebuild_scope_order(&mut self, anchor: Option<usize>)`. Recompute the
    ///           scope `order` (and the cursor `pos`) so that the `anchor` track stays
    ///           current. Private helper used whenever the scope might change (set_tracks,
    ///           set_shuffle, play_index to another page).
    /// Why:      Centralise the "what plays next, in what order" rebuild.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// private rebuildScopeOrder(anchor: number | null): void {
    ///   if (this.tracks.length === 0) { this.order = []; this.pos = null; return; }
    ///   const a = Math.min(anchor ?? 0, this.tracks.length - 1);
    ///   let scope = this.scopeIndices(a);
    ///   if (this.shuffle !== "off") this.shuffleSlice(scope);
    ///   const p = scope.indexOf(a);
    ///   this.order = scope;
    ///   this.pos = p < 0 ? 0 : p;
    /// }
    /// ```
    fn rebuild_scope_order(&mut self, anchor: Option<usize>) {
        // What:     `if self.tracks.is_empty() { self.order = Vec::new(); self.pos = None; return; }`.
        //           Empty queue: no order, no cursor.
        // Why:      Nothing to play; guard the index math below.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (!this.tracks.length) { this.order = []; this.pos = null; return; }
        // ```
        if self.tracks.is_empty() {
            self.order = Vec::new();
            self.pos = None;
            return;
        }
        // What:     `let anchor = match anchor { Some(a) => a, None => { ...; return; } };`.
        //           Turn the `Option<usize>` parameter into a plain `usize`, but treat a
        //           `None` anchor as "NO current track": clear the order and cursor and RETURN
        //           early (handled in the `None` arm below). `Some(a) => a` keeps a real index.
        //           (This SHADOWS the parameter `anchor` with the new `usize` binding.)
        // Why:      `set_tracks` anchors `Some(0)`, but `clear_selection` (and toggling shuffle
        //           while nothing is selected) passes `None` to DESELECT, so a freshly opened
        //           library highlights and loads nothing until the user picks a track.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (anchor === null) { this.order = []; this.pos = null; return; }
        // const a0 = anchor;
        // ```
        let anchor = match anchor {
            // What:     `Some(a) => a`. Unwrap a present anchor to its `usize` index.
            // Why:      We have a real track to centre the scope on.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const a0 = anchor;
            // ```
            Some(a) => a,
            // What:     `None => { self.order = Vec::new(); self.pos = None; return; }`. No
            //           anchor: `Vec::new()` builds a fresh empty owned vector for `order`,
            //           `self.pos = None` nulls the cursor, and `return` exits the function.
            // Why:      Express "nothing selected" for a loaded (non-empty) queue; a later
            //           `play_index` rebuilds a real scope when the user taps a track.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.order = []; this.pos = null; return;
            // ```
            None => {
                self.order = Vec::new();
                self.pos = None;
                return;
            }
        };
        // What:     `let anchor = anchor.min(self.tracks.len() - 1);`. Clamp the anchor into
        //           range. `.min(x)` returns the smaller of the two. (Shadows again.)
        // Why:      Defensive: a stale index must not point past the tracks.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const a = Math.min(a0, this.tracks.length - 1);
        // ```
        let anchor = anchor.min(self.tracks.len() - 1);
        // What:     `if self.shuffle == ShuffleMode::Off { ... } else { ... }`. Off builds the
        //           full sequential scope order; the shuffle modes start a fresh play history.
        // Why:      Off is a deterministic in-order walk of the scope, while shuffle picks just
        //           in time, so its `order` begins as only the anchor and grows on `advance`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.shuffle === "off") { /* full sequential scope */ } else { /* [anchor] */ }
        // ```
        if self.shuffle == ShuffleMode::Off {
            // What:     `let scope = self.scope_indices(anchor);`. The scope's indices in
            //           ascending load order.
            // Why:      Off plays the scope in load order.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const scope = this.scopeIndices(anchor);
            // ```
            let scope = self.scope_indices(anchor);
            // What:     `let pos = scope.iter().position(|&x| x == anchor);`. The anchor's slot
            //           in the scope.
            // Why:      The cursor must point at the anchor after the rebuild.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const p = scope.indexOf(anchor);
            // ```
            let pos = scope.iter().position(|&x| x == anchor);
            // What:     `self.order = scope; self.pos = pos.or(Some(0));`. Adopt the sequential
            //           order and point the cursor at the anchor (or the start).
            // Why:      Off's `order` is the full scope, walked sequentially with looping.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.order = scope; this.pos = p < 0 ? 0 : p;
            // ```
            self.order = scope;
            self.pos = pos.or(Some(0));
        } else {
            // What:     `self.order = vec![anchor]; self.pos = Some(0); self.cycle_start = 0;`.
            //           Begin the play history with just the anchor and open a fresh cycle.
            // Why:      Shuffle does not precompute a permutation; `advance` appends each
            //           just-in-time pick to `order`, and the anchor is the first track played.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.order = [anchor]; this.pos = 0; this.cycleStart = 0;
            // ```
            self.order = vec![anchor];
            self.pos = Some(0);
            self.cycle_start = 0;
        }
    }

    /// What:     `pub fn set_shuffle(&mut self, mode: ShuffleMode)` changes the shuffle/scope
    ///           mode while keeping the currently-playing track current.
    /// Why:      Switching shuffle should not interrupt the current song.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// setShuffle(mode: ShuffleMode): void {
    ///   if (mode === this.shuffle) return;
    ///   const cur = this.currentIndex();
    ///   this.shuffle = mode;
    ///   this.rebuildScopeOrder(cur);
    /// }
    /// ```
    pub fn set_shuffle(&mut self, mode: ShuffleMode) {
        // What:     `if mode == self.shuffle { return; }`. Early return when nothing
        //           changes. `==` compares the enum.
        // Why:      Avoid reshuffling (and moving the cursor) on a no-op.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (mode === this.shuffle) return;
        // ```
        if mode == self.shuffle {
            return;
        }
        // What:     `let current = self.current_index();` remembers the playing track
        //           (Option<usize>) before we rebuild the scope.
        // Why:      So the rebuild can keep the cursor on the same track.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const current = this.currentIndex();
        // ```
        let current = self.current_index();
        // What:     `self.shuffle = mode;` record the new mode.
        // Why:      `rebuild_scope_order`/`scope_indices` read it.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.shuffle = mode;
        // ```
        self.shuffle = mode;
        // What:     `self.rebuild_scope_order(current);` rebuild the scope order anchored on
        //           the previously playing track.
        // Why:      Apply the new mode without losing the current track.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.rebuildScopeOrder(current);
        // ```
        self.rebuild_scope_order(current);
    }

    /// What:     `pub fn play_index(&mut self, track: usize) -> Option<usize>` selects a
    ///           specific track (load-order index) as current, switching the playback scope
    ///           if the track is on another page.
    /// Why:      The user clicked a row in the queue list.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// playIndex(track: number): number | null {
    ///   if (track >= this.tracks.length) return null;
    ///   const p = this.order.indexOf(track);
    ///   if (p >= 0) this.pos = p;          // already in the current scope
    ///   else this.rebuildScopeOrder(track); // jumped to another page
    ///   return track;
    /// }
    /// ```
    pub fn play_index(&mut self, track: usize) -> Option<usize> {
        // What:     `if track >= self.tracks.len() { return None; }` bounds check.
        // Why:      Ignore an out-of-range click.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (track >= this.tracks.length) return null;
        // ```
        if track >= self.tracks.len() {
            return None;
        }
        // What:     `if self.shuffle == ShuffleMode::Off { ...find or rebuild... } else { rebuild }`.
        //           In `Off`, stay in the current scope when the track is already in it and
        //           only rebuild on a jump to another page; in the shuffle modes, always
        //           rebuild so the play history restarts from the clicked track.
        // Why:      For `Off`, `order` is the full sequential scope, so the track's slot is a
        //           valid cursor; for shuffle, `order` is the play history, and clicking a
        //           track should begin a fresh cycle at it rather than retrace into history.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.shuffle === "off") {
        //   const p = this.order.indexOf(track);
        //   if (p >= 0) this.pos = p; else this.rebuildScopeOrder(track);
        // } else this.rebuildScopeOrder(track);
        // ```
        if self.shuffle == ShuffleMode::Off {
            // What:     `match self.order.iter().position(|&x| x == track) { ... }`. Find the
            //           track's slot in the current sequential scope, if any.
            // Why:      Stay in scope when possible; rebuild only on a jump to another page.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const p = this.order.indexOf(track);
            // ```
            match self.order.iter().position(|&x| x == track) {
                // What:     `Some(p) => self.pos = Some(p)`. Already in scope: move the cursor.
                // Why:      Clicking another track on the same page keeps the scope intact.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (p >= 0) this.pos = p;
                // ```
                Some(p) => self.pos = Some(p),
                // What:     `None => self.rebuild_scope_order(Some(track))`. Another page:
                //           rebuild the scope around the clicked track.
                // Why:      Switch playback to the clicked track's page.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // else this.rebuildScopeOrder(track);
                // ```
                None => self.rebuild_scope_order(Some(track)),
            }
        } else {
            // What:     `self.rebuild_scope_order(Some(track));`. Restart the shuffle history at
            //           the clicked track (order = [track], a fresh cycle).
            // Why:      Selecting a track under shuffle should make it current and shuffle
            //           onward from there, not replay recorded history.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.rebuildScopeOrder(track);
            // ```
            self.rebuild_scope_order(Some(track));
        }
        // What:     `Some(track)` tail expression: report the now-current track.
        // Why:      The caller loads this index.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return track;
        // ```
        Some(track)
    }

    /// What:     `pub fn advance(&mut self, natural: bool) -> Option<usize>`. `natural` is
    ///           true when a track ended on its own, false when the user pressed Next.
    /// Why:      End-of-track and Next share most logic but differ for repeat-track.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// advance(natural: boolean): number | null {
    ///   if (this.pos === null) return null;
    ///   const pos = this.pos;
    ///   if (natural && this.repeatTrack) return this.order[pos];
    ///   const next = pos + 1;
    ///   if (next < this.order.length) { this.pos = next; return this.order[next]; }
    ///   this.pos = 0; return this.order[0]; // loop the scope (page or all)
    /// }
    /// ```
    pub fn advance(&mut self, natural: bool) -> Option<usize> {
        // What:     `let pos = self.pos?;`. The `?` operator on an `Option`: if `self.pos`
        //           is `Some(p)` it unwraps to `p`; if `None` it RETURNS `None` from the
        //           whole function immediately. (This early-return shape is why `advance`
        //           returns `Option<usize>`.)
        // Why:      No cursor means nothing to advance; bail out early.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.pos === null) return null;
        // const pos = this.pos;
        // ```
        let pos = self.pos?;
        // What:     `if natural && self.repeat_track { ... }`. `&&` is logical AND.
        // Why:      A track that ended under "repeat track" replays itself.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (natural && this.repeatTrack) return this.order[pos];
        // ```
        if natural && self.repeat_track {
            // What:     `return Some(self.order[pos]);`. Wrap the current track index as the
            //           return value (cursor unchanged).
            // Why:      Signal "play this same track again".
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return this.order[pos];
            // ```
            return Some(self.order[pos]);
        }
        // What:     `if self.shuffle != ShuffleMode::Off { ... }`. The shuffle modes use the
        //           just-in-time path; `Off` falls through to the sequential walk below.
        // Why:      Shuffle has no precomputed order: it retraces history forward, or appends a
        //           fresh random pick when at the history end.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.shuffle !== "off") { /* retrace or pick */ }
        // ```
        if self.shuffle != ShuffleMode::Off {
            // What:     `if pos + 1 < self.order.len() { ... }`. There is forward history to
            //           retrace (the user pressed `prev` earlier, then `next`).
            // Why:      `next` after `prev` replays the recorded history before drawing anew.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (pos + 1 < this.order.length) { this.pos = pos + 1; return this.order[pos + 1]; }
            // ```
            if pos + 1 < self.order.len() {
                self.pos = Some(pos + 1);
                return Some(self.order[pos + 1]);
            }
            // What:     `let current = self.order[pos];` then `let pick = self.pick_next_shuffle(current);`.
            //           At the history end: choose the next track just in time.
            // Why:      Without replacement within the cycle, reshuffling at cycle end.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const pick = this.pickNextShuffle(this.order[pos]);
            // ```
            let current = self.order[pos];
            let pick = self.pick_next_shuffle(current);
            // What:     `self.order.push(pick); self.pos = Some(self.order.len() - 1);`. Append
            //           the pick to the history and point the cursor at it.
            // Why:      The history grows by one; the new track is current.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.order.push(pick); this.pos = this.order.length - 1;
            // ```
            self.order.push(pick);
            self.pos = Some(self.order.len() - 1);
            // What:     `return Some(pick);`. The chosen track.
            // Why:      Hand back what to play next.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return pick;
            // ```
            return Some(pick);
        }
        // What:     `let next = pos + 1;` compute the following position (Off, sequential).
        // Why:      Try to move forward within the scope.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const next = pos + 1;
        // ```
        let next = pos + 1;
        // What:     `if next < self.order.len() { ... }` bounds check.
        // Why:      There is a track after the current one in this scope.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (next < this.order.length) { this.pos = next; return this.order[next]; }
        // ```
        if next < self.order.len() {
            // What:     `self.pos = Some(next);`. Update the cursor.
            // Why:      Normal forward step.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.pos = next;
            // ```
            self.pos = Some(next);
            // What:     `return Some(self.order[next]);`. The new track index.
            // Why:      Hand back what to play next.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return this.order[next];
            // ```
            return Some(self.order[next]);
        }
        // What:     `self.pos = Some(0);`. Past the end of the scope: wrap to its start.
        //           `Some(0)` wraps index 0.
        // Why:      Off loops the page. There is no "stop at end" mode (only repeat-track
        //           changes natural-end).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.pos = 0;
        // ```
        self.pos = Some(0);
        // What:     `Some(self.order[0])` tail expression: the wrapped track.
        // Why:      Begin the next loop of the scope.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.order[0];
        // ```
        Some(self.order[0])
    }

    /// What:     `pub fn prev(&mut self) -> Option<usize>` steps backward. In `Off` it walks the
    ///           sequential scope and wraps to the end at the start; in the shuffle modes it
    ///           steps back through the play history and stops at its start (no wrap).
    /// Why:      The user pressed Previous. A shuffle history has no meaningful "last" to wrap
    ///           to, so going back past its start would invent a track.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// prev(): number | null {
    ///   if (this.pos === null) return null;
    ///   const pos = this.pos;
    ///   if (this.shuffle !== "off") {
    ///     if (pos > 0) { this.pos = pos - 1; return this.order[pos - 1]; }
    ///     return this.order[pos];
    ///   }
    ///   if (pos > 0) { this.pos = pos - 1; return this.order[pos - 1]; }
    ///   const last = this.order.length - 1; this.pos = last; return this.order[last];
    /// }
    /// ```
    pub fn prev(&mut self) -> Option<usize> {
        // What:     `let pos = self.pos?;`. The `?` operator on the `Option<usize>` cursor:
        //           unwraps `Some(p)` to `p`, or returns `None` from `prev` immediately when
        //           the cursor is `None`.
        // Why:      Nothing to go back to when there is no cursor; bail out early.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.pos === null) return null;
        // const pos = this.pos;
        // ```
        let pos = self.pos?;
        // What:     `if self.shuffle != ShuffleMode::Off { ... }`. Shuffle steps back through
        //           the history and stops at its start; `Off` falls through to the wrap below.
        // Why:      Going back past the start of a random history would invent a track.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.shuffle !== "off") { if (pos > 0) { this.pos = pos - 1; return this.order[pos - 1]; } return this.order[pos]; }
        // ```
        if self.shuffle != ShuffleMode::Off {
            // What:     `if pos > 0 { self.pos = Some(pos - 1); return Some(self.order[pos - 1]); }`.
            //           Step back one in the history.
            // Why:      Replay the previously-played track.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (pos > 0) { this.pos = pos - 1; return this.order[pos - 1]; }
            // ```
            if pos > 0 {
                self.pos = Some(pos - 1);
                return Some(self.order[pos - 1]);
            }
            // What:     `return Some(self.order[pos]);`. Already at the history start: stay put.
            // Why:      No earlier history; report the current track unchanged.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return this.order[pos];
            // ```
            return Some(self.order[pos]);
        }
        // What:     `if pos > 0 { ... }` there is a previous slot in the scope (Off).
        // Why:      Normal backward step.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (pos > 0) { this.pos = pos - 1; return this.order[pos - 1]; }
        // ```
        if pos > 0 {
            // What:     `self.pos = Some(pos - 1);`. Decrement the cursor.
            // Why:      Move to the previous track.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.pos = pos - 1;
            // ```
            self.pos = Some(pos - 1);
            // What:     `return Some(self.order[pos - 1]);`. That track index.
            // Why:      Hand back the previous track.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return this.order[pos - 1];
            // ```
            return Some(self.order[pos - 1]);
        }
        // What:     `let last = self.order.len() - 1;` the last scope index.
        // Why:      At the start of the scope, Previous wraps to its end.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const last = this.order.length - 1;
        // ```
        let last = self.order.len() - 1;
        // What:     `self.pos = Some(last);`. Set the cursor to the last slot.
        // Why:      Wrap behaviour (the scope always loops).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.pos = last;
        // ```
        self.pos = Some(last);
        // What:     `Some(self.order[last])` tail expression.
        // Why:      Play the wrapped (last) track of the scope.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.order[last];
        // ```
        Some(self.order[last])
    }
}

/// What:     `impl Default for Queue { ... }` lets `Queue::default()` work and satisfies
///           clippy's "type with new() should impl Default" lint.
/// Why:      Idiomatic; some generic code expects `Default`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // Queue.default() === Queue.new()
/// ```
impl Default for Queue {
    /// What:     `fn default() -> Queue`. The single method `Default` requires.
    /// Why:      Provide the zero-argument construction generic code expects.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// static default(): Queue { return Queue.new(); }
    /// ```
    fn default() -> Queue {
        // What:     `Queue::new()`. Delegate to the seeded constructor. Tail expression.
        // Why:      One source of truth for construction.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return Queue.new();
        // ```
        Queue::new()
    }
}

/// What:     `#[cfg(test)] #[path = "queue_tests.rs"] mod tests;` declares a test-only
///           submodule whose code lives in the sibling file `queue_tests.rs`. `#[cfg(test)]`
///           gates it to test builds only; `#[path = "..."]` aims the module at a flat
///           sibling file instead of the default `queue/tests.rs` subdirectory lookup. The
///           file stays the `tests` CHILD of queue, so its `use super::*` reaches the module
///           items (including private ones) unchanged.
/// Why:      Keep `queue.rs` to production code; the tests live beside it without inflating
///           this file or its max-lines budget (sibling `*_tests.rs` files are exempt from
///           the linter).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // queue.unit.test.ts, run only by the test runner
/// ```
#[cfg(test)]
#[path = "queue_tests.rs"]
mod tests;
