//! Saving and restoring the last session to a JSON file under the user's config
//! directory. The session records the Source Root (the opened directory), the
//! optional Selected Track, and playback settings (position, volume, shuffle,
//! repeat). The Queue itself is NOT stored: on restore the Source Root is
//! re-scanned to rebuild a fresh Queue, and the Selected Track is re-selected by
//! path if it is still present. See
//! `doc/decision/music-player-session-source-root.md`.

/// What:     `use std::path::PathBuf;` imports the OWNED path type (sibling: borrowed
///           `&Path`).
/// Why:      The session stores the Source Root directory and the Selected Track path.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // a path is just a string in TS
/// ```
use std::path::PathBuf;

/// What:     `use serde::{Deserialize, Serialize};` imports the two derive macros that
///           generate JSON conversion code.
/// Why:      `Session` is read from and written to disk as JSON.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Serializable } from "some-json-lib";
/// ```
use serde::{Deserialize, Serialize};

/// What:     `use crate::command::ShuffleMode;` imports our shuffle enum.
/// Why:      The saved session remembers the shuffle mode.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { ShuffleMode } from "./command";
/// ```
use crate::command::ShuffleMode;

/// What:     `use crate::identity;` imports the shared identity-strings module
///           (importing the MODULE, so reads stay qualified as
///           `identity::CONFIG_APPLICATION`, keeping the origin obvious).
/// Why:      `session_path` builds the config dir from the reverse-DNS triple, which now
///           lives in one place instead of inline literals.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import * as identity from "./identity";
/// ```
use crate::identity;

/// What:     `PageControlStyle` is the saved visual treatment for library-page selectors.
///           It has four fixed values: radio controls, wrapping Material Design 1 tabs,
///           the earlier rounded buttons, and joined segmented buttons. `Default` selects
///           `Radio` for old sessions.
/// Why:      Users can choose a page selector while fresh and older installs start with
///           radio controls as requested.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type PageControlStyle = 'radio' | 'md1Tabs' | 'roundedButtons' | 'segmentedButtons';
/// ```
#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
pub enum PageControlStyle {
    /// Radio indicators and labels in a wrapping group.
    #[default]
    Radio,
    /// Flat wrapping MD1 tabs with selected underlines.
    Md1Tabs,
    /// Filled or outlined rounded buttons from the previous UI.
    RoundedButtons,
    /// Joined content-width buttons with selected fill.
    SegmentedButtons,
}

/// What:     `impl PageControlStyle` adds conversion methods used at the Slint boundary.
/// Why:      Slint properties carry integers, while saved Rust state keeps named variants.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const pageControlStyleToInt = (style: PageControlStyle): number => ...;
/// ```
impl PageControlStyle {
    /// Convert this style to Slint's stable integer representation.
    pub fn to_int(self) -> i32 {
        if self == PageControlStyle::Md1Tabs {
            return 1;
        }
        if self == PageControlStyle::RoundedButtons {
            return 2;
        }
        if self == PageControlStyle::SegmentedButtons {
            return 3;
        }
        return 0;
    }

    /// Decode Slint's integer representation, defaulting unknown values to radio controls.
    pub fn from_int(value: i32) -> PageControlStyle {
        if value == 1 {
            return PageControlStyle::Md1Tabs;
        }
        if value == 2 {
            return PageControlStyle::RoundedButtons;
        }
        if value == 3 {
            return PageControlStyle::SegmentedButtons;
        }
        return PageControlStyle::Radio;
    }
}

