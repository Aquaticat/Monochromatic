//! Pure playback helpers with no audio device or threading: the per-sample
//! output stage (volume, headroom, clamp) and the path-to-file expansion the
//! queue needs. Kept apart from `engine`/`controller` so these can be unit
//! -tested directly and so each file stays within the line budget.

// What:     `use std::path::{Path, PathBuf};`. `Path` is a borrowed path view;
//           `PathBuf` is the owned, growable version (like `&str` vs `String`).
// Why:      The helpers take borrowed paths and return owned ones.
// TS map:   both are just `string` in TS.
use std::path::{Path, PathBuf};

// What:     `const AUDIO_EXTENSIONS: &[&str] = &[ ... ];`. `&[&str]` is a BORROWED
//           slice (sibling: the owned `Vec<&str>`) of borrowed string slices, each
//           pointing at text baked into the binary. The file extensions (lowercased,
//           no leading dot) this player treats as playable, matching the documented
//           codec set: FLAC, WAV/PCM, MP3, Vorbis (Ogg), Opus, AAC-LC/ALAC (MP4),
//           and AIFF.
// Why:      A folder holds more than music (cover art, playlists, and system files
//           like `.DS_Store` / `.nomedia` / `.database_uuid`); this allowlist is the
//           single rule deciding what a scan enqueues, so junk never reaches the queue.
// TS map:   `const AUDIO_EXTENSIONS: readonly string[] = [ ... ];`
const AUDIO_EXTENSIONS: &[&str] = &[
    "flac", "wav", "wave", "mp3", "ogg", "oga", "opus", "m4a", "m4b", "mp4", "aac", "aiff", "aif",
    "aifc",
];

// What:     `pub(crate) fn is_audio_file(path: &Path) -> bool`. True when the path's
//           extension is in `AUDIO_EXTENSIONS`, compared case-insensitively. `&Path`
//           is a borrowed path (read-only). `pub(crate)` so the session pruner reuses
//           the same rule.
// Why:      One predicate decides "does this belong in a music queue", shared by the
//           folder scan and the session restore so they cannot disagree.
// TS map:   `function isAudioFile(path: string): boolean`
//
// In TS you'd write (pseudocode):
// ```ts
// function isAudioFile(path: string): boolean {
//   const ext = extname(path).replace(/^\./, "").toLowerCase(); // "" when none
//   return AUDIO_EXTENSIONS.includes(ext);
// }
// ```
pub(crate) fn is_audio_file(path: &Path) -> bool {
    // What:     `match path.extension() { ... }`. `path.extension()` returns
    //           `Option<&OsStr>`: the part after the final dot, or `None` when there
    //           is none. A dotfile like `.DS_Store` has NO extension in Rust (the
    //           leading dot is not a separator), so it lands in the `None` arm.
    // Why:      Without an extension there is nothing to match against the allowlist.
    // TS map:   `const ext = extname(path); // "" when none`
    match path.extension() {
        // What:     `Some(ext) => AUDIO_EXTENSIONS.contains(&ext.to_string_lossy().to_lowercase().as_str())`.
        //           `ext.to_string_lossy()` makes a `Cow<str>` (replacing invalid
        //           bytes); `.to_lowercase()` returns an owned lowercased `String`;
        //           `.as_str()` borrows it as `&str`; the leading `&` makes the
        //           `&&str` that `slice.contains` compares against each entry.
        // Why:      Case-insensitive membership test, so `.FLAC` matches `flac`.
        // TS map:   `return AUDIO_EXTENSIONS.includes(ext.toLowerCase());`
        Some(ext) => AUDIO_EXTENSIONS.contains(&ext.to_string_lossy().to_lowercase().as_str()),
        // What:     `None => false`. No extension (extensionless name or a dotfile):
        //           not recognised as audio.
        // Why:      Skip extensionless and hidden files.
        // TS map:   `return false;`
        None => false,
    }
}

