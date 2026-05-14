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

// What:     `use std::fs;` imports the filesystem module for `fs::read`
//           inside the per-thread fused read+scan loop.
// Why:      We slurp every input file into memory and scan it.
//           `fs::read` is empirically faster than `mmap`-based access
//           on this workload (many small files; per-file VMA setup
//           cost dominates the saved alloc) -- the E2 mmap experiment
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
// TS map:   `import * as fs from "node:fs";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import * as fs from "node:fs";
// ```
use std::fs;

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

// What:     `use std::process::ExitCode;` imports the typed wrapper for
//           process exit codes. `main` returning `ExitCode` is the
//           idiomatic way to set the OS exit status from Rust.
// Why:      Exit 0 = clean, 1 = violation(s), 2 = usage / loader error.
// TS map:   No direct equivalent; Node uses `process.exit(N)` or
//           `process.exitCode = N`.
//
// In TS you'd write (pseudocode):
// ```ts
// // No type; just a number.
// ```
use std::process::ExitCode;

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

// What:     `fn is_skipped_file(path: &str) -> bool` returns true when
//           the file's basename is one of the scanner's own rule
//           inputs or the upstream-vendored source TOML.
//           `Path::new(path).file_name()` returns `Option<&OsStr>` (the
//           last path component, or None for paths ending in `..` or
//           `/`); `.and_then(|s| s.to_str())` lifts that into
//           `Option<&str>` if it's valid UTF-8; `.unwrap_or("")` falls
//           back to the empty string when both prior calls returned
//           `None`. `matches!` is a macro that returns `true` if the
//           value matches any one of the listed literal patterns.
// Why:      The scanner reads its rule file then walks the working
//           tree. Several files in the working tree ARE the rule
//           definitions themselves (or their upstream source). If any
//           of them end up in the scanned set, every rule that matches
//           a literal in its own definition would self-match.
//           Specifically:
//             - `forbidden-strings.local.example.txt` (committed)
//               contains rules like `/bedrock-api-key-...{base64}/`
//               whose body is a literal substring of the rule itself.
//             - `forbidden-strings.local.txt` is the runtime rule file.
//             - `forbidden-strings.append.local.txt` is the per-repo
//               additions file.
//             - `betterleaks-default-config.toml` is the upstream
//               provenance bundled under `data/`; it contains example
//               literals (e.g. `AIza...` GCP-key shapes used by an
//               allowlist) that the ported rules detect.
//             - `port-betterleaks-relaxations.ts` holds the regex-source
//               strings used during the upstream port (e.g. mongodb
//               connection-string shape, sourcegraph token form). These
//               are the rule definitions in TypeScript form; the same
//               self-match risk applies as for the example-rules file.
//           Skip all five basenames unconditionally so `--all` runs
//           don't fire on the scanner's own infrastructure.
// TS map:   `function isSkippedFile(path: string): boolean { return [...names].includes(basename(path)); }`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { basename } from "node:path";
// function isSkippedFile(path: string): boolean {
//   const name = basename(path);
//   return name === "forbidden-strings.local.example.txt"
//       || name === "forbidden-strings.local.txt"
//       || name === "forbidden-strings.append.local.txt"
//       || name === "betterleaks-default-config.toml"
//       || name === "port-betterleaks-relaxations.ts";
// }
// ```
fn is_skipped_file(path: &str) -> bool {
    // What:     `path.rsplit('/').next().unwrap_or(path)` walks the
    //           string from the END until it hits the first `/`,
    //           returning the suffix after that `/` (or the whole
    //           string when no `/` is present). Substantially faster
    //           than `Path::new(path).file_name()`, which iterates
    //           through every path component to reach the last one.
    // Why:      `is_skipped_file` is called for every file in the
    //           working tree (~2700 calls on Mono `--all`). The
    //           Path-based basename extraction was a measurable
    //           fraction of the total wall time when scan dropped
    //           to ~37 ms via unicode(false). `rsplit` is one
    //           memchr-style pass over the basename suffix only.
    let basename = path.rsplit('/').next().unwrap_or(path);
    matches!(
        basename,
        "forbidden-strings.local.example.txt"
            | "forbidden-strings.local.txt"
            | "forbidden-strings.append.local.txt"
            | "betterleaks-default-config.toml"
            | "port-betterleaks-relaxations.ts"
    )
}

