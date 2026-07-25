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
/// Finding the files to lint, and the flags that shape that set.
pub mod discover;
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
pub use monochromatic_rust_linter_core::{context, diagnostic, fix, severity, span, toml};

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
/// Imports file discovery and the resolved worker-thread count.
use crate::discover::{collect_rust_files, thread_count};

// What:     `use monochromatic_rust_linter_core::config::...` reaches the core
//           crate directly rather than through this crate's re-export, because
//           these are used here rather than republished.
// Why:      The runner owns loading and merging; rules never see any of it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { loadFor, defaultConfig, merge, LinterConfig } from "...core/config";
// ```
/// Imports configuration discovery and `extends` resolution.
use monochromatic_rust_linter_core::config::load::{load_file, load_for};
/// Imports configuration merging and the compiled, resolvable configuration.
use monochromatic_rust_linter_core::config::resolve::{merge, LinterConfig};
/// Imports the built-in configuration compiled into the core crate.
use monochromatic_rust_linter_core::config::default_config;

/// Imports the JSONL renderer, this linter's only output format.
use monochromatic_rust_linter_core::format::render as render_jsonl;

/// Imports directive parsing and the suppression applier.
use monochromatic_rust_linter_core::directive::{apply::apply, parse as parse_directives};
/// Imports the configured-severity type the unused-directive report uses.
use monochromatic_rust_linter_core::severity::RuleSeverity;

/// Imports the repair applier and its fixpoint cap.
use monochromatic_rust_linter_core::fix::apply::{apply as apply_fixes, MAX_PASSES};
/// Imports the trust levels gating which repairs a run may apply.
use monochromatic_rust_linter_core::fix::FixKind;

/// Imports the rule that runs declarative patterns from configuration.
use crate::builtin::pattern_rule::{PatternRule, PLUGIN as PATTERN_PLUGIN};

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
    //           borrow.
    // Why:      Keep the old `Result`-returning API while delegating all work to
    //           the clap-backed run loop.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return runCli(cli);
    // ```
    return Ok(run_cli(&cli))
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
    // What:     `let linter = match load_linter_config(cli) { Ok(v) => v, Err(m)
    //           => { .. return 2; } };`. A `match` on a `Result`, binding the
    //           success value or reporting the failure and exiting.
    // Why:      A broken config is a fatal setup error, not a lint finding, so it
    //           exits 2 the way an unparseable `--max` already does.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let linter; try { linter = loadLinterConfig(cli); } catch (e) { ...; return 2; }
    // ```
    let linter = match load_linter_config(cli) {
        Ok(loaded) => loaded,
        Err(message) => {
            eprintln!("rust-linter: {message}");
            return 2;
        }
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
    let files = collect_rust_files(cli);

    // `--debug=files` prints what would be linted and stops, which is how a user
    // answers "why is this file not being checked" without reading the config.
    if debug_wants(cli, "files") {
        for file in &files {
            println!("{file}");
        }

        return 0;
    }

    // An empty file set is an error by default, because it usually means a typo
    // in a path rather than a repository with no Rust in it.
    if files.is_empty() && !cli.no_error_on_unmatched_pattern {
        eprintln!("rust-linter: no files matched the given paths");
        return 2;
    }

    // What:     `let rules = all_rules();`. The enabled rule set as
    //           `Vec<Box<dyn Rule>>` (heap-boxed trait objects).
    // Why:      Iterate these for every file.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const rules = allRules();
    // ```
    // What:     `let mut rules = all_rules();` then extending it from config.
    //           `mut` is required to push into a binding at all; bindings are
    //           immutable by default in Rust.
    // Why:      Compiled-in rules are known at build time, but pattern rules are
    //           read from `rust-linter.toml`, so the set is only complete once
    //           the configuration has been loaded.
    let mut rules = all_rules(&linter);

    // The pattern plugin is gated like any other: `plugins = ["builtin"]` turns
    // configured pattern rules off without the author having to delete them.
    let patterns: &[_] = if linter.plugin_enabled(PATTERN_PLUGIN) {
        &linter.patterns
    } else {
        &[]
    };

    for configured in patterns {
        match PatternRule::build(configured) {
            Ok(built) => rules.push(Box::new(built)),
            Err(message) => {
                // A malformed pattern is a configuration error, not a finding.
                // Reporting it and exiting 2 beats silently matching nothing.
                eprintln!("rust-linter: {message}");
                return 2;
            }
        }
    }

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
    // What:     A repair pass BEFORE the reporting pass, when a fix flag was
    //           given. Each file is rewritten until it stops changing.
    // Why:      Only unrepaired findings should be reported, which oxlint states
    //           as "only unfixed issues are reported in the output". Reporting
    //           first would name problems that no longer exist by the time the
    //           user reads them.
    if let Some(ceiling) = fix_ceiling(cli) {
        for file in &files {
            fix_file(file, cli, &linter, &rules, ceiling);
        }
    }

    lint_all(&files, cli, &linter, &rules, &mut diagnostics);

    // What:     `let warnings = diagnostics.iter().filter(..).count();` counts
    //           findings at warning severity. `.iter()` borrows each element,
    //           `.filter(closure)` keeps the ones the closure accepts, and
    //           `.count()` consumes what is left into a number.
    // Why:      Both `--max-warnings` and `--deny-warnings` need this count, and
    //           computing it once keeps the two decisions from drifting apart.
    let warnings = diagnostics
        .iter()
        .filter(|diagnostic| return diagnostic.severity == Severity::Warn)
        .count();

    let errors = diagnostics
        .iter()
        .filter(|diagnostic| return diagnostic.severity == Severity::Error)
        .count();

    // `--quiet` drops warnings before rendering. `.cloned()` copies the kept
    // findings into an owned vector, because the renderer takes a slice.
    let shown: Vec<Diagnostic> = if cli.quiet {
        diagnostics
            .iter()
            .filter(|diagnostic| return diagnostic.severity != Severity::Warn)
            .cloned()
            .collect()
    } else {
        diagnostics.clone()
    };

    // `--silent` suppresses the report entirely, without touching the exit code.
    //
    // `print!` rather than `println!`: the renderer already ends every record
    // with a newline, and a clean run prints nothing at all rather than a blank
    // line, which is what makes the output safe to pipe straight into `jq`.
    if !cli.silent {
        print!("{}", render_jsonl(&shown));
    }

    return exit_code_for(cli, linter.options.deny_warnings, warnings, errors);
}

