// What:     Five `pub mod ...;` lines declare the crate's submodules, each living
//           in the matching file (`config.rs`, `context.rs`, `diagnostic.rs`,
//           `rule.rs`, and the `rules/` folder). `mod` is what compiles a file
//           into the crate at all; `pub` re-exposes it to outside consumers and
//           to the binary half.
// Why:      Split the linter into small, separately commentable files.
//
// In TS you'd write (pseudocode):
// ```ts
// export * from "./config"; export * from "./context"; /* ...and so on */
// ```
pub mod config;
pub mod context;
pub mod diagnostic;
pub mod rule;
pub mod rules;

// What:     `use std::fs;` imports the standard filesystem module (we call
//           `fs::read_to_string`).
// Why:      Read each `.rs` file's text.
//
// In TS you'd write (pseudocode):
// ```ts
// import * as fs from "node:fs";
// ```
use std::fs;

// What:     `use std::path::Path;` imports the borrowed-path type used to test
//           "is this a file or a directory".
// Why:      Decide whether to read a path directly or walk it as a folder.
//
// In TS you'd write (pseudocode):
// ```ts
// import path from "node:path";
// ```
use std::path::Path;

// What:     `use ignore::WalkBuilder;` imports the gitignore-aware directory
//           walker from the external `ignore` crate (the one ripgrep uses).
// Why:      Enumerate `.rs` files under a directory while skipping `target/` and
//           anything `.gitignore` excludes.
//
// In TS you'd write (pseudocode):
// ```ts
// import { walk } from "<gitignore-aware walker>";
// ```
use ignore::WalkBuilder;

// What:     `use crate::config::Config;` and the next three lines import this
//           crate's own types and the rule registry.
// Why:      The run loop builds a `Config`, makes `LintContext`s, collects
//           `Diagnostic`s, and iterates the rules from `all_rules`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Config } from "./config";
// ```
use crate::config::Config;
use crate::context::LintContext;
use crate::diagnostic::{Diagnostic, Severity};
use crate::rule::{all_rules, Rule};

// What:     `struct Parsed { paths: Vec<String>, max_lines: usize }`. A private
//           record holding parsed command-line options: the paths to scan and the
//           budget. `Vec<String>` is an owned, growable array of owned strings.
// Why:      Bundle the two parsed values so `parse_args` returns one thing.
//
// In TS you'd write (pseudocode):
// ```ts
// type Parsed = { paths: string[]; maxLines: number };
// ```
struct Parsed {
    paths: Vec<String>,
    max_lines: usize,
}

