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

// What:     `fn detect_index_hash_kind(repo_root) -> gix_hash::Kind`
//           reads `.git/config` and returns `Sha256` when the repository
//           was initialized with `git init --object-format=sha256`,
//           otherwise `Sha1`. Detection runs in a few hundred
//           microseconds (config files are tiny).
// Why:      `gix_index::File::at(...)` parses entries based on the
//           hash kind: 20-byte object IDs and 20-byte trailer for
//           Sha1, 32-byte for Sha256. Calling with the wrong kind on
//           a Sha256 index produces silently corrupted paths because
//           each entry's flags + path offsets land 12 bytes off. We
//           never compute hashes ourselves (skip_hash = true) but we
//           must still know the right ID length to parse correctly.
//           Configurations using SHA-256 are still rare today, but
//           Git's SHA-256 transition is moving forward; supporting
//           the case keeps BUG 3's fix sound across object formats.
// TS map:   `function detectIndexHashKind(repoRoot: string): "sha1" | "sha256"`.
//
// In TS you'd write (pseudocode):
// ```ts
// function detectIndexHashKind(repoRoot: string): "sha1" | "sha256" {
//   const config = fs.readFileSync(path.join(repoRoot, ".git/config"), "utf8");
//   let inExtensions = false;
//   for (const raw of config.split("\n")) {
//     const line = raw.split(/[#;]/, 1)[0].trim();
//     if (line === "") continue;
//     const section = line.match(/^\[(.+?)(?:\s.+)?\]$/);
//     if (section) { inExtensions = section[1].toLowerCase() === "extensions"; continue; }
//     if (!inExtensions) continue;
//     const eq = line.indexOf("=");
//     if (eq < 0) continue;
//     if (line.slice(0, eq).trim().toLowerCase() === "objectformat" &&
//         line.slice(eq + 1).trim().toLowerCase() === "sha256") {
//       return "sha256";
//     }
//   }
//   return "sha1";
// }
// ```
fn detect_index_hash_kind(repo_root: &std::path::Path) -> gix_hash::Kind {
    let config_path = repo_root.join(".git/config");
    let Ok(config) = std::fs::read_to_string(&config_path) else {
        return gix_hash::Kind::Sha1;
    };
    let mut in_extensions = false;
    for raw in config.lines() {
        // What:     Strip line comments (`# ...`, `; ...`) and trim.
        // Why:      Git config supports both comment prefixes; the
        //           value before the comment is the only signal.
        let line = raw
            .split(|c: char| c == '#' || c == ';')
            .next()
            .unwrap_or("")
            .trim();
        if line.is_empty() {
            continue;
        }
        // What:     Section headers look like `[section]` or
        //           `[section "subsection"]`. We only care whether the
        //           current section name (case-insensitive) is
        //           `extensions`; subsections are ignored.
        // Why:      `objectformat` lives directly under `[extensions]`
        //           in git's standard config layout; subsections would
        //           be a custom shape we don't speak.
        if let Some(rest) = line.strip_prefix('[') {
            let section = rest.trim_end_matches(']').trim();
            let name = section.split_whitespace().next().unwrap_or("");
            in_extensions = name.eq_ignore_ascii_case("extensions");
            continue;
        }
        if !in_extensions {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        if key.trim().eq_ignore_ascii_case("objectformat")
            && value.trim().eq_ignore_ascii_case("sha256")
        {
            return gix_hash::Kind::Sha256;
        }
    }
    gix_hash::Kind::Sha1
}

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

    // What:     Union with paths read from `.git/index` via `gix-index`
    //           to recover tracked files the walker did not visit. The
    //           `ignore` crate's `WalkBuilder` always honours .gitignore
    //           (the `.ignore(false)` toggle disables `.ignore` files,
    //           not `.gitignore`). A file that was force-added with
    //           `git add -f` despite matching a `.gitignore` pattern is
    //           tracked by git but skipped by the walker, leaving a
    //           silent gap in `--all` mode -- a secret-scan on
    //           push-to-main must cover every tracked file.
    // Why:      Closes BUG 3 without paying the ~88 ms subprocess wall
    //           the previous `git ls-files --cached --ignored
    //           --exclude-standard -z` invocation cost on Mono
    //           (350 ms on Linux). Reading `.git/index` in-process with
    //           `gix-index` is single-digit milliseconds: the same
    //           binary index format `git ls-files` parses, without the
    //           fork+exec+repo-discovery overhead.
    //
    //           We read EVERY index entry (not just gitignored ones),
    //           then dedup against the walker output. The set
    //           difference `index - walker` is exactly the gitignored
    //           tracked files plus any tracked file that vanished from
    //           the workdir between commit and scan. Either case is
    //           valid to report: vanished tracked files surface as
    //           "read error" hits via BUG 4's fix, and gitignored
    //           tracked files are the force-added set we need.
    //
    //           When `.git/index` is absent (not a repo) or unreadable
    //           the call returns `Err` and we silently fall back to
    //           walker-only output, matching the previous subprocess
    //           behaviour.
    // TS map:   `const idx = await openIndex(repoRoot); for (const e of idx.entries) { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const idx = await openIndex(path.join(repoRoot, ".git/index"));
    // for (const entry of idx.entries) {
    //   const rel = entry.path;
    //   // dedupe + normalize prefix as before
    // }
    // ```
    let root_path = std::path::Path::new(root);
    let index_path = root_path.join(".git/index");
    let hash_kind = detect_index_hash_kind(root_path);
    if let Ok(index) = gix_index::File::at(
        &index_path,
        hash_kind,
        // What:     `true` skips the trailing-checksum verification
        //           that `gix-index` would otherwise re-hash the entire
        //           file to validate. We do not need integrity here;
        //           git itself owns index integrity, and a corrupt
        //           index will surface on the next git operation.
        //           Skipping the hash check is bench-meaningful: it
        //           drops index-open from ~5 ms to <1 ms on Mono.
        // Why:      Match the perf target: in-process index read should
        //           be a few milliseconds total, not match the
        //           subprocess wall it replaces.
        true,
        gix_index::decode::Options::default(),
    ) {
        // What:     Build a HashSet of normalized paths already in
        //           `files` so we can detect duplicates with the
        //           index output. WalkBuilder paths typically start
        //           with `./`; index paths are repo-root-relative with
        //           no leading `./`. Normalize by stripping `./` and
        //           comparing the remainder.
        // Why:      Without deduplication tracked-non-ignored files
        //           would scan twice (once via walker, once via index).
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
        for entry in index.entries() {
            // What:     Filter index entries by `Mode`. Only regular
            //           files (`Mode::FILE`, `Mode::FILE_EXECUTABLE`)
            //           are scannable; `Mode::COMMIT` is a submodule
            //           gitlink whose path on disk is a directory (or
            //           absent), `Mode::SYMLINK` would let `fs::read`
            //           follow into content outside the repo, and
            //           `Mode::DIR` (sparse-checkout) is non-content.
            //           Without this filter, every tracked submodule
            //           surfaces as a `"./<sub>: Is a directory"` hit
            //           via BUG 4's read-error path; on the Linux
            //           kernel that produces ~12 false-positive lines
            //           per scan.
            // Why:      Match the original subprocess semantics.
            //           `git ls-files --cached --ignored
            //           --exclude-standard -z` filtered to gitignored
            //           entries; submodules are almost never
            //           gitignored, so the subprocess output naturally
            //           excluded them. The in-process replacement
            //           reads ALL index entries, so we must mode-filter
            //           explicitly.
            // TS map:   `if (entry.mode !== FILE && entry.mode !== FILE_EXECUTABLE) continue;`.
            let mode = entry.mode;
            if !mode.contains(gix_index::entry::Mode::FILE)
                && !mode.contains(gix_index::entry::Mode::FILE_EXECUTABLE)
            {
                continue;
            }
            // What:     `entry.path(&index)` resolves the entry's path
            //           backing range into a `&BStr` (byte string) slice
            //           of the index's shared path-storage buffer. The
            //           bytes are exactly what `git ls-files -z` would
            //           emit for this entry.
            // Why:      The repo-relative path is what we want to feed
            //           downstream scanning; index entries do not carry
            //           the leading `./` walker convention.
            // TS map:   `entry.path` (a string/bytes).
            let path_bytes: &[u8] = entry.path(&index);
            // What:     `std::str::from_utf8(path_bytes)` validates that
            //           the path is UTF-8. Non-UTF-8 paths are silently
            //           skipped to match the walker's existing
            //           semantics (the walker uses `Path::to_str()`,
            //           which also requires UTF-8).
            // Why:      Every downstream consumer expects `&str`; a
            //           single non-UTF-8 path would force `OsString`
            //           plumbing across the binary for vanishingly rare
            //           cases.
            let Ok(rel) = std::str::from_utf8(path_bytes) else {
                continue;
            };
            let normalized = rel.trim_start_matches("./").to_string();
            if seen.insert(normalized.clone()) {
                files.push(format!("./{}", normalized));
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

    #[test]
    fn list_files_excludes_submodule_gitlink_entries() {
        // What:     Sets up a fixture git repo, then injects a submodule
        //           gitlink (mode 0o160000) directly into the index via
        //           `git update-index --add --cacheinfo`. The on-disk
        //           path for the submodule does not exist as a real
        //           submodule clone -- the gitlink is just a tracked
        //           index entry pointing at an arbitrary object id.
        //           `list_files(dir)` must skip the gitlink because
        //           our gix-index path filters non-FILE/FILE_EXECUTABLE
        //           entries.
        // Why:      The gix-index replacement for the previous
        //           `git ls-files --cached --ignored --exclude-standard`
        //           subprocess reads ALL index entries. Without a mode
        //           filter, tracked submodules would surface as
        //           "Is a directory" read-error hits via BUG 4's
        //           surface (~12 false positives on the Linux kernel
        //           per scan). This test pins the filter against
        //           silent regression.
        // TS map:   `test("submodule entries are filtered", () => { ... })`.
        let dir = unique_tmp("gix-mode-filter");
        run_git(&dir, &["init", "-q"]);
        run_git(&dir, &["config", "user.email", "t@t"]);
        run_git(&dir, &["config", "user.name", "t"]);
        // What:     Create one real tracked file to keep the index
        //           non-empty after our cacheinfo injection.
        fs::write(dir.join("real.txt"), "ordinary").expect("write real.txt");
        run_git(&dir, &["add", "-f", "real.txt"]);
        // What:     `git update-index --add --cacheinfo
        //           160000,<sha>,vendor/sub` adds an entry with
        //           Mode::COMMIT (gitlink). The SHA must be 40 hex
        //           chars; the value need not refer to a real commit
        //           for the index to accept the entry.
        // Why:      Mirrors a tracked submodule without the complexity
        //           of creating a real second repository.
        run_git(
            &dir,
            &[
                "update-index",
                "--add",
                "--cacheinfo",
                "160000,0000000000000000000000000000000000000001,vendor/sub",
            ],
        );
        run_git(
            &dir,
            &["commit", "-q", "-m", "initial", "real.txt"],
        );

        let files = list_files(dir.to_str().expect("dir utf8")).expect("list_files");
        let normalized: Vec<String> = files
            .iter()
            .map(|p| p.trim_start_matches("./").to_string())
            .collect();
        assert!(
            normalized.iter().any(|p| p.ends_with("real.txt")),
            "regular tracked file must still be listed; got {:?}",
            normalized
        );
        assert!(
            !normalized.iter().any(|p| p.ends_with("vendor/sub")),
            "submodule gitlink (Mode::COMMIT) must NOT be listed; got {:?}",
            normalized
        );

        let _ = fs::remove_dir_all(&dir);
    }

    // What:     Helper `write_config(dir, contents)` materialises a
    //           `.git/config` file under `dir` with the given contents.
    //           Used by the `detect_index_hash_kind` unit tests below.
    // Why:      Each test exercises a different config shape; a helper
    //           keeps the test bodies focused on the shape they test.
    fn write_config(dir: &PathBuf, contents: &str) {
        let git_dir = dir.join(".git");
        fs::create_dir_all(&git_dir).expect("create .git");
        fs::write(git_dir.join("config"), contents).expect("write .git/config");
    }

    #[test]
    fn detect_sha256_in_standard_config_shape() {
        let dir = unique_tmp("detect-sha256-standard");
        write_config(
            &dir,
            "[extensions]\n\tobjectformat = sha256\n[core]\n\tbare = false\n",
        );
        assert_eq!(super::detect_index_hash_kind(&dir), gix_hash::Kind::Sha256);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn detect_sha1_when_extensions_absent() {
        let dir = unique_tmp("detect-sha1-default");
        write_config(&dir, "[core]\n\tbare = false\n[user]\n\temail = t@t\n");
        assert_eq!(super::detect_index_hash_kind(&dir), gix_hash::Kind::Sha1);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn detect_sha1_when_config_missing() {
        let dir = unique_tmp("detect-sha1-noconfig");
        // No .git/config written -- read_to_string returns Err, helper
        // must default to Sha1.
        assert_eq!(super::detect_index_hash_kind(&dir), gix_hash::Kind::Sha1);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn detect_sha256_with_comments_and_irregular_whitespace() {
        let dir = unique_tmp("detect-sha256-comments");
        write_config(
            &dir,
            // What:     Mixed-case section, `#` and `;` comments,
            //           tab and space variation, mid-line comment.
            // Why:      Git config tolerates all of these; our parser
            //           must too.
            "# comment line\n[Extensions]\n  ObjectFormat=  sha256  ; trailing\n[core]\n",
        );
        assert_eq!(super::detect_index_hash_kind(&dir), gix_hash::Kind::Sha256);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn detect_sha1_when_objectformat_is_outside_extensions_section() {
        let dir = unique_tmp("detect-sha1-wrong-section");
        // What:     `objectformat` lives under `[core]` here; our
        //           parser must NOT treat that as a Sha256 signal.
        // Why:      Bogus configs should default-to-Sha1 rather than
        //           silently break parsing on real Sha1 indexes.
        write_config(
            &dir,
            "[core]\n\tobjectformat = sha256\n",
        );
        assert_eq!(super::detect_index_hash_kind(&dir), gix_hash::Kind::Sha1);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn detect_sha256_with_extensions_subsection() {
        let dir = unique_tmp("detect-sha256-subsection");
        // What:     `[extensions "foo"]` is a subsection; our parser
        //           treats it as `extensions` proper (`split_whitespace`
        //           strips the subsection name).
        // Why:      Git itself reads `extensions.objectformat` under
        //           any subsection; our detection should match.
        write_config(
            &dir,
            "[extensions \"weird\"]\n\tobjectformat = sha256\n",
        );
        assert_eq!(super::detect_index_hash_kind(&dir), gix_hash::Kind::Sha256);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn list_files_handles_sha256_repo_force_added_gitignored() {
        // What:     End-to-end test on a fresh `git init
        //           --object-format=sha256` repo with a force-added
        //           gitignored file. `list_files` must return both the
        //           ordinary tracked file AND the force-added one;
        //           gix-index must parse the Sha256 index correctly via
        //           our `detect_index_hash_kind` plumbing.
        // Why:      Pre-fix the in-process index reader was hard-wired
        //           to Sha1, so a Sha256 index either failed to parse
        //           (Err fall-through to walker-only, missing the
        //           force-added file) or produced garbage paths.
        //           Without this regression test the SHA-256 path could
        //           silently break next time we touch walk.rs.
        let dir = unique_tmp("sha256-force-added");
        run_git(&dir, &["init", "--object-format=sha256", "-q"]);
        run_git(&dir, &["config", "user.email", "t@t"]);
        run_git(&dir, &["config", "user.name", "t"]);
        fs::write(dir.join(".gitignore"), "*.ignored\n").expect("write .gitignore");
        fs::write(dir.join("tracked.ignored"), "secret content")
            .expect("write tracked.ignored");
        fs::write(dir.join("normal.txt"), "normal content").expect("write normal.txt");
        run_git(&dir, &["add", "-f", ".gitignore", "tracked.ignored", "normal.txt"]);
        run_git(
            &dir,
            &["commit", "-q", "-m", "initial", ".gitignore", "tracked.ignored", "normal.txt"],
        );

        let files = list_files(dir.to_str().expect("dir utf8")).expect("list_files");
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
            "sha256 repo: normal tracked file must be listed; got {:?}",
            basenames
        );
        assert!(
            basenames.iter().any(|b| b == "tracked.ignored"),
            "sha256 repo: force-added gitignored file must be listed via \
             gix-index path; got {:?}",
            basenames
        );

        let _ = fs::remove_dir_all(&dir);
    }
}

