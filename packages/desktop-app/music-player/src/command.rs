//! Messages that cross the boundary between the UI thread and the engine
//! thread. `Command` flows UI -> engine; `Update` flows engine -> UI.

// What:     `use std::path::PathBuf;` pulls the `PathBuf` type into scope.
//           `PathBuf` is an OWNED, growable filesystem path (heap-allocated).
//           Sibling the reader might expect: `&Path`, a BORROWED path slice
//           that does not own its bytes (like `&str` is to `String`).
// Why:      Commands carry file paths the user opened; the engine keeps them
//           after the UI call returns, so they must be owned, not borrowed.
// TS map:   There is no owned/borrowed split in TS; mentally this is just
//           `string` used as a path.
//
// In TS you'd write (pseudocode):
// ```ts
// type PathBuf = string; // a filesystem path
// ```
use std::path::PathBuf;

// What:     `use serde::{Deserialize, Serialize};` imports two DERIVE MACROS.
//           A derive macro auto-generates code for a type when you write
//           `#[derive(...)]` above it. `Serialize` generates "turn this into
//           JSON", `Deserialize` generates "build this from JSON".
// Why:      `ShuffleMode` is saved to the session file on disk, so it needs
//           both directions of conversion.
// TS map:   No direct equivalent; imagine importing a decorator that makes a
//           class JSON-roundtrippable, e.g. `import { Serializable } from ...`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Serializable } from "some-json-lib";
// ```
use serde::{Deserialize, Serialize};

// What:     `#[derive(...)]` is an ATTRIBUTE that runs the listed macros to
//           auto-implement behaviour for the enum below:
//           - `Clone` / `Copy`: makes the value duplicable. `Copy` means it
//             is cheap enough to duplicate implicitly on assignment (like a
//             number), not moved. Sibling: a type WITHOUT `Copy` is "moved"
//             (the old binding becomes unusable).
//           - `Debug`: enables `{:?}` formatting for logging.
//           - `PartialEq` / `Eq`: enables `==` comparison.
//           - `Serialize` / `Deserialize`: JSON conversion (see import above).
// Why:      We compare shuffle modes with `==`, copy them around freely, log
//           them, and persist them; each derive unlocks one of those.
//           `Default` is added here too (instead of a hand-written `impl
//           Default`) and reads the `#[default]` marker on the `Off` variant
//           below; clippy flags a manual `impl` that just returns one variant.
// TS map:   TS gives `==`, structural equality, and JSON for free on a string
//           union, so no annotation is needed there.
//
// In TS you'd write (pseudocode):
// ```ts
// // nothing — the union below just works with ===, JSON, console.log
// ```
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
// What:     `pub enum ShuffleMode { ... }` declares a PUBLIC enum: a type whose
//           value is exactly one of the listed variants. Here the variants
//           carry no data (plain tags).
// Why:      Encodes the three shuffle behaviours. Shuffle now also chooses the
//           SCOPE that playback loops over, so it subsumes what a separate
//           repeat-all/off setting used to do (see the design note below).
// TS map:   A string-literal union type.
//
// In TS you'd write (pseudocode):
// ```ts
// type ShuffleMode = "off" | "withinPage" | "all";
// ```
//
// Design decision (deliberate limitation): the repeat behaviour when "repeat
// track" is OFF is derived from this mode, not set independently. `Off` and
// `WithinPage` confine playback to the current page (the track's top-level
// folder, or its A-Z/`#` letter bucket for a root-level track) and loop WITHIN
// that page; only `All` traverses and loops the whole queue. There is therefore
// no way to express "play the whole queue in load order and loop the whole
// queue" (non-shuffle + repeat-all): when not shuffling, the user stays inside
// the current folder/page. This is intended: when playing in order, people do
// not want playback to jump to a different artist once a folder finishes.
pub enum ShuffleMode {
    // What:     `#[default]` marks this variant as the one `derive(Default)`
    //           returns from `ShuffleMode::default()`. It is an ATTRIBUTE on the
    //           variant, not code.
    // Why:      A brand-new session with no saved file should start unshuffled;
    //           the derive then writes the `Default` impl for us.
    // TS map:   `const DEFAULT_SHUFFLE: ShuffleMode = "off";`
    #[default]
    /// Play the current page in load order, looping within the page.
    Off,
    /// Shuffle the current page, looping within the page once all are played.
    WithinPage,
    /// Shuffle the whole queue, looping the queue once all are played.
    All,
}

