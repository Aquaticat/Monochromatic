//! Binary entry point for the nested Wayland session fixture.
//!
//! This file owns only process startup: install the log subscriber, parse the
//! arguments, run the compositor, and translate the hosted client's exit code into
//! the process exit code. All real work lives in the library crate.

/// What:     `use std::process::ExitCode;`. `ExitCode` is the type `main` can return to
///           set the process exit status (sibling: returning `()` always exits 0).
/// Why:      The fixture propagates the hosted app's exit code, so `main` returns one.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // ExitCode ~ the number you pass to process.exit(code).
/// ```
use std::process::ExitCode;

/// What:     `use anyhow::{Context, Result};`. Error helpers; `Result` is
///           `anyhow::Result`.
/// Why:      `main` returns `Result` so any error prints and exits non-zero.
use anyhow::{Context, Result};

/// What:     `use nested_wayland_session::{parse_args, run};`. Import the library's
///           public entry points. `nested_wayland_session` is this crate's library name.
/// Why:      The binary is a thin shell over these.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { parseArgs, run } from "nested_wayland_session";
/// ```
use nested_wayland_session::{parse_args, run};

/// What:     `use tracing_subscriber::EnvFilter;`. The env-driven log-level filter.
/// Why:      Configures which log events print, from `RUST_LOG`.
use tracing_subscriber::EnvFilter;

/// Process entry: set up logging, parse arguments, run, and return the exit code.
///
/// What:     `fn main() -> Result<ExitCode>`. Returns `anyhow::Result<ExitCode>`: on
///           `Err`, the runtime prints the error and exits non-zero; on `Ok(code)`, the
///           process exits with `code`.
/// Why:      One place that turns the command line into a running compositor and the
///           app's exit code into ours.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function main(): Promise<number> { ... }
/// ```
fn main() -> Result<ExitCode> {
    // What:     `let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_|
    //           EnvFilter::new("info"));`. Read the `RUST_LOG` filter, or default to
    //           `info` if it is unset/invalid. `.unwrap_or_else(closure)` supplies the
    //           fallback lazily.
    // Why:      Sensible default verbosity, overridable via the environment.
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    // What:     `tracing_subscriber::fmt().with_env_filter(filter).with_writer(
    //           std::io::stderr).init();`. Install the global log subscriber writing to
    //           stderr (stdout is reserved for machine-readable output later).
    // Why:      Route all `tracing` events somewhere visible without polluting stdout.
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_writer(std::io::stderr)
        .init();

    // What:     `let args: Vec<String> = std::env::args().skip(1).collect();`.
    //           `env::args()` yields the program name plus arguments; `.skip(1)` drops the
    //           program name; `.collect()` gathers the rest into an owned `Vec<String>`.
    // Why:      `parse_args` wants just the arguments.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const args = process.argv.slice(2);
    // ```
    let args: Vec<String> = std::env::args().skip(1).collect();

    // What:     `let config = parse_args(&args).context("parsing command-line arguments")?;`.
    //           Parse the arguments; `?` returns the usage error (with context) on failure.
    // Why:      Fail early and clearly on bad input.
    let config = parse_args(&args).context("parsing command-line arguments")?;

    // What:     `let code = run(config)?;`. Run the compositor to completion; `?`
    //           propagates any setup/runtime error. `code` is the hosted app's exit code.
    // Why:      Do the actual work.
    let code = run(config)?;

    // What:     `Ok(ExitCode::from(code as u8))`. Convert the `i32` exit code to `u8`
    //           (the range an exit code occupies) and wrap it. Tail expression.
    // Why:      Make the process exit with the same code the hosted app did.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return code & 0xff;
    // ```
    Ok(ExitCode::from(code as u8))
}
