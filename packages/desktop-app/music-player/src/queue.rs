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
//! "Repeat track" is independent: when on, a track that ends NATURALLY replays
//! itself; a manual Next/Prev still moves within the scope.
//!
//! Design decision (deliberate): because `Off`/`WithinPage` are page-confined
//! and always loop the page, there is no way to play the whole queue in load
//! order and loop the whole queue (non-shuffle + repeat-all). When not
//! shuffling, the user stays inside the current folder/page on purpose.

// What:     `use std::path::PathBuf;` imports the OWNED filesystem-path type
//           (heap-allocated, growable). Sibling: `&Path`, a borrowed view.
// Why:      The queue stores the actual file paths it will hand to the decoder.
// TS map:   `type PathBuf = string`.
//
// In TS you'd write (pseudocode):
// ```ts
// type PathBuf = string;
// ```
use std::path::PathBuf;

// What:     `use crate::command::ShuffleMode;` imports our own enum from the sibling
//           module. `crate::` means "from the root of this package".
// Why:      The queue's scope and ordering depend on the shuffle mode.
// TS map:   `import { ShuffleMode } from "./command";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { ShuffleMode } from "./command";
// ```
use crate::command::ShuffleMode;

// What:     `pub struct Queue { ... }` declares a public record type with named fields.
//           The fields are private (no `pub`), so only this module can touch them
//           directly.
// Why:      Bundles the queue's state behind methods that keep it consistent.
// TS map:   A class with private fields.
//
// In TS you'd write (pseudocode):
// ```ts
// class Queue {
//   private tracks: string[];
//   private order: number[];
//   private pos: number | null;
//   private shuffle: ShuffleMode;
//   private repeatTrack: boolean;
//   private rngState: bigint;
// }
// ```
pub struct Queue {
    // What:     `tracks: Vec<PathBuf>`. An OWNED, growable array of owned paths. Sibling:
    //           `&[PathBuf]`, a borrowed slice that owns nothing.
    // Why:      The tracks in the order the user loaded them; the displayed queue list
    //           uses this order.
    // TS map:   `string[]`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private tracks: string[];
    // ```
    tracks: Vec<PathBuf>,
    // What:     `order: Vec<usize>`. A growable array of indices into `tracks`. `usize` is
    //           the pointer-sized unsigned int used for indexing (siblings: `u32`, `u64`).
    // Why:      The CURRENT SCOPE's playback order: the load-order indices of the tracks
    //           playback walks right now (the current page for Off/WithinPage, or the whole
    //           queue for All), sequential or shuffled.
    // TS map:   `number[]`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private order: number[];
    // ```
    order: Vec<usize>,
    // What:     `pos: Option<usize>`. "maybe an index": `Some(p)` or `None`.
    // Why:      The cursor's position WITHIN `order`. `None` means the queue is empty /
    //           nothing selected.
    // TS map:   `number | null`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private pos: number | null;
    // ```
    pos: Option<usize>,
    // What:     `shuffle: ShuffleMode`. The three-state shuffle/scope setting (Off /
    //           WithinPage / All). `ShuffleMode` is `Copy`.
    // Why:      Decides both the scope (page vs whole queue) and the ordering (sequential
    //           vs shuffled).
    // TS map:   `shuffle: ShuffleMode`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private shuffle: ShuffleMode;
    // ```
    shuffle: ShuffleMode,
    // What:     `repeat_track: bool`. When true, a track that ends naturally replays
    //           itself.
    // Why:      The "repeat track" checkbox; independent of the shuffle scope.
    // TS map:   `repeatTrack: boolean`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private repeatTrack: boolean;
    // ```
    repeat_track: bool,
    // What:     `rng_state: u64`. An unsigned 64-bit integer (siblings: `u32`, `usize`,
    //           `i64`). Used as the running state of a tiny PRNG.
    // Why:      Shuffling needs randomness; a self-contained PRNG avoids a dependency and
    //           stays seedable for deterministic tests.
    // TS map:   `bigint` (JS numbers cannot hold 64 unsigned bits exactly).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private rngState: bigint;
    // ```
    rng_state: u64,
}

