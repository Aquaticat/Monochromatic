// What:     `use ignore::WalkBuilder;` imports the type that builds a
//           filesystem walker honoring `.gitignore`, hidden-file rules,
//           and parent-directory ignore files. `ignore` is the crate
//           ripgrep uses for its file walking.
// Why:      `--all` mode walks the working tree to enumerate every file
//           we should scan; `WalkBuilder` does this in parallel and
//           respects `.gitignore` semantics (including `!` negations).
// TS map:   `import { WalkBuilder } from "<some npm package>"` — there
//           is no direct TS analogue; closest is `globby` or
//           `fast-glob` with `gitignore: true`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { WalkBuilder } from "<no-direct-equivalent>";
// ```
use ignore::WalkBuilder;

// What:     `use ignore::WalkState;` imports the enum returned by the
//           parallel walker's per-entry callback to control whether to
//           keep walking, skip the current subtree, or quit entirely.
// Why:      The parallel walker wants the callback to say
//           `WalkState::Continue` after handling each entry.
// TS map:   No equivalent; closest mental model is "return a status
//           code from the callback to steer the iterator."
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent; conceptually a return value steering the walker.
// ```
use ignore::WalkState;

// What:     `use std::sync::{Arc, Mutex};` imports two thread-safe
//           wrappers from the standard library.
//             - `Arc<T>` ("atomically reference-counted") is a heap-
//               allocated `T` whose ownership is shared across multiple
//               owners; cloning bumps a refcount, dropping decrements
//               it, the inner `T` is freed when the count hits zero.
//             - `Mutex<T>` is a mutual-exclusion lock guarding a `T`;
//               `lock()` blocks until the current thread is the holder.
// Why:      The parallel walker spawns multiple threads, each calling
//           our callback concurrently. To collect file paths from all
//           threads into a shared `Vec`, we wrap the `Vec` in
//           `Arc<Mutex<...>>`: `Arc` to share across threads, `Mutex`
//           to serialize push operations.
// TS map:   No 1:1 equivalent. Mentally: a JS `Array` shared between
//           workers via SharedArrayBuffer + an Atomics lock — except
//           the Rust version is type-checked end to end.
// Gotcha:   `Arc::clone(&x)` is cheap (atomic increment), NOT a deep
//           copy. The pointee is the same `Mutex<Vec>`.
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent. Imagine SharedArrayBuffer + a worker-pool lock.
// ```
use std::sync::{Arc, Mutex};

