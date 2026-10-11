//! Library root for the `music-player` app.
//!  The binary (`main.rs`) wires
//! these modules to the Slint UI;
//!  keeping the logic in a library lets the pure
//! parts (queue,
//!  session) be unit-tested without any audio or GUI.

/// What:
///      `pub mod command;` declares and re-exports the `command` module
///           (the file `src/command.rs`).
///  `pub` makes it visible to the binary
///           and to tests.
/// Why:
///       Shared command/update message types live there.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as command from "./command";
/// ```
pub mod command;

/// What:
///      `pub mod cli;` declares and re-exports the `cli` module
///           (the file `src/cli.rs`).
///  `pub` makes the `Cli` parser visible to the
///           binary (`main.rs` calls `Cli::parse()`) and to its sibling tests.
/// Why:
///       Command-line parsing is pure logic,
///  so it lives in the library where it
///           can be unit-tested without the GUI or an audio backend.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as cli from "./cli";
/// ```
pub mod cli;

/// What:
///      `pub mod identity;` the platform identity-string module
///           (`src/identity.rs`).
/// Why:
///       One home for the Wayland app id,
///  the macOS bundle id,
///  and the config-
///           dir reverse-DNS triple,
///  so the three platforms' names never drift.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as identity from "./identity";
/// ```
pub mod identity;

/// What:
///      `pub mod queue;` the play-queue model module.
/// Why:
///       Pure traversal/shuffle/repeat logic,
///  unit-tested.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as queue from "./queue";
/// ```
pub mod queue;

/// What:
///      `pub mod session;` the save/restore module.
/// Why:
///       Persists the last session to disk.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as session from "./session";
/// ```
pub mod session;

/// What:
///      `pub mod error;` the shared error type module.
/// Why:
///       `PlayerError` is the one error all fallible functions return.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as error from "./error";
/// ```
pub mod error;

/// What:
///      `pub mod decode;` the decoding module (`src/decode.rs`).
/// Why:
///       Probes files and yields interleaved f32 PCM via the `Source` trait.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as decode from "./decode";
/// ```
pub mod decode;

/// What:
///      `pub mod opus;` the Opus decode path (`src/opus.rs`).
/// Why:
///       libopus-backed `Source` for Opus,
///  which symphonia cannot decode.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as opus from "./opus";
/// ```
pub mod opus;

/// What:
///      `#[cfg(target_os = "linux")]` is a CONDITIONAL-COMPILATION attribute:
///           the item right below it is compiled into the program ONLY when the
///           build target is Linux,
///  and skipped entirely otherwise.
///           `#[path = "output_pipewire.rs"]` overrides the default filename,
///  so
///           the module named `output` is read from `src/output_pipewire.rs`
///           instead of `src/output.rs`.
///  `pub mod output;` declares and
///           re-exports that module.
/// Why:
///       Linux gets the native PipeWire backend;
///  everything else in the
///           player (engine.rs,
///  controller.rs) only ever names `output::Output`
///           and never learns which backend is behind it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as output from "./output_pipewire"; // only on Linux builds
/// ```
#[cfg(target_os = "linux")]
#[path = "output_pipewire.rs"]
pub mod output;

/// What:
///      The non-Linux counterpart:
///  `#[cfg(not(target_os = "linux"))]` compiles
///           the next item on EVERY target except Linux (macOS and Windows here),
///           and `#[path = "output_cpal.rs"]` sources the `output` module from the
///           cpal file.
///  Same `pub mod output;` name as the Linux branch above;
///           exactly one of the two is ever compiled.
///  `not(...)` inverts a cfg
///           predicate,
///  so this is "compiled when NOT Linux".
/// Why:
///       Neither macOS nor Windows has PipeWire,
///  so both use cpal (CoreAudio on
///           macOS,
///  WASAPI on Windows) while exposing the IDENTICAL `output::Output`
///           surface,
///  keeping the rest of the player platform-agnostic.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as output from "./output_cpal"; // on every non-Linux build
/// ```
#[cfg(not(target_os = "linux"))]
#[path = "output_cpal.rs"]
pub mod output;

