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

    let ruleset = match ruleset_result {
        Ok(r) => r,
        Err(e) => {
            eprintln!("forbidden-strings: {}", e);
            return ExitCode::from(2);
        }
    };

    if let Some(listed) = listed_result {
        match listed {
            Ok(f) => files = f,
            Err(e) => {
                eprintln!("forbidden-strings: {}", e);
                return ExitCode::from(2);
            }
        }
    }

    // Fused read+scan: each rayon thread reads one file's bytes and
    // immediately scans them. The two-phase split that used to live
    // here (Phase A reads, Phase B scans) traded cache locality for
    // a clean separation but produced no measurable speedup -- after
    // P1 the AC scan is so fast that file bytes go from disk to AC to
    // discard within tens of microseconds. Fusing keeps each file's
    // bytes hot in L1/L2 across the read->scan boundary instead of
    // risking eviction during the materialize-then-iterate round trip.
    // What:     `files.par_iter().flat_map_iter(|p| { let c = ...; scan_content(p, &c, &rs) }).collect::<Vec<String>>()`
    //           runs read+scan as one rayon work unit per file. The
    //           closure's local `Vec<u8>` lives only until the scan
    //           finishes for that file; rayon work-steals across cores.
    // Why:      Single pass over the file list, no intermediate Vec of
    //           (path, content) pairs, no second `par_iter` setup cost.
    // TS map:   `(await Promise.all(files.map(async (p) => scanContent(p, await fs.promises.readFile(p), rs)))).flat()`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const hits = (await Promise.all(
    //   files.map(async (p) => scanContent(p, await fs.promises.readFile(p), ruleset))
    // )).flat();
    // ```
    let hits: Vec<String> = files
        .par_iter()
        .flat_map_iter(|p| {
            let content = fs::read(p).unwrap_or_default();
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

    if hits.is_empty() {
        ExitCode::SUCCESS
    } else {
        ExitCode::from(1)
    }
}
