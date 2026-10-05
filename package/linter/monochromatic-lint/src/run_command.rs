//! What: Turn parsed command options into output bytes and an exit status.
//! Why: This is the one place the pieces meet: discovery, per-file planning, bounded workers,
//! output routing and exit accounting. It takes the working directory and standard input as
//! arguments, so tests drive the exact production path without touching process state.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // runCommand(options, cwd, stdin) -> { stdout, stderr, exitCode }
//! ```

/// Import the command grammar and its collaborators.
use crate::cli_options::CliOptions;
use crate::diagnostic::Diagnostic;
use crate::file_discovery::DiscoveryOptions;
use crate::path_inputs::collect_inputs;
use crate::run_file::{FileOutcome, SourceOutcome};
use crate::run_lfs::LfsRepos;
use crate::run_modes::{SetupError, init_configuration, print_configuration, rules_listing};
use crate::run_output::{OutputOptions, RunOutput, run_output};
use crate::run_paths::{display_name, language_of};
use crate::run_plan::{ConfigStore, FilePlan, Planned};
use crate::run_workers::{contained_source, process_plans};
use crate::rust_file_engine::RustFileEngine;
use crate::rust_workspace::WorkspacePreparation;
/// Import the reader trait for standard input and native paths.
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

/// What: The prefix of every non-finding line this program writes to standard error.
/// Why: A consumer can separate program messages from JSONL records by this prefix.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const PROGRAM = 'monochromatic-lint';
/// ```
pub const PROGRAM: &str = "monochromatic-lint";

/// What: Discard semantic-workspace progress messages.
/// Why: The engine takes a plain function pointer; without `--debug` progress is not shown.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function silentProgress(_message: string): void {}
/// ```
fn silent_progress(_message: String) {}

/// What: Write semantic-workspace progress to standard error as it happens.
/// Why: Loading a Cargo workspace can take a while; `--debug` shows that it is working.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function debugProgress(message: string): void { console.error(`monochromatic-lint: debug: ${message}`); }
/// ```
fn debug_progress(message: String) {
    // A closed standard error has nowhere left to report its own failure, so the result is unused.
    let _unreportable: std::io::Result<()> =
        writeln!(std::io::stderr(), "{PROGRAM}: debug: {message}");
}

/// What: Render collected debug notes as prefixed standard-error lines.
/// Why: Debug information stays off standard output, which carries only JSONL or fixed source.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function debugLines(notes: string[]): string;
/// ```
fn debug_lines(notes: &[String]) -> String {
    let mut output: String = String::new();
    for note in notes {
        output.push_str(format!("{PROGRAM}: debug: {note}\n").as_str());
    }
    return output;
}

/// What: Collect the output controls from the command options.
/// Why: Quiet, silent and the warning limit affect display and exit status only, never linting.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function outputOptions(options: CliOptions): OutputOptions;
/// ```
fn output_options(options: &CliOptions) -> OutputOptions {
    return OutputOptions {
        quiet: options.quiet,
        silent: options.silent,
        max_warnings: options.max_warnings,
    };
}

/// What: Route findings and add debug notes to standard error when requested.
/// Why: Every lint mode ends the same way; only the presence of fixed standard-input source differs.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function finish(options, findings, fixedStdin, notes): RunOutput;
/// ```
fn finish(
    options: &CliOptions,
    findings: &[Diagnostic],
    fixed_stdin: Option<&str>,
    notes: &[String],
) -> Result<RunOutput, SetupError> {
    let mut output: RunOutput = match run_output(findings, fixed_stdin, output_options(options)) {
        Ok(routed) => routed,
        Err(error) => return Err(SetupError::from_display(&error)),
    };
    if options.debug {
        output.stderr.push_str(debug_lines(notes).as_str());
    }
    return Ok(output);
}

/// What: Create the invocation's semantic engine without opening any workspace.
/// Why: A workspace is loaded only when a selected rule needs it. Source-only preparation never
/// runs build scripts; no command-line option requests generated-source preparation yet.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function engine(debug: boolean): RustFileEngine;
/// ```
fn engine(debug: bool) -> RustFileEngine {
    if debug {
        return RustFileEngine::new(WorkspacePreparation::SourceOnly, debug_progress);
    }
    return RustFileEngine::new(WorkspacePreparation::SourceOnly, silent_progress);
}