// What:     `pub(crate) fn process_sample(sample: f32, gain: f32) -> f32`. The
//           per-sample output stage: apply the combined gain (user volume times the
//           track's normalization gain), then hard-clamp into the valid PCM range.
//           `pub(crate)` makes it visible to the controller module but not outside the
//           crate. A plain free function (not a method) so it is unit-testable.
// Why:      One spot defines exactly what reaches the ring buffer, so the clamp guard
//           cannot be skipped and its behaviour can be tested directly. Headroom now
//           comes from per-track true-peak normalization folded into `gain` (see the
//           `truepeak` and `measure` modules), not a fixed factor here.
// TS map:   `function processSample(sample: number, gain: number): number`
pub(crate) fn process_sample(sample: f32, gain: f32) -> f32 {
    // What:     `(sample * gain).clamp(-1.0, 1.0)`. Multiply the raw sample by the
    //           combined gain, then `f32::clamp` pins the result into `-1.0..=1.0`
    //           (returns the bound when outside, else the value unchanged). No trailing
    //           `;`, so this tail expression is the return value. `-1.0`/`1.0` are the
    //           valid f32 PCM range PipeWire expects.
    // Why:      Final guard against any sample leaving the legal range; with true-peak
    //           normalization the clamp rarely fires, but it backstops measurement
    //           error and any residual decoder overshoot.
    // TS map:   `return Math.max(-1, Math.min(1, sample * gain));`
    // Gotcha:   `clamp` PANICS only if a BOUND is NaN; ours are constants, so it never
    //           panics. A NaN product passes through as NaN; decoders do not emit NaN.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return Math.max(-1, Math.min(1, sample * gain));
    // ```
    (sample * gain).clamp(-1.0, 1.0)
}

// What:     `pub(crate) fn frames_to_secs(frames: u64, rate: u32) -> f64`. Convert
//           a frame count to seconds at a given sample rate, returning `0.0` when
//           the rate is unknown (`0`). `f64` (sibling: `f32`) is the seconds-as-f64
//           time contract shared across threads.
// Why:      Both the session snapshot and the position throttle need frames -> secs;
//           one helper keeps the divide-by-zero guard in a single place.
// TS map:   `function framesToSecs(frames: number, rate: number): number`
pub(crate) fn frames_to_secs(frames: u64, rate: u32) -> f64 {
    // What:     `if rate == 0 { return 0.0; }`. Early return guarding the divide.
    // Why:      An unknown rate has no meaningful position; avoid dividing by zero.
    // TS map:   `if (rate === 0) return 0;`
    if rate == 0 {
        return 0.0;
    }
    // What:     `frames as f64 / rate as f64`. Widen both integers to `f64`, then
    //           divide. Tail expression -> return.
    // Why:      seconds = frames / rate.
    // TS map:   `return frames / rate;`
    frames as f64 / rate as f64
}

// What:     `pub(crate) fn expand_paths(paths: Vec<PathBuf>) -> Vec<PathBuf>`. Turn
//           the opened paths into a flat file list: a directory expands to every
//           file under it, RECURSIVELY (subfolders included); a plain path passes
//           through unchanged. `pub(crate)` so the controller can call it.
// Why:      The queue holds files, but the UI opens a folder, which should
//           enqueue all of its tracks.
// TS map:   `function expandPaths(paths: string[]): string[]`
pub(crate) fn expand_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    // What:     `let mut out: Vec<PathBuf> = Vec::new();`. The accumulating result.
    //           Explicit type because it starts empty.
    // Why:      Collect the expanded files.
    // TS map:   `const out: string[] = [];`
    let mut out: Vec<PathBuf> = Vec::new();

    // What:     `for path in paths { ... }`. Consume each opened path by value.
    // Why:      Classify file vs directory.
    // TS map:   `for (const path of paths) { ... }`
    for path in paths {
        // What:     `if path.is_dir() { ... } else { ... }`. `is_dir()` checks the
        //           filesystem (following symlinks).
        // Why:      Directories need recursive expansion.
        // TS map:   `if (isDir(path)) { ... } else { ... }`
        if path.is_dir() {
            // What:     `out.extend(collect_dir_files(&path));`. Append every file
            //           found under the directory. `&path` lends it; `.extend(...)`
            //           MOVES the returned files into `out`.
            // Why:      Recursively enqueue the folder's tracks.
            // TS map:   `out.push(...collectDirFiles(path));`
            out.extend(collect_dir_files(&path));
        } else {
            // What:     `out.push(path);`. A plain path: keep it as-is (MOVES it).
            // Why:      Could be a file (or non-existent; the decoder will report).
            // TS map:   `out.push(path);`
            out.push(path);
        }
    }

    // What:     `out`. Tail expression -> the expanded list is returned.
    // Why:      Hand back the flat file list.
    // TS map:   `return out;`
    out
}