// What:     `pub fn run_cli_from_env() -> Result<i32, String>`. The library entry
//           point. `Result<i32, String>` means it returns either `Ok(code)` (an
//           exit code) or `Err(message)` (a fatal error string).
// Why:      Hold all CLI behaviour in one testable function; `main.rs` just maps
//           its result to an OS exit code.
//
// In TS you'd write (pseudocode):
// ```ts
// function runCliFromEnv(): number { /* ... */ }
// ```
pub fn run_cli_from_env() -> Result<i32, String> {
    // What:     `let args: Vec<String> = std::env::args().skip(1).collect();`.
    //           `std::env::args()` yields the process arguments (an iterator of
    //           `String`); `.skip(1)` drops the program name; `.collect()`
    //           gathers the rest into a `Vec<String>` (the `: Vec<String>`
    //           annotation tells `collect` what to build).
    // Why:      Get the user-supplied arguments to parse.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const args = process.argv.slice(2);
    // ```
    let args: Vec<String> = std::env::args().skip(1).collect();

    // What:     `let parsed = parse_args(&args)?;`. Lends `args` read-only to the
    //           parser. The trailing `?` is the propagation operator: if
    //           `parse_args` returned `Err(e)`, return that same `Err` from here
    //           immediately; otherwise unwrap the `Ok` value into `parsed`.
    // Why:      Turn raw arguments into structured options, bailing on bad input.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const parsed = parseArgs(args);
    // ```
    let parsed = parse_args(&args)?;

    // What:     `let config = Config { max_lines: parsed.max_lines };`. Builds the
    //           settings struct from the parsed budget.
    // Why:      Rules read the budget from here.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const config = { maxLines: parsed.maxLines };
    // ```
    let config = Config {
        max_lines: parsed.max_lines,
    };

    // What:     `let files = collect_rust_files(&parsed.paths);`. Lends the paths
    //           and gets back an owned `Vec<String>` of `.rs` file paths.
    // Why:      The list of files to lint.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const files = collectRustFiles(parsed.paths);
    // ```
    let files = collect_rust_files(&parsed.paths);

    // What:     `let rules = all_rules();`. The enabled rule set as
    //           `Vec<Box<dyn Rule>>` (heap-boxed trait objects).
    // Why:      Iterate these for every file.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const rules = allRules();
    // ```
    let rules = all_rules();

    // What:     `let mut diagnostics: Vec<Diagnostic> = Vec::new();`. An empty,
    //           mutable, owned vector that every file's findings accumulate into.
    // Why:      One shared buffer collects all findings across files.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const diagnostics: Diagnostic[] = [];
    // ```
    let mut diagnostics: Vec<Diagnostic> = Vec::new();

    // What:     `for file in &files`. Iterates by BORROWING each element (`&files`),
    //           so `file` is a `&String` and `files` stays usable afterwards.
    // Why:      Lint every discovered file.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const file of files) { lintFile(file, config, rules, diagnostics); }
    // ```
    for file in &files {
        // What:     `lint_file(file, &config, &rules, &mut diagnostics);`. Lends
        //           the file path and config read-only, the rules slice read-only,
        //           and the diagnostics vector MUTABLY so the callee can push.
        // Why:      Run all rules against this one file.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // lintFile(file, config, rules, diagnostics);
        // ```
        lint_file(file, &config, &rules, &mut diagnostics);
    }

    // What:     `for diagnostic in &diagnostics { println!("{}", diagnostic.render()); }`.
    //           Borrow each finding and print its rendered line to standard output.
    //           `println!` is the formatting print macro (the `!`).
    // Why:      Show the user every violation.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const d of diagnostics) console.log(renderDiagnostic(d));
    // ```
    for diagnostic in &diagnostics {
        println!("{}", diagnostic.render());
    }

    // What:     `let any_error = diagnostics.iter().any(|d| d.severity ==
    //           Severity::Error);`. `.iter()` borrows each element; `.any(closure)`
    //           returns true if the closure is true for at least one. `|d| ...` is
    //           the closure, `d` is a `&Diagnostic`.
    // Why:      Decide the exit code: any error-severity finding means failure.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const anyError = diagnostics.some(d => d.severity === "error");
    // ```
    let any_error = diagnostics
        .iter()
        .any(|d| d.severity == Severity::Error);

    // What:     `if any_error { Ok(1) } else { Ok(0) }`. `Ok(1)` / `Ok(0)`
    //           construct the success variant of `Result` carrying the exit code.
    //           The whole `if/else` is the tail expression, so it is returned.
    // Why:      1 signals "lint violations found", 0 signals "clean".
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return anyError ? 1 : 0;
    // ```
    if any_error {
        Ok(1)
    } else {
        Ok(0)
    }
}

