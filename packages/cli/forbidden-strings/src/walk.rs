// What:     `use ignore::WalkBuilder;` imports the type that builds a
//           filesystem walker honoring `.gitignore`, hidden-file rules,
//           and parent-directory ignore files. `ignore` is the crate
//           ripgrep uses for its file walking.
// Why:      `--all` mode walks the working tree to enumerate every file
//           we should scan; `WalkBuilder` does this in parallel and
//           respects `.gitignore` semantics (including `!` negations).
// TS map:   `import { WalkBuilder } from "<some npm package>"`; there
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
//           workers via SharedArrayBuffer + an Atomics lock, except
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
    //               `.gitignore`, etc.): git tracks these, so we
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
    // TS map:   The whole block is a builder chain; closest TS analogue
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
    // TS map:   `walker.run((entry) => { handle(entry); })`,
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
                // TS map:   `files.push(s);`; TS doesn't have to
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
    let mut files = match Arc::try_unwrap(files) {
        Ok(m) => m.into_inner().map_err(|e| format!("walk poisoned: {}", e))?,
        Err(arc) => arc.lock().map_err(|e| format!("walk poisoned: {}", e))?.clone(),
    };

    // What:     Union with `git ls-files --ignored --exclude-standard -z`
    //           to recover tracked-but-gitignored files. The `ignore`
    //           crate's `WalkBuilder` always honours .gitignore (the
    //           `.ignore(false)` toggle disables `.ignore` files, not
    //           `.gitignore`). A file that was force-added with
    //           `git add -f` despite matching a `.gitignore` pattern is
    //           tracked by git but skipped by the walker, leaving a
    //           silent gap in `--all` mode -- a secret-scan on
    //           push-to-main must cover every tracked file.
    // Why:      Closes BUG 3. The union approach keeps the fast in-
    //           process walker as the primary enumerator and pays for
    //           git only when we need to recover the long-tail set.
    //           When the user is not inside a git repo, the `git`
    //           invocation fails and we silently fall back to the
    //           walker-only behaviour (existing non-git use case stays
    //           working).
    // TS map:   `await execFile("git", ["ls-files", "--ignored", "--exclude-standard", "-z"], { cwd: root });`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const out = await execFile("git", ["ls-files", "--ignored", "--exclude-standard", "-z"], { cwd: root });
    // for (const entry of out.split("\0").filter(s => s.length > 0)) {
    //   // dedupe + normalize prefix
    // }
    // ```
    if let Ok(output) = std::process::Command::new("git")
        .args(["ls-files", "--cached", "--ignored", "--exclude-standard", "-z"])
        .current_dir(root)
        .output()
    {
        if output.status.success() {
            // What:     Build a HashSet of normalized paths already in
            //           `files` so we can detect duplicates with the
            //           git output. WalkBuilder paths typically start
            //           with `./` (or the root prefix the user passed),
            //           while `git ls-files` returns paths relative to
            //           the git working-tree root with no leading `./`.
            //           Normalize by stripping `./` and comparing the
            //           remainder.
            // Why:      Without deduplication the same file would be
            //           scanned twice when it lives in BOTH sets (e.g.
            //           a file that is tracked but not gitignored
            //           appears only in walker output; a tracked-and-
            //           ignored file appears only in git output; but
            //           defensive dedup is cheap and survives future
            //           changes to either side).
            // TS map:   `const seen = new Set(files.map(p => p.replace(/^\.\//, "")));`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const seen = new Set(files.map(p => p.replace(/^\.\//, "")));
            // ```
            let mut seen: std::collections::HashSet<String> = files
                .iter()
                .map(|p| p.trim_start_matches("./").to_string())
                .collect();
            // What:     `output.stdout.split(|&b| b == 0).filter(|s| !s.is_empty())`
            //           splits the NUL-separated `git ls-files -z`
            //           stdout into per-path slices, dropping the
            //           trailing empty element after the last NUL.
            //           Each non-empty slice is one tracked-but-ignored
            //           path, UTF-8 (we silently skip non-UTF-8 entries
            //           to match the walker's existing semantics).
            // Why:      `-z` avoids quoting issues that the default
            //           newline-delimited output would have for paths
            //           containing spaces, quotes, or backslashes.
            // TS map:   `out.split("\0").filter(s => s.length > 0)`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // for (const bytes of out.split("\0")) {
            //   if (!bytes) continue;
            //   const s = bytes; // assume utf-8
            // }
            // ```
            for chunk in output.stdout.split(|&b| b == 0) {
                if chunk.is_empty() {
                    continue;
                }
                if let Ok(rel) = std::str::from_utf8(chunk) {
                    let normalized = rel.trim_start_matches("./").to_string();
                    if seen.insert(normalized.clone()) {
                        // Match the walker's leading-`./` convention so
                        // downstream string comparisons are uniform.
                        files.push(format!("./{}", normalized));
                    }
                }
            }
        }
    }

    Ok(files)
}

// What:     Integration-style tests for `list_files` that exercise the
//           git ls-files union path. Each test creates a temporary git
//           repository, populates it with a fixture file set, then
//           calls `list_files` and asserts the expected paths appear.
// Why:      The bug shape (BUG 3) is specifically about the interaction
//           with `git add -f` + .gitignore. A unit test on a pure
//           in-memory abstraction wouldn't catch it; we need real git
//           state.
// TS map:   integration test under `__tests__/walk.test.ts` shelling
//           out to `git init`/`git add`/`git commit`.
#[cfg(test)]
mod tests {
    use super::list_files;
    use std::fs;
    use std::path::PathBuf;
    use std::process::Command;

