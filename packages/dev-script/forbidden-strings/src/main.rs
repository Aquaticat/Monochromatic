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
//           inside the parallel-I/O Phase A.
// Why:      We slurp every input file into memory up front.
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
    let args: Vec<String> = env::args().skip(1).collect();
    let mut rules_path: Option<String> = env::var("FORBIDDEN_STRINGS_RULES").ok();
    let mut all = false;
    let mut files: Vec<String> = Vec::new();
    let mut i: usize = 0;
    while i < args.len() {
        let a = &args[i];
        if a == "--rules" {
            i += 1;
            if i >= args.len() {
                eprintln!("--rules needs an argument");
                return ExitCode::from(2);
            }
            rules_path = Some(args[i].clone());
        } else if a == "--all" {
            all = true;
        } else if a == "--help" || a == "-h" {
            println!("forbidden-strings --rules <path> [--all] [FILE...]");
            return ExitCode::SUCCESS;
        } else if a.starts_with("--") {
            eprintln!("unknown flag {}", a);
            return ExitCode::from(2);
        } else {
            files.push(a.clone());
        }
        i += 1;
    }

    let rules_path = match rules_path {
        Some(p) => p,
        None => {
            eprintln!("missing --rules or FORBIDDEN_STRINGS_RULES");
            return ExitCode::from(2);
        }
    };

    let ruleset = match load_ruleset(&rules_path) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("forbidden-strings: {}", e);
            return ExitCode::from(2);
        }
    };

    if all {
        match list_files(".") {
            Ok(f) => files = f,
            Err(e) => {
                eprintln!("forbidden-strings: {}", e);
                return ExitCode::from(2);
            }
        }
    }

    // Phase A: parallel reads. Each rayon thread fetches its file's
    // bytes; the kernel readahead + page cache handle disk parallelism.
    // What:     `files.par_iter().map(...).collect::<Vec<...>>()` runs
    //           the closure across worker threads, gathering results
    //           into a single Vec. `unwrap_or_default()` substitutes an
    //           empty `Vec<u8>` on read failure -- the scan path will
    //           treat that as a clean file.
    // Why:      Doing all reads up front separates I/O from CPU. The
    //           subsequent scan phase is then purely CPU-bound, which
    //           lets rayon's work-stealing maximize core utilization.
    // TS map:   `await Promise.all(files.map(async (p) => [p, await fs.promises.readFile(p)]))`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const contents = await Promise.all(
    //   files.map(async (p) => [p, await fs.promises.readFile(p)] as const)
    // );
    // ```
    let contents: Vec<(String, Vec<u8>)> = files
        .par_iter()
        .map(|p| (p.clone(), fs::read(p).unwrap_or_default()))
        .collect();

    // Phase B: parallel scans. Each rayon thread takes one
    // `(path, content)` pair and emits hits as a sequential `Vec<String>`;
    // `flat_map_iter` concatenates them. The `RuleSet` is borrowed
    // (`&ruleset`) -- safe to share because every field is `Sync`
    // (`AhoCorasick` has no interior mutex, and each `RegexRule` carries
    // its OWN mutex so different rules don't contend).
    // What:     `flat_map_iter` is rayon's "sequential inner iterator"
    //           variant of `flat_map`. Cheaper than `flat_map` when
    //           the per-item iterator is short.
    // Why:      Genuine multi-core scan: AC over literals (Sync, no
    //           contention) plus per-rule regex `find_all` (each
    //           rule's own mutex, no cross-thread contention).
    // TS map:   `(await Promise.all(contents.map(([p, c]) => scanContent(p, c, rs)))).flat()`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const hits = (await Promise.all(
    //   contents.map(([p, c]) => scanContent(p, c, ruleset))
    // )).flat();
    // ```
    let hits: Vec<String> = contents
        .par_iter()
        .flat_map_iter(|(path, content)| scan_content(path, content, &ruleset))
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

    if hits.is_empty() {
        ExitCode::SUCCESS
    } else {
        ExitCode::from(1)
    }
}
