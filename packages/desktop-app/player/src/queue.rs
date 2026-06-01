//! The play queue: an ordered list of tracks plus a cursor, with shuffle and
//! repeat behaviour. Pure logic, no audio, no I/O, so it is fully unit-tested.

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

// What:     `use crate::command::RepeatMode;` imports our own enum from the
//           sibling module. `crate::` means "from the root of this package".
// Why:      The queue's traversal depends on the repeat mode.
// TS map:   `import { RepeatMode } from "./command";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { RepeatMode } from "./command";
// ```
use crate::command::RepeatMode;

// What:     `pub struct Queue { ... }` declares a public record type with
//           named fields. The fields are private (no `pub`), so only this
//           module can touch them directly.
// Why:      Bundles the queue's state behind methods that keep it consistent.
// TS map:   A class with private fields.
//
// In TS you'd write (pseudocode):
// ```ts
// class Queue {
//   private tracks: string[];
//   private order: number[];
//   private pos: number | null;
//   private shuffle: boolean;
//   private repeat: RepeatMode;
//   private rngState: bigint;
// }
// ```
pub struct Queue {
    // What:     `Vec<PathBuf>` is an OWNED, growable array of owned paths.
    //           Sibling: `&[PathBuf]`, a borrowed slice that owns nothing.
    // Why:      The tracks in the order the user loaded them; the displayed
    //           queue list uses this order.
    // TS map:   `string[]`.
    tracks: Vec<PathBuf>,
    // What:     `Vec<usize>` is a growable array of indices into `tracks`.
    //           `usize` is the pointer-sized unsigned int used for indexing
    //           (siblings: `u32`, `u64`).
    // Why:      Playback order. Without shuffle it is 0,1,2,...; with shuffle
    //           it is a permutation of those indices.
    // TS map:   `number[]`.
    order: Vec<usize>,
    // What:     `Option<usize>` is "maybe an index": `Some(p)` or `None`.
    // Why:      The cursor's position WITHIN `order`. `None` means the queue
    //           is empty / nothing selected.
    // TS map:   `number | null`.
    pos: Option<usize>,
    /// Whether playback order is shuffled.
    shuffle: bool,
    /// Behaviour at the end of the queue / end of a track.
    repeat: RepeatMode,
    // What:     `u64` is an unsigned 64-bit integer (siblings: `u32`, `usize`,
    //           `i64`). Used as the running state of a tiny PRNG.
    // Why:      Shuffling needs randomness; a self-contained PRNG avoids a
    //           dependency and stays seedable for deterministic tests.
    // TS map:   `bigint` (JS numbers cannot hold 64 unsigned bits exactly).
    rng_state: u64,
}

impl Queue {
    // What:     `pub fn new() -> Queue` is the public constructor. `-> Queue`
    //           is the return type.
    // Why:      Creates an empty queue seeded from the clock so first-run
    //           shuffles differ between launches.
    // TS map:   A static factory `static new(): Queue`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // static new(): Queue { return new Queue(seedFromClock()); }
    // ```
    pub fn new() -> Queue {
        // What:     `std::time::{SystemTime, UNIX_EPOCH}` paths name two items:
        //           the wall-clock type and the "1970-01-01" reference point.
        // Why:      We derive a changing seed from the current time.
        // TS map:   `Date.now()` is the rough analogue.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const seed = BigInt(Date.now());
        // ```
        let seed = std::time::SystemTime::now()
            // What:     `.duration_since(UNIX_EPOCH)` returns
            //           `Result<Duration, _>` (Ok with the elapsed time, or Err
            //           if the clock is before 1970). `?`-style handling is
            //           avoided here; see the next call.
            // Why:      Turns "now" into "nanoseconds since 1970".
            // TS map:   `Date.now() - 0`.
            .duration_since(std::time::UNIX_EPOCH)
            // What:     `.map(|d| d.as_nanos() as u64)` transforms the Ok value
            //           if present. `|d| ...` is a closure (anonymous function)
            //           taking the `Duration` `d`. `d.as_nanos()` is a `u128`;
            //           `as u64` truncates it to 64 bits.
            // Why:      We only need 64 bits of entropy for the PRNG seed.
            // TS map:   `.then(d => Number(d.nanos))` — but here it's sync.
            .map(|d| d.as_nanos() as u64)
            // What:     `.unwrap_or(0x9e3779b97f4a7c15)` extracts the Ok number,
            //           or substitutes this constant (a well-known mixing
            //           constant) if the clock was weird. `_or` DROPS the error.
            // Why:      A non-zero fallback seed; xorshift must never start at 0.
            // TS map:   `?? 0x9e3779b97f4a7c15n`.
            .unwrap_or(0x9e3779b97f4a7c15);
        // What:     `Queue::with_rng_seed(seed)` calls the seeded constructor.
        //           No trailing `;`, so it is the tail expression / return.
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
        // What:     A struct literal `Queue { field: value, ... }` constructs the
        //           record. `Vec::new()` makes an empty owned array; `None` is
        //           the empty `Option`. No `;`, so this is the return value.
        // Why:      Start empty, not shuffled, repeat off.
        // TS map:   `return { tracks: [], order: [], pos: null, shuffle: false,
        //           repeat: "off", rngState: seed === 0n ? 1n : seed };`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { tracks: [], order: [], pos: null, shuffle: false,
        //          repeat: "off", rngState: seed === 0n ? 1n : seed };
        // ```
        Queue {
            tracks: Vec::new(),
            order: Vec::new(),
            pos: None,
            shuffle: false,
            repeat: RepeatMode::Off,
            // What:     `if seed == 0 { 1 } else { seed }` is an expression that
            //           evaluates to one of the two branch values (no `;`).
            // Why:      xorshift gets stuck forever at state 0, so forbid it.
            // TS map:   `seed === 0n ? 1n : seed`.
            rng_state: if seed == 0 { 1 } else { seed },
        }
    }

