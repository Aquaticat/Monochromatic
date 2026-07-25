//! Binary entry point for the rust-linter CLI.

/// Imports clap's parser trait so `Cli::parse()` is available in `main`.
// What:     `use clap::Parser;` brings the `Parser` trait into this binary. Rust
//           only lets trait methods such as `Cli::parse()` be called when the
//           trait is in scope. `::` is Rust's namespace separator.
// Why:      `main` should let clap read real process arguments, print help or
//           parse errors, and exit on invalid CLI input.
//
// In TS you'd write (pseudocode):
// ```ts
// import { parseArgs } from "some-cli-parser";
// ```
use clap::Parser;

/// Imports the clap-backed CLI struct from the library crate.
// What:     `use monochromatic_rust_linter::cli::Cli;` pulls the exported `Cli`
//           type out of this crate's library half. Cargo exposes the library name
//           with underscores even though the package name uses hyphens.
// Why:      The binary needs the parser declaration before it can run the linter.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Cli } from "./cli";
// ```
use monochromatic_rust_linter::cli::Cli;

/// Imports the library run loop.
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
use monochromatic_rust_linter::run_cli;

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
    // What:     `let cli = Cli::parse();` calls the clap-generated parser. `::` is
    //           Rust's namespace operator. `parse()` reads real process argv; on
    //           `--help`, `--version`, or invalid arguments, clap prints the right
    //           message and exits the process before this function continues.
    // Why:      Replace the old hand-written argv scanner with clap's parser.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const cli = parseArgs(process.argv.slice(2));
    // ```
    let cli = Cli::parse();

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