// What:     `#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]`
//           auto-implements: `Clone` (duplicable), `Debug` (`{:?}` printing),
//           `PartialEq` (`==`, used in tests), and `Serialize`/`Deserialize` (JSON both
//           ways).
// Why:      We clone it, compare it in tests, and persist it.
//
// In TS you'd write (pseudocode):
// ```ts
// // no annotation: a plain object is cloneable, comparable, and JSON-roundtrippable
// ```
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
// What:     `#[serde(default)]` makes every MISSING field fall back to `Default` when
//           parsing, instead of failing. Combined with serde's default of IGNORING
//           unknown fields, a session written by an older build (which stored `tracks`
//           and `current`) parses cleanly: the obsolete fields are ignored and the new
//           `source_root`/`selected` default to `None`.
// Why:      Old sessions must degrade to "no usable root" (so launch falls through to the
//           music directory) rather than crash the restore path.
//
// In TS you'd write (pseudocode):
// ```ts
// const s = { ...defaultSession(), ...JSON.parse(text) };
// ```
#[serde(default)]
/// What:     `pub struct Session { ... }` a public record of the saved state. Fields are
///           `pub` so the engine can read/build them directly.
/// Why:      One serializable blob describing "where the user left off".
///
/// In TS you'd write (pseudocode):
/// ```ts
/// interface Session {
///   sourceRoot: string | null;
///   selected: string | null;
///   positionSecs: number;
///   volume: number;
///   shuffle: ShuffleMode;
///   repeatTrack: boolean;
/// }
/// ```
pub struct Session {
    /// What:     `pub source_root: Option<PathBuf>` the opened directory whose scan IS the
    ///           queue (`Some(dir)`), or `None` on first run / no usable root.
    /// Why:      The queue is re-derived by scanning this directory on restore, so the
    ///           directory is the only queue-identifying thing stored.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// sourceRoot: string | null;
    /// ```
    pub source_root: Option<PathBuf>,
    /// What:     `pub selected: Option<PathBuf>` the Selected Track's path (`Some`), or
    ///           `None` when nothing was cued.
    /// Why:      Re-select this track on restore if the fresh scan still contains it.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// selected: string | null;
    /// ```
    pub selected: Option<PathBuf>,
    /// What:     `pub position_secs: f64` saved playback position in seconds. Siblings:
    ///           `f32`, `u64` frames. f64 matches the `Position`/`Seek` messages
    ///           (precision + seconds unit).
    /// Why:      Resume the Selected Track where it left off.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// positionSecs: number;
    /// ```
    pub position_secs: f64,
    /// What:     `pub volume: f32` saved gain 0.0..=1.0. Sibling: `f64`. f32 matches the
    ///           audio path and Slint.
    /// Why:      Restore the user's last volume.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// volume: number;
    /// ```
    pub volume: f32,
    /// What:     `pub shuffle: ShuffleMode` the saved shuffle mode (off / within-page /
    ///           all).
    /// Why:      Restore the user's shuffle choice.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// shuffle: ShuffleMode;
    /// ```
    pub shuffle: ShuffleMode,
    /// What:     `pub repeat_track: bool` whether "repeat track" was on.
    /// Why:      Restore the repeat-track flag.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// repeatTrack: boolean;
    /// ```
    pub repeat_track: bool,
    /// What:     `pub page_control_style: PageControlStyle` names the selected page
    ///           navigation treatment.
    /// Why:      Restore the user's radio, MD1 tab, or rounded-button preference.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// pageControlStyle: PageControlStyle;
    /// ```
    pub page_control_style: PageControlStyle,
}

/// What:     `impl Default for Session { ... }` provides the first-run / corrupt-file
///           fallback value, and the per-field fallback for `#[serde(default)]`.
/// Why:      `load()` returns this when there is no readable session.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function defaultSession(): Session {
///   return { sourceRoot: null, selected: null, positionSecs: 0, volume: 1,
///            shuffle: "off", repeatTrack: false };
/// }
/// ```
impl Default for Session {
    /// What:     `fn default() -> Session`. The single method `Default` requires; builds
    ///           the fallback value.
    /// Why:      One place defines the empty starting state.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// static default(): Session { return defaultSession(); }
    /// ```
    fn default() -> Session {
        // What:     struct literal as the tail expression (return value). `None` empty
        //           options; `0.0` start of track; `1.0` full volume; `ShuffleMode::Off`
        //           the default mode; `false` no repeat-track.
        // Why:      Sensible starting state with no root and nothing cued.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { sourceRoot: null, selected: null, positionSecs: 0, volume: 1, shuffle: "off", repeatTrack: false };
        // ```
        Session {
            source_root: None,
            selected: None,
            position_secs: 0.0,
            volume: 1.0,
            shuffle: ShuffleMode::Off,
            repeat_track: false,
            page_control_style: PageControlStyle::Radio,
        }
    }
}

/// What:     `impl Session { ... }` the methods block.
/// Why:      `load` and `save` are the two operations the engine drives.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class Session { static load() {} save() {} }
/// ```
impl Session {
    /// What:     `pub fn load() -> Session` reads the session file and parses it; any
    ///           failure (no config dir, missing file, unreadable, malformed JSON) yields
    ///           `Session::default()`.
    /// Why:      Restore on launch without ever failing the program start. The decision of
    ///           whether the saved `source_root` still exists (and what to scan) belongs to
    ///           the controller, not here, so `load` no longer prunes anything.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// static load(): Session {
    ///   const path = sessionPath();
    ///   if (!path) return defaultSession();
    ///   try { return { ...defaultSession(), ...JSON.parse(readFileSync(path, "utf8")) }; }
    ///   catch { return defaultSession(); }
    /// }
    /// ```
    pub fn load() -> Session {
        // What:     `let path = match session_path() { Some(p) => p, None => return ... };`
        //           obtains the file path or bails to default.
        // Why:      Without a config directory there is nothing to load.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const path = sessionPath(); if (!path) return defaultSession();
        // ```
        let path = match session_path() {
            // What:     `Some(p) => p`. Unwrap the present path.
            // Why:      Continue to reading it.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // path = p;
            // ```
            Some(p) => p,
            // What:     `None => return Session::default()` early return.
            // Why:      No home/config dir.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return defaultSession();
            // ```
            None => return Session::default(),
        };
        // What:     `let text = match std::fs::read_to_string(&path) { Ok(t) => t, Err(_) => return ... };`
        //           reads the whole file to a `String`, or returns defaults on any IO error
        //           (the common "no file yet" case included).
        // Why:      A missing or unreadable session is just "no session".
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let text; try { text = readFileSync(path, "utf8"); } catch { return defaultSession(); }
        // ```
        let text = match std::fs::read_to_string(&path) {
            // What:     `Ok(t) => t`. The file contents.
            // Why:      Parse them next.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // text = t;
            // ```
            Ok(t) => t,
            // What:     `Err(_) => return Session::default()`. The `_` discards the error.
            // Why:      No readable file means defaults.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return defaultSession();
            // ```
            Err(_) => return Session::default(),
        };
        // What:     `serde_json::from_str(&text).unwrap_or_default()` parses the JSON into a
        //           `Session`; `.unwrap_or_default()` substitutes `Session::default()` if
        //           parsing fails. Tail expression -> return value.
        // Why:      A malformed or stale-shaped file degrades to defaults rather than
        //           aborting launch.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // try { return { ...defaultSession(), ...JSON.parse(text) }; } catch { return defaultSession(); }
        // ```
        serde_json::from_str(&text).unwrap_or_default()
    }