// What:     `impl Queue { ... }`. The queue's methods (an `impl` block holds a type's
//           behaviour).
// Why:      Group the queue's operations with its state.
// TS map:   `class Queue { ...methods... }`
//
// In TS you'd write (pseudocode):
// ```ts
// class Queue { /* methods */ }
// ```
impl Queue {
    // What:     `pub fn new() -> Queue` is the public constructor. `-> Queue` is the return
    //           type.
    // Why:      Creates an empty queue seeded from the clock so first-run shuffles differ
    //           between launches.
    // TS map:   A static factory `static new(): Queue`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // static new(): Queue { return new Queue(seedFromClock()); }
    // ```
    pub fn new() -> Queue {
        // What:     `let seed = std::time::SystemTime::now().duration_since(UNIX_EPOCH).map(...).unwrap_or(...);`.
        //           `SystemTime::now()` is the wall clock; the chain turns "now" into a
        //           64-bit seed (see each combinator below).
        // Why:      We derive a changing seed from the current time.
        // TS map:   `const seed = BigInt(Date.now());`
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
            // TS map:   `Date.now() - 0`.
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
            // TS map:   `.then(d => Number(d.nanos))` — but here it's sync.
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
            // TS map:   `?? 0x9e3779b97f4a7c15n`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // // ?? 0x9e3779b97f4a7c15n
            // ```
            .unwrap_or(0x9e3779b97f4a7c15);
        // What:     `Queue::with_rng_seed(seed)` calls the seeded constructor. No trailing
        //           `;`, so it is the tail expression / return.
        // Why:      Share construction logic with the test constructor.
        // TS map:   `return Queue.withRngSeed(seed);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return Queue.withRngSeed(seed);
        // ```
        Queue::with_rng_seed(seed)
    }

