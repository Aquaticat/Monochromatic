// TODO: deferred perf work. See /home/user/.claude/plans/dapper-coalescing-horizon.md.
// TODO:   - L2: line-start index for `line_and_col` -- only matters on the
// TODO:     violation path; revisit if a single file with many hits ever becomes
// TODO:     a real workload.
// TODO:   - Z1: serialize the regex-bucket combined DFA. Resharp 0.5 has no
// TODO:     serialization API; would require swapping that gate to the `regex`
// TODO:     crate (`regex-automata::dfa::dense::DFA::to_bytes`). Trigger: when
// TODO:     startup-only time goes back over ~100ms after P1+P2 land.

// What:     `mod walk;` declares a child module whose source lives in
//           `walk.rs` (sibling to this file). `mod` is Rust's module
//           system: it does NOT import names; it simply tells the
//           compiler "this file/module exists, compile it". Names
//           referenced via `crate::walk::xxx` afterward.
// Why:      We split the binary into four files so each unit is
//           focused: `walk.rs` for the working-tree walker that
//           respects `.gitignore`.
// TS map:   Closer to a tsconfig file's "include" entry than to an
//           `import`. The actual `import` happens via the `use` lines
//           below.
// Gotcha:   `mod foo;` without a body is NOT an import; it's a
//           registration. Forgetting to write `mod` for a sibling file
//           silently excludes it from the build.
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent. Closest: TypeScript automatically picks up files
// // in `include` paths; Rust requires explicit `mod` declarations.
// ```
mod rules;
mod scan;
mod scan_format;
mod walk;

// What:     `use std::env;` imports the std `env` module so we can
//           reference `env::args` / `env::var`.
// Why:      Reading argv and environment variables.
// TS map:   `import { argv, env } from "node:process";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { argv, env } from "node:process";
// ```
use std::env;

// What:     `std::fs::canonicalize` is referenced via the full path at
//           three sites (rules-path skip set, walker skip lookup); no
//           bare `use std::fs;` because the per-file `fs::read` slurp
//           moved into `read_with_binary_check` which uses
//           `std::fs::File` directly.
// Why:      Background on file-reading performance choices: `fs::read`
//           is empirically faster than `mmap`-based access on this
//           workload (many small files; per-file VMA setup cost
//           dominates the saved alloc) -- the E2 mmap experiment
//           regressed wall time by 35% on Mono and 43% on the Linux
//           kernel. See PERF.md "Mmap experiment (rejected)".
//           Thread-local scratch buffers were also tried 2026-05-03;
//           rayon's nested-parallelism work-stealing (scan_content
//           uses inner par_iter via prefix-matched and combined-
//           shard fan-out) re-entered the outer flat_map_iter on
//           the SAME thread while the buffer was borrowed,
//           triggering a `RefCell already borrowed` panic. The
//           per-file alloc cost is dwarfed by the unicode-mode
//           speedup; not worth the re-entrancy hazard.
// TS map:   N/A (no import line; `std::fs::canonicalize` is fully
//           qualified at use sites).

// What:     `use std::io::Write;` imports the `Write` TRAIT (interface-
//           like). Methods declared by a trait are only callable when
//           the trait is in scope, even when used via macros like
//           `writeln!`.
// Why:      We use `writeln!(handle, ...)` to emit hits.
// TS map:   No 1:1 equivalent; in TS, methods are always callable.
//
// In TS you'd write (pseudocode):
// ```ts
// // Unnecessary in TS.
// ```
use std::io::Write;

// What:     `use rayon::prelude::*;` brings rayon's parallel-iterator
//           extension methods into scope (`par_iter`, `flat_map_iter`,
//           etc.).
// Why:      The two-phase main loop uses `par_iter` for both the
//           parallel-read phase and the parallel-scan phase.
// TS map:   No equivalent.
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent.
// ```
use rayon::prelude::*;

// What:     `use crate::walk::list_files;` re-exports the named function
//           from the sibling module under a short alias for local use.
//           `crate::` is the absolute root of this crate.
// Why:      We call `list_files(".")` once when `--all` mode is
//           selected to enumerate every scannable file.
// TS map:   `import { listFiles } from "./walk";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { listFiles } from "./walk";
// ```
use crate::rules::load_ruleset;
use crate::scan::scan_content;
use crate::walk::list_files;