    // What:     `fn next_rand(&mut self) -> u64`. `&mut self` is a MUTABLE
    //           borrow of the queue: the method may change `self`'s fields but
    //           does not own/consume it. Private (no `pub`).
    // Why:      Advances and returns the PRNG state (xorshift64).
    // TS map:   `private nextRand(): bigint { ... mutates this.rngState ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private nextRand(): bigint { /* xorshift on this.rngState */ }
    // ```
    fn next_rand(&mut self) -> u64 {
        // What:     `let mut x = self.rng_state;` binds a LOCAL MUTABLE copy.
        //           `mut` marks it reassignable; without it, bindings are
        //           read-only by default.
        // Why:      We mutate a local then store it back, the classic xorshift.
        // TS map:   `let x = this.rngState;`
        let mut x = self.rng_state;
        // What:     `x ^= x << 13;` is xor-assign with a left-shift. `^` is
        //           bitwise XOR, `<<` is bitwise left shift. On `u64` these are
        //           plain wrapping bit ops (no overflow concept for shifts).
        // Why:      One of the three xorshift mixing steps.
        // TS map:   `x ^= x << 13n;` using BigInt, masked to 64 bits.
        x ^= x << 13;
        // What:     `x ^= x >> 7;` xor-assign with a right shift.
        // Why:      Second xorshift step.
        // TS map:   `x ^= x >> 7n;`
        x ^= x >> 7;
        // What:     `x ^= x << 17;` xor-assign with a left shift.
        // Why:      Third xorshift step.
        // TS map:   `x ^= x << 17n;`
        x ^= x << 17;
        // What:     `self.rng_state = x;` writes the new state back through the
        //           mutable borrow.
        // Why:      Persist the PRNG progress for the next call.
        // TS map:   `this.rngState = x;`
        self.rng_state = x;
        // What:     `x` alone on the last line is the tail expression: its value
        //           is returned.
        // Why:      Caller uses the fresh random number.
        // TS map:   `return x;`
        x
    }

    /// Number of tracks in the queue.
    // What:     `pub fn len(&self) -> usize`. `&self` is a read-only (shared)
    //           borrow; the method cannot mutate the queue.
    // Why:      Callers ask how many tracks there are.
    // TS map:   `get length(): number`.
    pub fn len(&self) -> usize {
        // What:     `self.tracks.len()` returns the array length as `usize`.
        //           Tail expression -> return value.
        // Why:      Report the count.
        // TS map:   `return this.tracks.length;`
        self.tracks.len()
    }

    /// Whether the queue has no tracks.
    // What:     `pub fn is_empty(&self) -> bool`. Read-only borrow.
    // Why:      Convenience predicate; clippy also prefers this beside `len`.
    // TS map:   `get isEmpty(): boolean`.
    pub fn is_empty(&self) -> bool {
        // What:     `self.tracks.is_empty()` -> bool. Tail expression.
        // Why:      Report emptiness.
        // TS map:   `return this.tracks.length === 0;`
        self.tracks.is_empty()
    }

