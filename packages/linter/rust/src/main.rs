// What:     `use monochromatic_rust_linter::run_cli_from_env;` pulls the one
//           public entry function out of this crate's library half. The crate
//           is split into a library (`src/lib.rs`, name `monochromatic_rust_linter`
//           with underscores) and this binary (`src/main.rs`). All real logic
//           lives in the library so tests can call it directly.
// Why:      So `main` below can call it; `main` itself stays a tiny shell.
// TS map:   `import { runCliFromEnv } from "./lib";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { runCliFromEnv } from "./lib";
// ```
use monochromatic_rust_linter::run_cli_from_env;

// What:     `use std::process::ExitCode;` imports the typed wrapper for an OS
//           process exit status. Returning it from `main` is the idiomatic way
//           to set the exit code.
// Why:      We translate the library's numeric return into this type.
// TS map:   No direct type; Node uses `process.exit(n)` / `process.exitCode = n`.
//
// In TS you'd write (pseudocode):
// ```ts
// // no type; just a number passed to process.exit
// ```
use std::process::ExitCode;

// What:     `fn main() -> ExitCode` is the program entry point. `-> ExitCode`
//           means it hands an exit status back to the operating system.
// Why:      Keep `main` to a few lines: call the library, convert its result
//           into an exit code.
// TS map:   TS has no entry function; imagine the whole file wrapped in
//           `async function main(): Promise<number> { ... }` that the runtime
//           auto-calls and whose return becomes `process.exit(n)`.
//
// In TS you'd write (pseudocode):
// ```ts
// async function main(): Promise<number> { /* ... */ }
// ```
fn main() -> ExitCode {
    // What:     `match run_cli_from_env() { Ok(code) => ..., Err(e) => ... }`.
    //           `run_cli_from_env` returns a `Result<i32, String>`: either the
    //           success variant `Ok` carrying an `i32` exit code, or the
    //           failure variant `Err` carrying an error message `String`.
    //           `match` inspects which variant came back and binds its payload.
    // Why:      Rust has no exceptions; functions report failure by returning
    //           `Result`. We branch on the two cases here.
    // TS map:   `try { const code = runCliFromEnv(); ... } catch (e) { ... }` —
    //           the `Ok` arm is the try body, the `Err` arm is the catch.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try { return runCliFromEnv(); } catch (e) { console.error(e); return 2; }
    // ```
    match run_cli_from_env() {
        // What:     `Ok(code) => ExitCode::from(code as u8)`. `Ok(code)` binds
        //           the inner `i32`. `code as u8` narrows that 32-bit signed
        //           integer to an 8-bit unsigned one (exit codes are a byte).
        //           `ExitCode::from(...)` builds the typed exit status.
        // Why:      Every value the library returns is 0, 1, or 2, all inside a
        //           byte, so the narrowing cast is safe in practice.
        // TS map:   `return code;` (Node clamps the number into a byte itself).
        // Gotcha:   `as u8` is a silent truncating cast in Rust; it does not
        //           throw on out-of-range like nothing in TS does either, but
        //           here the range is already guaranteed small.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return code;
        // ```
        Ok(code) => ExitCode::from(code as u8),

        // What:     `Err(e) => { eprintln!(...); ExitCode::from(2) }`. `Err(e)`
        //           binds the error message. `eprintln!` is the macro that
        //           prints a formatted line to standard error (the `!` marks it
        //           a macro, not a function). The block's tail value
        //           `ExitCode::from(2)` becomes the arm's result.
        // Why:      Surface a catastrophic failure to stderr and exit with code
        //           2, distinct from "lint violations found" (1).
        // TS map:   `console.error(`rust-linter: ${e}`); return 2;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // console.error(`rust-linter: ${e}`); return 2;
        // ```
        Err(e) => {
            eprintln!("rust-linter: {e}");
            ExitCode::from(2)
        }
    }
}