// What:     `fn build_skip_set(rules_path: &str) -> HashSet<PathBuf>`
//           returns the set of CANONICAL absolute paths to skip when
//           walking the tree in `--all` mode. Pre-fix this logic was a
//           basename check (`is_skipped_file`) that matched anywhere in
//           the tree, so an unrelated `sub/forbidden-strings.local.txt`
//           was silently dropped along with the actual rule file. Path-
//           anchored matching pins each skip to its specific filesystem
//           location.
// Why:      Closes BUG 6 (basename skip applies to arbitrary explicit
//           args) and BUG 11 (Windows path basename via rsplit('/')) in
//           one shape change. Path-anchoring removes both failure modes:
//           the basename collision cannot trigger because we compare
//           full canonical paths, and the Windows backslash separator
//           is handled inside `std::fs::canonicalize` / `PathBuf::eq`.
//
//           Skip set composition:
//             - The actual rules file (whatever the user passed via
//               `--rules` or `FORBIDDEN_STRINGS_RULES`; falls back to
//               the default `forbidden-strings.local.txt` in cwd).
//             - Three canonical generated-source paths at their
//               expected locations relative to repo root. If running
//               from a different cwd they fail to canonicalize and are
//               silently dropped from the set; matching is still
//               correct for the rules file alone.
//
//           The caller separately decides WHEN to apply the skip:
//           explicit positional args are NEVER skipped (the user asked
//           for them); only walker output in --all mode is filtered.
// TS map:   `function buildSkipSet(rulesPath: string): Set<string>`.
//
// In TS you'd write (pseudocode):
// ```ts
// function buildSkipSet(rulesPath: string): Set<string> {
//   const set = new Set<string>();
//   try { set.add(fs.realpathSync(rulesPath)); } catch {}
//   for (const k of CANONICAL_GENERATED) {
//     try { set.add(fs.realpathSync(k)); } catch {}
//   }
//   return set;
// }
// ```
fn build_skip_set(rules_path: &str) -> std::collections::HashSet<std::path::PathBuf> {
    // What:     `let mut set: HashSet<PathBuf> = HashSet::new();` -- the
    //           usual mutable-empty-collection pattern.
    // Why:      Accumulate canonical-form paths we want to skip.
    // TS map:   `const set = new Set<string>();`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const set = new Set<string>();
    // ```
    let mut set: std::collections::HashSet<std::path::PathBuf> =
        std::collections::HashSet::new();

    // What:     `if let Ok(p) = std::fs::canonicalize(rules_path) { set.insert(p); }`.
    //           `canonicalize` resolves symlinks AND makes the path
    //           absolute; identical files reached via different
    //           relative paths compare equal at the canonical level.
    //           A missing rules file would fail to canonicalize -- the
    //           loader will surface that error separately via
    //           `load_ruleset`, so we silently skip the insertion here.
    // Why:      Anchor the skip on the actual filesystem identity of
    //           the rules file rather than its basename.
    // TS map:   `try { set.add(fs.realpathSync(rulesPath)); } catch {}`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try { set.add(fs.realpathSync(rulesPath)); } catch {}
    // ```
    if let Ok(p) = std::fs::canonicalize(rules_path) {
        set.insert(p);
    }
    // What:     Canonical generated-source paths relative to the repo
    //           root. Each is a file we know contains literal copies of
    //           rule bodies -- scanning them in --all mode would
    //           produce self-matches. Pinned by their expected location
    //           so the matcher does not fire on unrelated files of the
    //           same name elsewhere in the tree.
    // Why:      Same anti-self-match guard as the previous basename
    //           list, but anchored to specific paths. If the binary is
    //           run from outside the monorepo or these files have been
    //           relocated, canonicalize fails and the entry is dropped
    //           -- still no false negative because the file does not
    //           exist at the expected location, so the walker would
    //           not encounter it either.
    // TS map:   constant string array of canonical paths.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const CANONICAL_GENERATED = [ "...", "...", "..." ];
    // ```
    let canonical_generated = [
        "packages/cli/forbidden-strings/data/betterleaks-default-config.toml",
        "packages/cli/forbidden-strings/src/port-betterleaks-relaxations.ts",
        "packages/cli/forbidden-strings/forbidden-strings.local.example.txt",
    ];
    for k in canonical_generated {
        if let Ok(p) = std::fs::canonicalize(k) {
            set.insert(p);
        }
    }
    set
}

// What:     `fn is_walker_skipped(path: &str, skip_set: &HashSet<PathBuf>) -> bool`
//           returns true when the path's canonical form matches a
//           skip-set entry. Used ONLY for walker output in --all mode;
//           explicit positional args bypass this check entirely.
// Why:      Closes BUG 6: the previous `is_skipped_file` ran on every
//           queued path regardless of source, hiding real positive
//           findings on `sub/forbidden-strings.local.txt`-style explicit
//           args. The path-anchored form here is consulted only when
//           the caller knows the path came from the walker.
// TS map:   `function isWalkerSkipped(path: string, skipSet: Set<string>): boolean`.
//
// In TS you'd write (pseudocode):
// ```ts
// function isWalkerSkipped(path: string, skipSet: Set<string>): boolean {
//   try {
//     const canonical = fs.realpathSync(path);
//     return skipSet.has(canonical);
//   } catch { return false; }
// }
// ```
fn is_walker_skipped(
    path: &str,
    skip_set: &std::collections::HashSet<std::path::PathBuf>,
) -> bool {
    // What:     Canonicalize per file and lookup in the skip set. A
    //           canonicalize failure (broken symlink, vanished file)
    //           returns false -- if we cannot resolve the path, we are
    //           definitely not skipping it. The downstream `fs::read`
    //           will surface any read error via the BUG 4 fix.
    // Why:      Per-file canonicalize is one stat syscall; with the
    //           ~2700-file walked corpus, that's a few ms total --
    //           well under the scan cost itself.
    // TS map:   try/catch around realpathSync.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try {
    //   const canonical = fs.realpathSync(path);
    //   return skipSet.has(canonical);
    // } catch { return false; }
    // ```
    if let Ok(canonical) = std::fs::canonicalize(path) {
        return skip_set.contains(&canonical);
    }
    false
}