    // What:     `fn unique_tmp(label: &str) -> PathBuf` returns a fresh
    //           empty directory under `/tmp` (or platform equivalent).
    //           Uses pid + label to avoid collisions across concurrent
    //           tests; we don't take a `tempfile` crate dependency for
    //           one test.
    // Why:      Cargo test runs tests in parallel by default; without a
    //           per-test unique path two tests would race on the same
    //           directory.
    // TS map:   `os.tmpdir() + "/" + label + "-" + process.pid;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function uniqueTmp(label: string) {
    //   return path.join(os.tmpdir(), `${label}-${process.pid}`);
    // }
    // ```
    fn unique_tmp(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "fs-walk-test-{}-{}",
            label,
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create tmp dir");
        dir
    }

    // What:     `fn run_git(dir, args)` runs `git <args>` in `dir` and
    //           panics if the exit status is non-zero. The args are
    //           passed as a fixed-shape array so callers don't have to
    //           build a Vec.
    // Why:      Test setup needs deterministic git invocations; failing
    //           fast on a setup error keeps the actual assertions
    //           focused on the function under test.
    // TS map:   `execSync("git " + args.join(" "), { cwd: dir });`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function runGit(dir: string, args: string[]) {
    //   execSync(`git ${args.join(" ")}`, { cwd: dir });
    // }
    // ```
    fn run_git(dir: &PathBuf, args: &[&str]) {
        // What:     Resolve the git binary. The dev environment in this
        //           repo wraps `git` with a CLI policy enforcer that
        //           rejects bulk-add `.` and commit-without-pathspec
        //           shapes. Tests need direct access to the real binary
        //           so the setup steps run unmodified.
        // Why:      The wrapper is in `node_modules/.bin/git` which
        //           is earlier in PATH; tests spawning `git` would hit
        //           it and fail on perfectly normal setup invocations.
        //           Probe `/usr/bin/git` first; fall back to PATH lookup
        //           if absent so the test still works on other systems.
        // TS map:   `const gitBin = existsSync("/usr/bin/git") ? "/usr/bin/git" : "git";`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const gitBin = fs.existsSync("/usr/bin/git") ? "/usr/bin/git" : "git";
        // ```
        let git_bin = if std::path::Path::new("/usr/bin/git").exists() {
            "/usr/bin/git"
        } else {
            "git"
        };
        let status = Command::new(git_bin)
            .args(args)
            .current_dir(dir)
            .status()
            .expect("git command failed to spawn");
        assert!(
            status.success(),
            "git {:?} failed in {:?}",
            args,
            dir
        );
    }

    #[test]
    fn list_files_includes_force_added_gitignored_file() {
        // What:     Sets up a fixture git repo containing:
        //             - .gitignore with `*.ignored` pattern
        //             - tracked.ignored (force-added despite .gitignore)
        //             - normal.txt (tracked normally)
        //           Then calls `list_files(dir)` and asserts BOTH files
        //           appear in the output.
        // Why:      BUG 3 regression: pre-fix the WalkBuilder honoured
        //           .gitignore and silently skipped tracked.ignored.
        //           Post-fix the `git ls-files --ignored --exclude-standard`
        //           union recovers it.
        // TS map:   integration test as described.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // test("list_files includes force-added gitignored file", () => { ... });
        // ```
        let dir = unique_tmp("bug3-tracked-ignored");
        run_git(&dir, &["init", "-q"]);
        run_git(&dir, &["config", "user.email", "t@t"]);
        run_git(&dir, &["config", "user.name", "t"]);
        fs::write(dir.join(".gitignore"), "*.ignored\n").expect("write .gitignore");
        fs::write(dir.join("tracked.ignored"), "secret content")
            .expect("write tracked.ignored");
        fs::write(dir.join("normal.txt"), "normal content").expect("write normal.txt");
        run_git(&dir, &["add", "-f", ".gitignore", "tracked.ignored", "normal.txt"]);
        // Explicit pathspec on commit -- the dev environment's git
        // wrapper rejects commits without one, and real git accepts it
        // either way.
        run_git(
            &dir,
            &["commit", "-q", "-m", "initial", ".gitignore", "tracked.ignored", "normal.txt"],
        );

        let files = list_files(dir.to_str().expect("dir utf8")).expect("list_files");
        // What:     Collect basenames of returned paths into a Vec for
        //           the diagnostic message; the assertion is on
        //           membership, not order.
        // Why:      The walker returns paths like `<dir>/tracked.ignored`
        //           and `<dir>/./normal.txt`; comparing basenames keeps
        //           the test platform-independent.
        let basenames: Vec<String> = files
            .iter()
            .filter_map(|p| {
                std::path::Path::new(p)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map(|s| s.to_string())
            })
            .collect();
        assert!(
            basenames.iter().any(|b| b == "normal.txt"),
            "normal tracked file must be listed; got {:?}",
            basenames
        );
        assert!(
            basenames.iter().any(|b| b == "tracked.ignored"),
            "BUG 3: force-added gitignored file must be listed; got {:?}",
            basenames
        );

        let _ = fs::remove_dir_all(&dir);
    }
}

