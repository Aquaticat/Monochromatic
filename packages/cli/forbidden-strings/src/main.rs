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

// What:     `fn main() -> ExitCode` is the program entry point. It
//           dispatches to `run_cli_from_env` and converts the
//           returned `Result<i32, String>` into an `ExitCode`. The
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
    //           destructures the `Result<i32, String>`. `Ok(code)`
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
    match run_cli_from_env() {
        Ok(code) => ExitCode::from(code as u8),
        Err(e) => {
            eprintln!("forbidden-strings: {}", e);
            ExitCode::from(2)
        }
    }
}
