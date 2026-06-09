//! Saving and restoring the last session (queue, cursor, position, volume,
//! shuffle, repeat) to a JSON file under the user's config directory. On
//! restore, tracks whose files have moved/disappeared, or that are not audio
//! files, are dropped and the cursor is remapped onto the survivors.

// What:     `use std::path::PathBuf;` imports the OWNED path type (sibling:
//           borrowed `&Path`).
// Why:      The session stores the file paths to reopen next launch.
// TS map:   `type PathBuf = string`.
use std::path::PathBuf;

// What:     `use serde::{Deserialize, Serialize};` imports the two derive
//           macros that generate JSON conversion code.
// Why:      `Session` is read from and written to disk as JSON.
// TS map:   `import { Serializable } from "some-json-lib";`
use serde::{Deserialize, Serialize};

// What:     `use crate::command::ShuffleMode;` imports our shuffle enum.
// Why:      The saved session remembers the shuffle mode.
// TS map:   `import { ShuffleMode } from "./command";`
use crate::command::ShuffleMode;

// What:     `use crate::identity;` imports the shared identity-strings module
//           (importing the MODULE, so reads stay qualified as
//           `identity::CONFIG_APPLICATION`, keeping the origin obvious).
// Why:      `session_path` builds the config dir from the reverse-DNS triple,
//           which now lives in one place instead of inline literals.
// TS map:   `import * as identity from "./identity";`
use crate::identity;

// What:     `#[derive(...)]` auto-implements: `Clone` (duplicable), `Debug`
//           (`{:?}` printing), `PartialEq` (`==`, used in tests), and
//           `Serialize`/`Deserialize` (JSON both ways).
// Why:      We clone it, compare it in tests, and persist it.
// TS map:   no annotation needed in TS for a plain object.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
// What:     `pub struct Session { ... }` a public record of the saved state.
//           Fields are `pub` so the engine can read/build them directly.
// Why:      One serializable blob describing "where the user left off".
// TS map:   `interface Session { ... }`.
//
// In TS you'd write (pseudocode):
// ```ts
// interface Session {
//   tracks: string[];
//   current: number | null;
//   positionSecs: number;
//   volume: number;
//   shuffle: ShuffleMode;
//   repeatTrack: boolean;
// }
// ```
pub struct Session {
    /// Queue tracks in load order.
    pub tracks: Vec<PathBuf>,
    // What:     `Option<usize>` is "maybe an index" (`Some(i)` or `None`).
    // Why:      Which track was current; `None` when the queue was empty.
    // TS map:   `current: number | null`.
    pub current: Option<usize>,
    // What:     `position_secs: f64` saved playback position in seconds.
    //           Siblings: `f32`, `u64` frames. f64 chosen for the same reasons
    //           as the `Position`/`Seek` messages (precision + seconds unit).
    // Why:      Resume the current track where it left off.
    // TS map:   `positionSecs: number`.
    pub position_secs: f64,
    // What:     `volume: f32` saved gain 0.0..=1.0. Sibling: `f64`. f32 matches
    //           the audio path and Slint.
    // Why:      Restore the user's last volume.
    // TS map:   `volume: number`.
    pub volume: f32,
    /// Saved shuffle mode (off / within-page / all).
    pub shuffle: ShuffleMode,
    /// Whether "repeat track" was on.
    pub repeat_track: bool,
}

// What:     `impl Default for Session` provides the first-run / corrupt-file
//           fallback value.
// Why:      `load()` returns this when there is no readable session.
// TS map:   a factory `function defaultSession(): Session`.
//
// In TS you'd write (pseudocode):
// ```ts
// function defaultSession(): Session {
//   return { tracks: [], current: null, positionSecs: 0, volume: 1,
//            shuffle: "off", repeatTrack: false };
// }
// ```
impl Default for Session {
    fn default() -> Session {
        // What:     struct literal as the tail expression (return value).
        //           `Vec::new()` empty array; `None` empty option; `1.0` full
        //           volume; `ShuffleMode::Off` the default mode; `false` no
        //           repeat-track.
        // Why:      Sensible starting state.
        // TS map:   the object literal above.
        Session {
            tracks: Vec::new(),
            current: None,
            position_secs: 0.0,
            volume: 1.0,
            shuffle: ShuffleMode::Off,
            repeat_track: false,
        }
    }
}

