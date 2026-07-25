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

/// Imports the ordered severity overrides rebuilt after parsing.
use monochromatic_rust_linter_core::config::cli_override::CliOverride;

// The `--max` default used to be read from `Config::with_defaults()` here.
// It is no longer a clap default at all: the flag is optional, and the fallback
// lives in `resolve_max_lines` in lib.rs, where the whole precedence chain of
// flag, then config, then built-in default is decided in one place.

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
    // What:     `pub max_lines: Option<usize>` with NO `default_value_t`.
    //           `Option` distinguishes "the user passed --max" from "the user
    //           did not", which a plain `usize` with a default cannot: clap
    //           would fill in 300 either way.
    // Why:      That distinction is the whole precedence rule. `--max` must beat
    //           a configured `max`, but an absent `--max` must not, and with a
    //           default value every run looked like an explicit 300 and silently
    //           overrode every configured budget.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // maxLines?: number;
    // ```
    #[arg(
        long = "max",
        value_name = "LINES",
        help = "Maximum code lines allowed per file (overrides config; default 300)"
    )]
    pub max_lines: Option<usize>,

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

    // What:     Three `Vec<String>` fields with `action = ArgAction::Append`, so
    //           the flag may be repeated and every occurrence is kept rather
    //           than the last winning.
    // Why:      oxlint accumulates these left to right, so `-A all -D no-unwrap`
    //           enables exactly one rule and `-D all -A no-unwrap` disables
    //           exactly one. Keeping only the last occurrence would make both
    //           mean the same thing.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // allow: string[];
    // ```
    /// Rules or categories to silence, accumulated in command-line order.
    #[arg(
        short = 'A',
        long = "allow",
        value_name = "NAME",
        action = clap::ArgAction::Append,
        help = "Allow the rule or category, suppressing the lint"
    )]
    pub allow: Vec<String>,

    /// Rules or categories to warn on, accumulated in command-line order.
    #[arg(
        short = 'W',
        long = "warn",
        value_name = "NAME",
        action = clap::ArgAction::Append,
        help = "Report the rule or category as a warning"
    )]
    pub warn: Vec<String>,

    /// Rules or categories to fail on, accumulated in command-line order.
    #[arg(
        short = 'D',
        long = "deny",
        value_name = "NAME",
        action = clap::ArgAction::Append,
        help = "Report the rule or category as an error"
    )]
    pub deny: Vec<String>,

    /// Report directives that suppress nothing.
    #[arg(
        long = "report-unused-disable-directives",
        help = "Report directive comments that suppress nothing"
    )]
    pub report_unused_disable_directives: bool,

    /// Report directives that suppress nothing, at a chosen severity.
    // What:     A second flag doing the same job as the one above, but carrying
    //           a severity. `conflicts_with` makes clap reject both at once.
    // Why:      oxlint ships exactly this pair, and says only one may be used at
    //           a time. Accepting both would leave the severity ambiguous.
    #[arg(
        long = "report-unused-disable-directives-severity",
        value_name = "SEVERITY",
        conflicts_with = "report_unused_disable_directives",
        help = "Report unused directives at a chosen severity: off, warn or error"
    )]
    pub report_unused_disable_directives_severity: Option<String>,

    /// Report only errors, hiding warnings.
    #[arg(
        long = "quiet",
        help = "Disable reporting on warnings, only errors are reported"
    )]
    pub quiet: bool,

    /// Print no diagnostics at all, exit code only.
    #[arg(long = "silent", help = "Do not display any diagnostics")]
    pub silent: bool,

    /// Make warnings fail the run.
    #[arg(
        long = "deny-warnings",
        help = "Ensure warnings produce a non-zero exit code"
    )]
    pub deny_warnings: bool,

    /// Warning count above which the run fails.
    // `Option` distinguishes an unset threshold from a threshold of zero, which
    // are different things: zero means "no warnings allowed at all".
    #[arg(
        long = "max-warnings",
        value_name = "INT",
        help = "Warning threshold above which the run exits non-zero"
    )]
    pub max_warnings: Option<usize>,

    // What:     `#[arg(skip)]` marks a field clap must NOT parse, leaving it at
    //           its type's default. It is filled in after parsing instead.
    // Why:      The three flags above interleave in argv, and their relative
    //           order IS the behaviour. clap's derive gives each field its own
    //           vector with no record of how they interleaved, so the ordered
    //           list is rebuilt from `ArgMatches::indices_of` in `parse_cli`.
    /// Severity overrides in true command-line order, filled in after parsing.
    #[arg(skip)]
    pub severity_overrides: Vec<CliOverride>,

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