    // What:     `pub fn with_rng_seed(seed: u64) -> Queue` builds a queue with a
    //           caller-chosen PRNG seed.
    // Why:      Tests pass a fixed seed to get a deterministic shuffle.
    // TS map:   `static withRngSeed(seed: bigint): Queue`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // static withRngSeed(seed: bigint): Queue { ... }
    // ```
    pub fn with_rng_seed(seed: u64) -> Queue {
        // What:     `Queue { ... }`. A struct literal constructs the record. `Vec::new()`
        //           makes an empty owned array; `None` is the empty `Option`.
        //           `ShuffleMode::Off` is the path-qualified variant. No `;`, so this is the
        //           return value.
        // Why:      Start empty, not shuffled, repeat-track off.
        // TS map:   `return { tracks: [], order: [], pos: null, shuffle: "off", repeatTrack: false, rngState: seed === 0n ? 1n : seed };`
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
            // TS map:   `seed === 0n ? 1n : seed`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // rngState: seed === 0n ? 1n : seed,
            // ```
            rng_state: if seed == 0 { 1 } else { seed },
        }
    }

    // What:     `fn next_rand(&mut self) -> u64`. `&mut self` is a MUTABLE borrow of the
    //           queue: the method may change `self`'s fields but does not own/consume it.
    //           Private (no `pub`).
    // Why:      Advances and returns the PRNG state (xorshift64).
    // TS map:   `private nextRand(): bigint { ... mutates this.rngState ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private nextRand(): bigint { /* xorshift on this.rngState */ }
    // ```
    fn next_rand(&mut self) -> u64 {
        // What:     `let mut x = self.rng_state;` binds a LOCAL MUTABLE copy. `mut` marks
        //           it reassignable; without it, bindings are read-only by default.
        // Why:      We mutate a local then store it back, the classic xorshift.
        // TS map:   `let x = this.rngState;`
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
        // TS map:   `x ^= x << 13n;` using BigInt, masked to 64 bits.
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
        // TS map:   `x ^= x >> 7n;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // x = BigInt.asUintN(64, x ^ (x >> 7n));
        // ```
        x ^= x >> 7;
        // What:     `x ^= x << 17;` xor-assign with a left shift.
        // Why:      Third xorshift step.
        // TS map:   `x ^= x << 17n;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // x = BigInt.asUintN(64, x ^ (x << 17n));
        // ```
        x ^= x << 17;
        // What:     `self.rng_state = x;` writes the new state back through the mutable
        //           borrow.
        // Why:      Persist the PRNG progress for the next call.
        // TS map:   `this.rngState = x;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.rngState = x;
        // ```
        self.rng_state = x;
        // What:     `x` alone on the last line is the tail expression: its value is returned.
        // Why:      Caller uses the fresh random number.
        // TS map:   `return x;`
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
    // TS map:   `get length(): number`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // get length(): number { return this.tracks.length; }
    // ```
    pub fn len(&self) -> usize {
        // What:     `self.tracks.len()` returns the array length as `usize`. Tail expression
        //           -> return value.
        // Why:      Report the count.
        // TS map:   `return this.tracks.length;`
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
    // TS map:   `get tracks(): readonly string[]` (a read-only view of the array).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // get tracks(): readonly string[] { return this.tracks; }
    // ```
    pub fn tracks(&self) -> &[PathBuf] {
        // What:     `&self.tracks` borrows the `Vec` as a slice (the `Vec` derefs to
        //           `&[PathBuf]`). Tail expression -> return value.
        // Why:      Hand out a read-only view of the paths.
        // TS map:   `return this.tracks;`
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
    // TS map:   `get isEmpty(): boolean`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // get isEmpty(): boolean { return this.tracks.length === 0; }
    // ```
    pub fn is_empty(&self) -> bool {
        // What:     `self.tracks.is_empty()` -> bool. Tail expression.
        // Why:      Report emptiness.
        // TS map:   `return this.tracks.length === 0;`
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
    // TS map:   `repeatTrack(): boolean`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // repeatTrack(): boolean { return this.repeatTrack; }
    // ```
    pub fn repeat_track(&self) -> bool {
        // What:     `self.repeat_track` reads the `Copy` bool. Tail expression.
        // Why:      Expose the flag.
        // TS map:   `return this.repeatTrack;`
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
    // TS map:   `shuffleMode(): ShuffleMode`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // shuffleMode(): ShuffleMode { return this.shuffle; }
    // ```
    pub fn shuffle_mode(&self) -> ShuffleMode {
        // What:     `self.shuffle` reads the `Copy` enum out. Tail expression.
        // Why:      Expose the mode.
        // TS map:   `return this.shuffle;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.shuffle;
        // ```
        self.shuffle
    }

    // What:     `pub fn display_paths(&self) -> Vec<String>` returns owned display strings
    //           in load order: each track's path relative to the queue's common root (e.g.
    //           `Artist/Album/01.flac`, or just `01.flac` when the whole queue is one
    //           folder).
    // Why:      The UI shows the folder a track lives in, not just its filename, so
    //           pagination can group by folder; the absolute prefix is stripped.
    // TS map:   `displayPaths(): string[]`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // displayPaths(): string[] { return relativeDisplayPaths(this.tracks); }
    // ```
    pub fn display_paths(&self) -> Vec<String> {
        // What:     `crate::relpath::relative_display_paths(&self.tracks)`. Call the pure
        //           path helper. `crate::` means "from this package's root"; `&self.tracks`
        //           lends the `Vec<PathBuf>` (which coerces to the `&[PathBuf]` slice the
        //           helper takes) read-only. Tail expression -> return.
        // Why:      One source of truth for the common-prefix stripping, reused and
        //           unit-tested in the `relpath` module.
        // TS map:   `return relativeDisplayPaths(this.tracks);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return relativeDisplayPaths(this.tracks);
        // ```
        crate::relpath::relative_display_paths(&self.tracks)
    }

    // What:     `pub fn current_index(&self) -> Option<usize>` returns the LOAD-ORDER index
    //           of the current track (into `tracks`), or None.
    // Why:      The UI highlights this row; NowPlaying carries it.
    // TS map:   `currentIndex(): number | null`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // currentIndex(): number | null {
    //   return this.pos === null ? null : this.order[this.pos];
    // }
    // ```
    pub fn current_index(&self) -> Option<usize> {
        // What:     `self.pos.map(|p| self.order[p])`. `self.pos` is `Option<usize>`;
        //           `.map` runs the closure only if `Some`. `self.order[p]` indexes the
        //           scope order array. Tail -> return.
        // Why:      Translate the cursor's order-position into a track index.
        // TS map:   `return this.pos === null ? null : this.order[this.pos];`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.pos === null ? null : this.order[this.pos];
        // ```
        self.pos.map(|p| self.order[p])
    }

    // What:     `pub fn current_path(&self) -> Option<&PathBuf>` returns a BORROWED
    //           reference to the current path, or None. `&PathBuf` is a shared borrow tied
    //           to `self`'s lifetime.
    // Why:      The engine needs the path to open the file, without copying it.
    // TS map:   `currentPath(): string | null`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // currentPath(): string | null {
    //   const i = this.currentIndex();
    //   return i === null ? null : this.tracks[i];
    // }
    // ```
    pub fn current_path(&self) -> Option<&PathBuf> {
        // What:     `self.current_index().map(|i| &self.tracks[i])`. `self.current_index()`
        //           gives `Option<usize>`; `.map(|i| &self.tracks[i])` borrows the element.
        //           `&` here lends the path to the caller (no ownership transfer).
        // Why:      Avoid cloning the path on every access.
        // TS map:   `return i === null ? null : this.tracks[i];`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const i = this.currentIndex(); return i === null ? null : this.tracks[i];
        // ```
        self.current_index().map(|i| &self.tracks[i])
    }

    // What:     `pub fn set_repeat_track(&mut self, on: bool)` mutates state.
    // Why:      The UI checkbox toggles "repeat track"; record the new flag.
    // TS map:   `setRepeatTrack(on: boolean): void`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // setRepeatTrack(on: boolean): void { this.repeatTrack = on; }
    // ```
    pub fn set_repeat_track(&mut self, on: bool) {
        // What:     `self.repeat_track = on;`. Plain field assignment through the mutable
        //           borrow.
        // Why:      Store it; `advance` reads it on a natural end.
        // TS map:   `this.repeatTrack = on;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.repeatTrack = on;
        // ```
        self.repeat_track = on;
    }

    // What:     `pub fn set_tracks(&mut self, tracks: Vec<PathBuf>)`. The parameter is taken
    //           BY VALUE (ownership moves into the queue).
    // Why:      Replacing the queue when the user opens new files.
    // TS map:   `setTracks(tracks: string[]): void`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // setTracks(tracks: string[]): void {
    //   this.tracks = tracks;
    //   this.rebuildScopeOrder(tracks.length ? 0 : null);
    // }
    // ```
    pub fn set_tracks(&mut self, tracks: Vec<PathBuf>) {
        // What:     `self.tracks = tracks;` moves the new vector in, dropping (freeing) the
        //           old one.
        // Why:      Adopt the new track list.
        // TS map:   `this.tracks = tracks;`
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
        // TS map:   `this.rebuildScopeOrder(0);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.rebuildScopeOrder(0);
        // ```
        self.rebuild_scope_order(Some(0));
    }

    // What:     `pub fn clear_selection(&mut self)`. Drop the current-track selection: after
    //           this, no track is current and there is no playback scope until the user picks
    //           one. `&mut self` is a MUTABLE borrow of the queue (we reassign its fields).
    // Why:      Opening a library should auto-select NOTHING. The controller calls this after
    //           `set_tracks` on a normal open, and the restore path calls it when the saved
    //           session had no current track, so a fresh queue highlights and loads nothing.
    // TS map:   `clearSelection(): void`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // clearSelection(): void { this.rebuildScopeOrder(null); }
    // ```
    pub fn clear_selection(&mut self) {
        // What:     `self.rebuild_scope_order(None);`. Rebuild the scope with a `None` anchor;
        //           `None` is the absent variant of `Option<usize>`, which `rebuild_scope_order`
        //           treats as "no current track" (empties `order`, sets `pos = None`).
        // Why:      Reuse the single method that owns the scope/cursor invariant instead of
        //           poking the fields here.
        // TS map:   `this.rebuildScopeOrder(null);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.rebuildScopeOrder(null);
        // ```
        self.rebuild_scope_order(None);
    }

    // What:     `fn scope_indices(&self, anchor: usize) -> Vec<usize>` returns the
    //           load-order indices that make up the playback scope around the `anchor`
    //           track, in ascending load order. Private helper.
    // Why:      `All` scopes the whole queue; `Off`/`WithinPage` scope the anchor's page
    //           (its top-level folder / letter bucket), so playback stays inside one folder
    //           unless shuffling everything.
    // TS map:   `private scopeIndices(anchor: number): number[]`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private scopeIndices(anchor: number): number[] {
    //   if (this.shuffle === "all") return [...Array(this.tracks.length).keys()];
    //   const pages = paginate(this.displayPaths());
    //   const p = pageOfIndex(pages, anchor);
    //   return p === null
    //     ? [...Array(this.tracks.length).keys()]
    //     : pages[p].entries.map(e => e.index);
    // }
    // ```
    fn scope_indices(&self, anchor: usize) -> Vec<usize> {
        // What:     `if self.shuffle == ShuffleMode::All { ... }`. `==` compares the `Copy`
        //           enum (it derives `PartialEq`).
        // Why:      `All` ignores pages: the scope is every track.
        // TS map:   `if (this.shuffle === "all") { ... }`
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
            // TS map:   `return [...Array(this.tracks.length).keys()];`
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
        // TS map:   `const names = this.displayPaths();`
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
        // TS map:   `const pages = paginate(names);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const pages = paginate(names);
        // ```
        let pages = crate::pagination::paginate(&names);
        // What:     `match crate::pagination::page_of_index(&pages, anchor) { ... }`. Find
        //           which page holds the anchor; returns `Option<usize>`.
        // Why:      That page IS the scope.
        // TS map:   `const p = pageOfIndex(pages, anchor);`
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
            // TS map:   `return pages[p].entries.map(e => e.index);`
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
            // TS map:   `return [...Array(this.tracks.length).keys()];`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return [...Array(this.tracks.length).keys()];
            // ```
            None => (0..self.tracks.len()).collect(),
        }
    }

    // What:     `fn shuffle_slice(&mut self, slice: &mut [usize])`. Fisher-Yates shuffle of
    //           a borrowed mutable slice of indices. `&mut [usize]` is a mutable view; the
    //           slice is a local Vec the caller owns, so mutating it does not clash with
    //           `self.next_rand()`'s `&mut self`.
    // Why:      Randomly permute the scope indices before they become `order`.
    // TS map:   `private shuffleSlice(slice: number[]): void`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private shuffleSlice(slice: number[]): void {
    //   for (let i = slice.length - 1; i > 0; i--) {
    //     const j = Number(this.nextRand() % BigInt(i + 1));
    //     [slice[i], slice[j]] = [slice[j], slice[i]];
    //   }
    // }
    // ```
    fn shuffle_slice(&mut self, slice: &mut [usize]) {
        // What:     `if slice.len() < 2 { return; }` is an EARLY RETURN: nothing to shuffle
        //           for 0 or 1 elements.
        // Why:      Avoid the `len() - 1` underflow on an empty slice (usize is unsigned, so
        //           0 - 1 would panic in debug).
        // TS map:   `if (slice.length < 2) return;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (slice.length < 2) return;
        // ```
        if slice.len() < 2 {
            return;
        }
        // What:     `let mut i = slice.len() - 1;` a mutable loop counter.
        // Why:      Fisher-Yates walks from the last index down to 1.
        // TS map:   `let i = slice.length - 1;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let i = slice.length - 1;
        // ```
        let mut i = slice.len() - 1;
        // What:     `while i > 0 { ... }` a condition-controlled loop.
        // Why:      Standard Fisher-Yates traversal.
        // TS map:   `while (i > 0) { ... }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // while (i > 0) { ... }
        // ```
        while i > 0 {
            // What:     `let j = (self.next_rand() % (i as u64 + 1)) as usize;`.
            //           `self.next_rand()` returns a `u64`; `% (i as u64 + 1)` is modulo.
            //           `i as u64` casts the `usize` index to `u64` to match the PRNG's type;
            //           `as usize` casts the result back for indexing.
            // Why:      Pick a random slot `j` in `0..=i`.
            // TS map:   `const j = Number(this.nextRand() % BigInt(i + 1));`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const j = Number(this.nextRand() % BigInt(i + 1));
            // ```
            let j = (self.next_rand() % (i as u64 + 1)) as usize;
            // What:     `slice.swap(i, j)` swaps two elements in place.
            // Why:      The shuffle step.
            // TS map:   `[slice[i], slice[j]] = [slice[j], slice[i]];`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // [slice[i], slice[j]] = [slice[j], slice[i]];
            // ```
            slice.swap(i, j);
            // What:     `i -= 1;` decrement the counter.
            // Why:      Move toward the loop end.
            // TS map:   `i--;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // i--;
            // ```
            i -= 1;
        }
    }

    // What:     `fn rebuild_scope_order(&mut self, anchor: Option<usize>)`. Recompute the
    //           scope `order` (and the cursor `pos`) so that the `anchor` track stays
    //           current. Private helper used whenever the scope might change (set_tracks,
    //           set_shuffle, play_index to another page).
    // Why:      Centralise the "what plays next, in what order" rebuild.
    // TS map:   `private rebuildScopeOrder(anchor: number | null): void`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private rebuildScopeOrder(anchor: number | null): void {
    //   if (this.tracks.length === 0) { this.order = []; this.pos = null; return; }
    //   const a = Math.min(anchor ?? 0, this.tracks.length - 1);
    //   let scope = this.scopeIndices(a);
    //   if (this.shuffle !== "off") this.shuffleSlice(scope);
    //   const p = scope.indexOf(a);
    //   this.order = scope;
    //   this.pos = p < 0 ? 0 : p;
    // }
    // ```
    fn rebuild_scope_order(&mut self, anchor: Option<usize>) {
        // What:     `if self.tracks.is_empty() { self.order = Vec::new(); self.pos = None; return; }`.
        //           Empty queue: no order, no cursor.
        // Why:      Nothing to play; guard the index math below.
        // TS map:   `if (!this.tracks.length) { this.order = []; this.pos = null; return; }`
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
        // TS map:   `if (anchor === null) { this.order = []; this.pos = null; return; } const a0 = anchor;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (anchor === null) { this.order = []; this.pos = null; return; }
        // const a0 = anchor;
        // ```
        let anchor = match anchor {
            // What:     `Some(a) => a`. Unwrap a present anchor to its `usize` index.
            // Why:      We have a real track to centre the scope on.
            // TS map:   `const a0 = anchor;`
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
            // TS map:   `this.order = []; this.pos = null; return;`
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
        // TS map:   `const a = Math.min(a0, this.tracks.length - 1);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const a = Math.min(a0, this.tracks.length - 1);
        // ```
        let anchor = anchor.min(self.tracks.len() - 1);
        // What:     `let mut scope = self.scope_indices(anchor);`. The scope's indices in
        //           ascending load order; `mut` so we can shuffle it.
        // Why:      Starting point for the playback order.
        // TS map:   `let scope = this.scopeIndices(a);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let scope = this.scopeIndices(a);
        // ```
        let mut scope = self.scope_indices(anchor);
        // What:     `if self.shuffle != ShuffleMode::Off { self.shuffle_slice(&mut scope); }`.
        //           `!=` is "not equal"; both `WithinPage` and `All` shuffle. `&mut scope`
        //           lends the local vector mutably to the shuffler.
        // Why:      Off keeps load order; the other two randomise the scope.
        // TS map:   `if (this.shuffle !== "off") this.shuffleSlice(scope);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.shuffle !== "off") this.shuffleSlice(scope);
        // ```
        if self.shuffle != ShuffleMode::Off {
            self.shuffle_slice(&mut scope);
        }
        // What:     `let pos = scope.iter().position(|&x| x == anchor);`. Find the anchor's
        //           index within the (possibly shuffled) scope. `.iter()` borrows; `|&x|`
        //           destructures the `&usize` to a `usize` value; `.position` returns
        //           `Option<usize>`.
        // Why:      The cursor must point at the anchor after the rebuild.
        // TS map:   `const p = scope.indexOf(a);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const p = scope.indexOf(a);
        // ```
        let pos = scope.iter().position(|&x| x == anchor);
        // What:     `self.order = scope;` move the new order into place.
        // Why:      Adopt the rebuilt scope.
        // TS map:   `this.order = scope;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.order = scope;
        // ```
        self.order = scope;
        // What:     `self.pos = pos.or(Some(0));`. `.or(default)` keeps `Some`, else
        //           substitutes `Some(0)`. `Some(0)` wraps index 0.
        // Why:      Point the cursor at the anchor, or the scope's start if the anchor
        //           somehow fell outside (cannot happen for a real track).
        // TS map:   `this.pos = p < 0 ? 0 : p;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.pos = p < 0 ? 0 : p;
        // ```
        self.pos = pos.or(Some(0));
    }

    // What:     `pub fn set_shuffle(&mut self, mode: ShuffleMode)` changes the shuffle/scope
    //           mode while keeping the currently-playing track current.
    // Why:      Switching shuffle should not interrupt the current song.
    // TS map:   `setShuffle(mode: ShuffleMode): void`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // setShuffle(mode: ShuffleMode): void {
    //   if (mode === this.shuffle) return;
    //   const cur = this.currentIndex();
    //   this.shuffle = mode;
    //   this.rebuildScopeOrder(cur);
    // }
    // ```
    pub fn set_shuffle(&mut self, mode: ShuffleMode) {
        // What:     `if mode == self.shuffle { return; }`. Early return when nothing
        //           changes. `==` compares the enum.
        // Why:      Avoid reshuffling (and moving the cursor) on a no-op.
        // TS map:   `if (mode === this.shuffle) return;`
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
        // TS map:   `const current = this.currentIndex();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const current = this.currentIndex();
        // ```
        let current = self.current_index();
        // What:     `self.shuffle = mode;` record the new mode.
        // Why:      `rebuild_scope_order`/`scope_indices` read it.
        // TS map:   `this.shuffle = mode;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.shuffle = mode;
        // ```
        self.shuffle = mode;
        // What:     `self.rebuild_scope_order(current);` rebuild the scope order anchored on
        //           the previously playing track.
        // Why:      Apply the new mode without losing the current track.
        // TS map:   `this.rebuildScopeOrder(current);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.rebuildScopeOrder(current);
        // ```
        self.rebuild_scope_order(current);
    }

    // What:     `pub fn play_index(&mut self, track: usize) -> Option<usize>` selects a
    //           specific track (load-order index) as current, switching the playback scope
    //           if the track is on another page.
    // Why:      The user clicked a row in the queue list.
    // TS map:   `playIndex(track: number): number | null`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // playIndex(track: number): number | null {
    //   if (track >= this.tracks.length) return null;
    //   const p = this.order.indexOf(track);
    //   if (p >= 0) this.pos = p;          // already in the current scope
    //   else this.rebuildScopeOrder(track); // jumped to another page
    //   return track;
    // }
    // ```
    pub fn play_index(&mut self, track: usize) -> Option<usize> {
        // What:     `if track >= self.tracks.len() { return None; }` bounds check.
        // Why:      Ignore an out-of-range click.
        // TS map:   `if (track >= this.tracks.length) return null;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (track >= this.tracks.length) return null;
        // ```
        if track >= self.tracks.len() {
            return None;
        }
        // What:     `match self.order.iter().position(|&x| x == track) { ... }`. Find the
        //           track's position in the CURRENT scope order, if any.
        // Why:      Stay in the same scope when possible; rebuild only on a jump to a
        //           different page.
        // TS map:   `const p = this.order.indexOf(track);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const p = this.order.indexOf(track);
        // ```
        match self.order.iter().position(|&x| x == track) {
            // What:     `Some(p) => self.pos = Some(p)`. Already in scope: just move the
            //           cursor. `Some(p)` wraps the position.
            // Why:      Clicking another track on the same page keeps the page's shuffle
            //           order intact.
            // TS map:   `if (p >= 0) this.pos = p;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (p >= 0) this.pos = p;
            // ```
            Some(p) => self.pos = Some(p),
            // What:     `None => self.rebuild_scope_order(Some(track))`. Not in the current
            //           scope: the track is on another page (Off/WithinPage) — rebuild the
            //           scope around it. `Some(track)` wraps the anchor.
            // Why:      Switch playback to the clicked track's page.
            // TS map:   `else this.rebuildScopeOrder(track);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // else this.rebuildScopeOrder(track);
            // ```
            None => self.rebuild_scope_order(Some(track)),
        }
        // What:     `Some(track)` tail expression: report the now-current track.
        // Why:      The caller loads this index.
        // TS map:   `return track;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return track;
        // ```
        Some(track)
    }

    // What:     `pub fn advance(&mut self, natural: bool) -> Option<usize>`. `natural` is
    //           true when a track ended on its own, false when the user pressed Next.
    // Why:      End-of-track and Next share most logic but differ for repeat-track.
    // TS map:   `advance(natural: boolean): number | null`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // advance(natural: boolean): number | null {
    //   if (this.pos === null) return null;
    //   const pos = this.pos;
    //   if (natural && this.repeatTrack) return this.order[pos];
    //   const next = pos + 1;
    //   if (next < this.order.length) { this.pos = next; return this.order[next]; }
    //   this.pos = 0; return this.order[0]; // loop the scope (page or all)
    // }
    // ```
    pub fn advance(&mut self, natural: bool) -> Option<usize> {
        // What:     `let pos = self.pos?;`. The `?` operator on an `Option`: if `self.pos`
        //           is `Some(p)` it unwraps to `p`; if `None` it RETURNS `None` from the
        //           whole function immediately. (This early-return shape is why `advance`
        //           returns `Option<usize>`.)
        // Why:      No cursor means nothing to advance; bail out early.
        // TS map:   `if (this.pos === null) return null; const pos = this.pos;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.pos === null) return null;
        // const pos = this.pos;
        // ```
        let pos = self.pos?;
        // What:     `if natural && self.repeat_track { ... }`. `&&` is logical AND.
        // Why:      A track that ended under "repeat track" replays itself.
        // TS map:   `if (natural && this.repeatTrack) return order[pos];`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (natural && this.repeatTrack) return this.order[pos];
        // ```
        if natural && self.repeat_track {
            // What:     `return Some(self.order[pos]);`. Wrap the current track index as the
            //           return value (cursor unchanged).
            // Why:      Signal "play this same track again".
            // TS map:   `return this.order[pos];`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return this.order[pos];
            // ```
            return Some(self.order[pos]);
        }
        // What:     `let next = pos + 1;` compute the following position.
        // Why:      Try to move forward within the scope.
        // TS map:   `const next = pos + 1;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const next = pos + 1;
        // ```
        let next = pos + 1;
        // What:     `if next < self.order.len() { ... }` bounds check.
        // Why:      There is a track after the current one in this scope.
        // TS map:   `if (next < this.order.length) { ... }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (next < this.order.length) { this.pos = next; return this.order[next]; }
        // ```
        if next < self.order.len() {
            // What:     `self.pos = Some(next);`. Update the cursor.
            // Why:      Normal forward step.
            // TS map:   `this.pos = next;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.pos = next;
            // ```
            self.pos = Some(next);
            // What:     `return Some(self.order[next]);`. The new track index.
            // Why:      Hand back what to play next.
            // TS map:   `return this.order[next];`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return this.order[next];
            // ```
            return Some(self.order[next]);
        }
        // What:     `self.pos = Some(0);`. Past the end of the scope: wrap to its start.
        //           `Some(0)` wraps index 0.
        // Why:      Off/WithinPage loop the page; All loops the whole queue. There is no
        //           "stop at end" mode (only repeat-track changes natural-end).
        // TS map:   `this.pos = 0;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.pos = 0;
        // ```
        self.pos = Some(0);
        // What:     `Some(self.order[0])` tail expression: the wrapped track.
        // Why:      Begin the next loop of the scope.
        // TS map:   `return this.order[0];`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.order[0];
        // ```
        Some(self.order[0])
    }

    // What:     `pub fn prev(&mut self) -> Option<usize>` steps backward within the scope,
    //           wrapping to the end at the start.
    // Why:      The user pressed Previous.
    // TS map:   `prev(): number | null`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // prev(): number | null {
    //   if (this.pos === null) return null;
    //   const pos = this.pos;
    //   if (pos > 0) { this.pos = pos - 1; return this.order[pos - 1]; }
    //   const last = this.order.length - 1; this.pos = last; return this.order[last];
    // }
    // ```
    pub fn prev(&mut self) -> Option<usize> {
        // What:     `let pos = self.pos?;`. The `?` operator on the `Option<usize>` cursor:
        //           unwraps `Some(p)` to `p`, or returns `None` from `prev` immediately when
        //           the cursor is `None`.
        // Why:      Nothing to go back to when there is no cursor; bail out early.
        // TS map:   `if (this.pos === null) return null; const pos = this.pos;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.pos === null) return null;
        // const pos = this.pos;
        // ```
        let pos = self.pos?;
        // What:     `if pos > 0 { ... }` there is a previous slot in the scope.
        // Why:      Normal backward step.
        // TS map:   `if (pos > 0) { ... }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (pos > 0) { this.pos = pos - 1; return this.order[pos - 1]; }
        // ```
        if pos > 0 {
            // What:     `self.pos = Some(pos - 1);`. Decrement the cursor.
            // Why:      Move to the previous track.
            // TS map:   `this.pos = pos - 1;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.pos = pos - 1;
            // ```
            self.pos = Some(pos - 1);
            // What:     `return Some(self.order[pos - 1]);`. That track index.
            // Why:      Hand back the previous track.
            // TS map:   `return this.order[pos - 1];`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return this.order[pos - 1];
            // ```
            return Some(self.order[pos - 1]);
        }
        // What:     `let last = self.order.len() - 1;` the last scope index.
        // Why:      At the start of the scope, Previous wraps to its end.
        // TS map:   `const last = this.order.length - 1;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const last = this.order.length - 1;
        // ```
        let last = self.order.len() - 1;
        // What:     `self.pos = Some(last);`. Set the cursor to the last slot.
        // Why:      Wrap behaviour (the scope always loops).
        // TS map:   `this.pos = last;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.pos = last;
        // ```
        self.pos = Some(last);
        // What:     `Some(self.order[last])` tail expression.
        // Why:      Play the wrapped (last) track of the scope.
        // TS map:   `return this.order[last];`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.order[last];
        // ```
        Some(self.order[last])
    }
}

// What:     `impl Default for Queue { ... }` lets `Queue::default()` work and satisfies
//           clippy's "type with new() should impl Default" lint.
// Why:      Idiomatic; some generic code expects `Default`.
// TS map:   no analogue; just an extra factory delegating to `new`.
//
// In TS you'd write (pseudocode):
// ```ts
// // Queue.default() === Queue.new()
// ```
impl Default for Queue {
    // What:     `fn default() -> Queue`. The single method `Default` requires.
    // Why:      Provide the zero-argument construction generic code expects.
    // TS map:   `static default(): Queue`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // static default(): Queue { return Queue.new(); }
    // ```
    fn default() -> Queue {
        // What:     `Queue::new()`. Delegate to the seeded constructor. Tail expression.
        // Why:      One source of truth for construction.
        // TS map:   `return Queue.new();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return Queue.new();
        // ```
        Queue::new()
    }
}

// What:     `#[cfg(test)] #[path = "queue_tests.rs"] mod tests;` declares a test-only
//           submodule whose code lives in the sibling file `queue_tests.rs`. `#[cfg(test)]`
//           gates it to test builds only; `#[path = "..."]` aims the module at a flat
//           sibling file instead of the default `queue/tests.rs` subdirectory lookup. The
//           file stays the `tests` CHILD of queue, so its `use super::*` reaches the module
//           items (including private ones) unchanged.
// Why:      Keep `queue.rs` to production code; the tests live beside it without inflating
//           this file or its max-lines budget (sibling `*_tests.rs` files are exempt from
//           the linter).
// TS map:   the `queue.unit.test.ts` file beside `queue.ts`, excluded from the production
//           bundle.
//
// In TS you'd write (pseudocode):
// ```ts
// // queue.unit.test.ts, run only by the test runner
// ```
#[cfg(test)]
#[path = "queue_tests.rs"]
mod tests;
