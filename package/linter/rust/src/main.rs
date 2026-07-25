//! Binary entry point for the rust-linter CLI.

// What:     Neither `clap::Parser` nor `Cli` is imported here any more.
// Why:      `main` used to call `Cli::parse()`, which needs the `Parser` trait in
//           scope. It now calls `parse_cli()`, which runs the same clap parse and
//           additionally records the order the -A/-W/-D flags appeared in. Going
//           through `Cli::parse()` here left that ordering empty, so every
//           severity flag the user passed was silently ignored.

// What:     `use monochromatic_rust_linter::run_cli;` pulls in the function that
//           lints files after clap has parsed arguments. Keeping the run loop in
//           the library lets tests and other callers exercise it without starting
//           a separate process.
// Why:      `main` stays a tiny adapter: parse arguments, run lints, translate the
//           result into an OS exit code.
//
// In TS you'd write (pseudocode):
// ```ts
// import { runCli } from "./lib";
// ```
/// Imports the library run loop.
use monochromatic_rust_linter::run_cli;

/// Imports the argv parser that also records severity-flag ordering.
use monochromatic_rust_linter::cli::parse_cli;

/// Imports Rust's typed process exit status.
// What:     `use std::process::ExitCode;` imports the standard wrapper around an
//           operating-system exit status. Returning it from `main` sets the
//           process code without calling `process::exit` directly.
// Why:      The linter reports 0 for clean files and 1 for lint violations, while
//           clap itself exits 2 for invalid command-line input.
//
// In TS you'd write (pseudocode):
// ```ts
// // no type; return or assign a numeric process exit code
// ```
use std::process::ExitCode;

/// Program entry point for the `rust-linter` binary.
// What:     `fn main() -> ExitCode` is the function the operating system calls
//           when the binary starts. `-> ExitCode` means it returns the typed exit
//           status described above.
// Why:      Keep all command-line parsing at the boundary and all lint behaviour
//           in the library.
//
// In TS you'd write (pseudocode):
// ```ts
// async function main(): Promise<number> { /* ... */ }
// ```
fn main() -> ExitCode {
    // Install the stderr tracing subscriber (RUST_LOG, default info) so the linter's own
    // diagnostics never mix with the lint findings printed to stdout.
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| return tracing_subscriber::EnvFilter::new("info")),
        )
        .with_writer(std::io::stderr)
        .init();
    // What:     `let cli = parse_cli();` runs clap's parser and then fills in the
    //           one field clap cannot supply. Reading real process argv, it
    //           prints and exits on `--help`, `--version`, or invalid arguments
    //           before this function continues.
    // Why:      `parse_cli` rather than `Cli::parse`, because the interleaved
    //           order of the -A/-W/-D flags is behaviour, and clap's derive does
    //           not record it. Going through `Cli::parse()` here left that field
    //           empty, so every severity flag the user passed was ignored.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const cli = parseCli();
    // ```
    let cli = parse_cli();

    // What:     `let code = run_cli(&cli);` lends the parsed options to the library
    //           run loop. The `&` means read-only borrow: `main` keeps ownership,
    //           while `run_cli` can inspect the values.
    // Why:      The library decides whether lint findings make the process fail.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const code = runCli(cli);
    // ```
    let code = run_cli(&cli);

    // What:     `ExitCode::from(code as u8)` converts the library's signed integer
    //           into the byte-sized exit-code wrapper. `as u8` is a narrowing cast,
    //           and `ExitCode::from(...)` constructs the wrapper.
    // Why:      The library returns only 0 or 1, both valid process exit-code bytes.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return code;
    // ```
    return ExitCode::from(code as u8)
}