// What:     `fn collect_dir_files(root: &Path) -> Vec<PathBuf>`. Walk a directory
//           tree and return every file under it, sorted within each folder, with
//           a folder's own files listed before its subfolders' files. `&Path` is
//           a borrowed path (we only read it). Private: only `expand_paths` calls it.
// Why:      Opening a folder should enqueue all its tracks, including nested ones.
// TS map:   `function collectDirFiles(root: string): string[]`
fn collect_dir_files(root: &Path) -> Vec<PathBuf> {
    // What:     `let mut out: Vec<PathBuf> = Vec::new();`. The collected files.
    // Why:      Accumulate across the whole walk.
    // TS map:   `const out: string[] = [];`
    let mut out: Vec<PathBuf> = Vec::new();

    // What:     `let mut stack: Vec<PathBuf> = vec![root.to_path_buf()];`. A
    //           work-list of directories still to visit, seeded with the root.
    //           `vec![...]` is the macro that builds a vector literal;
    //           `root.to_path_buf()` copies the borrowed `&Path` into an OWNED
    //           `PathBuf` we can store.
    // Why:      An explicit stack walks the tree ITERATIVELY (no recursion), so a
    //           deeply nested folder cannot overflow the call stack.
    // TS map:   `const stack: string[] = [root];`
    let mut stack: Vec<PathBuf> = vec![root.to_path_buf()];

    // What:     `while let Some(dir) = stack.pop() { ... }`. Pop directories until
    //           the work-list is empty. `stack.pop()` returns `Option<PathBuf>`:
    //           `Some(dir)` while items remain, `None` when done (ends the loop).
    // Why:      Process every pending directory.
    // TS map:   `while (stack.length) { const dir = stack.pop()!; ... }`
    while let Some(dir) = stack.pop() {
        // What:     `let entries = match std::fs::read_dir(&dir) { ... };`. List the
        //           directory; `read_dir` returns `Result<ReadDir>` (an iterator of
        //           entries). `&dir` lends the path.
        // Why:      Gather this folder's children, robust to unreadable folders.
        // TS map:   `let entries; try { entries = readdir(dir); } catch (e) { ... }`
        let entries = match std::fs::read_dir(&dir) {
            // What:     `Ok(e) => e`. The directory iterator.
            // Why:      Walk its entries.
            // TS map:   `entries = e;`
            Ok(e) => e,
            // What:     `Err(e) => { eprintln!(...); continue; }`. Log the failure
            //           and `continue` to the next work-list item.
            // Why:      One bad folder should not abort the whole walk.
            // TS map:   `catch (e) { console.error(e); continue; }`
            Err(e) => {
                eprintln!("music-player: cannot read dir {}: {e}", dir.display());
                continue;
            }
        };

        // What:     `let mut files: Vec<PathBuf> = Vec::new();`. Files directly in
        //           this folder.
        // Why:      Collected, sorted, then appended.
        // TS map:   `const files: string[] = [];`
        let mut files: Vec<PathBuf> = Vec::new();
        // What:     `let mut subdirs: Vec<PathBuf> = Vec::new();`. Subfolders found
        //           in this folder.
        // Why:      Pushed onto the work-stack after sorting.
        // TS map:   `const subdirs: string[] = [];`
        let mut subdirs: Vec<PathBuf> = Vec::new();

        // What:     `for entry in entries.flatten() { ... }`. Each `read_dir` item
        //           is a `Result<DirEntry>`; `.flatten()` yields only the `Ok`
        //           values, silently dropping unreadable entries. So `entry` is a
        //           `DirEntry`.
        // Why:      Iterate readable entries; skip broken ones robustly.
        // TS map:   `for (const entry of entries.filter(e => e.ok).map(e => e.value)) { ... }`
        for entry in entries.flatten() {
            // What:     `let file_type = match entry.file_type() { ... };`.
            //           `entry.file_type()` reports the entry kind WITHOUT following
            //           symlinks (returns `Result<FileType>`); on error skip it.
            // Why:      The non-following check lets us refuse to descend into
            //           symlinked directories, avoiding infinite loops on a symlink
            //           cycle.
            // TS map:   `let ft; try { ft = entry.fileType(); } catch { continue; }`
            let file_type = match entry.file_type() {
                // What:     `Ok(ft) => ft`. The entry's type.
                // Why:      Classify below.
                // TS map:   `ft = ...;`
                Ok(ft) => ft,
                // What:     `Err(_) => continue`. Unreadable type: skip this entry.
                //           `_` ignores the error value.
                // Why:      Be robust.
                // TS map:   `catch { continue; }`
                Err(_) => continue,
            };
            // What:     `let p = entry.path();`. The entry's full path.
            // Why:      Stored in one of the two buckets.
            // TS map:   `const p = entry.path;`
            let p = entry.path();
            // What:     `if file_type.is_dir() { subdirs.push(p); } else if p.is_file() && is_audio_file(&p) { files.push(p); }`.
            //           A REAL subdirectory (symlinks excluded by `file_type`) goes
            //           on the work-list; a file is kept ONLY when it resolves to a
            //           real file (`p.is_file()` DOES follow symlinks, so symlinked
            //           files still count) AND its extension is in the audio allowlist
            //           (`is_audio_file`, borrowing `&p`). A symlinked directory
            //           matches neither and is ignored (loop-safe).
            // Why:      Recurse into real folders; enqueue only audio files, so cover
            //           art, playlists, and system files (`.DS_Store`, `.nomedia`,
            //           `.database_uuid`, ...) never enter the queue.
            // TS map:   `if (ft.isDirectory()) subdirs.push(p); else if (isFile(p) && isAudioFile(p)) files.push(p);`
            if file_type.is_dir() {
                subdirs.push(p);
            } else if p.is_file() && is_audio_file(&p) {
                files.push(p);
            }
        }

        // What:     `files.sort();`. Sort this folder's files alphabetically in place.
        // Why:      Deterministic queue order.
        // TS map:   `files.sort();`
        files.sort();
        // What:     `subdirs.sort();`. Sort subfolders alphabetically in place.
        // Why:      Deterministic descent order.
        // TS map:   `subdirs.sort();`
        subdirs.sort();

        // What:     `out.extend(files);`. Append this folder's files (a parent's
        //           files precede its children's), MOVING them into `out`.
        // Why:      Add the folder's tracks to the result.
        // TS map:   `out.push(...files);`
        out.extend(files);

        // What:     `for dir in subdirs.into_iter().rev() { stack.push(dir); }`.
        //           Push subfolders in REVERSE sorted order. `into_iter()` consumes
        //           the vec by value; `.rev()` reverses the iteration.
        // Why:      The stack pops last-in-first-out, so reversing here makes the
        //           subfolders pop back out in sorted (ascending) order.
        // TS map:   `for (const dir of [...subdirs].reverse()) stack.push(dir);`
        for dir in subdirs.into_iter().rev() {
            stack.push(dir);
        }
    }

    // What:     `out`. Tail expression -> the recursively collected files.
    // Why:      Hand back every file under `root`.
    // TS map:   `return out;`
    out
}

