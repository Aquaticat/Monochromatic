//! Library root for the `music-player` app. The binary (`main.rs`) wires
//! these modules to the Slint UI; keeping the logic in a library lets the pure
//! parts (queue, session) be unit-tested without any audio or GUI.

/// What:     `pub mod command;` declares and re-exports the `command` module
///           (the file `src/command.rs`). `pub` makes it visible to the binary
///           and to tests.
/// Why:      Shared command/update message types live there.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as command from "./command";
/// ```
pub mod command;

/// What:     `pub mod cli;` declares and re-exports the `cli` module
///           (the file `src/cli.rs`). `pub` makes the `Cli` parser visible to the
///           binary (`main.rs` calls `Cli::parse()`) and to its sibling tests.
/// Why:      Command-line parsing is pure logic, so it lives in the library where it
///           can be unit-tested without the GUI or an audio backend.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as cli from "./cli";
/// ```
pub mod cli;

/// What:     `pub mod identity;` the platform identity-string module
///           (`src/identity.rs`).
/// Why:      One home for the Wayland app id, the macOS bundle id, and the config-
///           dir reverse-DNS triple, so the three platforms' names never drift.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as identity from "./identity";
/// ```
pub mod identity;

/// What:     `pub mod queue;` the play-queue model module.
/// Why:      Pure traversal/shuffle/repeat logic, unit-tested.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as queue from "./queue";
/// ```
pub mod queue;

/// What:     `pub mod session;` the save/restore module.
/// Why:      Persists the last session to disk.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as session from "./session";
/// ```
pub mod session;

/// What:     `pub mod error;` the shared error type module.
/// Why:      `PlayerError` is the one error all fallible functions return.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as error from "./error";
/// ```
pub mod error;

/// What:     `pub mod decode;` the decoding module (`src/decode.rs`).
/// Why:      Probes files and yields interleaved f32 PCM via the `Source` trait.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as decode from "./decode";
/// ```
pub mod decode;

/// What:     `pub mod opus;` the Opus decode path (`src/opus.rs`).
/// Why:      libopus-backed `Source` for Opus, which symphonia cannot decode.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as opus from "./opus";
/// ```
pub mod opus;

/// What:     `#[cfg(target_os = "linux")]` is a CONDITIONAL-COMPILATION attribute:
///           the item right below it is compiled into the program ONLY when the
///           build target is Linux, and skipped entirely otherwise.
///           `#[path = "output_pipewire.rs"]` overrides the default filename, so
///           the module named `output` is read from `src/output_pipewire.rs`
///           instead of `src/output.rs`. `pub mod output;` declares and
///           re-exports that module.
/// Why:      Linux gets the native PipeWire backend; everything else in the
///           player (engine.rs, controller.rs) only ever names `output::Output`
///           and never learns which backend is behind it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as output from "./output_pipewire"; // only on Linux builds
/// ```
#[cfg(target_os = "linux")]
#[path = "output_pipewire.rs"]
pub mod output;

/// What:     The non-Linux counterpart: `#[cfg(not(target_os = "linux"))]` compiles
///           the next item on EVERY target except Linux (macOS and Windows here),
///           and `#[path = "output_cpal.rs"]` sources the `output` module from the
///           cpal file. Same `pub mod output;` name as the Linux branch above;
///           exactly one of the two is ever compiled. `not(...)` inverts a cfg
///           predicate, so this is "compiled when NOT Linux".
/// Why:      Neither macOS nor Windows has PipeWire, so both use cpal (CoreAudio on
///           macOS, WASAPI on Windows) while exposing the IDENTICAL `output::Output`
///           surface, keeping the rest of the player platform-agnostic.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as output from "./output_cpal"; // on every non-Linux build
/// ```
#[cfg(not(target_os = "linux"))]
#[path = "output_cpal.rs"]
pub mod output;

/// What:     `pub mod playback;` the device-free playback helpers (`src/playback.rs`):
///           the per-sample gain/clamp stage, frame->seconds conversion, and folder
///           expansion.
/// Why:      Pure logic kept apart so it is unit-tested and the files stay small.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as playback from "./playback";
/// ```
pub mod playback;

/// What:     `pub mod progress;` the progress-surface debounce helper module.
/// Why:      The binary uses this pure, unit-tested timing gate for the Slint seek
///           bar and KDE taskbar progress.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as progress from "./progress";
/// ```
pub mod progress;

/// What:     `pub mod truepeak;` the true-peak measurement module (`src/truepeak.rs`).
/// Why:      Oversampled inter-sample peak measurement + the normalization gain.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as truepeak from "./truepeak";
/// ```
pub mod truepeak;

/// What:     `pub mod peakcache;` the persistent peak cache (`src/peakcache.rs`).
/// Why:      Memoizes measured peaks on disk, keyed by an opaque fingerprint.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as peakcache from "./peakcache";
/// ```
pub mod peakcache;

/// What:     `pub mod measure;` the measurement orchestration (`src/measure.rs`).
/// Why:      Per-track gain resolution + the background queue-measurement sweep.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as measure from "./measure";
/// ```
pub mod measure;

/// What:     `pub mod peak_swap;` the current-track true-peak swap strategy
///           (`src/peak_swap.rs`).
/// Why:      Cache misses now start with a safe temporary gain, wait briefly at
///           playback start, then swap to the measured gain when it lands.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as peakSwap from "./peak_swap";
/// ```
pub mod peak_swap;

/// What:     `pub mod controller;` the playback state machine (`src/controller.rs`),
///           with its loading/audio half in `src/controller_audio.rs`.
/// Why:      Owns the queue + decoder + output; turns commands into playback.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as controller from "./controller";
/// ```
pub mod controller;

/// What:     `pub mod controller_audio;` the second `impl Controller` block
///           (`src/controller_audio.rs`): loading and audio pumping.
/// Why:      Split out so each controller file stays within the line budget.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // more methods of the same `controller` class, in another file
/// ```
pub mod controller_audio;

/// What:     `pub mod engine;` the worker-thread front door (`src/engine.rs`).
/// Why:      Spawns the worker and drives a `Controller` from the command channel.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as engine from "./engine";
/// ```
pub mod engine;

/// What:     `pub mod watch;` the Source Root file watcher (`src/watch.rs`).
/// Why:      Watches the current Source Root and sends `Command::Rescan` on a debounced
///           change, so the queue live-updates while the app runs.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as watch from "./watch";
/// ```
pub mod watch;

/// What:     `pub mod pagination;` the queue-pagination module (`src/pagination.rs`).
/// Why:      Pure grouping of display paths into folder pages (subfolder tracks) and
///           A-Z + `#` letter pages (root-level tracks), unit-tested.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as pagination from "./pagination";
/// ```
pub mod pagination;

/// What:     `pub mod relpath;` the relative-path display module (`src/relpath.rs`).
/// Why:      Pure stripping of the queue's common directory prefix, so the UI shows
///           each track's path relative to the loaded root; unit-tested.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as relpath from "./relpath";
/// ```
pub mod relpath;

/// What:     `pub mod launcher;` the desktop-shell integration module
///           (`src/launcher.rs`): the Wayland app-id hook and the KDE taskbar
///           progress signal.
/// Why:      Stamps the window app id and emits LauncherEntry progress over D-Bus.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as launcher from "./launcher";
/// ```
pub mod launcher;

/// What:     `pub mod logging;`. The tracing subscriber setup (`src/logging.rs`): a stderr
///           sink with an env-filter the binary installs once at startup.
/// Why:      Gives every `tracing` event from this crate and `truepeak-core` a sink.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as logging from "./logging";
/// ```
pub mod logging;