/// What:
///      `pub mod playback;` the device-free playback helpers (`src/playback.rs`):
///           the per-sample gain/clamp stage,
///  frame->seconds conversion,
///  and folder
///           expansion.
/// Why:
///       Pure logic kept apart so it is unit-tested and the files stay small.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as playback from "./playback";
/// ```
pub mod playback;

/// What:
///      `pub mod progress;` the progress-surface debounce helper module.
/// Why:
///       The binary uses this pure,
///  unit-tested timing gate for the Slint seek
///           bar and KDE taskbar progress.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as progress from "./progress";
/// ```
pub mod progress;

/// What:
///      `pub mod truepeak;` the true-peak measurement module (`src/truepeak.rs`).
/// Why:
///       Oversampled inter-sample peak measurement + the normalization gain.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as truepeak from "./truepeak";
/// ```
pub mod truepeak;

/// What:
///      `pub mod peakcache;` the persistent peak cache (`src/peakcache.rs`).
/// Why:
///       Memoizes measured peaks on disk,
///  keyed by an opaque fingerprint.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as peakcache from "./peakcache";
/// ```
pub mod peakcache;

/// What:
///      `pub mod measure;` the measurement orchestration (`src/measure.rs`).
/// Why:
///       Per-track gain resolution + the background queue-measurement sweep.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as measure from "./measure";
/// ```
pub mod measure;

/// What:
///      `pub mod peak_swap;` the current-track true-peak swap strategy
///           (`src/peak_swap.rs`).
/// Why:
///       Cache misses now start with a safe temporary gain,
///  wait briefly at
///           playback start,
///  then swap to the measured gain when it lands.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as peakSwap from "./peak_swap";
/// ```
pub mod peak_swap;

/// What:
///      `pub mod controller;` the playback state machine (`src/controller.rs`),
///           with its loading/audio half in `src/controller_audio.rs`.
/// Why:
///       Owns the queue + decoder + output;
///  turns commands into playback.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as controller from "./controller";
/// ```
pub mod controller;

/// What:
///      `pub mod controller_audio;` the second `impl Controller` block
///           (`src/controller_audio.rs`):
///  loading and audio pumping.
/// Why:
///       Split out so each controller file stays within the line budget.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // more methods of the same `controller` class, in another file
/// ```
pub mod controller_audio;

/// What:
///      `pub mod engine;` the worker-thread front door (`src/engine.rs`).
/// Why:
///       Spawns the worker and drives a `Controller` from the command channel.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as engine from "./engine";
/// ```
pub mod engine;

/// What:
///      `pub mod watch;` the Source Root file watcher (`src/watch.rs`).
/// Why:
///       Watches the current Source Root and sends `Command::Rescan` on a debounced
///           change,
///  so the queue live-updates while the app runs.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as watch from "./watch";
/// ```
pub mod watch;

/// What:
///      `pub mod pagination;` the queue-pagination module (`src/pagination.rs`).
/// Why:
///       Pure grouping of display paths into folder pages (subfolder tracks) and
///           A-Z + `#` letter pages (root-level tracks),
///  unit-tested.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as pagination from "./pagination";
/// ```
pub mod pagination;

/// What:
///      `pub mod relpath;` the relative-path display module (`src/relpath.rs`).
/// Why:
///       Pure stripping of the queue's common directory prefix,
///  so the UI shows
///           each track's path relative to the loaded root;
///  unit-tested.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as relpath from "./relpath";
/// ```
pub mod relpath;

/// What:
///      `pub mod launcher;` the desktop-shell integration module
///           (`src/launcher.rs`):
///  the Wayland app-id hook and the KDE taskbar
///           progress signal.
/// Why:
///       Stamps the window app id and emits LauncherEntry progress over D-Bus.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as launcher from "./launcher";
/// ```
pub mod launcher;

/// What:
///      `pub mod logging;`.
///  The tracing subscriber setup (`src/logging.rs`):
///  a stderr
///           sink with an env-filter the binary installs once at startup.
/// Why:
///       Gives every `tracing` event from this crate and `truepeak-core` a sink.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as logging from "./logging";
/// ```
pub mod logging;