// What:     `pub(crate) fn file_name_of(path: &Path) -> String`. The display
//           filename of a path (final component), or the whole path if it has none.
//           `pub(crate)` so the controller can call it.
// Why:      Filename-only metadata policy for the UI.
// TS map:   `function fileNameOf(path: string): string`
pub(crate) fn file_name_of(path: &Path) -> String {
    // What:     `match path.file_name() { ... }`. `file_name()` returns
    //           `Option<&OsStr>` (the last component), or `None` (e.g. `/`).
    // Why:      Extract the filename.
    // TS map:   `const name = basename(path);`
    match path.file_name() {
        // What:     `Some(name) => name.to_string_lossy().into_owned()`.
        //           `to_string_lossy()` converts the OS string to a `Cow<str>`
        //           (replacing invalid bytes); `.into_owned()` makes an owned
        //           `String`.
        // Why:      Need an owned UTF-8 string for the UI.
        // TS map:   `return basename;`
        Some(name) => name.to_string_lossy().into_owned(),
        // What:     `None => path.display().to_string()`. Fall back to the full
        //           path text. `display()` formats the path; `.to_string()` owns it.
        // Why:      Always show something.
        // TS map:   `return String(path);`
        None => path.display().to_string(),
    }
}

// What:     `#[cfg(test)] mod tests { ... }` declares a submodule compiled ONLY
//           during `cargo test`. `#[cfg(test)]` is a conditional-compilation
//           attribute.
// Why:      Cover the pure helpers (the threaded engine itself is exercised by
//           manual UI verification, not unit tests).
// TS map:   like a `*.test.ts` file, but inlined and compiled out of prod.
#[cfg(test)]
mod tests {
    // What:     `use super::*;` imports everything from the parent module into the
    //           test scope. `super` means "one level up".
    // Why:      Tests need `expand_paths`, `process_sample`, `PathBuf`, etc.
    // TS map:   `import * as parent from "./playback";`
    use super::*;
    // What:     `use std::fs;` brings the filesystem module into scope.
    // Why:      The test builds a real directory tree to walk.
    // TS map:   `import * as fs from "node:fs";`
    use std::fs;
    // What:     `use std::time::{SystemTime, UNIX_EPOCH};`. A clock reading and the
    //           1970 epoch reference point.
    // Why:      Build a unique temp-dir name so reruns do not collide.
    // TS map:   `Date.now()`.
    use std::time::{SystemTime, UNIX_EPOCH};