impl Session {
    // What:     `pub fn prune_unplayable(&mut self)` removes tracks that cannot or
    //           should not be played, fixing up the `current` index: a track is kept
    //           only when its file still exists AND its extension is in the audio
    //           allowlist. `&mut self` is a mutable borrow.
    // Why:      Files may have moved since the session was saved (gone paths), and a
    //           session saved before audio filtering existed may hold non-audio junk
    //           (cover art, `.DS_Store`, `.nomedia`); neither belongs in the queue.
    // TS map:   `pruneUnplayable(): void`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // pruneUnplayable(): void {
    //   const kept: string[] = [];
    //   let newCurrent: number | null = null;
    //   this.tracks.forEach((p, oldIdx) => {
    //     if (existsSync(p) && isAudioFile(p)) {
    //       if (this.current === oldIdx) newCurrent = kept.length;
    //       kept.push(p);
    //     }
    //   });
    //   this.tracks = kept;
    //   this.current = newCurrent;
    //   if (newCurrent === null) this.positionSecs = 0;
    // }
    // ```
    pub fn prune_unplayable(&mut self) {
        // What:     `let mut kept: Vec<PathBuf> = Vec::new();` an owned, growable
        //           array we fill with surviving paths. The `: Vec<PathBuf>`
        //           annotation is explicit because nothing else pins the type.
        // Why:      Collect only the still-existing tracks.
        // TS map:   `const kept: string[] = [];`
        let mut kept: Vec<PathBuf> = Vec::new();
        // What:     `let mut new_current: Option<usize> = None;` the remapped
        //           cursor, starting as "none yet".
        // Why:      The old index shifts once earlier tracks are dropped.
        // TS map:   `let newCurrent: number | null = null;`
        let mut new_current: Option<usize> = None;
        // What:     `for (old_idx, path) in self.tracks.iter().enumerate()`
        //           iterates BORROWED tracks paired with their position.
        //           `.iter()` borrows each `&PathBuf`; `.enumerate()` yields
        //           `(usize, &PathBuf)` tuples destructured into `old_idx`/`path`.
        // Why:      We need both the value and its original index to remap.
        // TS map:   `this.tracks.forEach((path, oldIdx) => { ... })`.
        for (old_idx, path) in self.tracks.iter().enumerate() {
            // What:     `path.exists() && crate::playback::is_audio_file(path)`.
            //           `path.exists()` returns `bool` (does the file exist now);
            //           `&&` short-circuits to the audio-extension test, the same
            //           predicate the folder scan uses. `path` is a `&PathBuf`, which
            //           DEREF-COERCES to the `&Path` `is_audio_file` takes.
            // Why:      Keep only present audio files; drop moved-away paths and any
            //           non-audio junk a pre-filtering session persisted.
            // TS map:   `existsSync(path) && isAudioFile(path)`.
            if path.exists() && crate::playback::is_audio_file(path) {
                // What:     `if self.current == Some(old_idx) { ... }` compares the
                //           saved cursor with this position. `Some(old_idx)` wraps
                //           the index to match the `Option` on the left.
                // Why:      If the surviving track was the current one, record its
                //           new position.
                // TS map:   `if (this.current === oldIdx) newCurrent = kept.length;`
                if self.current == Some(old_idx) {
                    // What:     `new_current = Some(kept.len());` the new index is
                    //           the count of already-kept items. `Some(...)` wraps it.
                    // Why:      Remap the cursor to the compacted array.
                    // TS map:   `newCurrent = kept.length;`
                    new_current = Some(kept.len());
                }
                // What:     `kept.push(path.clone());` appends a DEEP COPY of the
                //           path. `.clone()` is needed because `path` is a borrow
                //           we cannot move out of `self.tracks`.
                // Why:      Build the survivors list owning its own paths.
                // TS map:   `kept.push(path);` (strings copy implicitly in JS).
                kept.push(path.clone());
            }
        }
        // What:     `self.tracks = kept;` replace the list with survivors.
        // Why:      Drop the missing files.
        // TS map:   `this.tracks = kept;`
        self.tracks = kept;
        // What:     `self.current = new_current;` install the remapped cursor.
        // Why:      Point at the surviving current track, or `None`.
        // TS map:   `this.current = newCurrent;`
        self.current = new_current;
        // What:     `if self.current.is_none() { self.position_secs = 0.0; }`.
        //           `.is_none()` is true when the option is empty.
        // Why:      If the current track vanished, there is no position to resume.
        // TS map:   `if (this.current === null) this.positionSecs = 0;`
        if self.current.is_none() {
            self.position_secs = 0.0;
        }
    }