/// What: Lint one source read from standard input as if it lived at `--stdin-filename`.
/// Why: The caller owns the bytes it commits: no file is read for content or written. With
/// `--fix` the (possibly unchanged) source goes to standard output and findings to standard error.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function runStdin(options, store, stdin): RunOutput;
/// ```
fn run_stdin(
    options: &CliOptions,
    store: &mut ConfigStore,
    stdin: &mut dyn Read,
) -> Result<RunOutput, SetupError> {
    let filename: &Path = options
        .stdin_filename
        .as_deref()
        .expect("the command grammar requires --stdin-filename with --stdin");
    if language_of(filename).is_none() {
        return Err(SetupError {
            message: format!(
                "Standard input filename {} must end in .rs, .md or .mdx.",
                filename.display()
            ),
        });
    }
    let mut bytes: Vec<u8> = Vec::<u8>::new();
    if let Err(error) = stdin.read_to_end(&mut bytes) {
        return Err(SetupError {
            message: format!("Cannot read standard input: {error}."),
        });
    }
    let source: String = match String::from_utf8(bytes) {
        Ok(text) => text,
        Err(error) => {
            return Err(SetupError {
                message: format!(
                    "Standard input is not valid UTF-8 (first invalid byte at offset {}).",
                    error.utf8_error().valid_up_to()
                ),
            });
        }
    };
    let planned: Planned = match store.plan(filename) {
        Ok(value) => value,
        Err(error) => return Err(SetupError::from_display(&error)),
    };
    let mut findings: Vec<Diagnostic> = Vec::<Diagnostic>::new();
    let mut notes: Vec<String> = Vec::<String>::new();
    let mut result: String = source.clone();
    match planned {
        Planned::Lint(plan) => {
            let lfs: LfsRepos = LfsRepos::new();
            let mut semantic: RustFileEngine = engine(options.debug);
            let outcome: SourceOutcome = contained_source(
                &plan,
                source.as_str(),
                options.fix,
                &lfs,
                Some(&mut semantic),
            );
            findings = outcome.findings;
            notes = outcome.notes;
            if let Some(fixed) = outcome.fixed {
                result = fixed;
            }
        }
        Planned::Ignored => notes.push(format!("{}: ignored by configuration", filename.display())),
        Planned::NoConfiguration => {
            return Err(SetupError {
                message: format!(
                    "No {} governs standard input filename {}. Create one with --init or pass --config.",
                    crate::config_lookup::CONFIG_NAME,
                    filename.display()
                ),
            });
        }
        Planned::Unsupported => {}
    }
    if options.fix {
        return finish(
            options,
            findings.as_slice(),
            Some(result.as_str()),
            notes.as_slice(),
        );
    }
    return finish(options, findings.as_slice(), None, notes.as_slice());
}

/// What: Plan every discovered file, separating lintable plans from skipped inputs.
/// Why: All configuration errors surface here, before any file is linted or rewritten.
/// The count returned is how many files had no configuration file at all.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function planFiles(store, cwd, files, notes): { plans: FilePlan[]; unconfigured: number };
/// ```
fn plan_files(
    store: &mut ConfigStore,
    cwd: &Path,
    files: &[PathBuf],
    notes: &mut Vec<String>,
) -> Result<(Vec<FilePlan>, usize), SetupError> {
    let mut plans: Vec<FilePlan> = Vec::<FilePlan>::new();
    let mut without_configuration: usize = 0;
    for file in files {
        let planned: Planned = match store.plan(file) {
            Ok(value) => value,
            Err(error) => return Err(SetupError::from_display(&error)),
        };
        match planned {
            Planned::Lint(plan) => plans.push(*plan),
            Planned::Ignored => {
                notes.push(format!(
                    "{}: ignored by configuration",
                    display_name(file, cwd)
                ));
            }
            Planned::NoConfiguration => {
                without_configuration += 1;
                notes.push(format!(
                    "{}: no configuration file in its directory or any ancestor",
                    display_name(file, cwd)
                ));
            }
            Planned::Unsupported => {}
        }
    }
    return Ok((plans, without_configuration));
}