    /// What:     `pub fn save(&self) -> std::io::Result<()>` serializes `self` to JSON and
    ///           writes it under the config directory, creating the directory if needed.
    /// Why:      Persist "where the user left off" on quit.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// save(): void {
    ///   const path = sessionPath(); if (!path) return;
    ///   mkdirSync(dirname(path), { recursive: true });
    ///   writeFileSync(path, JSON.stringify(this, null, 2));
    /// }
    /// ```
    pub fn save(&self) -> std::io::Result<()> {
        // What:     `let path = match session_path() { Some(p) => p, None => return Ok(()) };`
        //           get the target path or quietly succeed if there is no config dir.
        // Why:      Saving is best-effort; missing config dir is not an error.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const path = sessionPath(); if (!path) return;
        // ```
        let path = match session_path() {
            // What:     `Some(p) => p`. Unwrap the present path.
            // Why:      Continue to writing it.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // path = p;
            // ```
            Some(p) => p,
            // What:     `None => return Ok(())` early success. `Ok(())` is the success
            //           variant wrapping unit.
            // Why:      Nothing to do, not a failure.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return;
            // ```
            None => return Ok(()),
        };
        // What:     `if let Some(parent) = path.parent() { ... }` runs only when the path
        //           has a parent directory. `path.parent()` returns `Option<&Path>`.
        // Why:      Ensure the config directory exists before writing into it.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // mkdirSync(dirname(path), { recursive: true });
        // ```
        if let Some(parent) = path.parent() {
            // What:     `std::fs::create_dir_all(parent)?;` creates the directory and any
            //           missing ancestors. The trailing `?` PROPAGATES an error.
            // Why:      First-ever save has no config dir yet.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // mkdirSync(parent, { recursive: true });
            // ```
            std::fs::create_dir_all(parent)?;
        }
        // What:     `let json = serde_json::to_string_pretty(self).map_err(std::io::Error::other)?;`
        //           serializes `self` to pretty JSON; `.map_err(...)` converts the serde
        //           error into a `std::io::Error` so `?` can propagate it.
        // Why:      Produce the bytes to write; unify error types for `?`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const json = JSON.stringify(this, null, 2);
        // ```
        let json = serde_json::to_string_pretty(self)
            .map_err(std::io::Error::other)?;
        // What:     `std::fs::write(&path, json)` writes the string to the file, replacing
        //           existing contents. Tail expression -> `save`'s result.
        // Why:      Persist the JSON.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // writeFileSync(path, json);
        // ```
        std::fs::write(&path, json)
    }
}

/// What:     `fn session_path() -> Option<PathBuf>` computes the on-disk location of the
///           session file, or `None` if no config directory is available. Module-private.
/// Why:      One place that decides where the session lives (its directory comes from the
///           shared `identity::config_dir`, which the peak cache uses too).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function sessionPath(): string | null {
///   const dir = configDir();
///   return dir ? join(dir, "session.json") : null;
/// }
/// ```
fn session_path() -> Option<PathBuf> {
    // What:     `identity::config_dir().map(|dir| dir.join("session.json"))`. Take the
    //           shared config directory (`Option<PathBuf>`) and, when present, append the
    //           session filename; `.join(...)` returns an owned `PathBuf`. Tail -> return.
    // Why:      Name the session file here while the directory is resolved once in
    //           `identity`, so the session and the peak cache cannot drift apart.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const dir = configDir();
    // return dir ? join(dir, "session.json") : null;
    // ```
    identity::config_dir().map(|dir| dir.join("session.json"))
}

/// What:     `#[cfg(test)] #[path = "session_tests.rs"] mod tests;` declares a test-only
///           submodule whose code lives in the sibling file `session_tests.rs`.
/// Why:      Keep `session.rs` to production code; the tests live beside it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // session.unit.test.ts, run only by the test runner
/// ```
#[cfg(test)]
#[path = "session_tests.rs"]
mod tests;