    /// Current repeat mode.
    pub fn repeat(&self) -> RepeatMode {
        // What:     `self.repeat` is a `Copy` enum, so reading it copies it out.
        //           Tail expression.
        // Why:      Expose the mode to the engine/UI.
        // TS map:   `return this.repeat;`
        self.repeat
    }

    /// Whether shuffle is on.
    pub fn shuffle_on(&self) -> bool {
        self.shuffle
    }

    // What:     `pub fn display_names(&self) -> Vec<String>` returns owned
    //           filename strings in load order.
    // Why:      The UI shows filenames only (project policy); this builds that
    //           list once per queue change.
    // TS map:   `displayNames(): string[]`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // displayNames(): string[] {
    //   return this.tracks.map(p => basename(p) ?? p);
    // }
    // ```
    pub fn display_names(&self) -> Vec<String> {
        // What:     `self.tracks.iter()` makes a BORROWING iterator over
        //           `&PathBuf`. `.map(|p| ...)` transforms each. `.collect()`
        //           gathers the results into a `Vec<String>` (the target type is
        //           inferred from the return type). Tail expression -> return.
        // Why:      One pass turning each path into its display name.
        // TS map:   `return this.tracks.map(p => fileName(p));`
        self.tracks
            .iter()
            // What:     `|p|` is a closure taking `p: &PathBuf` (a borrow).
            //           `p.file_name()` returns `Option<&OsStr>` (maybe the last
            //           path component as an OS string). `.and_then(|n| ...)`
            //           runs the next step only if present, flattening nested
            //           options. `n.to_str()` returns `Option<&str>` (None if the
            //           bytes are not valid UTF-8). `.map(|s| s.to_string())`
            //           makes an OWNED copy. `.unwrap_or_else(|| ...)` supplies a
            //           fallback by calling a closure only when needed.
            // Why:      Show the bare filename; fall back to the whole path's
            //           lossy string when there is no filename or bad UTF-8.
            // TS map:   `p => basename(p) ?? p`.
            .map(|p| {
                p.file_name()
                    // What:     `.and_then(|n| n.to_str().map(|s| s.to_string()))`
                    //           chains optionals: if there is a filename AND it is
                    //           valid UTF-8, produce an owned `String`.
                    // Why:      Convert the OS string to a normal owned string.
                    // TS map:   filename may be undefined; map it to a string.
                    .and_then(|n| n.to_str().map(|s| s.to_string()))
                    // What:     `.unwrap_or_else(|| p.to_string_lossy().into_owned())`
                    //           provides the fallback. `to_string_lossy()` returns a
                    //           `Cow<str>` (borrowed-or-owned) replacing bad bytes;
                    //           `.into_owned()` forces an owned `String`.
                    // Why:      Always yield some readable label.
                    // TS map:   `?? String(p)`.
                    .unwrap_or_else(|| p.to_string_lossy().into_owned())
            })
            // What:     `.collect()` builds the `Vec<String>` from the iterator.
            // Why:      Materialise the list to hand to the UI.
            // TS map:   the `.map(...)` already yields the array.
            .collect()
    }