/// What: Lint or fix the files named by path arguments, defaulting to the working directory.
/// Why: Discovery, planning, processing and routing run in that order so that setup errors never
/// follow a rewritten file.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function runPaths(options, cwd, store): RunOutput;
/// ```
fn run_paths(
    options: &CliOptions,
    cwd: &Path,
    store: &mut ConfigStore,
) -> Result<RunOutput, SetupError> {
    let mut ignore_paths: Vec<PathBuf> = Vec::<PathBuf>::new();
    for path in &options.ignore_paths {
        // Ignore files resolve against the invocation directory, not the process's own.
        ignore_paths.push(cwd.join(path));
    }
    let discovery: DiscoveryOptions = DiscoveryOptions {
        cwd: cwd.to_path_buf(),
        no_ignore: options.no_ignore,
        ignore_patterns: options.ignore_patterns.clone(),
        ignore_paths,
    };
    let files: Vec<PathBuf> = match collect_inputs(
        options.paths.as_slice(),
        &discovery,
        options.no_error_on_unmatched_pattern,
    ) {
        Ok(found) => found,
        Err(error) => return Err(SetupError::from_display(&error)),
    };
    let mut notes: Vec<String> = vec![format!("discovered {} supported file(s)", files.len())];
    let (plans, without_configuration): (Vec<FilePlan>, usize) =
        plan_files(store, cwd, files.as_slice(), &mut notes)?;
    if !files.is_empty() && without_configuration == files.len() {
        return Err(SetupError {
            message: format!(
                "No {} was found for any of the {} input file(s). Create one with --init or pass --config.",
                crate::config_lookup::CONFIG_NAME,
                files.len()
            ),
        });
    }
    let concurrency: usize = match options.concurrency {
        Some(limit) => limit.get(),
        None => match std::thread::available_parallelism() {
            Ok(available) => available.get(),
            Err(_) => 1,
        },
    };
    notes.push(format!(
        "linting {} file(s) with a concurrency limit of {concurrency}",
        plans.len()
    ));
    let lfs: LfsRepos = LfsRepos::new();
    let mut semantic: RustFileEngine = engine(options.debug);
    let outcomes: Vec<FileOutcome> = process_plans(
        plans.as_slice(),
        options.fix,
        &lfs,
        concurrency,
        &mut semantic,
    );
    let mut findings: Vec<Diagnostic> = Vec::<Diagnostic>::new();
    let mut written: usize = 0;
    for outcome in outcomes {
        findings.extend(outcome.findings);
        notes.extend(outcome.notes);
        if outcome.written {
            written += 1;
        }
    }
    notes.push(format!(
        "rewrote {written} file(s); loaded {} Cargo workspace(s)",
        semantic.workspace_count()
    ));
    return finish(options, findings.as_slice(), None, notes.as_slice());
}

/// What: Select and run the requested mode.
/// Why: The command grammar already rejects conflicting modes; each remaining mode returns its
/// own complete output.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function execute(options, cwd, stdin): RunOutput; // throws SetupError
/// ```
fn execute(
    options: &CliOptions,
    cwd: &Path,
    stdin: &mut dyn Read,
) -> Result<RunOutput, SetupError> {
    if !cwd.is_absolute() {
        return Err(SetupError {
            message: String::from("The working directory must be an absolute path."),
        });
    }
    let mut output: RunOutput = RunOutput {
        stdout: String::new(),
        stderr: String::new(),
        exit_code: 0,
    };
    if options.rules {
        output.stdout = rules_listing()?;
        return Ok(output);
    }
    if options.init {
        let created: PathBuf = init_configuration(cwd)?;
        output.stdout = format!("{}\n", created.display());
        return Ok(output);
    }
    let mut store: ConfigStore = match ConfigStore::new(cwd, options.config.as_deref()) {
        Ok(value) => value,
        Err(error) => return Err(SetupError::from_display(&error)),
    };
    if let Some(path) = &options.print_config {
        match print_configuration(&mut store, cwd, path) {
            Ok(text) => output.stdout = text,
            Err(error) => return Err(SetupError::from_display(&error)),
        }
        return Ok(output);
    }
    if options.stdin {
        return run_stdin(options, &mut store, stdin);
    }
    return run_paths(options, cwd, &mut store);
}

/// What: Run one invocation and always return output, converting a setup failure to status 2.
/// Why: A setup or usage error prints one prefixed line on standard error and nothing on standard output.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function runCommand(options: CliOptions, cwd: Path, stdin: Readable): RunOutput;
/// ```
pub fn run_command(options: &CliOptions, cwd: &Path, stdin: &mut dyn Read) -> RunOutput {
    match execute(options, cwd, stdin) {
        Ok(output) => return output,
        Err(error) => {
            return RunOutput {
                stdout: String::new(),
                stderr: format!("{PROGRAM}: {}\n", error.message),
                exit_code: 2,
            };
        }
    }
}

/// Whole-invocation controls stay outside release artifacts.
#[cfg(test)]
#[path = "run_command_tests.rs"]
mod tests;