// What:     `fn exit_code_for(..) -> i32`. Turns the run's tallies into the
//           process status.
// Why:      Three separate switches can each fail a run that produced no errors,
//           and deciding them in one function is what makes the precedence
//           legible rather than emergent from the order of some `if`s.
//
// In TS you'd write (pseudocode):
// ```ts
// function exitCodeFor(cli: Cli, denyWarnings: boolean, warnings: number, errors: number): number
// ```
/// Decide the process exit status from the run's warning and error counts.
fn exit_code_for(cli: &Cli, config_deny_warnings: bool, warnings: usize, errors: usize) -> i32 {
    // Any error fails, whatever the warning settings say.
    if errors > 0 {
        return 1;
    }

    // The flag and the configured option are both honoured, and the flag cannot
    // turn the option off, matching how `deny-warnings` merges between files.
    if (cli.deny_warnings || config_deny_warnings) && warnings > 0 {
        return 1;
    }

    // `if let Some(threshold) = ..` runs only when a threshold was set. Zero is
    // meaningful and distinct from absent, which is why this is an `Option`
    // rather than a number defaulting to zero.
    // What:     `if let Some(threshold) = .. && warnings > threshold`. A let
    //           binding and a boolean test joined by `&&` in one condition; the
    //           binding is in scope for the test to its right.
    // Why:      Written as two nested `if`s clippy objects, and it reads as one
    //           condition anyway: there is a threshold AND it was exceeded.
    if let Some(threshold) = cli.max_warnings
        && warnings > threshold
    {
        return 1;
    }

    return 0;
}

// What:     `fn collect_rust_files(paths: &[String]) -> Vec<String>`. Borrow the
//           requested paths; return owned paths of every `.rs` file found.
// Why:      Expand directories into their `.rs` files; pass files through directly.
//
// In TS you'd write (pseudocode):
// ```ts
// function collectRustFiles(paths: string[]): string[] { /* ... */ }
// ```

// What:     `fn debug_wants(cli: &Cli, option: &str) -> bool`. Answers whether a
//           comma-separated `--debug` list names one option.
// Why:      oxlint takes `--debug=files,timings` as one flag rather than two, so
//           the list is split here rather than by clap.
/// Report whether the --debug list names a given option.
fn debug_wants(cli: &Cli, option: &str) -> bool {
    // `.is_some_and(..)` is true only when the option is present AND the closure
    // accepts, which reads better than nesting an `if let` around a search.
    return cli
        .debug
        .as_ref()
        .is_some_and(|list| return list.split(',').any(|entry| return entry.trim() == option));
}

