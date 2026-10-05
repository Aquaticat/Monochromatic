//! What: The process boundary: real arguments, working directory, standard streams and exit status.
//! Why: Everything above this module is testable with injected values; this module only connects
//! them to the operating system and makes sure no failure leaves the process without the
//! program's own explanation and one of the documented statuses.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // process.exitCode = runProcess();
//! ```

/// Import the command grammar, the injected-environment runner and output model.
use crate::{
    cli_options::CliOptions, run_command::run_command, run_failure::panic_text,
    run_finish::PROGRAM, run_output::RunOutput,
};
/// Import the argument parser trait that provides `parse`.
use clap::Parser;
/// Import stream writing and panic containment.
use std::{
    io::{ErrorKind, Write},
    panic::{PanicHookInfo, catch_unwind},
    path::PathBuf,
};

/// What: A panic hook that prints nothing.
/// Why: The default hook writes a message to standard error for every panic, including ones this
/// program catches and reports as findings. In `--stdin --fix` mode standard error carries JSONL,
/// so that extra text would corrupt the record stream. Every panic is caught and reported in the
/// program's own format instead; `--debug` keeps the default hook for its location and backtrace.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// process.on('uncaughtException', () => {}); // reporting happens where the error is caught
/// ```
fn silent_hook(_info: &PanicHookInfo<'_>) {}

/// What: Write bytes to a stream, treating a closed pipe as an ordinary end of output.
/// Why: `monochromatic-lint . | head` closes the pipe early; that is not an error worth reporting.
/// Returns false when some other write failure occurred.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function emit(stream: Writable, text: string): boolean;
/// ```
fn emit(stream: &mut dyn Write, text: &str) -> bool {
    if text.is_empty() {
        return true;
    }
    let mut outcome: std::io::Result<()> = stream.write_all(text.as_bytes());
    if outcome.is_ok() {
        outcome = stream.flush();
    }
    match outcome {
        Ok(()) => return true,
        Err(error) => return error.kind() == ErrorKind::BrokenPipe,
    }
}

/// What: Parse the real command line and run it with the real working directory and standard input.
/// Why: The argument parser prints help, version and usage errors itself and exits with 0 or 2.
/// This function takes no arguments, so it can be handed to `catch_unwind` by name, without a closure.
/// An unreadable working directory is a setup error with status 2, like any other.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function parseAndRun(): RunOutput;
/// ```
fn parse_and_run() -> RunOutput {
    let options: CliOptions = CliOptions::parse();
    if !options.debug {
        // Box::new moves the function pointer to the heap, as the hook API requires an owned callable.
        std::panic::set_hook(Box::new(silent_hook));
    }
    let cwd: PathBuf = match std::env::current_dir() {
        Ok(directory) => directory,
        Err(error) => {
            return RunOutput {
                stdout: String::new(),
                stderr: format!("{PROGRAM}: Cannot determine the working directory: {error}.\n"),
                exit_code: 2,
            };
        }
    };
    let mut stdin: std::io::StdinLock<'static> = std::io::stdin().lock();
    return run_command(&options, &cwd, &mut stdin);
}

/// What: Run the program, write both streams and return the exit status.
/// Why: A panic that escapes per-file containment is reported as an internal error with status 2,
/// never as a bare runtime abort.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function runProcess(): number;
/// ```
pub fn run_process() -> u8 {
    let attempt: Result<RunOutput, Box<dyn std::any::Any + Send>> = catch_unwind(parse_and_run);
    let output: RunOutput = match attempt {
        Ok(value) => value,
        Err(payload) => RunOutput {
            stdout: String::new(),
            stderr: format!(
                "{PROGRAM}: internal error: {}. No result was produced; rerun with --debug for the panic location.\n",
                panic_text(payload.as_ref())
            ),
            exit_code: 2,
        },
    };
    let wrote_stdout: bool = emit(&mut std::io::stdout().lock(), output.stdout.as_str());
    let wrote_stderr: bool = emit(&mut std::io::stderr().lock(), output.stderr.as_str());
    if !wrote_stdout || !wrote_stderr {
        return 2;
    }
    return output.exit_code;
}

/// Stream-writing controls stay outside release artifacts.
#[cfg(test)]
#[path = "run_process_tests.rs"]
mod tests;