    // What:     `pub fn current_index(&self) -> Option<usize>` returns the
    //           LOAD-ORDER index of the current track (into `tracks`), or None.
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
        // What:     `self.pos.map(|p| self.order[p])`. `self.pos` is
        //           `Option<usize>`; `.map` runs the closure only if `Some`.
        //           `self.order[p]` indexes the order array. Tail -> return.
        // Why:      Translate the cursor's order-position into a track index.
        // TS map:   `return this.pos === null ? null : this.order[this.pos];`
        self.pos.map(|p| self.order[p])
    }

    // What:     `pub fn current_path(&self) -> Option<&PathBuf>` returns a
    //           BORROWED reference to the current path, or None. `&PathBuf` is a
    //           shared borrow tied to `self`'s lifetime.
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
        // What:     `self.current_index()` gives `Option<usize>`;
        //           `.map(|i| &self.tracks[i])` borrows the element. `&` here
        //           lends the path to the caller (no ownership transfer).
        // Why:      Avoid cloning the path on every access.
        // TS map:   `return i === null ? null : this.tracks[i];`
        self.current_index().map(|i| &self.tracks[i])
    }

    // What:     `pub fn set_repeat(&mut self, mode: RepeatMode)` mutates state.
    // Why:      The UI toggles repeat; record the new mode.
    // TS map:   `setRepeat(mode: RepeatMode): void`.
    pub fn set_repeat(&mut self, mode: RepeatMode) {
        // What:     plain field assignment through the mutable borrow.
        // Why:      Store it; traversal reads it later.
        // TS map:   `this.repeat = mode;`
        self.repeat = mode;
    }

    // What:     `pub fn set_tracks(&mut self, tracks: Vec<PathBuf>)`. The
    //           parameter is taken BY VALUE (ownership moves into the queue).
    // Why:      Replacing the queue when the user opens new files.
    // TS map:   `setTracks(tracks: string[]): void`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // setTracks(tracks: string[]): void {
    //   this.tracks = tracks;
    //   this.rebuildOrder();
    //   this.pos = tracks.length ? 0 : null;
    // }
    // ```
    pub fn set_tracks(&mut self, tracks: Vec<PathBuf>) {
        // What:     `self.tracks = tracks;` moves the new vector in, dropping
        //           (freeing) the old one.
        // Why:      Adopt the new track list.
        // TS map:   `this.tracks = tracks;`
        self.tracks = tracks;
        // What:     `self.rebuild_order();` calls a private helper (declared
        //           below) on `&mut self`.
        // Why:      Build the playback order to match the new tracks + shuffle.
        // TS map:   `this.rebuildOrder();`
        self.rebuild_order();
        // What:     `if self.tracks.is_empty() { None } else { Some(0) }` is an
        //           expression assigned to `self.pos`. `Some(0)` wraps index 0.
        // Why:      Start at the first track, or have no cursor when empty.
        // TS map:   `this.pos = this.tracks.length === 0 ? null : 0;`
        self.pos = if self.tracks.is_empty() { None } else { Some(0) };
    }

    // What:     `fn rebuild_order(&mut self)` private helper.
    // Why:      Recreates `order` as 0..n, then shuffles it in place if shuffle
    //           is on. Used by set_tracks and set_shuffle.
    // TS map:   `private rebuildOrder(): void`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private rebuildOrder(): void {
    //   this.order = [...Array(this.tracks.length).keys()];
    //   if (this.shuffle) this.shuffleOrder();
    // }
    // ```
    fn rebuild_order(&mut self) {
        // What:     `(0..self.tracks.len())` is a RANGE (half-open, excludes the
        //           end). `.collect()` turns it into `Vec<usize>` (type inferred
        //           from the field it is assigned to).
        // Why:      The identity order 0,1,2,...,n-1.
        // TS map:   `this.order = [...Array(n).keys()];`
        self.order = (0..self.tracks.len()).collect();
        // What:     `if self.shuffle { self.shuffle_order(); }` runs the shuffle
        //           only when enabled.
        // Why:      Keep load order unless shuffle is requested.
        // TS map:   `if (this.shuffle) this.shuffleOrder();`
        if self.shuffle {
            self.shuffle_order();
        }
    }

    // What:     `fn shuffle_order(&mut self)` private Fisher-Yates shuffle.
    // Why:      Randomly permute `order` using the built-in PRNG.
    // TS map:   `private shuffleOrder(): void`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private shuffleOrder(): void {
    //   for (let i = this.order.length - 1; i > 0; i--) {
    //     const j = Number(this.nextRand() % BigInt(i + 1));
    //     [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
    //   }
    // }
    // ```
    fn shuffle_order(&mut self) {
        // What:     `if self.order.len() < 2 { return; }` is an EARLY RETURN:
        //           nothing to shuffle for 0 or 1 elements.
        // Why:      Avoid the `len() - 1` underflow on an empty array (usize is
        //           unsigned, so 0 - 1 would panic in debug).
        // TS map:   `if (this.order.length < 2) return;`
        if self.order.len() < 2 {
            return;
        }
        // What:     `let mut i = self.order.len() - 1;` a mutable loop counter.
        // Why:      Fisher-Yates walks from the last index down to 1.
        // TS map:   `let i = this.order.length - 1;`
        let mut i = self.order.len() - 1;
        // What:     `while i > 0 { ... }` a condition-controlled loop.
        // Why:      Standard Fisher-Yates traversal.
        // TS map:   `while (i > 0) { ... }`
        while i > 0 {
            // What:     `self.next_rand()` returns a `u64`; `% (i as u64 + 1)` is
            //           modulo. `i as u64` casts the `usize` index to `u64` to
            //           match the PRNG's type; `as usize` casts the result back
            //           for indexing.
            // Why:      Pick a random slot `j` in `0..=i`.
            // TS map:   `const j = Number(this.nextRand() % BigInt(i + 1));`
            let j = (self.next_rand() % (i as u64 + 1)) as usize;
            // What:     `self.order.swap(i, j)` swaps two elements in place.
            // Why:      The shuffle step.
            // TS map:   `[order[i], order[j]] = [order[j], order[i]];`
            self.order.swap(i, j);
            // What:     `i -= 1;` decrement the counter.
            // Why:      Move toward the loop end.
            // TS map:   `i--;`
            i -= 1;
        }
    }

    // What:     `pub fn set_shuffle(&mut self, on: bool)` toggles shuffle while
    //           keeping the currently-playing track current.
    // Why:      Turning shuffle on/off should not interrupt the current song.
    // TS map:   `setShuffle(on: boolean): void`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // setShuffle(on: boolean): void {
    //   if (on === this.shuffle) return;
    //   const cur = this.currentIndex();
    //   this.shuffle = on;
    //   this.rebuildOrder();
    //   this.pos = cur === null ? this.pos
    //            : this.order.indexOf(cur);
    // }
    // ```
    pub fn set_shuffle(&mut self, on: bool) {
        // What:     early return when nothing changes.
        // Why:      Avoid reshuffling (and moving the cursor) on a no-op.
        // TS map:   `if (on === this.shuffle) return;`
        if on == self.shuffle {
            return;
        }
        // What:     `let current = self.current_index();` remembers the playing
        //           track (Option<usize>) before we rebuild the order.
        // Why:      So we can restore the cursor onto the same track afterward.
        // TS map:   `const current = this.currentIndex();`
        let current = self.current_index();
        // What:     `self.shuffle = on;` record the new flag.
        // Why:      rebuild_order reads it.
        // TS map:   `this.shuffle = on;`
        self.shuffle = on;
        // What:     rebuild the order array (shuffled or identity).
        // Why:      Apply the new mode.
        // TS map:   `this.rebuildOrder();`
        self.rebuild_order();
        // What:     `if let Some(track) = current { ... }` is a one-arm pattern
        //           match: run the block only when `current` is `Some`, binding
        //           the inner value to `track`.
        // Why:      Re-point the cursor at the previously playing track's new
        //           position in `order`.
        // TS map:   `if (current !== null) { ... }`
        if let Some(track) = current {
            // What:     `self.order.iter().position(|&x| x == track)` finds the
            //           index where the order array holds `track`. `iter()`
            //           borrows; `|&x|` is a closure that DESTRUCTURES the borrow
            //           so `x` is a `usize` value, not `&usize`. `.position`
            //           returns `Option<usize>`.
            // Why:      Locate where the current track landed after shuffling.
            // TS map:   `this.pos = this.order.indexOf(track);` (indexOf returns
            //           -1 when missing; here it is always found).
            self.pos = self.order.iter().position(|&x| x == track);
        }
    }

    // What:     `pub fn play_index(&mut self, track: usize) -> Option<usize>`
    //           selects a specific track (load-order index) as current.
    // Why:      The user clicked a row in the queue list.
    // TS map:   `playIndex(track: number): number | null`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // playIndex(track: number): number | null {
    //   const p = this.order.indexOf(track);
    //   if (p < 0) return null;
    //   this.pos = p;
    //   return track;
    // }
    // ```
    pub fn play_index(&mut self, track: usize) -> Option<usize> {
        // What:     find the order-position of the requested track index.
        // Why:      The cursor stores an order-position, not a track index.
        // TS map:   `const p = this.order.indexOf(track);`
        let position = self.order.iter().position(|&x| x == track);
        // What:     `if let Some(p) = position { self.pos = Some(p); }` updates
        //           the cursor only when the track exists.
        // Why:      Guard against an out-of-range click.
        // TS map:   `if (p >= 0) this.pos = p;`
        if let Some(p) = position {
            self.pos = Some(p);
        }
        // What:     `position.map(|_| track)` turns Some(p) into Some(track) and
        //           keeps None as None. `|_|` ignores the closure argument.
        //           Tail expression -> return.
        // Why:      Report the now-current track index, or None if not found.
        // TS map:   `return p < 0 ? null : track;`
        position.map(|_| track)
    }

    // What:     `pub fn advance(&mut self, natural: bool) -> Option<usize>`.
    //           `natural` is true when a track ended on its own, false when the
    //           user pressed Next.
    // Why:      End-of-track and Next share most logic but differ for repeat-one.
    // TS map:   `advance(natural: boolean): number | null`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // advance(natural: boolean): number | null {
    //   if (this.pos === null) return null;
    //   if (natural && this.repeat === "one") return this.order[this.pos];
    //   const next = this.pos + 1;
    //   if (next < this.order.length) { this.pos = next; return this.order[next]; }
    //   if (this.repeat === "all") { this.pos = 0; return this.order[0]; }
    //   return null; // end of queue, stop
    // }
    // ```
    pub fn advance(&mut self, natural: bool) -> Option<usize> {
        // What:     `let pos = match self.pos { Some(p) => p, None => return None };`
        //           A `match` on the Option. The `None => return None` arm exits
        //           the whole function early. Otherwise bind the inner `p`.
        // Why:      No cursor means nothing to advance.
        // TS map:   `if (this.pos === null) return null; const pos = this.pos;`
        let pos = match self.pos {
            // What:     `Some(p) => p` extracts the index.
            // Why:      Continue with a concrete position.
            // TS map:   the non-null branch.
            Some(p) => p,
            // What:     `None => return None` short-circuits out of `advance`.
            // Why:      Empty queue.
            // TS map:   `return null;`
            None => return None,
        };
        // What:     `if natural && self.repeat == RepeatMode::One { ... }`. `&&`
        //           is logical AND; `==` compares the Copy enum.
        // Why:      A track that ended under repeat-one replays itself.
        // TS map:   `if (natural && this.repeat === "one") return order[pos];`
        if natural && self.repeat == RepeatMode::One {
            // What:     `Some(self.order[pos])` wraps the current track index as
            //           the return value (cursor unchanged). Tail of the `if`.
            // Why:      Signal "play this same track again".
            // TS map:   `return this.order[pos];`
            return Some(self.order[pos]);
        }
        // What:     `let next = pos + 1;` compute the following position.
        // Why:      Try to move forward.
        // TS map:   `const next = pos + 1;`
        let next = pos + 1;
        // What:     `if next < self.order.len() { ... }` bounds check.
        // Why:      There is a track after the current one.
        // TS map:   `if (next < this.order.length) { ... }`
        if next < self.order.len() {
            // What:     update cursor and return the new track index.
            // Why:      Normal forward step.
            // TS map:   `this.pos = next; return this.order[next];`
            self.pos = Some(next);
            return Some(self.order[next]);
        }
        // What:     `if self.repeat == RepeatMode::All { ... }` wrap-around case.
        // Why:      At the end with repeat-all, loop to the front.
        // TS map:   `if (this.repeat === "all") { this.pos = 0; return order[0]; }`
        if self.repeat == RepeatMode::All {
            // What:     `Some(0)` wraps index 0; set cursor to the front.
            // Why:      Restart the queue.
            // TS map:   `this.pos = 0;`
            self.pos = Some(0);
            // What:     return the first track's index. Tail of the `if`.
            // Why:      Begin playing the wrapped track.
            // TS map:   `return this.order[0];`
            return Some(self.order[0]);
        }
        // What:     `None` is the function's tail expression: end of queue, no
        //           next track, stop playback.
        // Why:      Repeat is off and we are past the last track.
        // TS map:   `return null;`
        None
    }

    // What:     `pub fn prev(&mut self) -> Option<usize>` steps backward.
    // Why:      The user pressed Previous.
    // TS map:   `prev(): number | null`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // prev(): number | null {
    //   if (this.pos === null) return null;
    //   if (this.pos > 0) { this.pos--; return this.order[this.pos]; }
    //   if (this.repeat === "all") { this.pos = this.order.length - 1; return this.order[this.pos]; }
    //   return this.order[0]; // at first track: restart it
    // }
    // ```
    pub fn prev(&mut self) -> Option<usize> {
        // What:     match the cursor; early-return None when empty.
        // Why:      Nothing to go back to.
        // TS map:   `if (this.pos === null) return null; const pos = this.pos;`
        let pos = match self.pos {
            Some(p) => p,
            None => return None,
        };
        // What:     `if pos > 0 { ... }` there is a previous slot.
        // Why:      Normal backward step.
        // TS map:   `if (pos > 0) { ... }`
        if pos > 0 {
            // What:     decrement cursor, return that track index.
            // Why:      Move to the previous track.
            // TS map:   `this.pos = pos - 1; return this.order[pos - 1];`
            self.pos = Some(pos - 1);
            return Some(self.order[pos - 1]);
        }
        // What:     at the first track; `if self.repeat == RepeatMode::All`
        //           wraps to the last track.
        // Why:      Repeat-all makes Previous loop to the end.
        // TS map:   `if (this.repeat === "all") { ... last ... }`
        if self.repeat == RepeatMode::All {
            // What:     `let last = self.order.len() - 1;` last index.
            // Why:      Target for the wrap.
            // TS map:   `const last = this.order.length - 1;`
            let last = self.order.len() - 1;
            // What:     set cursor to last, return that track index.
            // Why:      Wrap behaviour.
            // TS map:   `this.pos = last; return this.order[last];`
            self.pos = Some(last);
            return Some(self.order[last]);
        }
        // What:     `Some(self.order[0])` tail: at the first track with no
        //           repeat-all, Previous just restarts the current (first) track.
        // Why:      Common player behaviour; cursor stays at 0.
        // TS map:   `return this.order[0];`
        Some(self.order[0])
    }
}