// What:     `fn main() -> ExitCode` is the program entry point. `ExitCode`
//           becomes the OS exit status when `main` returns.
// Why:      Coordinate arg parsing, ruleset loading, two-phase parallel
//           scan, and result reporting.
// TS map:   No entry-point function in TS; Node scripts just run top-
//           to-bottom. Mentally picture an
//           `async function main(): Promise<number>` wrapping the
//           whole file with the runtime auto-calling it.
//
// In TS you'd write (pseudocode):
// ```ts
// async function main(): Promise<number> {
//   // ...
//   return anyViolation ? 1 : 0;
// }
// process.exit(await main());
// ```
fn main() -> ExitCode {
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
                // What:     `return ExitCode::from(2);` early-exits `main`
                //           with exit status 2. `ExitCode::from(u8)` is a
                //           constructor that wraps a raw byte into the
                //           typed wrapper.
                // Why:      Convention: 0 = success, 1 = violation,
                //           2 = usage / config error.
                // TS map:   `process.exit(2);`.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // process.exit(2);
                // ```
                return ExitCode::from(2);
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
            return ExitCode::SUCCESS;
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
            return ExitCode::SUCCESS;
        } else if a.starts_with("--") || a.starts_with("-") && a.len() > 1 {
            eprintln!("unknown flag {}", a);
            return ExitCode::from(2);
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
            return ExitCode::from(2);
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
                return ExitCode::from(2);
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
    let hits: Vec<String> = files
        .par_iter()
        .flat_map_iter(|p| {
            // What:     `if is_skipped_file(p) { return Vec::new(); }`
            //           early-returns an empty `Vec<String>` when the
            //           file matches the scanner's own rule-file
            //           naming. `Vec::new()` is the empty vector
            //           constructor; returning it produces zero hits
            //           for this file. The closure's overall return
            //           type is `Vec<String>` (matching what
            //           `scan_content` returns), so the empty-vector
            //           early return is type-compatible with the
            //           normal-path return.
            // Why:      The example file (committed) and the runtime
            //           rules file would self-match if scanned (their
            //           regex bodies contain the very literals they
            //           detect). Skip them unconditionally so `--all`
            //           runs are clean.
            // TS map:   `if (isSkippedFile(p)) return [];`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (isSkippedFile(p)) return [];
            // ```
            if is_skipped_file(p) {
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
            // try { content = await readFile(p); } catch { content = new Uint8Array(); }
            // return scanContent(p, content, ruleset);
            // ```
            let content = fs::read(p).unwrap_or_default();
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

    // What:     `if hits.is_empty() { ExitCode::SUCCESS } else { ExitCode::from(1) }`.
    //           This is an `if`-as-EXPRESSION (not statement) with no
    //           trailing `;`: its value becomes the function's return.
    //           `ExitCode::SUCCESS` is the typed constant for status 0;
    //           `ExitCode::from(1)` constructs the wrapper for status 1.
    //           Sibling: `ExitCode::FAILURE` is `from(1)` -- we use the
    //           explicit form to be explicit about "violation" semantics.
    // Why:      No hits = clean exit; one or more hits = "violation"
    //           exit so CI marks the run as failed.
    // TS map:   `return hits.length === 0 ? 0 : 1;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return hits.length === 0 ? 0 : 1;
    // ```
    if hits.is_empty() {
        ExitCode::SUCCESS
    } else {
        ExitCode::from(1)
    }
}