    // What:     `pub fn load() -> Session` reads the session file, parses it, and
    //           prunes missing tracks; any failure yields `Session::default()`.
    // Why:      Restore on launch without ever failing the program start.
    // TS map:   `static load(): Session`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // static load(): Session {
    //   const path = sessionPath();
    //   if (!path) return defaultSession();
    //   try {
    //     const s = JSON.parse(readFileSync(path, "utf8")) as Session;
    //     s.pruneUnplayable();
    //     return s;
    //   } catch { return defaultSession(); }
    // }
    // ```
    pub fn load() -> Session {
        // What:     `let path = match session_path() { Some(p) => p, None => return ... };`
        //           obtains the file path or bails to default. `session_path()`
        //           returns `Option<PathBuf>`.
        // Why:      Without a config directory there is nothing to load.
        // TS map:   `const path = sessionPath(); if (!path) return defaultSession();`
        let path = match session_path() {
            Some(p) => p,
            // What:     `None => return Session::default()` early return.
            // Why:      No home/config dir.
            // TS map:   `return defaultSession();`
            None => return Session::default(),
        };
        // What:     `let text = match std::fs::read_to_string(&path) { ... };`
        //           reads the whole file into an owned `String`. `&path` lends the
        //           path to the function. The call returns `Result<String, _>`.
        // Why:      Get the JSON text, or fall back if the file is absent/unreadable.
        // TS map:   `let text; try { text = readFileSync(path,"utf8") } catch { return default }`
        let text = match std::fs::read_to_string(&path) {
            // What:     `Ok(t) => t` extracts the file contents.
            // Why:      Continue to parsing.
            // TS map:   the success branch.
            Ok(t) => t,
            // What:     `Err(_) => return Session::default()` ignore the error and
            //           use defaults. `_` discards the error value.
            // Why:      First run (no file) is the common case.
            // TS map:   `catch { return defaultSession(); }`
            Err(_) => return Session::default(),
        };
        // What:     `match serde_json::from_str::<Session>(&text) { ... }` parses
        //           the JSON into a `Session`. The `::<Session>` is a TURBOFISH:
        //           it tells the generic function which type to produce.
        // Why:      Build the typed session from text, or fall back if corrupt.
        // TS map:   `try { JSON.parse(text) as Session } catch { default }`.
        match serde_json::from_str::<Session>(&text) {
            // What:     `Ok(mut session) => { ... }` binds the parsed value as a
            //           MUTABLE local so we can prune it. `mut` in a pattern makes
            //           the binding reassignable/mutable.
            // Why:      We need to drop missing tracks before returning.
            // TS map:   `const session = ...; session.pruneMissing(); return session;`
            Ok(mut session) => {
                // What:     `session.prune_unplayable();` drop gone/non-audio files,
                //           fix the cursor.
                // Why:      Never resume into a missing file or non-audio junk.
                // TS map:   `session.pruneUnplayable();`
                session.prune_unplayable();
                // What:     `session` tail expression returns the cleaned value.
                // Why:      Hand back the restored state.
                // TS map:   `return session;`
                session
            }
            // What:     `Err(_) => Session::default()` corrupt JSON -> defaults.
            // Why:      A broken file should not block startup.
            // TS map:   `catch { return defaultSession(); }`
            Err(_) => Session::default(),
        }
    }

    // What:     `pub fn save(&self) -> std::io::Result<()>`. `&self` read-only
    //           borrow. `std::io::Result<()>` is `Result<(), std::io::Error>`;
    //           `()` is the unit type (like `void`) for the success value.
    // Why:      Persist the session; the caller logs any I/O failure.
    // TS map:   `save(): void` that may throw an IO error.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // save(): void {
    //   const path = sessionPath();
    //   if (!path) return;
    //   mkdirSync(dirname(path), { recursive: true });
    //   writeFileSync(path, JSON.stringify(this));
    // }
    // ```
    pub fn save(&self) -> std::io::Result<()> {
        // What:     `let path = match session_path() { Some(p) => p, None => return Ok(()) };`
        //           get the target path or quietly succeed if there is no config dir.
        // Why:      Saving is best-effort; missing config dir is not an error.
        // TS map:   `const path = sessionPath(); if (!path) return;`
        let path = match session_path() {
            Some(p) => p,
            // What:     `None => return Ok(())` early success. `Ok(())` is the
            //           success variant wrapping unit.
            // Why:      Nothing to do, not a failure.
            // TS map:   `return;`
            None => return Ok(()),
        };
        // What:     `if let Some(parent) = path.parent() { ... }` runs only when the
        //           path has a parent directory. `path.parent()` returns
        //           `Option<&Path>`.
        // Why:      Ensure the config directory exists before writing into it.
        // TS map:   `mkdirSync(dirname(path), { recursive: true });`
        if let Some(parent) = path.parent() {
            // What:     `std::fs::create_dir_all(parent)?;` creates the directory
            //           and any missing ancestors. The trailing `?` PROPAGATES an
            //           error: if it returns `Err`, `save` returns that `Err`
            //           immediately; otherwise it unwraps the `Ok(())`.
            // Why:      First-ever save has no config dir yet.
            // TS map:   `mkdirSync(parent, { recursive: true });` (throws on failure).
            std::fs::create_dir_all(parent)?;
        }
        // What:     `let json = serde_json::to_string_pretty(self).map_err(...)?;`
        //           serializes `self` to a pretty JSON `String`. `to_string_pretty`
        //           returns `Result<String, serde_json::Error>`; `.map_err(|e| ...)`
        //           converts that error type into a `std::io::Error` so the `?` can
        //           propagate it through our `io::Result` return type.
        // Why:      Produce the bytes to write; unify error types for `?`.
        // TS map:   `const json = JSON.stringify(this, null, 2);`
        let json = serde_json::to_string_pretty(self)
            // What:     `.map_err(std::io::Error::other)` wraps the serde error in a
            //           generic io error. `std::io::Error::other(e)` is the shorthand
            //           for "an io error of the catch-all `Other` kind carrying `e`";
            //           passing the function itself (not `|e| ...`) is the closure
            //           shorthand clippy prefers.
            // Why:      `?` below needs an `io::Error`, not a serde error.
            // TS map:   serialization rarely throws in JS; ignore the conversion.
            .map_err(std::io::Error::other)?;
        // What:     `std::fs::write(&path, json)` writes the string to the file,
        //           replacing existing contents. Returns `io::Result<()>`. It is
        //           the tail expression, so its result is `save`'s result.
        // Why:      Persist the JSON.
        // TS map:   `writeFileSync(path, json);` and implicit `return;`
        std::fs::write(&path, json)
    }
}