// What:     `fn parse_args(args: &[String]) -> Result<Parsed, String>`. Private
//           helper. `&[String]` is a borrowed slice of strings. Returns parsed
//           options or an error message.
// Why:      Read `--max N` / `--max=N` and treat every other argument as a path.
//
// In TS you'd write (pseudocode):
// ```ts
// function parseArgs(args: string[]): Parsed { /* ... */ }
// ```
fn parse_args(args: &[String]) -> Result<Parsed, String> {
    // What:     `let mut paths: Vec<String> = Vec::new();`. Mutable empty vector to
    //           collect path arguments.
    // Why:      Gather everything that is not a flag.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const paths: string[] = [];
    // ```
    let mut paths: Vec<String> = Vec::new();

    // What:     `let mut max_lines: usize = Config::with_defaults().max_lines;`.
    //           Builds a default `Config` and reads its budget field, so the
    //           literal `300` lives in exactly one place (the constructor).
    // Why:      Used unless `--max` overrides it; keeps one source of truth.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let maxLines = withDefaults().maxLines;
    // ```
    let mut max_lines: usize = Config::with_defaults().max_lines;

    // What:     `let mut index = 0usize;`. Manual cursor into `args` (we sometimes
    //           need to consume the NEXT argument for `--max N`, so a plain
    //           `for` loop is awkward).
    // Why:      Walk arguments with lookahead.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let index = 0;
    // ```
    let mut index = 0usize;

    // What:     `while index < args.len()`. Loop until the cursor passes the end.
    // Why:      Process each argument, advancing the cursor ourselves.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // while (index < args.length) { /* ... */ }
    // ```
    while index < args.len() {
        // What:     `let arg = &args[index];`. Borrow the current argument as a
        //           `&String`.
        // Why:      Inspect it without copying.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const arg = args[index];
        // ```
        let arg = &args[index];

        // What:     `if arg == "--max"`. Compare the argument to the flag name.
        // Why:      The space-separated form `--max 400` needs the next argument.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (arg === "--max") { /* ... */ }
        // ```
        if arg == "--max" {
            // What:     `index += 1;`. Advance to the value argument.
            // Why:      `--max` is followed by its number.
            index += 1;

            // What:     `let value = args.get(index).ok_or_else(|| "--max needs a
            //           value".to_string())?;`. `args.get(index)` returns
            //           `Option<&String>` (None if past the end, no panic).
            //           `.ok_or_else(closure)` converts `None` into `Err(closure())`
            //           and `Some(v)` into `Ok(v)`; the closure builds an owned
            //           error `String`. The `?` then propagates any `Err` and
            //           unwraps the `Ok` into `value`.
            // Why:      Fail cleanly if `--max` is the last argument with no number.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const value = args[index];
            // if (value === undefined) throw new Error("--max needs a value");
            // ```
            let value = args
                .get(index)
                .ok_or_else(|| "--max needs a value".to_string())?;

            // What:     `max_lines = value.parse::<usize>().map_err(|_| format!(
            //           "invalid --max value: {value}"))?;`. `.parse::<usize>()`
            //           tries to read the string as a `usize`, returning
            //           `Result<usize, _>`. `.map_err(|_| ...)` replaces the
            //           parser's error with our own message (the `_` ignores the
            //           original). `?` propagates failure or unwraps the number.
            // Why:      Accept only a valid non-negative integer budget.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const n = Number(value);
            // if (!Number.isInteger(n) || n < 0) throw new Error(`invalid --max value: ${value}`);
            // maxLines = n;
            // ```
            max_lines = value
                .parse::<usize>()
                .map_err(|_| format!("invalid --max value: {value}"))?;
        } else if let Some(rest) = arg.strip_prefix("--max=") {
            // What:     `else if let Some(rest) = arg.strip_prefix("--max=")`.
            //           `.strip_prefix(p)` returns `Some(remainder)` if `arg`
            //           starts with `p`, else `None`. `if let Some(rest) = ...`
            //           runs this branch only on a match, binding the remainder.
            // Why:      Support the joined form `--max=400`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // else if (arg.startsWith("--max=")) { const rest = arg.slice("--max=".length); /* parse */ }
            // ```
            max_lines = rest
                .parse::<usize>()
                .map_err(|_| format!("invalid --max value: {rest}"))?;
        } else {
            // What:     `paths.push(arg.clone());`. `.clone()` makes an OWNED copy
            //           of the borrowed `&String` so the vector can own it.
            // Why:      Treat any non-flag argument as a path to scan.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // paths.push(arg);
            // ```
            paths.push(arg.clone());
        }

        // What:     `index += 1;`. Move to the next argument.
        // Why:      Advance the cursor each iteration.
        index += 1;
    }

    // What:     `if paths.is_empty() { paths.push(".".to_string()); }`. If no path
    //           was given, default to the current directory. `".".to_string()`
    //           allocates an owned `String` from the borrowed literal.
    // Why:      Running with no arguments should lint the working tree.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (paths.length === 0) paths.push(".");
    // ```
    if paths.is_empty() {
        paths.push(".".to_string());
    }

    // What:     `Ok(Parsed { paths, max_lines })`. Wrap the built options in the
    //           success variant. Tail expression, so it is returned.
    // Why:      Hand structured options back to the caller.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return { paths, maxLines };
    // ```
    Ok(Parsed { paths, max_lines })
}

