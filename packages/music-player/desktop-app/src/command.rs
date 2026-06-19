//! Messages that cross the boundary between the UI thread and the engine
//! thread. `Command` flows UI -> engine; `Update` flows engine -> UI.

/// What:     `use std::path::PathBuf;` pulls the `PathBuf` type into scope. `PathBuf`
///           is an OWNED, growable filesystem path (heap-allocated). Sibling the
///           reader might expect: `&Path`, a BORROWED path slice that does not own
///           its bytes (like `&str` is to `String`).
/// Why:      Commands carry file paths the user opened; the engine keeps them after
///           the UI call returns, so they must be owned, not borrowed.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type PathBuf = string; // a filesystem path
/// ```
use std::path::PathBuf;

/// What:     `use serde::{Deserialize, Serialize};` imports two DERIVE MACROS. A
///           derive macro auto-generates code for a type when you write
///           `#[derive(...)]` above it. `Serialize` generates "turn this into JSON",
///           `Deserialize` generates "build this from JSON".
/// Why:      `ShuffleMode` is saved to the session file on disk, so it needs both
///           directions of conversion.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Serializable } from "some-json-lib";
/// ```
use serde::{Deserialize, Serialize};

// What:     `#[derive(...)]` is an ATTRIBUTE that runs the listed macros to
//           auto-implement behaviour for the enum below:
//           - `Clone` / `Copy`: makes the value duplicable. `Copy` means it is cheap
//             enough to duplicate implicitly on assignment (like a number), not
//             moved. Sibling: a type WITHOUT `Copy` is "moved" (the old binding
//             becomes unusable).
//           - `Debug`: enables `{:?}` formatting for logging.
//           - `PartialEq` / `Eq`: enables `==` comparison.
//           - `Serialize` / `Deserialize`: JSON conversion (see import above).
//           - `Default`: a zero-arg constructor reading the `#[default]` marker below.
// Why:      We compare shuffle modes with `==`, copy them around freely, log them,
//           and persist them; each derive unlocks one of those. `Default` is added
//           here (instead of a hand-written `impl Default`) and reads the `#[default]`
//           marker on the `Off` variant; clippy flags a manual `impl` that just
//           returns one variant.
//
// In TS you'd write (pseudocode):
// ```ts
// // nothing — the union below just works with ===, JSON, console.log
// ```
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
/// What:     `pub enum ShuffleMode { ... }` declares a PUBLIC enum: a type whose value
///           is exactly one of the listed variants. Here the variants carry no data
///           (plain tags).
/// Why:      Encodes the three shuffle behaviours. Shuffle now also chooses the SCOPE
///           that playback loops over, so it subsumes what a separate repeat-all/off
///           setting used to do (see the design note below).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type ShuffleMode = "off" | "withinPage" | "all";
/// ```
///
/// Design decision (deliberate limitation): the repeat behaviour when "repeat
/// track" is OFF is derived from this mode, not set independently. `Off` and
/// `WithinPage` confine playback to the current page (the track's top-level
/// folder, or its A-Z/`#` letter bucket for a root-level track) and loop WITHIN
/// that page; only `All` traverses and loops the whole queue. There is therefore
/// no way to express "play the whole queue in load order and loop the whole
/// queue" (non-shuffle + repeat-all): when not shuffling, the user stays inside
/// the current folder/page. This is intended: when playing in order, people do
/// not want playback to jump to a different artist once a folder finishes.
pub enum ShuffleMode {
    // What:     `#[default]` marks this variant as the one `derive(Default)` returns
    //           from `ShuffleMode::default()`. It is an ATTRIBUTE on the variant, not
    //           code.
    // Why:      A brand-new session with no saved file should start unshuffled; the
    //           derive then writes the `Default` impl for us.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const DEFAULT_SHUFFLE: ShuffleMode = "off";
    // ```
    #[default]
    /// What:     `Off` a fieldless enum variant.
    /// Why:      Play the current page in load order, looping within the page.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// "off"
    /// ```
    Off,
    /// What:     `WithinPage` a fieldless enum variant.
    /// Why:      Shuffle the current page, looping within the page once all are played.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// "withinPage"
    /// ```
    WithinPage,
    /// What:     `All` a fieldless enum variant.
    /// Why:      Shuffle the whole queue, looping the queue once all are played.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// "all"
    /// ```
    All,
}

