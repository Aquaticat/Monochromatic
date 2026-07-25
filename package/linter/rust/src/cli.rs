//! Command-line argument parsing for the `rust-linter` binary.
//!
//! Clap owns the command-line shape here, so help text, version output, flag
//! validation, and `--max` parsing come from one declaration instead of a manual
//! argv loop in `lib.rs`.

/// Imports clap's parser trait and derive macro for this CLI declaration.
// What:     `use clap::Parser;` brings TWO clap tools into scope under one name:
//           the `Parser` trait (which supplies `Cli::parse()` in `main.rs`) and
//           the `#[derive(Parser)]` macro (which generates the argv scanner for
//           the struct below). `::` is Rust's namespace separator, like `.` on an
//           imported object in TypeScript.
// Why:      The linter should delegate option parsing, help, version, and error
//           formatting to clap instead of hand-scanning raw strings.
// Gotcha:   The derive macro writes Rust code during compilation. This file keeps
//           that code generation at the CLI boundary so the rest of the linter
//           remains ordinary functions.
//
// In TS you'd write (pseudocode):
// ```ts
// import { parseArgs } from "some-cli-parser";
// ```
use clap::Parser;

/// Imports default linter settings for clap's default flag values.
// What:     `use crate::config::Config;` imports the settings struct from this
//           same crate. `crate::` means "start from this package's library root".
// Why:      The `--max` default below must share the same source of truth as the
//           run loop's normal configuration.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Config } from "./config";
// ```
use crate::config::Config;

/// Parsed command-line options for `rust-linter`.
// What:     `#[derive(Parser, Debug, PartialEq)]` asks Rust to generate three
//           implementations for `Cli`: clap's parser, debug formatting, and
//           equality. `#[command(...)]` configures clap's program metadata for
//           `--help` and `--version`. `pub struct Cli { ... }` is an exported
//           record type. Its fields are owned values, so callers can keep them
//           after parsing finishes. Siblings a TS reader might expect: a plain
//           object type with a handwritten parser, or a builder API.
// Why:      Declaring the CLI as data lets clap validate arguments and generate
//           user-facing help while the linter's run loop receives typed options.
//
// In TS you'd write (pseudocode):
// ```ts
// // @cli({ name: "rust-linter", version, about: "..." })
// export type Cli = { maxLines: number; paths: string[] };
// ```
#[derive(Parser, Debug, PartialEq)]
#[command(
    name = "rust-linter",
    version,
    about = "Lint Rust source files for Monochromatic repository conventions."
)]
pub struct Cli {
    /// Maximum nonblank, noncomment code lines allowed per file.
    // What:     `#[arg(...)] pub max_lines: usize` declares a long option named
    //           `--max` whose value is parsed as `usize`. `usize` is the unsigned
    //           integer type sized for this machine (siblings: `u32`, `u64`,
    //           `i32`, `i64`). `default_value_t = Config::with_defaults().max_lines`
    //           asks clap to use the repository default when the flag is absent.
    // Why:      The max-lines rule compares counts stored as `usize`, so parsing
    //           directly into `usize` avoids casts and rejects negative input.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // @option("--max", { default: Config.withDefaults().maxLines })
    // maxLines: number;
    // ```
    #[arg(
        long = "max",
        value_name = "LINES",
        default_value_t = Config::with_defaults().max_lines,
        help = "Maximum code lines allowed per file"
    )]
    pub max_lines: usize,

    /// Configuration file to use instead of discovering one.
    // What:     `pub config: Option<String>`. `Option<T>` says the value may be
    //           absent; clap leaves it `None` when the flag is not passed.
    //           Rust has no `null`, so absence is in the type.
    // Why:      Passing `--config` replaces discovery entirely, which is what
    //           makes a run reproducible from one named file.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // config?: string;
    // ```
    #[arg(
        short = 'c',
        long = "config",
        value_name = "FILE",
        help = "Configuration file to use instead of discovering one"
    )]
    pub config: Option<String>,

    /// Stop discovering configuration files in ancestor directories.
    // What:     `pub disable_nested_config: bool`. A flag with no value; clap
    //           sets it true when present. Its name uses snake_case here and
    //           kebab-case on the command line, which clap converts.
    // Why:      Discovery walks upward from the working directory, and a caller
    //           that wants only the built-in defaults needs a way to say so.
    #[arg(
        long = "disable-nested-config",
        help = "Do not discover configuration files in ancestor directories"
    )]
    pub disable_nested_config: bool,

    /// File or directory paths to lint.
    // What:     `#[arg(...)] pub paths: Vec<String>` declares repeated positional
    //           arguments. `Vec<String>` is an owned, growable array of owned UTF-8
    //           strings. Siblings: `&[String]` (borrowed slice) and `[String; N]`
    //           (fixed-size array). `default_value = "."` gives clap one path when
    //           the user supplies none. `num_args = 0..` means zero or more path
    //           tokens are accepted.
    // Why:      Directories and files are still expanded by the linter, but clap
    //           now owns the user-facing positional parsing and help text.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // @positional({ many: true, default: ["."] })
    // paths: string[];
    // ```
    #[arg(
        value_name = "PATH",
        default_value = ".",
        num_args = 0..,
        help = "Rust file or directory path to lint"
    )]
    pub paths: Vec<String>,
}