// What:     `BIN_PROBE_SIZE` is the byte length read up-front from every
//           file before deciding whether the file is binary. 8 KiB is
//           the same probe size the pre-BUG-5 `is_likely_binary`
//           heuristic used; it matches `git diff`'s "binary or text"
//           heuristic threshold.
// Why:      The probe length tunes a tradeoff: smaller probe lets a
//           binary file with a leading text header (PDF header,
//           machine-O header) sneak past as text; larger probe wastes
//           memory on small files. 8 KiB catches the common cases
//           (PNG, JPG, ELF, WASM, zip, ZSTD frames) and is the
//           established convention.
const BIN_PROBE_SIZE: usize = 8192;

// What:     `read_with_binary_check(path)` reads a file under a binary
//           heuristic:
//             1. Always read the first `BIN_PROBE_SIZE` bytes.
//             2. If the file is smaller than that, return what we got.
//             3. If the probe contains a NUL byte and the file is
//                larger than the probe, return only the probe (the
//                rest is treated as binary tail and not scanned).
//             4. Otherwise (probe is NUL-free), read and return the
//                full file.
// Why:      Closes the BUG-5 regression without re-introducing the
//           soundness gap that BUG 5 fixed. BUG 5 removed a heuristic
//           that threw away the WHOLE file when the first 8 KiB
//           contained a NUL byte; that masked secrets sitting BEFORE
//           the NUL. This rule keeps that signal (the first 8 KiB is
//           always scanned), but caps the per-file work on large
//           binary blobs (firmware images, vmlinuz, font caches, lock
//           sidecars) at 8 KiB instead of full content. Acceptable
//           miss: a secret living AFTER a NUL byte in a file that is
//           ALSO larger than 8 KiB. Acceptable: those files are the
//           "binary blob with bytes that happen to spell a secret"
//           case, and the secret-leak risk is dominated by source
//           files and small lock files which still scan in full.
// TS map:   `function readWithBinaryCheck(path: string): Buffer`.
//
// In TS you'd write (pseudocode):
// ```ts
// function readWithBinaryCheck(path: string): Buffer {
//   const fd = fs.openSync(path, "r");
//   try {
//     const probe = Buffer.alloc(BIN_PROBE_SIZE);
//     const n = fs.readSync(fd, probe, 0, BIN_PROBE_SIZE, null);
//     if (n < BIN_PROBE_SIZE) return probe.subarray(0, n);
//     if (probe.indexOf(0) !== -1) return probe;
//     return Buffer.concat([probe, fs.readSync.readRestOf(fd)]);
//   } finally {
//     fs.closeSync(fd);
//   }
// }
// ```
fn read_with_binary_check(path: &str) -> Result<Vec<u8>, std::io::Error> {
    use std::fs::File;
    use std::io::Read;

    let mut file = File::open(path)?;
    let mut buf: Vec<u8> = Vec::with_capacity(BIN_PROBE_SIZE);
    (&mut file)
        .take(BIN_PROBE_SIZE as u64)
        .read_to_end(&mut buf)?;

    if buf.len() < BIN_PROBE_SIZE {
        return Ok(buf);
    }

    if memchr::memchr(0, &buf).is_some() {
        return Ok(buf);
    }

    file.read_to_end(&mut buf)?;
    Ok(buf)
}