/// What:     `pub enum Command { ... }` declares the public set of actions the UI can
///           ask the engine to perform. Several variants carry data in parentheses (a
///           tuple variant), e.g. `Seek(f64)`.
/// Why:      A single message type lets the UI talk to the engine over one channel;
///           the engine matches on the variant to decide what to do.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Command =
///   | { kind: "openPaths"; paths: string[]; play: boolean }
///   | { kind: "togglePlay" } | { kind: "play" } | { kind: "pause" }
///   | { kind: "next" } | { kind: "prev" }
///   | { kind: "selectIndex"; index: number }
///   | { kind: "seek"; secs: number }
///   | { kind: "setVolume"; volume: number }
///   | { kind: "setShuffle"; mode: ShuffleMode }
///   | { kind: "setRepeatTrack"; on: boolean }
///   | { kind: "quit" };
/// ```
pub enum Command {
    /// What:     `OpenRoot { root: PathBuf, select: Option<PathBuf>, play: bool }` is a
    ///           STRUCT variant: set the Source Root to `root`, scan it recursively to
    ///           build the queue, optionally preselect `select` (the file a single-file
    ///           launch named), then either start playing (`play: true`) or load PAUSED
    ///           (`play: false`).
    /// Why:      Exactly one directory Source Root identifies what is loaded. Only a
    ///           command-line launch with `--start-playing` sets `play: true`; the folder
    ///           picker and the music-directory auto-load pass `false` (load paused) so
    ///           the app never blasts audio just from being opened.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "openRoot"; root: string; select: string | null; play: boolean }
    /// ```
    OpenRoot {
        /// What:     `root: PathBuf` the directory to scan into the queue (owned path).
        /// Why:      The Source Root whose scan IS the queue.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// root: string;
        /// ```
        root: PathBuf,
        /// What:     `select: Option<PathBuf>` a track to preselect (`Some`), or `None` to
        ///           open with nothing selected.
        /// Why:      A single-file launch names its parent as the root and preselects the
        ///           file; a folder open selects nothing.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// select: string | null;
        /// ```
        select: Option<PathBuf>,
        /// What:     `play: bool` whether to start playing once loaded.
        /// Why:      Set only by a `--start-playing` command-line launch; the folder
        ///           picker and auto-load pass `false` (load paused).
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// play: boolean;
        /// ```
        play: bool,
    },
    /// What:     `TogglePlay` a fieldless variant.
    /// Why:      Flip between playing and paused.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "togglePlay" }
    /// ```
    TogglePlay,
    /// What:     `Play` a fieldless variant.
    /// Why:      Resume playback.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "play" }
    /// ```
    Play,
    /// What:     `Pause` a fieldless variant.
    /// Why:      Pause playback (keep position).
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "pause" }
    /// ```
    Pause,
    /// What:     `Next` a fieldless variant.
    /// Why:      Skip to the next track.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "next" }
    /// ```
    Next,
    /// What:     `Prev` a fieldless variant.
    /// Why:      Skip to the previous track.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "prev" }
    /// ```
    Prev,
    /// What:     `SelectIndex(usize)` a tuple variant carrying a queue position. It
    ///           makes the track at this position current and loads it PAUSED (it does
    ///           not start playback). A single click on an unselected row sends this; a
    ///           second click on the now-current row sends `TogglePlay` to start it, so
    ///           "select then play" needs no double-click detection. `usize` is the
    ///           pointer-sized unsigned index (siblings: `u32`, `u64`).
    /// Why:      Selecting and playing are distinct user intents: a click highlights and
    ///           loads a track (pausing whatever was playing), and only a click on the
    ///           already-selected row begins playback.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "selectIndex"; index: number }
    /// ```
    SelectIndex(
        /// What:     Unnamed field `.0` of the `SelectIndex` variant: a queue
        ///           position as `usize`, the pointer-sized unsigned integer Rust
        ///           uses for indices (siblings the reader might expect: `u32`,
        ///           `u64`, `i32`, `i64`).
        /// Why:      `usize` (not `u32`/`u64`/`i64`) because the engine uses this to
        ///           index into the queue `Vec`, and every std indexing API wants
        ///           `usize`; another width would force a cast at the use site.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// // the `index: number` payload of { kind: "selectIndex" }
        /// ```
        usize,
    ),
    /// What:     `Seek(f64)` carries a target time in SECONDS as an `f64`. Siblings:
    ///           `f32`, `u64` frames, `Duration`.
    /// Why:      Same seconds-as-f64 unit as `Position`/`duration`; the engine converts
    ///           these seconds back into an exact frame offset for the decoder. Not
    ///           `f32` (too coarse for long tracks), not `u64` frames (UI does not know
    ///           the per-track rate), not `Duration` (awkward fractional value from a
    ///           slider drag).
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "seek"; secs: number }
    /// ```
    Seek(
        /// What:     Unnamed field `.0` of the `Seek` variant: a target time in
        ///           SECONDS as an `f64` (64-bit IEEE double). Siblings the reader
        ///           might expect: `f32` (32-bit float), `u64` (a frame/sample
        ///           count), or `std::time::Duration`.
        /// Why:      `f64` (not `f32`/`u64`/`Duration`) keeps the same
        ///           seconds-as-f64 unit as `Position`/`duration` so the engine can
        ///           convert it back to an exact frame offset; `f32` is too coarse
        ///           for long tracks, `u64` frames need a rate the UI does not know,
        ///           and `Duration` is awkward for a fractional slider drag.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// // the `secs: number` payload of { kind: "seek" }
        /// ```
        f64,
    ),
    /// What:     `SetVolume(f32)` is a gain in 0.0..=1.0 as an `f32`. Sibling: `f64`.
    /// Why:      `f32` matches PipeWire's f32 samples and Slint's `float`, and a 0..1
    ///           gain gains nothing from `f64` precision.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "setVolume"; volume: number }
    /// ```
    SetVolume(
        /// What:     Unnamed field `.0` of the `SetVolume` variant: a gain in
        ///           0.0..=1.0 as an `f32` (32-bit float). Sibling the reader might
        ///           expect: `f64` (64-bit double).
        /// Why:      `f32` (not `f64`) because a 0..1 gain gains nothing from double
        ///           precision and `f32` matches PipeWire's f32 samples and Slint's
        ///           `float`, so no conversion happens at either edge.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// // the `volume: number` payload of { kind: "setVolume" }
        /// ```
        f32,
    ),
    /// What:     `SetShuffle(ShuffleMode)` a tuple variant carrying the chosen mode.
    /// Why:      Set the shuffle mode (off / within-page / all).
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "setShuffle"; mode: ShuffleMode }
    /// ```
    SetShuffle(
        /// What:     Unnamed field `.0` of the `SetShuffle` variant: a `ShuffleMode`
        ///           value (the sibling enum declared above: `Off` / `WithinPage` /
        ///           `All`). Not a `bool` or an integer flag: shuffle has three
        ///           distinct behaviours, so it is its own enum.
        /// Why:      Carries the chosen mode the engine should switch to.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// // the `mode: ShuffleMode` payload of { kind: "setShuffle" }
        /// ```
        ShuffleMode,
    ),
    /// What:     `SetRepeatTrack(bool)` a tuple variant carrying the desired flag.
    /// Why:      Turn "repeat track" (replay the current track on its natural end) on
    ///           or off.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "setRepeatTrack"; on: boolean }
    /// ```
    SetRepeatTrack(
        /// What:     Unnamed field `.0` of the `SetRepeatTrack` variant: the desired
        ///           on/off flag as a `bool`. Not a `ShuffleMode` or an enum:
        ///           "repeat track" is a single two-state toggle.
        /// Why:      `true` turns on replaying the current track at its natural end,
        ///           `false` turns it off.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// // the `on: boolean` payload of { kind: "setRepeatTrack" }
        /// ```
        bool,
    ),
    /// What:     `Restore { ... }` is a STRUCT variant carrying a saved session to
    ///           reinstate at launch: the Source Root to scan, the optional Selected Track
    ///           to re-select, the position, and the volume/shuffle/repeat settings. The
    ///           engine scans the root, re-selects the track if the scan still contains it,
    ///           and loads it PAUSED at the saved position.
    /// Why:      Sent once on startup to resume where the user left off, without coupling
    ///           this enum to the persistence `Session` type.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "restore"; root: string; selected: string | null; position: number;
    ///   volume: number; shuffle: ShuffleMode; repeatTrack: boolean }
    /// ```
    Restore {
        /// What:     `root: PathBuf` the saved Source Root to re-scan into the queue.
        /// Why:      The queue is re-derived from disk, not from a saved track list.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// root: string;
        /// ```
        root: PathBuf,
        /// What:     `selected: Option<PathBuf>` the saved Selected Track's path, or `None`.
        ///           `Option<T>` is `Some(value)` or `None` (Rust's no-`null` "maybe").
        /// Why:      Re-select this track if the fresh scan still contains it; otherwise the
        ///           selection is cleared.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// selected: string | null;
        /// ```
        selected: Option<PathBuf>,
        /// What:     `position: f64` saved playback position in seconds (same
        ///           seconds-as-f64 unit as `Seek`/`Position`).
        /// Why:      Resume mid-track.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// position: number;
        /// ```
        position: f64,
        /// What:     `volume: f32` saved gain (32-bit float; sibling `f64`).
        /// Why:      Restore the last volume.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// volume: number;
        /// ```
        volume: f32,
        /// What:     `shuffle: ShuffleMode` saved shuffle mode.
        /// Why:      Restore shuffle.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// shuffle: ShuffleMode;
        /// ```
        shuffle: ShuffleMode,
        /// What:     `repeat_track: bool` saved "repeat track" flag.
        /// Why:      Restore whether the current track replays on its natural end.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// repeatTrack: boolean;
        /// ```
        repeat_track: bool,
    },
    /// What:     `Rescan` a fieldless variant.
    /// Why:      Re-scan the current Source Root and reconcile the queue with disk: added
    ///           files appear, removed files drop, and the Selected Track is preserved by
    ///           path (or, if its file left the root while playing, playback stops and the
    ///           selection clears). Sent by the file watcher on a debounced change, and on
    ///           any "rescan required" signal.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "rescan" }
    /// ```
    Rescan,
    /// What:     `Quit` a fieldless variant.
    /// Why:      Shut the engine thread down.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "quit" }
    /// ```
    Quit,
}