// What:     `impl Default for Queue { ... }` lets `Queue::default()` work and
//           satisfies clippy's "type with new() should impl Default" lint.
// Why:      Idiomatic; some generic code expects `Default`.
// TS map:   no analogue; just an extra factory delegating to `new`.
//
// In TS you'd write (pseudocode):
// ```ts
// // Queue.default() === Queue.new()
// ```
impl Default for Queue {
    fn default() -> Queue {
        // What:     delegate to `new()`. Tail expression.
        // Why:      One source of truth for construction.
        // TS map:   `return Queue.new();`
        Queue::new()
    }
}

// What:     `#[cfg(test)] mod tests { ... }` declares a submodule compiled ONLY
//           during `cargo test`. `#[cfg(test)]` is a conditional-compilation
//           attribute.
// Why:      Keep tests next to the code without shipping them in the binary.
// TS map:   like a `*.test.ts` file, but inlined and compiled out of prod.
//
// In TS you'd write (pseudocode):
// ```ts
// // queue.test.ts
// ```
#[cfg(test)]
mod tests {
    // What:     `use super::*;` imports everything from the parent module (the
    //           queue) into the test scope. `super` means "one level up".
    // Why:      Tests need `Queue`, `RepeatMode`, etc.
    // TS map:   `import * as parent from "./queue";`
    use super::*;

