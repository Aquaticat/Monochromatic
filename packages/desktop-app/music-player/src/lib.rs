//! Library root for the `music-player` app. The binary (`main.rs`) wires
//! these modules to the Slint UI; keeping the logic in a library lets the pure
//! parts (queue, session) be unit-tested without any audio or GUI.

// What:     `pub mod command;` declares and re-exports the `command` module
//           (the file `src/command.rs`). `pub` makes it visible to the binary
//           and to tests.
// Why:      Shared command/update message types live there.
// TS map:   `export * as command from "./command";`
pub mod command;

// What:     `pub mod queue;` the play-queue model module.
// Why:      Pure traversal/shuffle/repeat logic, unit-tested.
// TS map:   `export * as queue from "./queue";`
pub mod queue;

// What:     `pub mod session;` the save/restore module.
// Why:      Persists the last session to disk.
// TS map:   `export * as session from "./session";`
pub mod session;

// What:     `pub mod error;` the shared error type module.
// Why:      `PlayerError` is the one error all fallible functions return.
// TS map:   `export * as error from "./error";`
pub mod error;

// What:     `pub mod decode;` the decoding module (`src/decode.rs`).
// Why:      Probes files and yields interleaved f32 PCM via the `Source` trait.
// TS map:   `export * as decode from "./decode";`
pub mod decode;

// What:     `pub mod opus;` the Opus decode path (`src/opus.rs`).
// Why:      libopus-backed `Source` for Opus, which symphonia cannot decode.
// TS map:   `export * as opus from "./opus";`
pub mod opus;

// What:     `#[cfg(target_os = "linux")]` is a CONDITIONAL-COMPILATION attribute:
//           the item right below it is compiled into the program ONLY when the
//           build target is Linux, and skipped entirely otherwise.
//           `#[path = "output_pipewire.rs"]` overrides the default filename, so
//           the module named `output` is read from `src/output_pipewire.rs`
//           instead of `src/output.rs`. `pub mod output;` declares and
//           re-exports that module.
// Why:      Linux gets the native PipeWire backend; everything else in the
//           player (engine.rs, controller.rs) only ever names `output::Output`
//           and never learns which backend is behind it.
// TS map:   like `export * as output from process.platform === "linux"
//           ? "./output_pipewire" : "./output_coreaudio";` but resolved at
//           COMPILE time, so only one branch is ever built.
//
// In TS you'd write (pseudocode):
// ```ts
// export * as output from "./output_pipewire"; // only on Linux builds
// ```
#[cfg(target_os = "linux")]
#[path = "output_pipewire.rs"]
pub mod output;

// What:     The macOS counterpart: `#[cfg(target_os = "macos")]` compiles the
//           next item only on macOS builds, and `#[path = "output_coreaudio.rs"]`
//           sources the `output` module from the cpal/CoreAudio file. Same
//           `pub mod output;` name as the Linux branch above; exactly one of the
//           two is ever compiled.
// Why:      macOS has no PipeWire, so it uses CoreAudio (via cpal) while exposing
//           the IDENTICAL `output::Output` surface, keeping the rest of the
//           player platform-agnostic.
// TS map:   the `: "./output_coreaudio"` arm of the conditional re-export above.
//
// In TS you'd write (pseudocode):
// ```ts
// export * as output from "./output_coreaudio"; // only on macOS builds
// ```
#[cfg(target_os = "macos")]
#[path = "output_coreaudio.rs"]
pub mod output;

// What:     `pub mod playback;` the device-free playback helpers (`src/playback.rs`):
//           the per-sample gain/clamp stage, frame->seconds conversion, and folder
//           expansion.
// Why:      Pure logic kept apart so it is unit-tested and the files stay small.
// TS map:   `export * as playback from "./playback";`
pub mod playback;

// What:     `pub mod progress;` the progress-surface debounce helper module.
// Why:      The binary uses this pure, unit-tested timing gate for the Slint seek
//           bar and KDE taskbar progress.
// TS map:   `export * as progress from "./progress";`
pub mod progress;

// What:     `pub mod truepeak;` the true-peak measurement module (`src/truepeak.rs`).
// Why:      Oversampled inter-sample peak measurement + the normalization gain.
// TS map:   `export * as truepeak from "./truepeak";`
pub mod truepeak;

// What:     `pub mod peakcache;` the persistent peak cache (`src/peakcache.rs`).
// Why:      Memoizes measured peaks on disk, keyed by an opaque fingerprint.
// TS map:   `export * as peakcache from "./peakcache";`
pub mod peakcache;

// What:     `pub mod measure;` the measurement orchestration (`src/measure.rs`).
// Why:      Per-track gain resolution + the background queue-measurement sweep.
// TS map:   `export * as measure from "./measure";`
pub mod measure;

// What:     `pub mod controller;` the playback state machine (`src/controller.rs`),
//           with its loading/audio half in `src/controller_audio.rs`.
// Why:      Owns the queue + decoder + output; turns commands into playback.
// TS map:   `export * as controller from "./controller";`
pub mod controller;

// What:     `pub mod controller_audio;` the second `impl Controller` block
//           (`src/controller_audio.rs`): loading and audio pumping.
// Why:      Split out so each controller file stays within the line budget.
// TS map:   part of the same `controller` class, in another file.
pub mod controller_audio;

// What:     `pub mod engine;` the worker-thread front door (`src/engine.rs`).
// Why:      Spawns the worker and drives a `Controller` from the command channel.
// TS map:   `export * as engine from "./engine";`
pub mod engine;

// What:     `pub mod pagination;` the queue-pagination module (`src/pagination.rs`).
// Why:      Pure grouping of display paths into folder pages (subfolder tracks) and
//           A-Z + `#` letter pages (root-level tracks), unit-tested.
// TS map:   `export * as pagination from "./pagination";`
pub mod pagination;

// What:     `pub mod relpath;` the relative-path display module (`src/relpath.rs`).
// Why:      Pure stripping of the queue's common directory prefix, so the UI shows
//           each track's path relative to the loaded root; unit-tested.
// TS map:   `export * as relpath from "./relpath";`
pub mod relpath;

// What:     `pub mod launcher;` the desktop-shell integration module
//           (`src/launcher.rs`): the Wayland app-id hook and the KDE taskbar
//           progress signal.
// Why:      Stamps the window app id and emits LauncherEntry progress over D-Bus.
// TS map:   `export * as launcher from "./launcher";`
pub mod launcher;