    // What:     `fn unique_temp_dir() -> PathBuf` test helper: make and return a
    //           fresh throwaway directory under the system temp dir.
    // Why:      Verify on a disposable fixture, never real state.
    // TS map:   `function uniqueTempDir(): string`.
    fn unique_temp_dir() -> PathBuf {
        // What:     `let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();`.
        //           Current time minus the epoch -> a `Duration`; `.unwrap()`
        //           extracts it (panics only if the clock predates 1970);
        //           `.as_nanos()` gives a `u128` nanosecond count.
        // Why:      A high-resolution component keeps the directory name unique.
        // TS map:   `const nanos = BigInt(Date.now()) * 1_000_000n;`
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        // What:     `let dir = std::env::temp_dir().join(format!("music-player-expand-{}-{}", std::process::id(), nanos));`.
        //           Build the path: system temp dir + a name carrying the process
        //           id and the nanosecond stamp. `std::process::id()` is this
        //           process's pid (a `u32`).
        // Why:      Unique per process and per call.
        // TS map:   `const dir = path.join(os.tmpdir(), `music-player-expand-${pid}-${nanos}`);`
        let dir = std::env::temp_dir().join(format!(
            "music-player-expand-{}-{}",
            std::process::id(),
            nanos
        ));
        // What:     `fs::create_dir_all(&dir).unwrap();`. Create the directory (and
        //           any missing parents); `.unwrap()` fails the test on error.
        //           `&dir` lends the path.
        // Why:      The fixture root must exist before we populate it.
        // TS map:   `fs.mkdirSync(dir, { recursive: true });`
        fs::create_dir_all(&dir).unwrap();
        // What:     `dir`. Tail expression -> return the created path.
        // Why:      Hand the fixture root to the caller.
        // TS map:   `return dir;`
        dir
    }

