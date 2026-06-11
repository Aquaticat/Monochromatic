//! Command-line argument parsing for the binary's launch path. The parser (which
//! file/folder paths to enqueue, and whether to auto-play) is declared here in the
//! library, not in `main.rs`, so it can be unit-tested with `clap`'s
//! `try_parse_from` without building the Slint window or starting an audio backend.

// What:     `use std::path::PathBuf;`. The OWNED filesystem path type: a heap-
//           allocated, growable path buffer. Sibling: `&Path`, a BORROWED view
//           that does not own its bytes (the `String` vs `&str` distinction, but
//           for paths).
// Why:      Each positional argument is parsed straight into an owned `PathBuf`
//           that the caller can hand to the engine, outliving this scope.
// TS map:   just a `string` path in TS.
//
// In TS you'd write (pseudocode):
// ```ts
// // no import needed; a path is just a string
// ```
use std::path::PathBuf;

// What:     `use clap::Parser;`. Brings TWO things into scope under one name: the
//           `Parser` TRAIT (whose `parse()` / `try_parse_from()` methods read the
//           arguments) and the `#[derive(Parser)]` MACRO that generates that
//           trait's implementation for our struct.
// Why:      The derive macro reads the struct below and writes the whole argv
//           scanner for us, and the trait gives `Cli::parse()` to the binary.
// TS map:   `import { Command } from "commander";` (a CLI-parsing library) plus a
//           decorator that wires a class's fields to flags.
//
// In TS you'd write (pseudocode):
// ```ts
// import { parseArgs } from "some-cli-parser";
// ```
use clap::Parser;

// What:     `#[derive(Parser, Debug, PartialEq)]` asks the compiler to auto-generate
//           three trait implementations for the struct on the next line:
//           - `Parser`: the clap-generated argv -> `Cli` parser (this is the macro
//             that replaces a hand-written argument loop).
//           - `Debug`: lets `{:?}` format a `Cli` (used by test failure messages).
//           - `PartialEq`: lets `==` / `assert_eq!` compare two `Cli` values.
//           `#[command(...)]` configures the program-level metadata clap prints in
//           `--help`: the program `name`, `version` (pulled from `CARGO_PKG_VERSION`
//           at build time), and the one-line `about`.
// Why:      Declaring the CLI as data on a struct, then deriving the parser, is the
//           whole point of adopting clap: it replaces hand-rolled argv scanning with
//           a single source of truth that also generates `--help` / `--version`.
// TS map:   like decorating a class so a CLI library builds the parser from its
//           fields: `@cli({ name: "music-player", about: "..." }) class Cli { ... }`.
//
// In TS you'd write (pseudocode):
// ```ts
// // @cli({ name: "music-player", version, about: "..." })
// // class Cli { ... }  // decorator generates the parser from the fields
// ```
#[derive(Parser, Debug, PartialEq)]
#[command(
    name = "music-player",
    version,
    about = "Minimal native music player. Enqueues the given file/folder paths (folders are scanned recursively) and loads them PAUSED unless --start-playing is passed."
)]
pub struct Cli {
    // What:     `#[arg(long = "start-playing")] pub start_playing: bool`. The
    //           `#[arg(long = "...")]` attribute tells clap this field is an OPTIONAL
    //           `--start-playing` flag (a `bool` field with no value becomes a
    //           presence flag: absent -> `false`, present -> `true`). `pub` exposes
    //           the field to the binary and the tests.
    // Why:      This flag is the ONLY way to ask a command-line launch to begin
    //           playing immediately; without it, opened paths load paused.
    // TS map:   `start_playing: boolean // from a `--start-playing` flag`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // @option("--start-playing") start_playing: boolean = false;
    // ```
    #[arg(
        long = "start-playing",
        help = "Begin playback immediately on launch instead of loading the queue paused"
    )]
    pub start_playing: bool,

    // What:     `pub paths: Vec<PathBuf>`. A field with NO `#[arg(...)]` flag attribute
    //           is a POSITIONAL argument; typed as `Vec<PathBuf>`, clap collects every
    //           positional into the vector and parses each token into a `PathBuf`.
    //           `Vec<T>` is a heap-allocated growable array; siblings: `&[T]` (a
    //           borrowed slice) and `[T; N]` (a fixed-size array).
    // Why:      The file/folder paths to enqueue; a vector because the user may pass
    //           several, and it is empty when they pass none.
    // TS map:   `paths: string[] // the bare positional arguments`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // @positional({ variadic: true }) paths: string[] = [];
    // ```
    #[arg(help = "File or folder paths to enqueue (folders are scanned recursively)")]
    pub paths: Vec<PathBuf>,
}

// What:     `#[cfg(test)] #[path = "cli_tests.rs"] mod tests;`. Pull the unit tests
//           in from the flat sibling file `cli_tests.rs` as a child module named
//           `tests`. `#[cfg(test)]` compiles it ONLY under `cargo test` / `cargo
//           nextest run`; `#[path = "..."]` overrides the default `cli/tests.rs`
//           lookup so the file can sit beside this one.
// Why:      Keep the tests next to the code without inflating this file or its
//           max-lines budget (sibling `*_tests.rs` files are linter-exempt), and let
//           them reach private items via `use super::*`.
// TS map:   `// cli_tests.rs is cli.unit.test.ts beside cli.ts`
//
// In TS you'd write (pseudocode):
// ```ts
// // import "./cli_tests"; // test runner picks it up automatically
// ```
#[cfg(test)]
#[path = "cli_tests.rs"]
mod tests;