// What:     `fn collect_rust_files(paths: &[String]) -> Vec<String>`. Borrow the
//           requested paths; return owned paths of every `.rs` file found.
// Why:      Expand directories into their `.rs` files; pass files through directly.
//
// In TS you'd write (pseudocode):
// ```ts
// function collectRustFiles(paths: string[]): string[] { /* ... */ }
// ```
fn collect_rust_files(paths: &[String]) -> Vec<String> {
    // What:     `let mut files: Vec<String> = Vec::new();`. Accumulator for results.
    // Why:      Collect every discovered file path.
    let mut files: Vec<String> = Vec::new();

    // What:     `for path in paths`. Iterate the requested paths (borrowed).
    // Why:      Handle each path argument.
    for path in paths {
        // What:     `let start = Path::new(path);`. Wrap the string as a `&Path`.
        // Why:      Use path queries like `is_file`.
        let start = Path::new(path);

        // What:     `if start.is_file()`. Filesystem check: is this an existing file?
        // Why:      A directly named file is linted as-is, not walked.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (isFile(start)) { files.push(path); } else { /* walk */ }
        // ```
        if start.is_file() {
            // What:     `files.push(path.clone());`. Own a copy of the path string.
            // Why:      Keep the explicitly named file.
            files.push(path.clone());
        } else {
            // What:     `for entry in WalkBuilder::new(start).build().flatten()`.
            //           Build a sequential gitignore-aware walker rooted at `start`.
            //           Its items are `Result<DirEntry, Error>`; `.flatten()` keeps
            //           only the `Ok` entries and silently drops walk errors (such as
            //           an unreadable directory), so one bad entry never aborts the
            //           run. `entry` is therefore a plain `DirEntry`.
            // Why:      Find files recursively while honouring `.gitignore` (so
            //           `target/` is skipped), tolerating per-entry errors.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // for (const entry of walk(start)) { /* unreadable entries skipped */ }
            // ```
            for entry in WalkBuilder::new(start).build().flatten() {
                // What:     `let entry_path = entry.path();`. The `&Path` of this entry.
                // Why:      Test its kind and extension.
                let entry_path = entry.path();

                // What:     `let is_rs = entry_path.extension().and_then(|e|
                //           e.to_str()) == Some("rs");`. `.extension()` returns
                //           `Option<&OsStr>` (the bit after the last dot, or None).
                //           `.and_then(|e| e.to_str())` converts it to `Option<&str>`.
                //           Comparing to `Some("rs")` is true only when the extension
                //           is exactly `rs`.
                // Why:      Keep only Rust source files.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const isRs = entryPath.endsWith(".rs");
                // ```
                let is_rs = entry_path.extension().and_then(|e| e.to_str()) == Some("rs");

                // What:     `if entry_path.is_file() && is_rs`. Only real files with
                //           the `.rs` extension qualify. `&&` is logical AND.
                // Why:      Directories named `*.rs` (rare) must not slip in.
                if entry_path.is_file() && is_rs {
                    // What:     `files.push(entry_path.to_string_lossy().into_owned());`.
                    //           `.to_string_lossy()` turns the path into a `Cow<str>`
                    //           (borrowed when valid UTF-8, owned with replacement
                    //           chars otherwise); `.into_owned()` forces an owned
                    //           `String`.
                    // Why:      Store an owned path string in the results.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // files.push(String(entryPath));
                    // ```
                    files.push(entry_path.to_string_lossy().into_owned());
                }
            }
        }
    }

    // What:     `files`. Tail expression: return the collected paths.
    // Why:      Hand the file list back.
    files
}

// What:     `fn lint_file(path: &str, config: &Config, rules: &[Box<dyn Rule>],
//           out: &mut Vec<Diagnostic>)`. Read-only borrows of the path, config,
//           and rule slice; a mutable borrow of the findings vector.
// Why:      Read one file, build its context once, run every rule against it.
//
// In TS you'd write (pseudocode):
// ```ts
// function lintFile(path: string, config: Config, rules: Rule[], out: Diagnostic[]): void { /* ... */ }
// ```
fn lint_file(path: &str, config: &Config, rules: &[Box<dyn Rule>], out: &mut Vec<Diagnostic>) {
    // What:     `let source = match fs::read_to_string(path) { Ok(text) => text,
    //           Err(error) => { eprintln!(...); return; } };`. `fs::read_to_string`
    //           returns `Result<String, io::Error>`. The `match` binds the file
    //           text on success, or on failure prints to stderr and returns early
    //           (skipping this file). The whole `match` is an expression assigned
    //           to `source`.
    // Why:      An unreadable file should warn and be skipped, not crash the run.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let source: string;
    // try { source = fs.readFileSync(path, "utf8"); }
    // catch (e) { console.error(`rust-linter: cannot read ${path}: ${e}`); return; }
    // ```
    let source = match fs::read_to_string(path) {
        Ok(text) => text,
        Err(error) => {
            eprintln!("rust-linter: cannot read {path}: {error}");
            return;
        }
    };

    // What:     `let context = LintContext::new(path.to_string(), source);`.
    //           `path.to_string()` makes an OWNED `String` from the borrowed path;
    //           `source` is moved in. The constructor parses the file once.
    // Why:      Build the shared per-file bundle every rule reads from.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const context = LintContext.create(path, source);
    // ```
    let context = LintContext::new(path.to_string(), source);

    // What:     `for rule in rules`. Iterate the boxed rules (borrowed); `rule` is
    //           a `&Box<dyn Rule>` that auto-dereferences when we call a method.
    // Why:      Apply every enabled rule to this file.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const rule of rules) rule.check(context, config, out);
    // ```
    for rule in rules {
        // What:     `rule.check(&context, config, out);`. Call the trait method,
        //           lending the context read-only and forwarding the mutable
        //           findings buffer. `config` and `out` are already references
        //           here, so they pass straight through.
        // Why:      Let the rule append any findings for this file.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // rule.check(context, config, out);
        // ```
        rule.check(&context, config, out);
    }
}