    // What:     `#[test]` marks the next function as a test case.
    // Why:      `cargo test` discovers and runs it.
    // TS map:   `test("expand_paths ...", () => { ... })`.
    #[test]
    fn expand_paths_walks_directories_recursively_and_sorts() {
        // What:     `let root = unique_temp_dir();`. Make the throwaway fixture.
        // Why:      A real tree to expand.
        // TS map:   `const root = uniqueTempDir();`
        let root = unique_temp_dir();

        // What:     `fs::write(root.join("b.flac"), b"x").unwrap();`. Create a file.
        //           `root.join("b.flac")` builds the child path; `b"x"` is a BYTE
        //           STRING literal (a `&[u8; 1]`, raw bytes, not text); `.unwrap()`
        //           fails the test on I/O error.
        // Why:      Two root files created out of alphabetical order, to prove the
        //           walk sorts them.
        // TS map:   `fs.writeFileSync(path.join(root, "b.flac"), "x");`
        fs::write(root.join("b.flac"), b"x").unwrap();
        // What:     create the second root file.
        // Why:      Out-of-order sibling.
        // TS map:   `fs.writeFileSync(path.join(root, "a.flac"), "x");`
        fs::write(root.join("a.flac"), b"x").unwrap();

        // What:     `let sub = root.join("sub");`. A subfolder path.
        // Why:      Prove the walk descends one level.
        // TS map:   `const sub = path.join(root, "sub");`
        let sub = root.join("sub");
        // What:     create the subfolder.
        // Why:      It must exist before adding files.
        // TS map:   `fs.mkdirSync(sub, { recursive: true });`
        fs::create_dir_all(&sub).unwrap();
        // What:     a file inside the subfolder.
        // Why:      Expected after the root files.
        // TS map:   `fs.writeFileSync(path.join(sub, "c.flac"), "x");`
        fs::write(sub.join("c.flac"), b"x").unwrap();

        // What:     `let nested = sub.join("nested");`. A deeper folder.
        // Why:      Prove the walk descends more than one level.
        // TS map:   `const nested = path.join(sub, "nested");`
        let nested = sub.join("nested");
        // What:     create the nested folder.
        // Why:      Needed before its file.
        // TS map:   `fs.mkdirSync(nested, { recursive: true });`
        fs::create_dir_all(&nested).unwrap();
        // What:     a file two levels down.
        // Why:      Expected last.
        // TS map:   `fs.writeFileSync(path.join(nested, "d.flac"), "x");`
        fs::write(nested.join("d.flac"), b"x").unwrap();

        // What:     `let got = expand_paths(vec![root.clone()]);`. Expand the root
        //           folder. `vec![...]` wraps it in a one-element vector;
        //           `root.clone()` copies the path (we reuse `root` afterwards).
        // Why:      Exercise the recursive walk.
        // TS map:   `const got = expandPaths([root]);`
        let got = expand_paths(vec![root.clone()]);

        // What:     `let expected = vec![ ... ];`. The order the walk must produce:
        //           a folder's files (sorted) before its subfolders' files,
        //           depth-first.
        // Why:      Pin the deterministic ordering.
        // TS map:   `const expected = [ ... ];`
        let expected = vec![
            root.join("a.flac"),
            root.join("b.flac"),
            sub.join("c.flac"),
            nested.join("d.flac"),
        ];
        // What:     `assert_eq!(got, expected);`. Panics (failing the test) unless
        //           the two vectors are equal.
        // Why:      Confirm recursive collection and ordering.
        // TS map:   `expect(got).toEqual(expected);`
        assert_eq!(got, expected);

        // What:     `let single = expand_paths(vec![root.join("a.flac")]);`. Expand a
        //           plain FILE path (not a directory).
        // Why:      A file should pass through unchanged.
        // TS map:   `const single = expandPaths([path.join(root, "a.flac")]);`
        let single = expand_paths(vec![root.join("a.flac")]);
        // What:     `assert_eq!(single, vec![root.join("a.flac")]);`. One element, the
        //           file itself.
        // Why:      Files are not expanded.
        // TS map:   `expect(single).toEqual([path.join(root, "a.flac")]);`
        assert_eq!(single, vec![root.join("a.flac")]);

        // What:     `let _ = fs::remove_dir_all(&root);`. Delete the throwaway tree;
        //           `let _ =` discards the result (cleanup is best-effort).
        // Why:      Leave no fixture behind.
        // TS map:   `fs.rmSync(root, { recursive: true, force: true });`
        let _ = fs::remove_dir_all(&root);
    }

