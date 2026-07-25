//! The commands that report on the linter rather than lint anything.

/// Imports filesystem writes for the starter configuration.
use std::fs;
/// Imports the borrowed path type used to test for an existing config.
use std::path::Path;

/// Imports the parsed command-line options these commands read.
use crate::cli::Cli;
/// Imports the rule trait, for listing what is registered.
use crate::rule::Rule;

/// Imports the on-disk configuration shape printed by --print-config.
use monochromatic_rust_linter_core::config::file::ConfigFile;
/// Imports the file name --init writes to.
use monochromatic_rust_linter_core::config::load::CONFIG_FILE_NAME;

// What:     `pub const STARTER: &str = r#"..."#;`. A RAW string literal: the
//           `r#"` and `"#` delimiters mean no escape sequences are interpreted,
//           so backslashes and quotes inside stand for themselves.
// Why:      The starter configuration contains both quotes and a glob, and
//           escaping every one of them would make this unreadable in the source
//           as well as in the file it writes.
/// Starter configuration written by `--init`.
pub const STARTER: &str = r#"# Configuration for monochromatic-rust-linter.
# Every key is optional. See package/rust-module/rust-linter-core/README.md.

[rules]
# Severity is "off", "warn" or "error". oxlint's "allow" and "deny" are
# accepted as aliases of the first and last.
"builtin/require-rustdoc" = "error"

[rules."builtin/max-lines"]
severity = "error"
max = 300

# Turn rules off for a set of paths. Later overrides win over earlier ones.
[[overrides]]
files = ["**/*_tests.rs"]

[overrides.rules]
"builtin/max-lines" = "off"

# A declarative rule: the pattern is Rust, and META_ names a hole.
# [[pattern]]
# id      = "no-unwrap"
# match   = "META_X.unwrap()"
# fix     = 'META_X.expect("explain the invariant")'
# message = "unwrap() panics; name the invariant instead"
"#;

// What:     `pub fn print_config(merged: &ConfigFile) -> i32`. Returns the exit
//           code rather than exiting, so the caller decides.
// Why:      `--print-config` answers "what is actually in effect here", which is
//           the question a user asks when a rule fires and they cannot see why.
//           Printing the MERGED configuration, after every `extends` and nested
//           file has been folded in, is what makes it an answer rather than an
//           echo of one file.
//
// In TS you'd write (pseudocode):
// ```ts
// function printConfig(merged: ConfigFile): number
// ```
/// Print the fully merged configuration, then report the exit code.
pub fn print_config(merged: &ConfigFile) -> i32 {
    // TOML out, because TOML is what goes in. Printing JSON here would mean the
    // output could not be pasted back into a config file.
    return match crate::toml::to_string_pretty(merged) {
        Ok(text) => {
            println!("{text}");
            0
        }
        Err(error) => {
            eprintln!("rust-linter: cannot render the resolved config: {error}");
            2
        }
    };
}

// What:     `pub fn print_rules(rules: &[Box<dyn Rule>]) -> i32`.
// Why:      oxlint documents `--rules` as listing every registered rule, and its
//           own implementation prints nothing at all: both streams are empty at
//           exit 0, measured against 1.75.0. This implements the documented
//           behaviour rather than reproducing the silence.
/// List every registered rule with its plugin, category and suppressibility.
pub fn print_rules(rules: &[Box<dyn Rule>]) -> i32 {
    for rule in rules {
        // The suppressibility column is the one a reader cannot get anywhere
        // else, and it is the one that decides whether a directive will work.
        let suppression = if rule.allows_suppression() {
            "suppressible"
        } else {
            "never suppressed"
        };

        println!(
            "{}({})\t{}\t{}",
            rule.plugin(),
            rule.id(),
            rule.category().name(),
            suppression,
        );
    }

    return 0;
}

// What:     `pub fn init(cli: &Cli) -> i32`. Writes a starter configuration.
// Why:      A first config file is the hardest one to write, because nothing
//           tells the author what keys exist.
// Gotcha:   It refuses to overwrite. `--init` in a directory that already has a
//           configuration is far more likely to be a mistake than an intention,
//           and silently replacing someone's rules would be unrecoverable.
/// Write a starter configuration file, refusing to overwrite an existing one.
pub fn init(cli: &Cli) -> i32 {
    // `--config` names where to write, so `--init --config shared.toml` is how a
    // shared configuration gets started.
    let target = cli
        .config
        .clone()
        .unwrap_or_else(|| return CONFIG_FILE_NAME.to_string());

    if Path::new(&target).exists() {
        eprintln!("rust-linter: {target} already exists; not overwriting it");
        return 2;
    }

    return match fs::write(&target, STARTER) {
        Ok(()) => {
            println!("wrote {target}");
            0
        }
        Err(error) => {
            eprintln!("rust-linter: cannot write {target}: {error}");
            2
        }
    };
}
