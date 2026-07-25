//! Library entry points, file discovery, and lint run loop.

// What:     Six `pub mod ...;` lines declare the crate's submodules, each living
//           in the matching file (`cli.rs`, `config.rs`, `context.rs`,
//           `diagnostic.rs`, `rule.rs`, and the `rule/` folder). `mod` is what
//           compiles a file into the crate at all; `pub` re-exposes it to outside
//           consumers and to the binary half.
// Why:      Split the linter into small, separately commentable files.
//
// In TS you'd write (pseudocode):
// ```ts
// export * from "./cli"; export * from "./config"; /* ...and so on */
// ```
/// Clap-backed command-line parser module.
pub mod cli;
/// Path-based exemptions, re-exporting the shared settings record.
pub mod config;
/// Registry of the rules this binary compiles in.
pub mod rule;
/// Built-in lint rule implementations.
pub mod builtin;

// What:     `pub use dependency::{a, b};` re-exports two MODULES, not types, from
//           a dependency under this crate's own root. After this, `crate::context`
//           and `crate::diagnostic` resolve exactly as they did when the files
//           lived here, so no rule or test needed rewriting when they moved.
// Why:      The context and diagnostic models moved to
//           `monochromatic-rust-linter-core` so rule packages can depend on them
//           without depending on this CLI crate.
//
// In TS you'd write (pseudocode):
// ```ts
// export * as context from "@monochromatic-dev/rust-linter-core/context";
// ```
/// Per-file parsed context and the diagnostic model, from the core crate.
pub use monochromatic_rust_linter_core::{context, diagnostic, fix, span};

// What:     `use std::fs;` imports the standard filesystem module (we call
//           `fs::read_to_string`).
// Why:      Read each `.rs` file's text.
//
// In TS you'd write (pseudocode):
// ```ts
// import * as fs from "node:fs";
// ```
/// Imports filesystem helpers for reading Rust source files.
use std::fs;

// What:     `use std::path::Path;` imports the borrowed-path type used to test
//           "is this a file or a directory".
// Why:      Decide whether to read a path directly or walk it as a folder.
//
// In TS you'd write (pseudocode):
// ```ts
// import path from "node:path";
// ```
/// Imports path helpers for file and directory discovery.
use std::path::Path;

// What:     `use clap::Parser;` imports the trait that gives `Cli::parse()` its
//           method. `Parser` here is a trait from clap, not this crate's own type.
// Why:      The compatibility `run_cli_from_env` wrapper below needs to parse real
//           process arguments the same way `main.rs` does.
//
// In TS you'd write (pseudocode):
// ```ts
// import { parseArgs } from "some-cli-parser";
// ```
/// Imports clap parser trait for the compatibility entry point.
use clap::Parser;

// What:     `use ignore::WalkBuilder;` imports the gitignore-aware directory
//           walker from the external `ignore` crate (the one ripgrep uses).
// Why:      Enumerate `.rs` files under a directory while skipping `target/` and
//           anything `.gitignore` excludes.
//
// In TS you'd write (pseudocode):
// ```ts
// import { walk } from "<gitignore-aware walker>";
// ```
/// Imports gitignore-aware directory walker.
use ignore::WalkBuilder;

// What:     `use anyhow::Result;` imports `anyhow`'s one-parameter result alias.
// Why:      Preserve the compatibility entry point's fallible shape without a
//           string-only error channel.
//
// In TS you'd write (pseudocode):
// ```ts
// type Result<T> = T; // failures throw Error objects
// ```
/// Imports application-level result alias for compatibility entry point.
use anyhow::Result;

// What:     `use crate::cli::Cli;` imports the clap-backed parser output from
//           this crate. `crate::` means "from the root of this same crate".
// Why:      The run loop receives already-validated command-line options.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Cli } from "./cli";
// ```
/// Imports parsed command-line options.
use crate::cli::Cli;