/// What:
///      `pub mod template_model;` the supporting-text template vocabulary (`src/template_model.rs`):
///  fields,
///  the two templates and their defaults,
///  the function table,
///  track value sources,
///  and results.
/// Why:
///       Every other template module reads these shared definitions,
///  and `TrackFields` is the one track value type.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as templateModel from "./template_model";
/// ```
pub mod template_model;

/// What:
///      `pub mod template_format;` the JavaScript number text,
///  `tf` formatting,
///  and code-point cuts
///  (`src/template_format.rs`).
/// Why:
///       `tf` and `tc` must match the reference's number rules exactly.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as templateFormat from "./template_format";
/// ```
pub mod template_format;

/// What:
///      `pub mod template_tokens;` splits one formula's text into tokens (`src/template_tokens.rs`).
/// Why:
///       Token offsets are UTF-16 positions in the whole template,
///  as the editor needs them.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as templateTokens from "./template_tokens";
/// ```
pub mod template_tokens;

/// What:
///      `pub mod template_parse;` builds formula trees and splits a template into parts
///  (`src/template_parse.rs`).
/// Why:
///       Evaluation and help walk the same trees and parts.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as templateParse from "./template_parse";
/// ```
pub mod template_parse;

/// What:
///      `pub mod template_eval;` shows a template's text for one track,
///  or the mistakes that refuse it
///  (`src/template_eval.rs`).
/// Why:
///       Evaluation is the only place that reads field values and runs functions.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as templateEval from "./template_eval";
/// ```
pub mod template_eval;

/// What:
///      `pub mod template_help;` finds the call and argument under the caret (`src/template_help.rs`).
/// Why:
///       The typing help is a pure function of the text and the caret.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as templateHelp from "./template_help";
/// ```
pub mod template_help;

/// What:
///      `pub mod template_editor;` the editor values,
///  constants,
///  and shared helpers (`src/template_editor.rs`).
/// Why:
///       The editor state imports them from one module.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as templateEditor from "./template_editor";
/// ```
pub mod template_editor;

/// What:
///      `pub mod template_editor_state;` the editor state and its immutable transitions
///  (`src/template_editor_state.rs`).
/// Why:
///       Its fields stay private so the preview track list is never empty.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as templateEditorState from "./template_editor_state";
/// ```
pub mod template_editor_state;

/// What:
///      `#[cfg(test)] mod template_fixtures;` the shared track and editor fixtures (`src/template_fixtures.rs`).
/// Why:
///       The module is compiled only under `cargo test`,
///  so the fixtures never reach the binary.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // templateFixtures.ts, imported only by the test runner
/// ```
#[cfg(test)]
mod template_fixtures;

/// What:
///      `pub mod track_supporting_line;` builds the supporting-line function from a track rows template
///  (`src/track_supporting_line.rs`).
/// Why:
///       `track_list_entries` and `build_player_content` take this function,
///  so the template engine
///  is reached through one place.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as trackSupportingLine from "./track_supporting_line";
/// ```
pub mod track_supporting_line;

/// What:
///      `pub mod track;` the one-track value (`src/track.rs`) with its URI and display path.
/// Why:
///       Folder and search modules group tracks by display path,
///  so they share this record.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as track from "./track";
/// ```
pub mod track;

/// What:
///      `pub mod display_path;` joins and sanitizes display paths (`src/display_path.rs`).
/// Why:
///       Folder rows and search results both show the same `/`-joined path text.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as displayPath from "./display_path";
/// ```
pub mod display_path;

/// What:
///      `pub mod folder_rail;` the folder rail sections and collation keys (`src/folder_rail.rs`).
/// Why:
///       The folder picker and the search page both sort folder names with the same collation rule.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as folderRail from "./folder_rail";
/// ```
pub mod folder_rail;

/// What:
///      `pub mod folder_index;` groups the library into folders and their flat track lists (`src/folder_index.rs`).
/// Why:
///       The folder picker,
///  the search page,
///  and the player content all read the same folder layout.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as folderIndex from "./folder_index";
/// ```
pub mod folder_index;

