//! Saving and restoring the last session (queue, cursor, position, volume,
//! shuffle, repeat) to a JSON file under the user's config directory. On
//! restore, tracks whose files have moved/disappeared are dropped.

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

// What:     `use crate::command::RepeatMode;` imports our repeat enum.
// Why:      The saved session remembers the repeat mode.
// TS map:   `import { RepeatMode } from "./command";`
use crate::command::RepeatMode;

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
//   shuffle: boolean;
//   repeat: RepeatMode;
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
    /// Whether shuffle was on.
    pub shuffle: bool,
    /// Saved repeat mode.
    pub repeat: RepeatMode,
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
//            shuffle: false, repeat: "off" };
// }
// ```
impl Default for Session {
    fn default() -> Session {
        // What:     struct literal as the tail expression (return value).
        //           `Vec::new()` empty array; `None` empty option; `1.0` full
        //           volume; `RepeatMode::Off` the default mode.
        // Why:      Sensible starting state.
        // TS map:   the object literal above.
        Session {
            tracks: Vec::new(),
            current: None,
            position_secs: 0.0,
            volume: 1.0,
            shuffle: false,
            repeat: RepeatMode::Off,
        }
    }
}

impl Session {
    // What:     `pub fn prune_missing(&mut self)` removes tracks whose files no
    //           longer exist and fixes up the `current` index. `&mut self` is a
    //           mutable borrow.
    // Why:      Files may have moved since the session was saved; we must not
    //           try to play paths that are gone.
    // TS map:   `pruneMissing(): void`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // pruneMissing(): void {
    //   const kept: string[] = [];
    //   let newCurrent: number | null = null;
    //   this.tracks.forEach((p, oldIdx) => {
    //     if (existsSync(p)) {
    //       if (this.current === oldIdx) newCurrent = kept.length;
    //       kept.push(p);
    //     }
    //   });
    //   this.tracks = kept;
    //   this.current = newCurrent;
    //   if (newCurrent === null) this.positionSecs = 0;
    // }
    // ```
    pub fn prune_missing(&mut self) {
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
            // What:     `path.exists()` returns `bool` (does the file exist now).
            // Why:      Keep only present files.
            // TS map:   `existsSync(path)`.
            if path.exists() {
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
    //     s.pruneMissing();
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
                // What:     `session.prune_missing();` drop gone files, fix cursor.
                // Why:      Never resume into a missing file.
                // TS map:   `session.pruneMissing();`
                session.prune_missing();
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
    // What:     `directories::ProjectDirs::from("dev", "Monochromatic", "music-player")`
    //           asks the `directories` crate for the standard per-app config
    //           location (on Linux: `$XDG_CONFIG_HOME/music-player`). It returns
    //           `Option<ProjectDirs>` (None if the home directory cannot be found).
    // Why:      Respect the platform's config-dir convention instead of guessing.
    // TS map:   `const dirs = projectDirs("dev","Monochromatic","music-player");`
    directories::ProjectDirs::from("dev", "Monochromatic", "music-player")
        // What:     `.map(|dirs| dirs.config_dir().join("session.json"))` runs only
        //           when `Some`. `dirs.config_dir()` returns `&Path`; `.join(...)`
        //           appends the filename and returns an owned `PathBuf`.
        // Why:      Turn the directory into the full file path.
        // TS map:   `dirs ? join(dirs.configDir, "session.json") : null`.
        .map(|dirs| dirs.config_dir().join("session.json"))
}

// What:     `#[cfg(test)] mod tests { ... }` test-only submodule.
// Why:      Cover the round-trip and pruning paths.
// TS map:   a `session.test.ts`.
#[cfg(test)]
mod tests {
    // What:     `use super::*;` bring the module's items into the test scope.
    // Why:      Tests need `Session`, etc.
    // TS map:   `import * as parent from "./session";`
    use super::*;

    #[test]
    fn json_round_trip_preserves_fields() {
        // What:     build a non-default session literal.
        // Why:      Exercise serialization of every field.
        // TS map:   `const original = { ... };`
        let original = Session {
            // What:     `vec![PathBuf::from("/a.flac"), PathBuf::from("/b.opus")]`
            //           the `vec!` macro builds a `Vec` from listed elements;
            //           `PathBuf::from` wraps each string literal as a path.
            // Why:      Two sample tracks.
            // TS map:   `["/a.flac", "/b.opus"]`.
            tracks: vec![PathBuf::from("/a.flac"), PathBuf::from("/b.opus")],
            current: Some(1),
            position_secs: 12.5,
            volume: 0.7,
            shuffle: true,
            repeat: RepeatMode::All,
        };
        // What:     `serde_json::to_string(&original).unwrap()` serializes to JSON.
        //           `.unwrap()` extracts the `Ok` value and PANICS on `Err` (fine
        //           in a test).
        // Why:      Produce the wire form.
        // TS map:   `const json = JSON.stringify(original);`
        let json = serde_json::to_string(&original).unwrap();
        // What:     `serde_json::from_str::<Session>(&json).unwrap()` parses it back.
        // Why:      Round-trip the value.
        // TS map:   `const back = JSON.parse(json) as Session;`
        let back = serde_json::from_str::<Session>(&json).unwrap();
        // What:     `assert_eq!(original, back)` fails unless they are equal (uses
        //           the derived `PartialEq`).
        // Why:      No field is lost or altered by the round-trip.
        // TS map:   `expect(back).toEqual(original);`
        assert_eq!(original, back);
    }

    #[test]
    fn prune_drops_missing_and_remaps_current() {
        // What:     `std::env::temp_dir()` returns the OS temp directory `PathBuf`.
        // Why:      We create one real file there so `exists()` is true for it.
        // TS map:   `const dir = os.tmpdir();`
        let dir = std::env::temp_dir();
        // What:     `dir.join("player_prune_test_present.wav")` build a real path.
        // Why:      This file will actually be created.
        // TS map:   `const present = join(dir, "...present.wav");`
        let present = dir.join("player_prune_test_present.wav");
        // What:     `std::fs::write(&present, b"x").unwrap();` writes one byte.
        //           `b"x"` is a BYTE-STRING literal (`&[u8]`), not a text `&str`.
        // Why:      Make the file exist on disk.
        // TS map:   `writeFileSync(present, "x");`
        std::fs::write(&present, b"x").unwrap();
        // What:     a path that does not exist.
        // Why:      Should be pruned.
        // TS map:   `const missing = join(dir, "...missing.wav");`
        let missing = dir.join("player_prune_test_missing_xyz.wav");
        // What:     session with [missing, present], current = 1 (the present one).
        // Why:      After pruning, only `present` survives and current must remap
        //           from index 1 to index 0.
        // TS map:   `{ tracks: [missing, present], current: 1, ... }`.
        let mut session = Session {
            tracks: vec![missing.clone(), present.clone()],
            current: Some(1),
            position_secs: 5.0,
            volume: 1.0,
            shuffle: false,
            repeat: RepeatMode::Off,
        };
        // What:     run the prune.
        // Why:      The behaviour under test.
        // TS map:   `session.pruneMissing();`
        session.prune_missing();
        // What:     only one track remains.
        // Why:      The missing one was dropped.
        // TS map:   `expect(session.tracks.length).toBe(1);`
        assert_eq!(session.tracks.len(), 1);
        // What:     the survivor is `present`.
        // Why:      Correct file kept.
        // TS map:   `expect(session.tracks[0]).toBe(present);`
        assert_eq!(session.tracks[0], present);
        // What:     current remapped from 1 to 0.
        // Why:      The cursor must follow the surviving track.
        // TS map:   `expect(session.current).toBe(0);`
        assert_eq!(session.current, Some(0));
        // What:     `std::fs::remove_file(&present).ok();` clean up the temp file.
        //           `.ok()` converts the `Result` to `Option`, discarding any error.
        // Why:      Do not leave test droppings; ignore failure to delete.
        // TS map:   `try { unlinkSync(present); } catch {}`
        std::fs::remove_file(&present).ok();
    }

    #[test]
    fn prune_clears_position_when_current_track_gone() {
        // What:     session whose only track is missing and is current.
        // Why:      Position must reset because the resume target is gone.
        // TS map:   `{ tracks: [missing], current: 0, positionSecs: 9, ... }`.
        let mut session = Session {
            tracks: vec![PathBuf::from("/definitely/not/here_404.flac")],
            current: Some(0),
            position_secs: 9.0,
            volume: 1.0,
            shuffle: false,
            repeat: RepeatMode::Off,
        };
        session.prune_missing();
        // What:     queue now empty.
        // Why:      The only track was missing.
        // TS map:   `expect(session.tracks.length).toBe(0);`
        assert_eq!(session.tracks.len(), 0);
        // What:     current cleared.
        // Why:      Nothing to resume.
        // TS map:   `expect(session.current).toBe(null);`
        assert_eq!(session.current, None);
        // What:     position reset to 0.0.
        // Why:      No track to resume into.
        // TS map:   `expect(session.positionSecs).toBe(0);`
        assert_eq!(session.position_secs, 0.0);
    }
}