    // What:     `fn paths(n: usize) -> Vec<PathBuf>` test helper building `n`
    //           fake paths "0".."n-1".
    // Why:      Tracks' contents do not matter for queue logic, only their count.
    // TS map:   `function paths(n: number): string[]`.
    fn paths(n: usize) -> Vec<PathBuf> {
        // What:     `(0..n)` range; `.map(|i| PathBuf::from(i.to_string()))`
        //           turns each number into a path. `i.to_string()` allocates a
        //           `String`; `PathBuf::from` wraps it as a path. `.collect()`
        //           gathers into the Vec. Tail expression.
        // Why:      Distinct dummy paths.
        // TS map:   `return [...Array(n).keys()].map(i => String(i));`
        (0..n).map(|i| PathBuf::from(i.to_string())).collect()
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
    fn advance_walks_forward_then_stops_when_repeat_off() {
        let mut q = Queue::with_rng_seed(1);
        q.set_tracks(paths(3));
        // What:     natural=false (user pressed Next). Expect 1, then 2, then None.
        // Why:      Linear traversal, stop past the end with repeat Off.
        // TS map:   `expect(q.advance(false)).toBe(1);` etc.
        assert_eq!(q.advance(false), Some(1));
        assert_eq!(q.advance(false), Some(2));
        assert_eq!(q.advance(false), None);
    }

    #[test]
    fn repeat_all_wraps_at_end() {
        let mut q = Queue::with_rng_seed(1);
        q.set_tracks(paths(2));
        // What:     enable repeat-all.
        // Why:      End should wrap to the front.
        // TS map:   `q.setRepeat("all");`
        q.set_repeat(RepeatMode::All);
        assert_eq!(q.advance(false), Some(1));
        // What:     past the end wraps to 0.
        // Why:      Repeat-all behaviour.
        // TS map:   `expect(q.advance(false)).toBe(0);`
        assert_eq!(q.advance(false), Some(0));
    }

    #[test]
    fn repeat_one_replays_on_natural_end_only() {
        let mut q = Queue::with_rng_seed(1);
        q.set_tracks(paths(3));
        q.set_repeat(RepeatMode::One);
        // What:     natural=true: a track that ended replays itself (stays 0).
        // Why:      Repeat-one semantics.
        // TS map:   `expect(q.advance(true)).toBe(0);`
        assert_eq!(q.advance(true), Some(0));
        // What:     natural=false: the user pressing Next still advances to 1.
        // Why:      Repeat-one must not trap the user on one track.
        // TS map:   `expect(q.advance(false)).toBe(1);`
        assert_eq!(q.advance(false), Some(1));
    }

    #[test]
    fn prev_steps_back_and_restarts_at_first() {
        let mut q = Queue::with_rng_seed(1);
        q.set_tracks(paths(3));
        // What:     move forward to index 1, then back to 0.
        // Why:      Backward stepping.
        // TS map:   advance then prev.
        assert_eq!(q.advance(false), Some(1));
        assert_eq!(q.prev(), Some(0));
        // What:     prev at the first track (repeat off) returns 0 (restart).
        // Why:      No wrap without repeat-all.
        // TS map:   `expect(q.prev()).toBe(0);`
        assert_eq!(q.prev(), Some(0));
    }

    #[test]
    fn prev_wraps_to_last_with_repeat_all() {
        let mut q = Queue::with_rng_seed(1);
        q.set_tracks(paths(3));
        q.set_repeat(RepeatMode::All);
        // What:     prev at the first track wraps to the last (index 2).
        // Why:      Repeat-all backward wrap.
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
    fn shuffle_keeps_current_track_and_covers_all() {
        let mut q = Queue::with_rng_seed(12345);
        q.set_tracks(paths(6));
        // What:     advance to track 2, then enable shuffle.
        // Why:      Toggling shuffle must keep track 2 current.
        // TS map:   advance twice, setShuffle(true).
        assert_eq!(q.advance(false), Some(1));
        assert_eq!(q.advance(false), Some(2));
        q.set_shuffle(true);
        // What:     after shuffling, the current track is still 2.
        // Why:      The contract of set_shuffle.
        // TS map:   `expect(q.currentIndex()).toBe(2);`
        assert_eq!(q.current_index(), Some(2));
        // What:     collect every track reachable by repeated advance under
        //           repeat-all, then confirm all 6 indices appear.
        // Why:      A valid shuffle is a permutation: no track lost or duplicated
        //           within one cycle.
        // TS map:   gather order via advance() and compare as a set.
        q.set_repeat(RepeatMode::All);
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
        // Why:      One full cycle visits every other track exactly once.
        // TS map:   `for (let i = 0; i < 6; i++) { ... }`
        for _ in 0..6 {
            // What:     `if let Some(t) = q.advance(false) { seen.insert(t); }`
            //           advance and record.
            // Why:      Walk the shuffled order.
            // TS map:   `const t = q.advance(false); if (t !== null) seen.add(t);`
            if let Some(t) = q.advance(false) {
                seen.insert(t);
            }
        }
        // What:     `seen.len()` should be 6 (all tracks seen).
        // Why:      Proves the shuffle is a full permutation.
        // TS map:   `expect(seen.size).toBe(6);`
        assert_eq!(seen.len(), 6);
    }

    #[test]
    fn turning_shuffle_off_restores_load_order() {
        let mut q = Queue::with_rng_seed(999);
        q.set_tracks(paths(4));
        q.set_shuffle(true);
        // What:     turn shuffle back off.
        // Why:      Order should return to 0,1,2,3 traversal.
        // TS map:   `q.setShuffle(false);`
        q.set_shuffle(false);
        // What:     starting from current (0), advancing gives 1,2,3 in order.
        // Why:      Confirm identity order restored.
        // TS map:   advance() === 1, 2, 3.
        assert_eq!(q.current_index(), Some(0));
        assert_eq!(q.advance(false), Some(1));
        assert_eq!(q.advance(false), Some(2));
        assert_eq!(q.advance(false), Some(3));
    }
}