// What:     `fn lint_all(..)`. Splits the files across threads, lints each chunk
//           on its own thread, then concatenates the results in chunk order.
// Why:      Linting is per file and shares nothing, so it parallelises without
//           locking. Concatenating in CHUNK order rather than completion order
//           is what keeps output identical run to run: a linter whose findings
//           shuffle between runs cannot be diffed in CI.
//
// In TS you'd write (pseudocode):
// ```ts
// function lintAll(files, cli, linter, rules, out): void
// ```
/// Lint every file, in parallel when more than one thread was asked for.
fn lint_all(
    files: &[String],
    cli: &Cli,
    linter: &LinterConfig,
    rules: &[Box<dyn Rule>],
    out: &mut Vec<Diagnostic>,
) {
    let threads = thread_count(cli);

    // One thread means no scope, no chunking and no join: a small package should
    // not pay for machinery it does not use.
    if threads <= 1 || files.len() <= 1 {
        for file in files {
            lint_file(file, cli, linter, rules, out);
        }

        return;
    }

    // `.div_ceil(..)` rounds up, so the chunks cover every file rather than
    // leaving a remainder for nobody.
    let chunk_size = files.len().div_ceil(threads);

    // What:     `std::thread::scope(..)` starts threads GUARANTEED to finish
    //           before it returns, which is what lets them borrow `linter` and
    //           `rules` rather than needing owned copies behind an `Arc`.
    //           Threads spawned any other way could outlive those borrows, and
    //           Rust rejects that at compile time.
    // Why:      No locking and no reference counting, because nothing is shared
    //           mutably: each thread writes only into its own vector.
    let collected: Vec<Vec<Diagnostic>> = std::thread::scope(|scope| {
        let handles: Vec<_> = files
            .chunks(chunk_size)
            .map(|chunk| {
                return scope.spawn(move || {
                    let mut local = Vec::new();
                    for file in chunk {
                        lint_file(file, cli, linter, rules, &mut local);
                    }

                    return local;
                });
            })
            .collect();

        return handles
            .into_iter()
            .map(|handle| {
                // `.unwrap_or_default()` covers a worker that panicked: the run
                // continues with that chunk's findings missing, rather than the
                // whole process dying on a poisoned join.
                return handle.join().unwrap_or_default();
            })
            .collect();
    });

    for chunk in collected {
        out.extend(chunk);
    }
}

// What:     `fn load_linter_config(cli: &Cli) -> Result<LinterConfig, String>`.
//           Returns the merged, glob-compiled configuration, or a message
//           describing why it could not be built.
// Why:      Three layers stack here, and the order is the whole behaviour: the
//           built-in defaults compiled into the core crate sit at the bottom,
//           then whatever configuration governs the working directory, then an
//           explicit `--config` if one was given. Nearer always wins.
//
// In TS you'd write (pseudocode):
// ```ts
// function loadLinterConfig(cli: Cli): LinterConfig // throws a message string
// ```
/// Build the merged configuration governing this run.
fn load_linter_config(cli: &Cli) -> Result<LinterConfig, String> {
    // Layer 1: the policy compiled into the binary, so a checkout with no
    // configuration behaves exactly as the hardcoded predicates used to.
    let mut merged = default_config();

    // Layer 2: discovered files, unless the user asked for exactly one config.
    // `.is_none()` is true when the `Option` holds no value, meaning no
    // `--config` was passed.
    if cli.config.is_none() && !cli.disable_nested_config {
        // `.map_err(|error| error.to_string())?` turns the typed load failure
        // into the message string this function promises, then propagates it.
        let discovered = load_for(Path::new("."), None).map_err(|error| return error.to_string())?;
        merged = merge(merged, discovered);
    }

    // Layer 3: an explicit `--config`, which wins over everything.
    // `if let Some(path) = &cli.config` borrows the inner value when present.
    if let Some(path) = &cli.config {
        let explicit = load_file(Path::new(path)).map_err(|error| return error.to_string())?;
        merged = merge(merged, explicit);
    }

    // Compiling the globs is the last step, and the first place a malformed
    // pattern is noticed.
    // `.map(..)` runs only on success, attaching the ordered command-line flags
    // to the compiled configuration so resolution applies them last.
    return LinterConfig::compile(merged)
        .map(|compiled| return compiled.with_cli_overrides(cli.severity_overrides.clone()))
        .map_err(|error| return format!("invalid glob in config: {error}"));
}