// What:     `pub fn run_cli_from_env() -> Result<i32, String>` is the
//           library entry point. It reads `env::args()` and env vars,
//           parses flags, loads the ruleset, runs the parallel scan,
//           prints hits to stderr, and returns the exit code the OS
//           should see. `Result<i32, String>` lets the binary thin
//           wrapper decide how to report a catastrophic failure (the
//           `Err` arm) versus a regular run (`Ok(0)` clean,
//           `Ok(1)` violation, `Ok(2)` usage error already eprinted).
//           Sibling shape considered: returning `ExitCode` directly --
//           rejected because tests written against the lib want a
//           plain `i32` they can compare, and `ExitCode` has no `Eq`.
// Why:      Coordinate arg parsing, ruleset loading, parallel scan,
//           and result reporting from a unit testable surface. The bin
//           target's `main` is now a five-line wrapper that turns the
//           returned code into an `ExitCode` and prints `Err` to
//           stderr with a fixed prefix.
// TS map:   No entry-point function in TS; Node scripts just run top-
//           to-bottom. Mentally picture an
//           `async function runCliFromEnv(): Promise<number>` that
//           the bin's tiny wrapper awaits and passes to
//           `process.exit`.
//
// In TS you'd write (pseudocode):
// ```ts
// async function runCliFromEnv(): Promise<number> {
//   // ...
//   return anyViolation ? 1 : 0;
// }
// process.exit(await runCliFromEnv());
// ```
pub fn run_cli_from_env() -> Result<i32, String> {
    // What:     `let args: Vec<String> = env::args().skip(1).collect();`
    //           reads command-line arguments. `env::args()` returns an
    //           iterator of `String`s where index 0 is the program name
    //           ("forbidden-strings"); `.skip(1)` drops it; `.collect()`
    //           materializes the remainder into a `Vec<String>`. The
    //           explicit `Vec<String>` annotation tells `.collect()` what
    //           container to build (without it, the collect call is
    //           ambiguous). Sibling type to consider: `Vec<&str>` would
    //           BORROW the args, but `env::args()` already yields owned
    //           `String`s -- borrowing is not an option here.
    // Why:      We need the user's actual flags/files; the program name
    //           is irrelevant.
    // TS map:   `const args = process.argv.slice(2);`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const args: string[] = process.argv.slice(2);
    // ```
    let args: Vec<String> = env::args().skip(1).collect();

    // What:     `let mut rules_path: Option<String> = env::var("...").ok();`
    //           reads an environment variable. `env::var` returns
    //           `Result<String, VarError>` (Err if unset); `.ok()` converts
    //           it into `Option<String>` -- `Some(value)` if set, `None`
    //           otherwise. The `mut` lets us reassign `rules_path` later if
    //           `--rules` overrides. Sibling type: `Option<&str>` would
    //           need the env value to live somewhere else; `String` is
    //           owned so it can outlive any function call.
    // Why:      Initial source for the rules-file path; `--rules` flag
    //           takes precedence and overwrites this.
    // TS map:   `let rulesPath: string | undefined = process.env.FORBIDDEN_STRINGS_RULES;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let rulesPath: string | undefined = process.env.FORBIDDEN_STRINGS_RULES;
    // ```
    let mut rules_path: Option<String> = env::var("FORBIDDEN_STRINGS_RULES").ok();

    // What:     `let mut all = false;` declares a mutable boolean. No
    //           type annotation needed -- the literal `false` infers `bool`.
    // Why:      Tracks whether `--all` was passed; we toggle it to true
    //           when we encounter the flag.
    // TS map:   `let all = false;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let all = false;
    // ```
    let mut all = false;

    // What:     `let mut files: Vec<String> = Vec::new();` allocates an
    //           empty growable, owned vector of `String`. `Vec::new()` is
    //           the empty-vector constructor; the explicit type annotation
    //           tells the compiler the element type since the empty
    //           constructor cannot infer it. Sibling: `Vec<&str>` cannot
    //           hold values that outlive the source; we want owned data.
    // Why:      Accumulates positional file arguments as we parse argv.
    // TS map:   `const files: string[] = [];`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const files: string[] = [];
    // ```
    let mut files: Vec<String> = Vec::new();

    // What:     `let mut i: usize = 0;` declares a mutable index counter.
    //           `usize` is the unsigned integer wide enough to address any
    //           byte in memory on this platform (32 bits on 32-bit OS,
    //           64 bits on 64-bit OS). Siblings the reader might expect:
    //           `u32`, `u64`, `i32`, `i64`. Why `usize` not `u64`? Every
    //           std API that takes a "size" or "index" wants `usize`;
    //           mixing widths forces casts.
    // Why:      Manual index lets us advance by 2 (consume `--rules` plus
    //           its value) inside the loop body.
    // TS map:   `let i = 0;` (TS has only one number type).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let i = 0;
    // ```
    let mut i: usize = 0;

    // What:     `while i < args.len() { ... }` is a basic conditional loop.
    //           No iterator, no syntactic sugar -- just "keep going while
    //           condition holds". `args.len()` returns the vector's length
    //           as `usize`.
    // Why:      We need manual index control to consume `--rules` plus
    //           its argument together; a `for arg in &args` loop cannot
    //           skip ahead.
    // TS map:   `while (i < args.length) { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // while (i < args.length) { ... }
    // ```
    while i < args.len() {
        // What:     `let a = &args[i];` borrows the i-th element. `&` is
        //           Rust's "borrow" operator: it gives a read-only
        //           reference to the value without taking ownership; the
        //           original vector still owns the `String`. Without `&`,
        //           Rust would try to MOVE the `String` out of the vector,
        //           which is illegal because `Vec<String>` does not
        //           support hole-poking moves.
        // Why:      We want to inspect the arg's contents (compare to
        //           "--rules", etc.) without consuming it.
        // TS map:   `const a = args[i];` -- TS has no ownership system,
        //           so reading is always implicitly "borrowing".
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const a = args[i];
        // ```
        let a = &args[i];
        if a == "--rules" {
            i += 1;
            if i >= args.len() {
                eprintln!("--rules needs an argument");
                // What:     `return Ok(2);` early-exits `run_cli_from_env`
                //           with the eventual OS exit code 2. `Ok(...)`
                //           wraps the `i32` into the success variant of
                //           `Result<i32, String>`; the bin wrapper turns
                //           it into `ExitCode::from(2)`.
                // Why:      Convention: 0 = success, 1 = violation,
                //           2 = usage / config error. The usage message
                //           was already printed on the previous line.
                // TS map:   `return 2;`.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // return 2;
                // ```
                return Ok(2);
            }
            // What:     `rules_path = Some(args[i].clone());` reassigns
            //           the `Option<String>` variable. `Some(...)` wraps
            //           a value into the present variant of `Option`;
            //           `args[i].clone()` deep-copies the indexed `String`
            //           so the assignment OWNS its bytes (we cannot move
            //           out of a Vec, and a borrow would tie `rules_path`
            //           to `args`'s lifetime).
            // Why:      Capture the argument that follows `--rules` as
            //           our authoritative rules path.
            // TS map:   `rulesPath = args[i];` -- TS strings are GC'd, no
            //           clone needed.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // rulesPath = args[i];
            // ```
            rules_path = Some(args[i].clone());
        } else if a == "--all" {
            all = true;
        } else if a == "--help" || a == "-h" {
            // What:     `concat!` is a compile-time macro joining string
            //           literals into a single `&'static str`. The `!`
            //           marks it as a macro call, not a function call.
            //           `env!("CARGO_PKG_VERSION")` reads `version` from
            //           Cargo.toml at compile time and inlines it as a
            //           string literal.
            // Why:      Print a single static help string with the version
            //           baked in, no runtime allocation, no formatter.
            // TS map:   The TS analogue is template-literal concatenation
            //           plus `process.env.npm_package_version` (read at
            //           build time via a bundler define), but TS has no
            //           macro system -- the closest mental model is
            //           "compiled-in string template".
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const VERSION = process.env.npm_package_version!;
            // const HELP = `forbidden-strings ${VERSION}\n...`;
            // console.log(HELP);
            // ```
            println!(
                "{}",
                concat!(
                    "forbidden-strings ", env!("CARGO_PKG_VERSION"), "\n",
                    "Linear-time deny-list scanner for Git repos.\n",
                    "\n",
                    "USAGE:\n",
                    "    forbidden-strings [--rules <PATH>] [--all] [FILE...]\n",
                    "\n",
                    "FLAGS:\n",
                    "    --rules <PATH>    Path to the rule file (one rule per line).\n",
                    "                      Overrides FORBIDDEN_STRINGS_RULES.\n",
                    "                      Default: ./forbidden-strings.local.txt\n",
                    "    --all             Scan every git-tracked file under cwd.\n",
                    "                      Respects .gitignore (via the `ignore` crate).\n",
                    "    -h, --help        Print this help and exit.\n",
                    "    -V, --version     Print version and exit.\n",
                    "\n",
                    "ENV:\n",
                    "    FORBIDDEN_STRINGS_RULES    Default rules path; --rules wins if both are set.\n",
                    "                               If unset, falls back to ./forbidden-strings.local.txt\n",
                    "\n",
                    "EXIT CODES:\n",
                    "    0    No violations.\n",
                    "    1    One or more violations (printed to stderr, redacted).\n",
                    "    2    Usage error or rule-file error.\n",
                    "\n",
                    "EXAMPLES:\n",
                    "    # Scan a few files\n",
                    "    forbidden-strings --rules ./rules.txt src/main.ts README.md\n",
                    "\n",
                    "    # Scan the whole working tree\n",
                    "    FORBIDDEN_STRINGS_RULES=./rules.txt forbidden-strings --all\n",
                    "\n",
                    "RULE FORMAT:\n",
                    "    Bare line              -> case-sensitive literal substring\n",
                    "    /PATTERN/FLAGS         -> regex (resharp; supports A&B, ~(A), (?=...), (?<=...))\n",
                    "    # ...                  -> comment\n",
                    "    Empty line             -> skipped\n",
                    "\n",
                    "RESHARP 0.5.x LIMITATIONS:\n",
                    "    A `~(...)` complement body cannot contain `\\b`, `\\B`, `^`, `$`,\n",
                    "    or any user-explicit lookaround. Use `\\W` or literal whitespace for\n",
                    "    `\\b`; `\\A`/`\\z` for `^`/`$` when whole-content semantics fit; or\n",
                    "    lift the boundary check outside the complement. Loader rejects every\n",
                    "    failing shape with a named-trigger error. See TROUBLESHOOTING.resharp.md.\n",
                    "\n",
                    "OUTPUT:\n",
                    "    PATH:LINE:COL_START..COL_END rule=N    (matched substring is NEVER printed)\n",
                    "\n",
                    "See README.md for set-algebra rule examples and CI integration.\n",
                ),
            );
            return Ok(0);
        } else if a == "--version" || a == "-V" {
            // What:     Same `concat!` + `env!` trick: compile-time string
            //           literal, no runtime cost. `env!` panics at compile
            //           time if `CARGO_PKG_VERSION` is unset, which is
            //           impossible inside a Cargo build.
            // Why:      Match `cargo`/`rustc` convention -- `--version`
            //           prints `<name> <semver>` on stdout.
            // TS map:   `console.log(`forbidden-strings ${VERSION}`)`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // console.log(`forbidden-strings ${VERSION}`);
            // ```
            println!("forbidden-strings {}", env!("CARGO_PKG_VERSION"));
            return Ok(0);
        } else if a.starts_with("--") || a.starts_with("-") && a.len() > 1 {
            eprintln!("unknown flag {}", a);
            return Ok(2);
        } else {
            // What:     `files.push(a.clone())`. `a` is a `&String`
            //           (borrowed); `.clone()` deep-copies the `String`
            //           so the new owned copy can be moved into the
            //           vector. We cannot push the borrow itself --
            //           `Vec<String>` requires owned `String`s and the
            //           borrow's lifetime would not outlive `args`.
            // Why:      Stash the positional file argument for later
            //           scanning.
            // TS map:   `files.push(a);` -- TS strings are GC'd; no clone.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // files.push(a);
            // ```
            files.push(a.clone());
        }
        // What:     `i += 1;` advances to the next argv slot. Plain
        //           integer increment; no Rust-specific magic.
        // Why:      Move past the just-consumed flag/value.
        // TS map:   `i += 1;`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // i += 1;
        // ```
        i += 1;
    }

    // What:     `unwrap_or_else(|| ...)` returns the inner `Some` value or
    //           runs the closure to produce a fallback. The closure body
    //           is a string literal converted to `String` via `.to_string()`.
    // Why:      Default the rules path to `forbidden-strings.local.txt` in
    //           cwd when neither `--rules` nor `FORBIDDEN_STRINGS_RULES`
    //           is set, matching the conventional filename. The loader
    //           emits a clear "file not found" error if the default
    //           doesn't exist; we don't pre-check and shadow that error.
    // TS map:   `rulesPath ?? "forbidden-strings.local.txt"`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const finalRulesPath = rulesPath ?? "forbidden-strings.local.txt";
    // ```
    let rules_path = rules_path.unwrap_or_else(|| "forbidden-strings.local.txt".to_string());

    // Run `load_ruleset` and `list_files` concurrently when --all is
    // set: rules loading is CPU-bound (regex compile + AC build);
    // file walking is I/O-bound (directory traversal + gitignore parse).
    // They share no state, so overlapping them shaves whichever side
    // is shorter.
    // What:     `rayon::join(|| f1(), || f2())` runs two closures in
    //           parallel using the rayon threadpool. Returns a tuple
    //           of their return values once both finish. If only one
    //           closure has substantial work (e.g. when --all is off,
    //           we have no file walk to do), join still runs both --
    //           but the empty closure adds negligible cost.
    // Why:      Rules load is ~12ms for a 1k-rule ruleset; file walk
    //           is ~7ms on this repo. Sequential = 19ms; parallel = 12ms.
    // TS map:   `await Promise.all([loadRuleset(rulesPath), listFiles(".")])`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const [rulesetResult, filesResult] = await Promise.all([
    //   loadRuleset(rulesPath),
    //   all ? listFiles(".") : Promise.resolve(null),
    // ]);
    // ```
    let (ruleset_result, listed_result): (Result<_, String>, Option<Result<Vec<String>, String>>) =
        rayon::join(
            || load_ruleset(&rules_path),
            || if all { Some(list_files(".")) } else { None },
        );

    // What:     `let ruleset = match ruleset_result { Ok(r) => r, Err(e) => { ...; return ... } };`
    //           is a `match` expression destructuring a `Result<RuleSet, String>`.
    //           `Ok(r)` binds the success payload to local `r` and
    //           "evaluates" the arm to that value; `Err(e)` binds the
    //           failure payload, prints it, and early-returns from
    //           `main`. The match expression as a whole evaluates to
    //           the `Ok` arm's value; assigning it to `ruleset` gives us
    //           a plain `RuleSet` to use below (no more wrapper).
    // Why:      Unwrap the `Result` while presenting a friendly error to
    //           the user instead of a panic.
    // TS map:   `try { ruleset = await loadRuleset(...); } catch (e) { console.error(...); process.exit(2); }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let ruleset: RuleSet;
    // try { ruleset = rulesetResult; }
    // catch (e) { console.error(`forbidden-strings: ${e}`); process.exit(2); }
    // ```
    let ruleset = match ruleset_result {
        Ok(r) => r,
        Err(e) => {
            eprintln!("forbidden-strings: {}", e);
            return Ok(2);
        }
    };

    if env::var("FORBIDDEN_STRINGS_DEBUG_BUCKETS").is_ok() {
        let ac_cs_pat = ruleset.ac_meta.iter().filter(|m| matches!(m, crate::rules::AcMeta::RegexPrefix { .. })).count();
        let ac_cs_lit = ruleset.ac_meta.iter().filter(|m| matches!(m, crate::rules::AcMeta::Literal { .. })).count();
        let ac_ci_pat = ruleset.ac_meta_ci.len();
        let residual_count: usize = ruleset.residual_shards.iter().map(|s| match s {
            crate::rules::ResidualShard::Single { .. } => 1,
            crate::rules::ResidualShard::Combined { positions, .. } => positions.len(),
        }).sum();
        let single_shard_count = ruleset.residual_shards.iter().filter(|s| matches!(s, crate::rules::ResidualShard::Single { .. })).count();
        let combined_shard_count = ruleset.residual_shards.len() - single_shard_count;
        eprintln!(
            "forbidden-strings buckets: ac_cs_lit={} ac_cs_regex_prefix={} ac_ci_regex_prefix={} residual={} (in {} single + {} combined shards) regex_rules_total={}",
            ac_cs_lit, ac_cs_pat, ac_ci_pat, residual_count, single_shard_count, combined_shard_count, ruleset.regex_rules.len(),
        );
        if env::var("FORBIDDEN_STRINGS_DEBUG_RESIDUAL_LIST").is_ok() {
            for shard in &ruleset.residual_shards {
                let positions: Vec<usize> = match shard {
                    crate::rules::ResidualShard::Single { rule_pos } => vec![*rule_pos],
                    crate::rules::ResidualShard::Combined { positions, .. } => positions.clone(),
                };
                for pos in positions {
                    let r = &ruleset.regex_rules[pos];
                    eprintln!("residual rule line={}", r.idx);
                }
            }
        }
    }

    // What:     `if let Some(listed) = listed_result { match listed { ... } }`.
    //           One-arm pattern match: enter the block ONLY when
    //           `listed_result` is `Some`, binding the inner
    //           `Result<Vec<String>, String>` to `listed`. Inside, a
    //           regular `match` extracts `Ok` (replace `files` with the
    //           walker's output) or `Err` (print, exit 2).
    // Why:      `listed_result` is `Some(...)` only when `--all` was
    //           passed; otherwise `None` and we skip silently, leaving
    //           `files` set to whatever came from positional args.
    // TS map:   `if (listedResult) { try { files = listedResult; } catch (e) { ... } }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (listedResult !== null) {
    //   try { files = listedResult; }
    //   catch (e) { console.error(`forbidden-strings: ${e}`); process.exit(2); }
    // }
    // ```
    if let Some(listed) = listed_result {
        match listed {
            Ok(f) => files = f,
            Err(e) => {
                eprintln!("forbidden-strings: {}", e);
                return Ok(2);
            }
        }
    }

    // Fused read+scan: each rayon thread maps one file's bytes
    // (via mmap; falls back to `fs::read` if mmap fails) and
    // immediately scans them. The two-phase split that used to live
    // here (Phase A reads, Phase B scans) traded cache locality for
    // a clean separation but produced no measurable speedup -- after
    // P1 the AC scan is so fast that file bytes go from disk to AC to
    // discard within tens of microseconds. Fusing keeps each file's
    // bytes hot in L1/L2 across the read->scan boundary instead of
    // risking eviction during the materialize-then-iterate round trip.
    // What:     `files.par_iter().flat_map_iter(|p| { try mmap(p); scan_content(p, &bytes, &rs) }).collect::<Vec<String>>()`
    //           runs map+scan as one rayon work unit per file. The
    //           closure's `Mmap` (or `Vec<u8>` fallback) lives only
    //           until the scan finishes for that file; rayon
    //           work-steals across cores.
    // Why:      Mmap saves the alloc + memcpy that `fs::read` does.
    //           On a hot page cache, that's measurable on `--all`;
    //           on a cold cache, MADV_SEQUENTIAL lets the kernel
    //           readahead-pipeline files. Fallback to `fs::read`
    //           handles the cases mmap can't (empty files, /proc
    //           entries, character devices).
    // TS map:   `(await Promise.all(files.map(async (p) => scanContent(p, await readFileFastest(p), rs)))).flat()`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const hits = (await Promise.all(
    //   files.map(async (p) => scanContent(p, await readFileFastest(p), ruleset))
    // )).flat();
    // ```
    // What:     Build the canonical-path skip set once at startup
    //           (rather than per-file). The set captures the actual
    //           rules file plus the canonical generated-source paths;
    //           empty when none of them resolve. Used only in --all
    //           mode to filter walker output.
    // Why:      Closes BUG 6: explicit positional args are never
    //           skipped; only walker output is filtered, and the filter
    //           is path-anchored (not basename-anchored), so
    //           `sub/forbidden-strings.local.txt` no longer collides
    //           with the actual rules file path.
    // TS map:   `const skipSet = buildSkipSet(rulesPath);`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const skipSet = buildSkipSet(rulesPath);
    // ```
    let skip_set = if all { build_skip_set(&rules_path) } else { std::collections::HashSet::new() };

    let hits: Vec<String> = files
        .par_iter()
        .flat_map_iter(|p| {
            // What:     `if all && is_walker_skipped(p, &skip_set) { return Vec::new(); }`.
            //           Only runs the skip check on walker output
            //           (--all mode). For explicit positional args
            //           (`forbidden-strings <path>...` without --all),
            //           the file is ALWAYS scanned -- the user asked.
            // Why:      Closes BUG 6: the previous basename-based skip
            //           hid real findings on
            //           `sub/forbidden-strings.local.txt` and friends
            //           passed as explicit args. The new check applies
            //           only when the walker discovered the file
            //           automatically.
            //
            //           Inside the conditional, `is_walker_skipped`
            //           canonicalizes the path and compares against
            //           the pre-built skip set. Path-anchored matching
            //           also closes BUG 11 (Windows backslash basename)
            //           by routing through `std::fs::canonicalize`.
            // TS map:   `if (all && isWalkerSkipped(p, skipSet)) return [];`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (all && isWalkerSkipped(p, skipSet)) return [];
            // ```
            if all && is_walker_skipped(p, &skip_set) {
                return Vec::new();
            }
            // What:     `let content = fs::read(p).unwrap_or_default();`.
            //           `fs::read` returns `Result<Vec<u8>, io::Error>`
            //           (the file's raw bytes or an I/O error).
            //           `.unwrap_or_default()` extracts the `Ok` value or
            //           substitutes `Vec::<u8>::default()` (the empty
            //           vec) and SILENTLY DROPS the error. The implicit
            //           inferred type is `Vec<u8>`. Sibling pattern:
            //           `fs::read_to_string` returns `Result<String, _>`
            //           but requires UTF-8 -- we want raw bytes here
            //           because rules scan binary files too.
            // Why:      A file we can't read (permissions, vanished,
            //           etc.) becomes "empty content" and the scan
            //           pass produces zero hits for it. Crashing the
            //           whole walk on one unreadable file is worse.
            // TS map:   `try { content = await readFile(p); } catch { content = new Uint8Array(); }`.
            // Gotcha:   `.unwrap_or_default()` SILENTLY discards the
            //           `io::Error`. We accept that here because the
            //           per-file scan is best-effort.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // let content: Uint8Array;
            // try { content = await readFile(p); }
            // catch (e) { return [`${p}: read error: ${e.message}`]; }
            // return scanContent(p, content, ruleset);
            // ```
            // What:     `match fs::read(p) { Ok(c) => ..., Err(e) => ... }`.
            //           Read error path now emits a synthetic "hit"
            //           string formatted as `{path}: read error: {err}`
            //           instead of silently substituting empty content.
            //           The synthetic entry makes the file appear in the
            //           output report AND keeps the exit code at 1 (hits
            //           non-empty -> ExitCode::from(1) downstream).
            // Why:      Closes BUG 4. Pre-fix, `fs::read(p).unwrap_or_default()`
            //           dropped every io::Error: permissions, missing
            //           file, broken symlink, /proc EACCES, etc. became
            //           "empty content", the scan emitted zero hits, and
            //           the run exited 0. A secret-scanning CI control
            //           must NOT silently pass on unreadable files; the
            //           operator needs to know they had no signal.
            // TS map:   `try { ... } catch (e) { return [makeError(p, e)] }`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // try { content = await readFile(p); }
            // catch (e) { return [`${p}: read error: ${e}`]; }
            // ```
            let content = match read_with_binary_check(p) {
                Ok(c) => c,
                Err(e) => {
                    return vec![format!("{}: read error: {}", p, e)];
                }
            };
            // What:     `scan_content(p, &content, &ruleset)` is a function
            //           call. `&content` and `&ruleset` are BORROW
            //           expressions: we lend the vec and ruleset to the
            //           callee read-only. The callee returns a fresh
            //           `Vec<String>` of hits which becomes this closure's
            //           tail expression (no `;` -> implicit return).
            // Why:      Hand the just-read bytes to the scanner; the
            //           returned hits become this closure's contribution
            //           to the parallel-flat_map output.
            // TS map:   `return scanContent(p, content, ruleset);`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return scanContent(p, content, ruleset);
            // ```
            scan_content(p, &content, &ruleset)
        })
        .collect();

    // What:     `std::io::stderr().lock()` returns a `StderrLock`, an
    //           RAII handle holding the stderr mutex. Held writes
    //           don't interleave with other threads.
    // Why:      Print all hits in one batch.
    // TS map:   No equivalent; Node has no stderr lock concept.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const h of hits) process.stderr.write(h + "\n");
    // ```
    let stderr = std::io::stderr();
    let mut handle = stderr.lock();
    for h in &hits {
        let _ = writeln!(handle, "{}", h);
    }

    // What:     `if hits.is_empty() { Ok(0) } else { Ok(1) }`.
    //           This is an `if`-as-EXPRESSION (not statement) with no
    //           trailing `;`: its value becomes the function's return.
    //           `Ok(0)` and `Ok(1)` construct the success variant of
    //           `Result<i32, String>` with the OS-exit code inside; the
    //           bin wrapper converts to `ExitCode` for the actual exit.
    // Why:      No hits = clean exit; one or more hits = "violation"
    //           exit so CI marks the run as failed.
    // TS map:   `return hits.length === 0 ? 0 : 1;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return hits.length === 0 ? 0 : 1;
    // ```
    if hits.is_empty() {
        Ok(0)
    } else {
        Ok(1)
    }
}