    // What:     `#[test]` marks the next function as a test case.
    // Why:      Cover the audio-extension predicate directly.
    // TS map:   `test("is_audio_file ...", () => { ... })`.
    #[test]
    fn is_audio_file_matches_extensions_case_insensitively() {
        // What:     `assert!(is_audio_file(Path::new("a.flac")));`. `Path::new(s)`
        //           wraps a `&str` as a `&Path` with no allocation. A `.flac` file
        //           is audio.
        // Why:      Baseline positive.
        // TS map:   `expect(isAudioFile("a.flac")).toBe(true);`
        assert!(is_audio_file(Path::new("a.flac")));
        // What:     uppercase extension still matches.
        // Why:      The check is case-insensitive.
        // TS map:   `expect(isAudioFile("A.FLAC")).toBe(true);`
        assert!(is_audio_file(Path::new("A.FLAC")));
        // What:     a mixed-case extension on a nested path matches.
        // Why:      Confirm path components do not affect the extension test.
        // TS map:   `expect(isAudioFile("/x/y/b.OpUs")).toBe(true);`
        assert!(is_audio_file(Path::new("/x/y/b.OpUs")));
        // What:     `assert!(!is_audio_file(Path::new("cover.jpg")));`. `!` negates;
        //           a non-audio extension is rejected.
        // Why:      Cover art must not enter the queue.
        // TS map:   `expect(isAudioFile("cover.jpg")).toBe(false);`
        assert!(!is_audio_file(Path::new("cover.jpg")));
        // What:     a dotfile has no extension, so it is rejected.
        // Why:      System files like `.DS_Store` must be skipped.
        // TS map:   `expect(isAudioFile(".DS_Store")).toBe(false);`
        assert!(!is_audio_file(Path::new(".DS_Store")));
        // What:     an extensionless name is rejected.
        // Why:      Nothing identifies it as audio.
        // TS map:   `expect(isAudioFile("noext")).toBe(false);`
        assert!(!is_audio_file(Path::new("noext")));
    }

    // What:     `#[test]` marks the next function as a test case.
    // Why:      Prove a folder scan keeps only audio files and skips junk.
    // TS map:   `test("expand_paths keeps only audio ...", () => { ... })`.
    #[test]
    fn expand_paths_keeps_only_audio_files_and_skips_junk() {
        // What:     `let root = unique_temp_dir();`. A throwaway fixture directory.
        // Why:      A real folder to scan.
        // TS map:   `const root = uniqueTempDir();`
        let root = unique_temp_dir();

        // What:     create two audio files, deliberately out of alphabetical order.
        // Why:      Confirm they survive and come back sorted.
        // TS map:   `fs.writeFileSync(join(root, "song.mp3"), "x"); ...`
        fs::write(root.join("song.mp3"), b"x").unwrap();
        fs::write(root.join("tune.flac"), b"x").unwrap();
        // What:     create non-audio and hidden/system files that must be skipped.
        // Why:      These are exactly the kinds of files that leaked into the queue.
        // TS map:   `fs.writeFileSync(join(root, "cover.jpg"), "x"); ...`
        fs::write(root.join("cover.jpg"), b"x").unwrap();
        fs::write(root.join("playlist.m3u"), b"x").unwrap();
        fs::write(root.join(".DS_Store"), b"x").unwrap();
        fs::write(root.join(".nomedia"), b"x").unwrap();
        fs::write(root.join(".database_uuid"), b"x").unwrap();

        // What:     `let got = expand_paths(vec![root.clone()]);`. Scan the folder.
        // Why:      Exercise the filtered walk.
        // TS map:   `const got = expandPaths([root]);`
        let got = expand_paths(vec![root.clone()]);
        // What:     `let expected = vec![root.join("song.mp3"), root.join("tune.flac")];`.
        //           Only the two audio files, sorted (`s` before `t`).
        // Why:      Pin the filtered, ordered result.
        // TS map:   `const expected = [join(root, "song.mp3"), join(root, "tune.flac")];`
        let expected = vec![root.join("song.mp3"), root.join("tune.flac")];
        // What:     `assert_eq!(got, expected);`. Fail unless equal.
        // Why:      Confirm junk is dropped and audio kept in order.
        // TS map:   `expect(got).toEqual(expected);`
        assert_eq!(got, expected);

        // What:     `let _ = fs::remove_dir_all(&root);`. Best-effort cleanup.
        // Why:      Leave no fixture behind.
        // TS map:   `fs.rmSync(root, { recursive: true, force: true });`
        let _ = fs::remove_dir_all(&root);
    }