// What:     `pub fn parse_cli() -> Cli`. Parses argv through clap, then fills in
//           the one field clap cannot: the interleaved order of the severity
//           flags. `Cli::command()` returns clap's builder-form command, and
//           `.get_matches()` runs it, exiting the process on `--help` or bad
//           input exactly as `Cli::parse()` would.
// Why:      `-A all -D no-unwrap` and `-D no-unwrap -A all` mean different
//           things, and clap's derive hands back one vector per flag with no
//           record of how they interleaved. `ArgMatches::indices_of` does have
//           that record, so the ordered list is rebuilt from it.
//
// In TS you'd write (pseudocode):
// ```ts
// function parseCli(): Cli { const m = command().getMatches(); /* ... */ }
// ```
/// Parse command-line arguments, including the ordered severity overrides.
pub fn parse_cli() -> Cli {
    // `CommandFactory` supplies `command()`, and `FromArgMatches` supplies
    // `from_arg_matches`. Both are traits: in Rust a method only exists on a
    // type once the trait declaring it is in scope, which is why importing them
    // is what makes the two calls below compile. Imported here rather than at
    // the top of the file because this function is their only use.
    /// Imports the clap traits supplying `command` and `from_arg_matches`.
    use clap::{CommandFactory, FromArgMatches};

    let matches = Cli::command().get_matches();

    // What:     `.unwrap_or_else(|error| error.exit())` prints clap's own
    //           message and exits the process, which is what the derive's
    //           `parse()` does internally.
    // Gotcha:   No `return` on that closure, unlike every other closure in this
    //           crate. `error.exit()` has return type `!`, Rust's "never" type,
    //           meaning it does not come back at all. Writing `return` before it
    //           makes the `return` itself unreachable, which the compiler warns
    //           about.
    let mut cli = Cli::from_arg_matches(&matches).unwrap_or_else(|error| error.exit());

    cli.severity_overrides = collect_severity_overrides(&matches);

    return cli;
}

// What:     `fn collect_severity_overrides(matches: &clap::ArgMatches) ->
//           Vec<CliOverride>`. Reads the three flags back out of clap's match
//           result together with the argv position of each occurrence.
// Why:      Position is the whole point. Sorting by it restores the order the
//           user actually typed, across all three flags.
/// Rebuild the severity flags in true command-line order.
fn collect_severity_overrides(matches: &clap::ArgMatches) -> Vec<CliOverride> {
    /// Imports the configured-severity vocabulary the flags map onto.
    use monochromatic_rust_linter_core::severity::RuleSeverity;

    // What:     An array of `(&str, RuleSeverity)` PAIRS, iterated below. A
    //           tuple groups values positionally without naming a struct.
    // Why:      The three flags differ only in which severity they set, so the
    //           reading logic is written once and driven by this table.
    let flags = [
        ("allow", RuleSeverity::Off),
        ("warn", RuleSeverity::Warn),
        ("deny", RuleSeverity::Error),
    ];

    let mut collected: Vec<(usize, CliOverride)> = Vec::new();

    for (id, severity) in flags {
        // Both lookups answer `Option`, absent when the flag never appeared.
        let values = matches.get_many::<String>(id);
        let indices = matches.indices_of(id);

        // `if let (Some(a), Some(b)) = (x, y)` destructures a tuple of two
        // `Option`s, running the block only when BOTH are present.
        if let (Some(values), Some(indices)) = (values, indices) {
            // `.zip(..)` walks two iterators in lockstep, pairing each argv
            // position with the value found there.
            for (index, value) in indices.zip(values) {
                collected.push((index, CliOverride::parse(value, severity)));
            }
        }
    }

    // `.sort_by_key(..)` orders by argv position, interleaving the three flags
    // back into the sequence the user typed.
    collected.sort_by_key(|(index, _)| return *index);

    // `.into_iter()` consumes the vector so the overrides are moved out rather
    // than copied; `.map(..)` drops the now-redundant index.
    return collected
        .into_iter()
        .map(|(_, entry)| return entry)
        .collect();
}