// What:     `fn session_path() -> Option<PathBuf>` computes the on-disk location
//           of the session file, or `None` if no config directory is available.
//           Module-private (no `pub`).
// Why:      One place that decides where the session lives.
// TS map:   `function sessionPath(): string | null`.
//
// In TS you'd write (pseudocode):
// ```ts
// function sessionPath(): string | null {
//   const dirs = projectDirs("dev", "Monochromatic", "music-player");
//   return dirs ? join(dirs.configDir, "session.json") : null;
// }
// ```
fn session_path() -> Option<PathBuf> {
    // What:     `directories::ProjectDirs::from(identity::CONFIG_QUALIFIER,
    //           identity::CONFIG_ORGANIZATION, identity::CONFIG_APPLICATION)` asks
    //           the `directories` crate for the standard per-app config location
    //           (on Linux: `$XDG_CONFIG_HOME/music-player`) from the reverse-DNS
    //           triple, now sourced from the shared `identity` module instead of
    //           inline literals. It returns `Option<ProjectDirs>` (None if the
    //           home directory cannot be found).
    // Why:      Respect the platform's config-dir convention instead of guessing,
    //           and keep the identity strings in one place (identity.rs) so the
    //           config path cannot drift from the app's other identifiers.
    // TS map:   `const dirs = projectDirs(CONFIG_QUALIFIER, CONFIG_ORGANIZATION, CONFIG_APPLICATION);`
    directories::ProjectDirs::from(
        identity::CONFIG_QUALIFIER,
        identity::CONFIG_ORGANIZATION,
        identity::CONFIG_APPLICATION,
    )
        // What:     `.map(|dirs| dirs.config_dir().join("session.json"))` runs only
        //           when `Some`. `dirs.config_dir()` returns `&Path`; `.join(...)`
        //           appends the filename and returns an owned `PathBuf`.
        // Why:      Turn the directory into the full file path.
        // TS map:   `dirs ? join(dirs.configDir, "session.json") : null`.
        .map(|dirs| dirs.config_dir().join("session.json"))
}

// What:     `#[cfg(test)] #[path = "session_tests.rs"] mod tests;`
//           declares a test-only submodule whose code lives in the sibling
//           file `session_tests.rs`. `#[cfg(test)]` gates it to test
//           builds only; `#[path = "..."]` aims the module at a flat sibling
//           file instead of the default `session/tests.rs`
//           subdirectory lookup. The file stays the `tests` CHILD of
//           session, so its `use super::*` reaches the module items
//           (including private ones) unchanged.
// Why:      Keep `session.rs` to production code; the tests live
//           beside it without inflating this file or its max-lines budget
//           (sibling `*_tests.rs` files are exempt from the linter).
// TS map:   the `session.unit.test.ts` file beside
//           `session.ts`, excluded from the production bundle.
//
// In TS you'd write (pseudocode):
// ```ts
// // session.unit.test.ts, run only by the test runner
// ```
#[cfg(test)]
#[path = "session_tests.rs"]
mod tests;