// What:     `use crate::config::Config;` and the next three lines import this
//           crate's own types and the rule registry.
// Why:      The run loop builds a `Config`, makes `LintContext`s, collects
//           `Diagnostic`s, and iterates the rules from `all_rules`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Config } from "./config";
// ```
/// Imports shared linter settings.
use crate::config::Config;
/// Imports parsed per-file lint context.
use crate::context::LintContext;
/// Imports diagnostic payload and severity types.
use crate::diagnostic::{Diagnostic, Severity};
/// Imports enabled-rule registry and rule trait.
use crate::rule::{all_rules, Rule};

/// Parse real process arguments with clap, then run the linter.
// What:     `pub fn run_cli_from_env() -> Result<i32>` preserves the old
//           public entry-point shape. `Result<i32>` can still represent a
//           fatal setup error, though clap handles argument errors by printing and
//           exiting before this function returns.
// Why:      External callers that used `run_cli_from_env` keep compiling while the
//           implementation moves from manual argv scanning to clap.
//
// In TS you'd write (pseudocode):
// ```ts
// export function runCliFromEnv(): number { return runCli(parseArgs(process.argv)); }
// ```
pub fn run_cli_from_env() -> Result<i32> {
    // What:     `let cli = Cli::parse();` calls the clap-generated parser. `::` is
    //           Rust's namespace operator. `parse()` reads real process argv; on
    //           `--help`, `--version`, or invalid input, clap prints and exits the
    //           process before this function continues.
    // Why:      Keep this compatibility wrapper behaviour aligned with `main.rs`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const cli = parseArgs(process.argv.slice(2));
    // ```
    let cli = Cli::parse();

    // What:     `Ok(run_cli(&cli))` constructs the success variant of `Result` and
    //           lends the parsed options to `run_cli`. The `&` is a read-only
    //           borrow, and the tail expression is returned.
    // Why:      Keep the old `Result`-returning API while delegating all work to
    //           the clap-backed run loop.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return runCli(cli);
    // ```
    Ok(run_cli(&cli))
}

// What:     `pub fn run_cli(cli: &Cli) -> i32`. The library entry point. `&Cli` is
//           a read-only borrow of clap's parsed options. `i32` is a 32-bit signed
//           integer (siblings: `u32`, `u64`, `usize`) used here because process
//           exit codes are conventionally represented as signed integers before
//           `main` narrows them.
// Why:      Keep lint behaviour in a testable library function while clap owns
//           raw argv parsing in `main.rs`.
//
// In TS you'd write (pseudocode):
// ```ts
// function runCli(cli: Cli): number { /* ... */ }
// ```
/// Run the linter from already-parsed command-line options.
pub fn run_cli(cli: &Cli) -> i32 {
    // What:     `let config = Config { max_lines: cli.max_lines };`. Builds the
    //           settings struct from clap's parsed budget.
    // Why:      Rules read the budget from here.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const config = { maxLines: cli.maxLines };
    // ```
    let config = Config {
        max_lines: cli.max_lines,
    };

    // What:     `let files = collect_rust_files(&cli.paths);`. Lends the parsed
    //           path vector and gets back an owned `Vec<String>` of `.rs` files.
    //           The `&` is a read-only borrow, so `cli` keeps owning the paths.
    // Why:      The list of files to lint.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const files = collectRustFiles(cli.paths);
    // ```
    let files = collect_rust_files(&cli.paths);

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

    // What:     `if any_error { 1 } else { 0 }`. The whole `if/else` is the tail
    //           expression, so it is returned as the process status number.
    // Why:      1 signals "lint violations found", 0 signals "clean".
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return anyError ? 1 : 0;
    // ```
    if any_error {
        1
    } else {
        0
    }
}

// What:     `fn collect_rust_files(paths: &[String]) -> Vec<String>`. Borrow the
//           requested paths; return owned paths of every `.rs` file found.
// Why:      Expand directories into their `.rs` files; pass files through directly.
//
// In TS you'd write (pseudocode):
// ```ts
// function collectRustFiles(paths: string[]): string[] { /* ... */ }
// ```
/// Expand file and directory arguments into Rust source file paths.
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
/// Read one file and apply every enabled rule to it.
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
            tracing::warn!(path, cause = %error, "cannot read file");
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