/// What:
///      `pub mod track_entries;` the flat track rows for one folder,
///  with titles and supporting lines
///  (`src/track_entries.rs`).
/// Why:
///       The pane draws rows in folder order,
///  and the supporting line comes from `track_supporting_line`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as trackEntries from "./track_entries";
/// ```
pub mod track_entries;

/// What:
///      `pub mod player_content;` the pure builder for the player's rail,
///  folder rows,
///  and deck text
///  (`src/player_content.rs`).
/// Why:
///       One builder derives every player surface from the same inputs,
///  so the screen updates in one step.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as playerContent from "./player_content";
/// ```
pub mod player_content;

/// What:
///      `pub mod non_spacing_mark;` tests for non-spacing marks,
///  used by the search matcher
///  (`src/non_spacing_mark.rs`).
/// Why:
///       Search ignores combining marks when it compares text,
///  so the matcher needs this predicate.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as nonSpacingMark from "./non_spacing_mark";
/// ```
pub mod non_spacing_mark;

/// What:
///      `pub mod search_matcher;` the case- and mark-insensitive search matcher (`src/search_matcher.rs`).
/// Why:
///       Search results and the search page both need the same match and highlight offsets.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as searchMatcher from "./search_matcher";
/// ```
pub mod search_matcher;

/// What:
///      `pub mod search_results;` the ranked search results and their state (`src/search_results.rs`).
/// Why:
///       The search page renders these results,
///  and their order and limit are fixed here.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as searchResults from "./search_results";
/// ```
pub mod search_results;

/// What:
///      `pub mod search_page_model;` the search page's view model (`src/search_page_model.rs`).
/// Why:
///       One pure builder turns the query and results into the rows and states the page draws.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as searchPageModel from "./search_page_model";
/// ```
pub mod search_page_model;

/// What:
///      `pub mod keymap;` the keyboard shortcut map (`src/keymap.rs`).
/// Why:
///       Shortcuts are data,
///  so the platform-specific bindings stay in one tested module.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as keymap from "./keymap";
/// ```
pub mod keymap;

/// What:
///      `pub mod first_run;` the first-run walkthrough state (`src/first_run.rs`).
/// Why:
///       The walkthrough's steps and their persistence are pure logic,
///  so they are unit-tested.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as firstRun from "./first_run";
/// ```
pub mod first_run;

/// What:
///      `pub mod track_menu;` the per-track action menu model (`src/track_menu.rs`).
/// Why:
///       The menu's actions and their enabled states are decided here,
///  not in the UI code.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as trackMenu from "./track_menu";
/// ```
pub mod track_menu;

/// What:
///      `pub mod feedback;` the transient feedback message queue (`src/feedback.rs`).
/// Why:
///       Messages expire by time,
///  and the queue's order and expiry rules are pure logic.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as feedback from "./feedback";
/// ```
pub mod feedback;

/// What: `pub mod track_measure;` the per-track length and true peak, and their formatting.
/// Why: the rows and the deck read these values through the template fields.
pub mod track_measure;

/// What: `pub mod duration_probe;` reads a file length from its container header.
/// Why: rows show lengths before the slow true-peak measurement finishes.
pub mod duration_probe;

/// What: `pub mod measure_peek;` reads each track's cached decision and header length without decoding.
/// Why: the sweep reports lengths and cached peaks as soon as a queue loads.
pub mod measure_peek;

/// What: `pub mod sweep_report;` the reports a background sweep sends to the engine.
/// Why: the controller needs the generation of each report to drop stale ones.
pub mod sweep_report;

/// What: `pub mod color_scheme;` the environment override of the window color scheme.
/// Why: verification runs need a fixed light or dark window.
pub mod color_scheme;

/// What: `pub mod controller_measures;` the controller side of the per-track measures.
/// Why: sweep reports are filtered by queue generation there, before they reach the window.
pub mod controller_measures;

/// What:
///      `pub mod scan_indicator;` the library scan progress indicator model (`src/scan_indicator.rs`).
/// Why:
///       The indicator's text and visibility follow the scan state,
///  which is pure logic.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as scanIndicator from "./scan_indicator";
/// ```
pub mod scan_indicator;