// What:     `pub enum Command { ... }` declares the public set of actions the
//           UI can ask the engine to perform. Several variants carry data in
//           parentheses (a tuple variant), e.g. `Seek(f64)`.
// Why:      A single message type lets the UI talk to the engine over one
//           channel; the engine matches on the variant to decide what to do.
// TS map:   A discriminated union of action objects.
//
// In TS you'd write (pseudocode):
// ```ts
// type Command =
//   | { kind: "openPaths"; paths: string[]; play: boolean }
//   | { kind: "togglePlay" } | { kind: "play" } | { kind: "pause" }
//   | { kind: "next" } | { kind: "prev" }
//   | { kind: "selectIndex"; index: number }
//   | { kind: "seek"; secs: number }
//   | { kind: "setVolume"; volume: number }
//   | { kind: "setShuffle"; mode: ShuffleMode }
//   | { kind: "setRepeatTrack"; on: boolean }
//   | { kind: "quit" };
// ```
pub enum Command {
    // What:     `OpenPaths { paths: Vec<PathBuf>, play: bool }` is a STRUCT variant:
    //           replace the queue with these files/folders (folders are expanded
    //           recursively to their files), then either start playing
    //           (`play: true`) or just load the first track PAUSED (`play: false`).
    // Why:      A user-initiated open should play; the launch-time auto-load of the
    //           music directory should populate the queue without blasting audio.
    // TS map:   `{ kind: "openPaths"; paths: string[]; play: boolean }`
    OpenPaths {
        // What:     `paths: Vec<PathBuf>` files/folders to open (owned paths).
        // Why:      Source of the new queue.
        // TS map:   `paths: string[]`.
        paths: Vec<PathBuf>,
        // What:     `play: bool` whether to start playing once loaded.
        // Why:      Distinguishes a user open (play) from the auto-load (paused).
        // TS map:   `play: boolean`.
        play: bool,
    },
    /// Flip between playing and paused.
    TogglePlay,
    /// Resume playback.
    Play,
    /// Pause playback (keep position).
    Pause,
    /// Skip to the next track.
    Next,
    /// Skip to the previous track.
    Prev,
    // What:     `SelectIndex(usize)` makes the track at this queue position current
    //           and loads it PAUSED (it does not start playback). A single click on
    //           an unselected row sends this; a second click on the now-current row
    //           sends `TogglePlay` to start it, so "select then play" needs no
    //           double-click detection.
    // Why:      Selecting and playing are distinct user intents: a click highlights
    //           and loads a track (pausing whatever was playing), and only a click on
    //           the already-selected row begins playback.
    // TS map:   `{ kind: "selectIndex"; index: number }`
    SelectIndex(usize),
    // What:     `Seek(f64)` carries a target time in SECONDS as an `f64`.
    //           Siblings: `f32`, `u64` frames, `Duration`.
    // Why:      Same seconds-as-f64 unit as `Position`/`duration`; the engine
    //           converts these seconds back into an exact frame offset for the
    //           decoder. Not `f32` (too coarse for long tracks), not `u64`
    //           frames (UI does not know the per-track rate), not `Duration`
    //           (awkward fractional value from a slider drag).
    // TS map:   `{ kind: "seek"; secs: number }`.
    Seek(f64),
    // What:     `SetVolume(f32)` is a gain in 0.0..=1.0 as an `f32`. Sibling:
    //           `f64`.
    // Why:      `f32` matches PipeWire's f32 samples and Slint's `float`, and a
    //           0..1 gain gains nothing from `f64` precision.
    // TS map:   `{ kind: "setVolume"; volume: number }`.
    SetVolume(f32),
    /// Set the shuffle mode (off / within-page / all).
    SetShuffle(ShuffleMode),
    /// Turn "repeat track" (replay the current track on its natural end) on or off.
    SetRepeatTrack(bool),
    // What:     `Restore { ... }` is a STRUCT variant carrying a saved session to
    //           reinstate at launch: the queue paths, which track was current,
    //           the position, and the volume/shuffle/repeat settings. The engine
    //           loads the current track PAUSED at the saved position.
    // Why:      Sent once on startup to resume where the user left off, without
    //           coupling this enum to the persistence `Session` type.
    // TS map:   `{ kind: "restore"; tracks: string[]; current: number | null;
    //             position: number; volume: number; shuffle: ShuffleMode; repeatTrack: boolean }`
    Restore {
        // What:     `tracks: Vec<PathBuf>` the saved queue in load order.
        // Why:      Rebuild the queue.
        // TS map:   `tracks: string[]`.
        tracks: Vec<PathBuf>,
        // What:     `current: Option<usize>` which track was current (or `None`).
        // Why:      Position the cursor on restore.
        // TS map:   `current: number | null`.
        current: Option<usize>,
        // What:     `position: f64` saved playback position in seconds (same
        //           seconds-as-f64 unit as `Seek`/`Position`).
        // Why:      Resume mid-track.
        // TS map:   `position: number`.
        position: f64,
        // What:     `volume: f32` saved gain.
        // Why:      Restore the last volume.
        // TS map:   `volume: number`.
        volume: f32,
        // What:     `shuffle: ShuffleMode` saved shuffle mode.
        // Why:      Restore shuffle.
        // TS map:   `shuffle: ShuffleMode`.
        shuffle: ShuffleMode,
        // What:     `repeat_track: bool` saved "repeat track" flag.
        // Why:      Restore whether the current track replays on its natural end.
        // TS map:   `repeatTrack: boolean`.
        repeat_track: bool,
    },
    /// Shut the engine thread down.
    Quit,
}