// What:     `fn resolve_max_lines(override_value: Option<usize>, options:
//           Option<&toml::Table>) -> usize`. Two optional inputs, one definite
//           answer.
// Why:      Precedence has to live in exactly one place. `--max` beats a
//           configured `max`, which beats the built-in default. Before this
//           existed, clap filled `--max` with 300 on every run, so an explicit
//           `max` in a config file parsed, resolved, and was then silently
//           ignored by the rule.
//
// In TS you'd write (pseudocode):
// ```ts
// function resolveMaxLines(overrideValue?: number, options?: TomlTable): number
// ```
/// Resolve the code-line budget from the flag, the config, then the default.
fn resolve_max_lines(override_value: Option<usize>, options: Option<&toml::Table>) -> usize {
    // An explicit flag wins outright.
    if let Some(value) = override_value {
        return value;
    }

    // `.and_then(..)` chains lookups that may each come back absent: the table,
    // then the `max` key, then its integer form. Any absence short-circuits to
    // `None` and falls through to the default below.
    let configured = options
        .and_then(|table| return table.get("max"))
        .and_then(toml::Value::as_integer);

    if let Some(value) = configured {
        // A negative or absurd budget is a config error, not a reason to panic.
        // `try_into()` answers a `Result`, and `.unwrap_or(..)` falls back to the
        // default rather than crashing on a value that cannot be a count.
        return usize::try_from(value).unwrap_or_else(|_| return Config::with_defaults().max_lines);
    }

    return Config::with_defaults().max_lines;
}



// What:     `fn fix_ceiling(cli: &Cli) -> Option<FixKind>`. Resolves the three
//           fix flags into one ceiling, absent when none was passed.
// Why:      The flags are cumulative in trust rather than exclusive:
//           `--fix-dangerously` implies everything `--fix` would do. Deciding
//           that here means the applier only ever sees one ceiling.
//
// In TS you'd write (pseudocode):
// ```ts
// function fixCeiling(cli: Cli): FixKind | undefined
// ```
/// Resolve how much trust this run's repairs need, absent when not fixing.
fn fix_ceiling(cli: &Cli) -> Option<FixKind> {
    if cli.fix_dangerously {
        return Some(FixKind::Dangerous);
    }

    if cli.fix_suggestions {
        return Some(FixKind::Suggestion);
    }

    if cli.fix {
        return Some(FixKind::Safe);
    }

    return None;
}