/// What:     `pub enum Update { ... }` declares the messages the engine pushes back to
///           the UI so the on-screen state stays in sync. `NowPlaying { ... }` is a
///           STRUCT variant: it names its fields instead of using positional tuple
///           slots.
/// Why:      The engine owns the real playback state; the UI only mirrors it, and
///           these updates are how the mirror is refreshed.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Update =
///   | { kind: "queue"; names: string[] }
///   | { kind: "nowPlaying"; index: number | null; name: string; duration: number }
///   | { kind: "position"; secs: number }
///   | { kind: "playing"; on: boolean }
///   | { kind: "volume"; volume: number }
///   | { kind: "shuffle"; mode: ShuffleMode }
///   | { kind: "repeatTrack"; on: boolean };
/// ```
pub enum Update {
    /// What:     `Queue(Vec<String>)` a tuple variant carrying the full queue as
    ///           display paths, each relative to the queue's common root (e.g.
    ///           `Artist/Album/01.flac`, or a bare filename for a single-folder queue).
    /// Why:      The UI rebuilds its list from this whenever the queue changes.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "queue"; names: string[] }
    /// ```
    Queue(
        /// What:     Unnamed field `.0` of the `Queue` variant: the full queue as a
        ///           `Vec<String>`, an OWNED, growable array of OWNED strings. Each
        ///           entry is a display path relative to the queue's common root
        ///           (e.g. `Artist/Album/01.flac`, or a bare filename for a
        ///           single-folder queue). Siblings the reader might expect:
        ///           `&[String]` (a borrowed slice) or `[String; N]` (a fixed-size
        ///           array); for the elements, `&str` (a borrowed view).
        /// Why:      `Vec<String>` (not `&[String]`/`[String; N]`, elements not
        ///           `&str`) because the queue length is unknown at compile time and
        ///           this message is sent across the thread boundary, so the UI keeps
        ///           the strings past the call; borrowed views would dangle.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// // the `names: string[]` payload of { kind: "queue" }
        /// ```
        Vec<String>,
    ),
    /// What:     `NowPlaying { index, name, duration }` a STRUCT variant: the current
    ///           track changed. `index` is its position in the queue, or `None` when
    ///           nothing is loaded.
    /// Why:      Refresh the now-playing label, row highlight, and seek-bar maximum.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "nowPlaying"; index: number | null; name: string; duration: number }
    /// ```
    NowPlaying {
        /// What:     `index: Option<usize>` the "maybe a number" type. `Option<T>` has
        ///           two variants: `Some(value)` or `None`. `usize` is the
        ///           pointer-sized unsigned integer used for indices (siblings: `u32`,
        ///           `u64`).
        /// Why:      There may be no current track (empty queue), so the index is
        ///           optional.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// index: number | null;
        /// ```
        index: Option<usize>,
        /// What:     `name: String` the display path of the current track, relative to
        ///           the queue root (the same string the list row shows, e.g.
        ///           `r-906/diaLOG/06 V.flac`), used for the window title; falls back to
        ///           the bare filename if the index is absent. `String` is owned (sibling
        ///           `&str`).
        /// Why:      The UI keeps this string past the call, so it must be owned.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// name: string;
        /// ```
        name: String,
        /// What:     `duration: f64` the track length in SECONDS as an `f64` (64-bit
        ///           IEEE double). Siblings the reader might expect: `f32` (32-bit
        ///           float), `u64` (a frame/sample count), or `std::time::Duration`.
        /// Why:      Seconds-as-f64 is our cross-thread time unit. Not `f32`: its
        ///           ~7-significant-digit precision cannot resolve sub-second detail
        ///           once a track passes a few minutes (near 3600 s an f32's step is
        ///           ~0.25 s). Not `u64` frames: the UI thinks in seconds and does not
        ///           know each track's sample rate (it varies per file). Not `Duration`:
        ///           clumsy for a fractional seek-bar value. The value is narrowed to
        ///           Slint's `float` (f32) only at the property edge, where display
        ///           coarseness is harmless.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// duration: number;
        /// ```
        duration: f64,
    },
    /// What:     `Reconciled { names, index, name, duration }` a STRUCT variant: a live rescan
    ///           reconciled the queue with disk IN PLACE (files added/removed/renamed), keeping
    ///           the Selected Track by path. Carries the new list plus the re-anchored current
    ///           track (its possibly-shifted index, display name, and duration).
    /// Why:      Distinct from `Queue` (a fresh open/restore, which resets the view to the first
    ///           page) and `NowPlaying` (a transport/selection change, which follows the track to
    ///           its page): a reconcile must refresh the list and highlight WITHOUT moving the
    ///           user's selected tab or track. The UI keeps the current page.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "reconciled"; names: string[]; index: number | null; name: string; duration: number }
    /// ```
    Reconciled {
        /// What:     `names: Vec<String>` the reconciled queue as display paths (same shape as
        ///           `Queue`'s payload).
        /// Why:      The list may have gained or lost rows; the UI rebuilds from this.
        names: Vec<String>,
        /// What:     `index: Option<usize>` the current track's possibly-shifted load-order index,
        ///           or `None` when nothing is selected (or the selected file left the root).
        /// Why:      Drives the row highlight after a reorder without restarting playback.
        index: Option<usize>,
        /// What:     `name: String` the current track's display path (empty when `index` is
        ///           `None`), used for the window title.
        /// Why:      The common-root prefix can shift when files are added or removed.
        name: String,
        /// What:     `duration: f64` the current track's length in SECONDS (0.0 when `index` is
        ///           `None`); see `NowPlaying.duration` for why f64.
        /// Why:      Keeps the seek-bar maximum correct without recomputing it.
        duration: f64,
    },
    /// What:     `Position(f64)` carries the live playback position in SECONDS as an
    ///           `f64`. Siblings: `f32`, `u64` frames, `Duration` (see the `duration`
    ///           field above for why f64 wins).
    /// Why:      Same time unit as `duration` so the seek bar can compare them directly;
    ///           the engine derives it from an exact frame count.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "position"; secs: number }
    /// ```
    Position(
        /// What:     Unnamed field `.0` of the `Position` variant: the live playback
        ///           position in SECONDS as an `f64` (64-bit IEEE double). Siblings
        ///           the reader might expect: `f32` (32-bit float), `u64` frames, or
        ///           `std::time::Duration`.
        /// Why:      `f64` (not `f32`/`u64`/`Duration`) keeps the same time unit as
        ///           `duration` so the seek bar can compare them directly; the engine
        ///           derives this value from an exact frame count (see the
        ///           `NowPlaying.duration` field above for the full f64 rationale).
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// // the `secs: number` payload of { kind: "position" }
        /// ```
        f64,
    ),
    /// What:     `Playing(bool)` a tuple variant carrying the play/pause state.
    /// Why:      Whether audio is currently playing (true) or paused (false).
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "playing"; on: boolean }
    /// ```
    Playing(
        /// What:     Unnamed field `.0` of the `Playing` variant: the play/pause
        ///           state as a `bool`. Not an enum: playback is a single two-state
        ///           flag.
        /// Why:      `true` means audio is currently playing, `false` means paused;
        ///           the UI flips its play/pause button to match.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// // the `on: boolean` payload of { kind: "playing" }
        /// ```
        bool,
    ),
    /// What:     `Volume(f32)` is a gain in 0.0..=1.0 as an `f32` (32-bit float).
    ///           Sibling: `f64` (double).
    /// Why:      `f32` not `f64` because a 0..1 gain needs no double precision and it
    ///           matches BOTH PipeWire's f32 PCM samples and Slint's `float` (also
    ///           f32), so no conversion happens at either edge.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "volume"; volume: number }
    /// ```
    Volume(
        /// What:     Unnamed field `.0` of the `Volume` variant: a gain in 0.0..=1.0
        ///           as an `f32` (32-bit float). Sibling the reader might expect:
        ///           `f64` (64-bit double).
        /// Why:      `f32` (not `f64`) because a 0..1 gain needs no double precision
        ///           and it matches BOTH PipeWire's f32 PCM samples and Slint's
        ///           `float` (also f32), so no conversion happens at either edge.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// // the `volume: number` payload of { kind: "volume" }
        /// ```
        f32,
    ),
    /// What:     `Shuffle(ShuffleMode)` a tuple variant carrying the current mode.
    /// Why:      Current shuffle mode (off / within-page / all).
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "shuffle"; mode: ShuffleMode }
    /// ```
    Shuffle(
        /// What:     Unnamed field `.0` of the `Shuffle` variant: the current
        ///           `ShuffleMode` value (the sibling enum declared above: `Off` /
        ///           `WithinPage` / `All`). Not a `bool` or integer flag: shuffle has
        ///           three distinct behaviours.
        /// Why:      Tells the UI which shuffle mode the engine is now in so the
        ///           control reflects it.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// // the `mode: ShuffleMode` payload of { kind: "shuffle" }
        /// ```
        ShuffleMode,
    ),
    /// What:     `RepeatTrack(bool)` a tuple variant carrying the flag state.
    /// Why:      Whether "repeat track" is on.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "repeatTrack"; on: boolean }
    /// ```
    RepeatTrack(
        /// What:     Unnamed field `.0` of the `RepeatTrack` variant: the flag state
        ///           as a `bool`. Not an enum: "repeat track" is a single two-state
        ///           toggle.
        /// Why:      `true` means the current track replays on its natural end; the
        ///           UI lights its repeat control to match.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// // the `on: boolean` payload of { kind: "repeatTrack" }
        /// ```
        bool,
    ),
}