// What:     `pub enum Update { ... }` declares the messages the engine pushes
//           back to the UI so the on-screen state stays in sync.
//           `NowPlaying { ... }` is a STRUCT variant: it names its fields
//           instead of using positional tuple slots.
// Why:      The engine owns the real playback state; the UI only mirrors it,
//           and these updates are how the mirror is refreshed.
// TS map:   Another discriminated union.
//
// In TS you'd write (pseudocode):
// ```ts
// type Update =
//   | { kind: "queue"; names: string[] }
//   | { kind: "nowPlaying"; index: number | null; name: string; duration: number }
//   | { kind: "position"; secs: number }
//   | { kind: "playing"; on: boolean }
//   | { kind: "volume"; volume: number }
//   | { kind: "shuffle"; mode: ShuffleMode }
//   | { kind: "repeatTrack"; on: boolean };
// ```
pub enum Update {
    /// The full queue as display paths, each relative to the queue's common root
    /// (e.g. `Artist/Album/01.flac`, or a bare filename for a single-folder queue).
    Queue(Vec<String>),
    /// The current track changed. `index` is its position in the queue, or
    /// `None` when nothing is loaded.
    NowPlaying {
        // What:     `Option<usize>` is the "maybe a number" type. `Option<T>`
        //           has two variants: `Some(value)` or `None`. `usize` is the
        //           pointer-sized unsigned integer used for indices (siblings:
        //           `u32`, `u64`).
        // Why:      There may be no current track (empty queue), so the index
        //           is optional.
        // TS map:   `index: number | null`.
        index: Option<usize>,
        /// Display path of the current track, relative to the queue root (the same
        /// string the list row shows, e.g. `r-906/diaLOG/06 V.flac`), used for the
        /// window title; falls back to the bare filename if the index is absent.
        name: String,
        // What:     `duration: f64` is the track length in SECONDS as an `f64`
        //           (64-bit IEEE double). Siblings the reader might expect:
        //           `f32` (32-bit float), `u64` (a frame/sample count), or
        //           `std::time::Duration`.
        // Why:      Seconds-as-f64 is our cross-thread time unit. Not `f32`: its
        //           ~7-significant-digit precision cannot resolve sub-second
        //           detail once a track passes a few minutes (near 3600 s an
        //           f32's step is ~0.25 s). Not `u64` frames: the UI thinks in
        //           seconds and does not know each track's sample rate (it
        //           varies per file). Not `Duration`: clumsy for a fractional
        //           seek-bar value. The value is narrowed to Slint's `float`
        //           (f32) only at the property edge, where display coarseness
        //           is harmless.
        // TS map:   `duration: number` (JS `number` is already f64).
        duration: f64,
    },
    // What:     `Position(f64)` carries the live playback position in SECONDS as
    //           an `f64`. Siblings: `f32`, `u64` frames, `Duration` (see the
    //           `duration` field above for why f64 wins).
    // Why:      Same time unit as `duration` so the seek bar can compare them
    //           directly; the engine derives it from an exact frame count.
    // TS map:   `position: number`.
    Position(f64),
    /// Whether audio is currently playing (true) or paused (false).
    Playing(bool),
    // What:     `Volume(f32)` is a gain in 0.0..=1.0 as an `f32` (32-bit float).
    //           Sibling: `f64` (double).
    // Why:      `f32` not `f64` because a 0..1 gain needs no double precision
    //           and it matches BOTH PipeWire's f32 PCM samples and Slint's
    //           `float` (also f32), so no conversion happens at either edge.
    // TS map:   `volume: number`.
    Volume(f32),
    /// Current shuffle mode (off / within-page / all).
    Shuffle(ShuffleMode),
    /// Whether "repeat track" is on.
    RepeatTrack(bool),
}