// What:     `fn fix_file(..) -> usize`. Rewrites one file until no further
//           repair applies, returning how many were applied in total.
// Why:      Repairs cascade: fixing one problem can reveal another the same rule
//           now reports. A single pass would leave the file half repaired, and
//           the user would have to run the linter again to find out.
//
// In TS you'd write (pseudocode):
// ```ts
// function fixFile(path, cli, linter, rules, ceiling): number
// ```
/// Repair one file repeatedly until it stops changing.
fn fix_file(
    path: &str,
    cli: &Cli,
    linter: &LinterConfig,
    rules: &[Box<dyn Rule>],
    ceiling: FixKind,
) -> usize {
    let mut total = 0;

    // `0..MAX_PASSES` is a bounded loop: two rules that undo each other would
    // otherwise spin forever, and a linter that hangs is worse than one that
    // leaves a file imperfectly repaired.
    for _pass in 0..MAX_PASSES {
        let mut findings = Vec::new();
        lint_file(path, cli, linter, rules, &mut findings);

        let Ok(source) = fs::read_to_string(path) else {
            return total;
        };

        let outcome = apply_fixes(&source, &findings, ceiling);
        if outcome.applied == 0 {
            return total;
        }

        // Written only once the whole pass succeeded, so a file is never left
        // holding a partially applied set of repairs.
        if fs::write(path, &outcome.source).is_err() {
            tracing::warn!(path, "cannot write repaired file");
            return total;
        }

        total += outcome.applied;
    }

    return total;
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
fn lint_file(
    path: &str,
    cli: &Cli,
    linter: &LinterConfig,
    rules: &[Box<dyn Rule>],
    out: &mut Vec<Diagnostic>,
) {
    // What:     `if linter.is_ignored(Path::new(path)) { return; }`. Checks the
    //           merged `ignore-patterns` globs before reading the file at all.
    // Why:      An ignored file should cost nothing, not be parsed and then
    //           discarded rule by rule.
    if linter.is_ignored(Path::new(path)) {
        return;
    }

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
    // What:     `let mut file_findings = Vec::new();` rather than pushing
    //           straight into `out`.
    // Why:      Directives are per file, and applying them needs this file's
    //           findings on their own. Pushing into the shared buffer first
    //           would mean picking them back out by index afterwards.
    let mut file_findings: Vec<Diagnostic> = Vec::new();

    for rule in rules {
        // What:     `let resolved = linter.resolve(..)`. Asks the merged config
        //           what severity this rule runs at for THIS file, walking the
        //           category default, the `rules` table, and every matching
        //           `overrides` entry in order.
        // Why:      This is where the two deleted exemption predicates went. A
        //           rule that is off for this path never runs, which is both
        //           cheaper and the only way a user can change the answer.
        let resolved = linter.resolve(Path::new(path), rule.plugin(), rule.id(), rule.category());

        // `.is_enabled()` is false only for `Off`, so a warn-level rule still runs.
        if !resolved.severity.is_enabled() {
            continue;
        }

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
        // What:     `let config = Config { max_lines: resolve_max_lines(..) };`.
        //           Built per rule per file, not once per run.
        // Why:      A rule's options come from whichever config layer won for
        //           THIS path, and `overrides` can give one directory a different
        //           budget than another. A single config built up front could not
        //           express that.
        let config = Config {
            max_lines: resolve_max_lines(cli.max_lines, resolved.options.as_ref()),
        };

        // What:     `let before = out.len();` then re-reading the slice after
        //           `check`. Records how many findings existed beforehand, so
        //           the ones this rule just added can be identified by position.
        // Why:      The rule hardcodes a severity it cannot know: whether this
        //           finding is a warning or an error is a configuration answer,
        //           resolved above. Stamping it here means no rule has to
        //           remember, and none can get it wrong.
        let before = file_findings.len();

        rule.check(&context, &config, &mut file_findings);

        // `.as_diagnostic()` is absent only for `Off`, and an off rule never
        // reaches here, so anything absent would be a resolution bug rather
        // than a state to paper over.
        if let Some(reported) = resolved.severity.as_diagnostic() {
            // `&mut file_findings[before..]` borrows just the new tail mutably.
            for diagnostic in &mut file_findings[before..] {
                diagnostic.severity = reported;
            }
        }
    }

    // What:     `let directives = parse_directives(&context);` then applying
    //           them. Parsing walks the file's COMMENT tokens, not its lines.
    // Why:      The lexer is what tells a real comment from the same characters
    //           inside a string literal, so a directive spelled inside a string
    //           cannot silence anything.
    let directives = parse_directives(&context);

    // The closure answers whether a rule permits suppression at all. It is
    // built here because the rule registry lives in this crate, while the
    // applier lives in core and must not depend on it.
    let suppressible = |plugin: &str, rule_id: &str| {
        return rules
            .iter()
            .find(|rule| return rule.plugin() == plugin && rule.id() == rule_id)
            .is_some_and(|rule| return rule.allows_suppression());
    };

    let outcome = apply(
        &directives,
        file_findings,
        path,
        unused_directive_severity(cli, linter),
        &suppressible,
    );

    out.extend(outcome.kept);
    out.extend(outcome.directive_problems);
}

// What:     `fn unused_directive_severity(cli: &Cli, linter: &LinterConfig) ->
//           Option<RuleSeverity>`. Resolves the two flags and the config option
//           into one answer, absent when unused directives are not reported.
// Why:      Three inputs can turn this on, and deciding it in one place is what
//           keeps their precedence legible.
//
// In TS you'd write (pseudocode):
// ```ts
// function unusedDirectiveSeverity(cli: Cli, linter: LinterConfig): RuleSeverity | undefined
// ```
/// Resolve whether, and at what severity, unused directives are reported.
fn unused_directive_severity(cli: &Cli, linter: &LinterConfig) -> Option<RuleSeverity> {
    // The severity-carrying flag wins, and an unparseable value is treated as
    // absent rather than silently defaulting to some severity.
    if let Some(text) = &cli.report_unused_disable_directives_severity {
        return RuleSeverity::parse(text);
    }

    // The bare flag reports at warning level, matching oxlint.
    if cli.report_unused_disable_directives {
        return Some(RuleSeverity::Warn);
    }

    // Otherwise the configured option decides, and says nothing by default.
    return linter.options.report_unused_disable_directives;
}
