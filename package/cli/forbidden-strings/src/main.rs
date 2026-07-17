//! main support for the forbidden-strings scanner.
/// Imports dependencies used by this module.
// What:     `use forbidden_strings::run_cli_from_env;` imports the
//           public lib entry point. The crate's library target is
//           named `forbidden_strings` (underscores; the `[[bin]]`
//           name keeps the hyphen for the on-disk binary). The lib
//           owns argv parsing, env var reads, ruleset loading, the
//           parallel scan, and stderr emission; this file just
//           translates its return into the OS exit code.
// Why:      Move every interesting branch out of `main`. Tests
//           (`tests/integration.rs`) still drive the binary as a
//           subprocess, but additional fuzz targets and unit tests
//           can now exercise `run_cli_from_env` (and the helpers it
//           re-exports through the `fuzzing` Cargo feature) without
//           spawning a child process.
//
// In TS you'd write (pseudocode):
// ```ts
// import { runCliFromEnv } from "./lib";
// ```
use forbidden_strings::run_cli_from_env;

/// Imports dependencies used by this module.
// What:     `use std::process::ExitCode;` imports the typed wrapper
//           for OS exit codes. Returning `ExitCode` from `main` is
//           the idiomatic way to set the exit status from Rust.
// Why:      We need it to translate `run_cli_from_env`'s `i32`
//           into the typed value `main` returns.
//
// In TS you'd write (pseudocode):
// ```ts
// // No type; just a number.
// ```
use std::process::ExitCode;

/// Implements `main`.
// What:     `fn main() -> ExitCode` is the program entry point. It
//           dispatches to `run_cli_from_env` and converts the
//           returned `Result<i32>` into an `ExitCode`. The
//           `Err` arm prints the catastrophic error to stderr with
//           a fixed `forbidden-strings:` prefix and exits 2; the
//           lib never produces an `Err` today (every recoverable
//           error path eprintln's and returns `Ok(2)`), but the
//           shape is reserved so future panics or unwrap-failures
//           in the lib have somewhere to surface.
// Why:      Keep `main` to a five-line wrapper so the lib is the
//           sole carrier of business logic, and tests can drive
//           every code path without spawning a subprocess.
//
// In TS you'd write (pseudocode):
// ```ts
// try { process.exit(await runCliFromEnv()); }
// catch (e) { console.error(`forbidden-strings: ${e}`); process.exit(2); }
// ```
fn main() -> ExitCode {
    // What:     `match run_cli_from_env() { Ok(code) => ..., Err(e) => ... }`
    //           destructures the `Result<i32>`. `Ok(code)`
    //           binds the inner `i32` and the arm converts it to
    //           `ExitCode::from(code as u8)` -- the cast is safe in
    //           practice because every `Ok` arm in the lib returns
    //           a value in `{0, 1, 2}`, well inside `u8` range.
    //           `Err(e)` binds the error message, prints it to
    //           stderr with the conventional prefix, and exits 2.
    // Why:      Bridge the lib's testable return shape to the OS-
    //           expected `ExitCode`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try { process.exit(code); }
    // catch (e) { console.error(`forbidden-strings: ${e}`); process.exit(2); }
    // ```
    // Install the stderr tracing subscriber (RUST_LOG, default info); scan findings stay on stdout.
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| return tracing_subscriber::EnvFilter::new("info")),
        )
        .with_writer(std::io::stderr)
        .init();
    match run_cli_from_env() {
        Ok(code) => return ExitCode::from(code as u8),
        Err(e) => {
            // eprintln, not tracing: this is the user-facing CLI error contract
            // ("forbidden-strings: <msg>" on stderr) that integration tests assert; a tracing
            // event's target and level prefix would break that contract. The tracing subscriber
            // installed above carries the compiler's rule-rejection warnings instead.
            eprintln!("forbidden-strings: {}", e);
            return ExitCode::from(2)
        }
    }
}