    // What:     `fn approx_eq(a: f32, b: f32) -> bool` test helper: true when two
    //           floats sit within a tiny tolerance of each other.
    // Why:      Float math is not bit-exact, and a direct `==` on floats is both
    //           fragile and flagged by clippy; compare distances instead.
    // TS map:   `function approxEq(a: number, b: number): boolean`
    fn approx_eq(a: f32, b: f32) -> bool {
        // What:     `const TOLERANCE: f32 = 1e-6;`. Largest allowed difference;
        //           `1e-6` is scientific notation for 0.000001.
        // Why:      Far below any audible difference, loose enough for f32 rounding.
        // TS map:   `const TOLERANCE = 1e-6;`
        const TOLERANCE: f32 = 1e-6;
        // What:     `(a - b).abs() < TOLERANCE`. Subtract, take the magnitude with
        //           `.abs()`, then compare with `<`. Tail expression -> return.
        // Why:      Distance-based equality avoids the float `==` trap.
        // TS map:   `return Math.abs(a - b) < TOLERANCE;`
        (a - b).abs() < TOLERANCE
    }

    // What:     `#[test]` marks the next function as a test case.
    // Why:      `cargo test` discovers and runs it.
    // TS map:   `test("process_sample ...", () => { ... })`.
    #[test]
    fn process_sample_applies_gain_then_clamps() {
        // What:     `assert!(approx_eq(process_sample(0.0, 1.0), 0.0));`. `assert!(cond)`
        //           panics (failing the test) when `cond` is false.
        // Why:      Silence in must stay silence out, whatever the gain.
        // TS map:   `expect(approxEq(processSample(0, 1), 0)).toBe(true);`
        assert!(approx_eq(process_sample(0.0, 1.0), 0.0));

        // What:     unity gain passes a below-range sample through unchanged.
        // Why:      No clamp when within range.
        // TS map:   `expect(approxEq(processSample(0.5, 1), 0.5)).toBe(true);`
        assert!(approx_eq(process_sample(0.5, 1.0), 0.5));

        // What:     the gain multiplies the sample (0.8 * 0.5 = 0.4).
        // Why:      Prove the combined gain is applied.
        // TS map:   `expect(approxEq(processSample(0.8, 0.5), 0.4)).toBe(true);`
        assert!(approx_eq(process_sample(0.8, 0.5), 0.4));

        // What:     a result above 1.0 (1.5 * 1.0) is clamped to exactly 1.0.
        // Why:      The clamp backstops anything that would exceed full scale.
        // TS map:   `expect(approxEq(processSample(1.5, 1), 1)).toBe(true);`
        assert!(approx_eq(process_sample(1.5, 1.0), 1.0));
        // What:     a result below -1.0 (-2.0 * 1.0) is clamped to exactly -1.0.
        // Why:      Clamp is symmetric.
        // TS map:   `expect(approxEq(processSample(-2, 1), -1)).toBe(true);`
        assert!(approx_eq(process_sample(-2.0, 1.0), -1.0));
    }
}