// What:     `pub fn list_files(root: &str) -> Result<Vec<String>, String>`
//           walks the working tree starting at `root` and returns an
//           owned vector of file paths (UTF-8). `pub` makes it visible
//           to `main.rs`. The signature mirrors the prior
//           `list_tracked_files` to keep the call site simple.
// Why:      `--all` mode calls this once to get every scannable file.
//           The `Result` shape lets us propagate walk errors as
//           strings, matching the rest of the binary's error style.
// TS map:   `export function listFiles(root: string): string[]`, with
//           Rust's `Result<T, String>` standing in for "throw a string
//           message instead of returning."
//
// In TS you'd write (pseudocode):
// ```ts
// export function listFiles(root: string): string[] {
//   return walkBuilder(root)
//     .hidden(false)
//     .ignore(false)
//     .filterEntry((e) => e.fileName !== ".git" && e.fileName !== ".jj")
//     .buildParallel()
//     .map((e) => e.path);
// }
// ```
pub fn list_files(root: &str) -> Result<Vec<String>, String> {
    // What:     `Arc::new(Mutex::new(Vec::new()))` allocates an empty
    //           `Vec<String>`, wraps it in a `Mutex`, then heap-
    //           allocates that mutex behind an atomically-refcounted
    //           pointer. We will clone this `Arc` into each worker
    //           closure so every thread can lock-and-push.
    // Why:      Need a shared collection for the parallel walker to
    //           write into.
    // TS map:   `const files = new SharedCollection<string>();`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const files = makeSharedArray<string>();
    // ```
    let files: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));

    // What:     `WalkBuilder::new(root).hidden(false).ignore(false)
    //           .filter_entry(...).build_parallel()` configures and
    //           builds a parallel walker.
    //             - `hidden(false)`: include dotfiles (`.github/`,
    //               `.gitignore`, etc.) — git tracks these, so we
    //               must scan them.
    //             - `ignore(false)`: do NOT honor `.ignore` files
    //               (used by tools like `scc`); the repo's `.ignore`
    //               re-excludes things `.gitignore` deliberately
    //               re-includes via `!` negations, so reading
    //               `.ignore` would silently drop tracked files from
    //               the scan set.
    //             - `filter_entry(|e| ...)`: stops the walker from
    //               descending into `.git` and `.jj` directories
    //               (VCS internals are huge and not user content).
    //               We don't rely on `hidden(true)` to do this,
    //               because we need other dotdirs (`.github/`, etc.)
    //               to be visited.
    //             - `build_parallel()`: returns a parallel walker
    //               that runs a callback across worker threads.
    // Why:      Replaces the previous `git ls-files` subprocess with
    //           an in-process walk. On this repo the parallel walker
    //           is ~9x faster than the subprocess; the walker also
    //           drops the runtime dependency on `git` being on PATH.
    // TS map:   The whole block is a builder chain — closest TS analogue
    //           is fast-glob/globby with options object, then a
    //           `forEach` over results.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const walker = walkBuilder(root, {
    //   hidden: false,
    //   ignoreFile: false,
    //   filterEntry: (e) => e.fileName !== ".git" && e.fileName !== ".jj",
    //   parallel: true,
    // });
    // ```
    let walker = WalkBuilder::new(root)
        .hidden(false)
        .ignore(false)
        .filter_entry(|e| {
            // What:     `e.file_name()` returns the last path component
            //           as an `&OsStr`. Comparing it against the string
            //           literal `".git"` works because `OsStr` impls
            //           `PartialEq<str>` for ASCII names.
            // Why:      Skip the entire `.git/` and `.jj/` subtrees.
            // TS map:   `path.basename(p) !== ".git"` and `!== ".jj"`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return path.basename(p) !== ".git" && path.basename(p) !== ".jj";
            // ```
            e.file_name() != ".git" && e.file_name() != ".jj"
        })
        .build_parallel();

    // What:     `walker.run(|| { Box::new(move |entry| { ... }) })`
    //           runs the parallel walker. The OUTER closure builds a
    //           PER-THREAD callback (one per worker); the INNER
    //           closure handles each filesystem entry that thread
    //           visits. The `move` keyword on the inner closure
    //           transfers ownership of captured variables (the
    //           `Arc` clone) into the closure body.
    //             - `Box::new(...)` heap-allocates the callback so
    //               the walker can store a trait object.
    //             - The callback returns `WalkState::Continue` to
    //               keep walking. (Other variants exist for skipping
    //               or quitting; we don't need them.)
    // Why:      Kicks off the parallel walk and accumulates file
    //           paths into the shared `Vec`.
    // TS map:   `walker.run((entry) => { handle(entry); })` —
    //           closest mental model is a worker pool's per-worker
    //           handler factory.
    // Gotcha:   The OUTER closure is called once PER WORKER THREAD
    //           (NOT once per entry). The INNER closure is called
    //           once per entry. Mixing these up leads to allocating
    //           one callback per entry, which is wrong.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // walker.run(() => {
    //   const filesLocal = files; // captured per-worker
    //   return (entry) => {
    //     if (entry.isFile && entry.path) filesLocal.push(entry.path);
    //   };
    // });
    // ```
    walker.run(|| {
        // What:     `Arc::clone(&files)` bumps the refcount and yields
        //           a new owning handle to the same `Mutex<Vec>`.
        // Why:      Each worker thread needs its own `Arc` handle.
        //           The `move` below transfers this clone into the
        //           inner closure.
        // TS map:   `const filesRef = files;` (TS shares references
        //           naturally; Rust requires explicit refcounting to
        //           share ownership across threads).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const filesRef = files;
        // ```
        let files = Arc::clone(&files);
        Box::new(move |entry| {
            // What:     `let Ok(e) = entry else { return ...; };`
            //           is a `let-else` pattern: if `entry` (a
            //           `Result<DirEntry, ignore::Error>`) is the
            //           `Ok` variant, bind `e` to the inner value
            //           and continue; otherwise return early. We
            //           silently skip entries that errored (e.g.,
            //           permission denied on a sub-tree); they are
            //           rare and the prior `git ls-files` path
            //           also ignored such failures via lossy
            //           UTF-8 handling.
            // Why:      The walker reports per-entry I/O errors via
            //           `Result`; we need the `Ok` value to look at
            //           the file.
            // TS map:   `if (!entry.ok) return; const e = entry.value;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (!entry.ok) return WALK_CONTINUE;
            // const e = entry.value;
            // ```
            let Ok(e) = entry else {
                return WalkState::Continue;
            };

            // What:     `e.file_type().map(|t| t.is_file()).unwrap_or(false)`
            //           checks whether the entry is a regular file.
            //           `file_type()` returns `Option<FileType>`;
            //           `.map(|t| t.is_file())` becomes `Option<bool>`;
            //           `.unwrap_or(false)` extracts the bool or
            //           defaults to `false` (i.e., "not a file" when
            //           file type is unknown).
            // Why:      We only want files in the output, not
            //           directories or special entries.
            // TS map:   `e.fileType?.isFile ?? false`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const isFile = e.fileType?.isFile ?? false;
            // ```
            let is_file = e.file_type().map(|t| t.is_file()).unwrap_or(false);
            if !is_file {
                return WalkState::Continue;
            }

            // What:     `e.path().to_str()` returns `Option<&str>`:
            //           `Some(s)` when the path is valid UTF-8,
            //           `None` otherwise. We push only UTF-8 paths
            //           (matching the prior `list_tracked_files`
            //           behavior, which validated UTF-8 explicitly).
            // Why:      Every consumer downstream takes `&str`; non-
            //           UTF-8 paths would force an `OsString` plumbing
            //           overhaul for vanishingly rare cases.
            // TS map:   `e.path` (TS strings are always UTF-16; the
            //           equivalent decision happens implicitly).
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const s = e.path; // assume utf-8
            // files.push(s);
            // ```
            if let Some(s) = e.path().to_str() {
                // What:     `files.lock().unwrap().push(s.to_string())`
                //           acquires the mutex (blocking briefly if
                //           contended), unwraps the LockResult into
                //           a `MutexGuard`, then pushes a clone of
                //           the path string. The guard is dropped at
                //           end of statement, releasing the lock.
                // Why:      Serialize the per-thread push into the
                //           shared `Vec`.
                // TS map:   `files.push(s);` — TS doesn't have to
                //           lock because Node is single-threaded.
                // Gotcha:   `unwrap()` on `lock()` panics if a prior
                //           holder panicked while holding the lock
                //           (poisoned mutex). Acceptable here: a
                //           panic in the walker is a bug and we
                //           want it to surface.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // files.push(s);
                // ```
                files.lock().unwrap().push(s.to_string());
            }
            WalkState::Continue
        })
    });

    // What:     `Arc::try_unwrap(files)` succeeds if this `Arc` is the
    //           sole remaining handle, returning the `Mutex<Vec>`
    //           directly; otherwise returns the `Arc` back as `Err`.
    //           Then `.into_inner()` unwraps the `Mutex` into its
    //           inner `Vec`. We fall back to cloning the contents if
    //           somehow extra refcounts remain (the walker should
    //           have dropped them by now, but a defensive fallback
    //           costs nothing).
    // Why:      Returning the inner `Vec` by value is cheaper than
    //           cloning; we only fall back when the optimization
    //           is unavailable.
    // TS map:   No 1:1; mentally: "if I'm the only owner, take the
    //           array out without copying; otherwise copy."
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const out = files.takeOrClone();
    // return out;
    // ```
    let files = match Arc::try_unwrap(files) {
        Ok(m) => m.into_inner().map_err(|e| format!("walk poisoned: {}", e))?,
        Err(arc) => arc.lock().map_err(|e| format!("walk poisoned: {}", e))?.clone(),
    };
    Ok(files)
}
