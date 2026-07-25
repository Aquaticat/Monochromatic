//! Runtime settings handed to rules, and the configuration layer behind them.

/// Severity overrides accumulated from the command line.
pub mod cli_override;
/// The shape of one `rust-linter.toml` on disk.
pub mod file;
/// Reading configuration from disk, resolving `extends` and nested discovery.
pub mod load;
/// Merging configurations and resolving one rule against one file.
pub mod resolve;

/// Imports the default configuration text compiled into the binary.
use crate::config::file::ConfigFile;

// What:     `const DEFAULT_CONFIG: &str = include_str!("../default.toml");`.
//           `include_str!` is a macro, marked by its `!`, that reads a file AT
//           COMPILE TIME and embeds its text in the binary. The path is relative
//           to this source file, not to the working directory.
// Why:      The built-in policy has to ship inside the binary, so a checkout with
//           no configuration behaves exactly as the hardcoded predicates used to.
//           Writing it as TOML rather than as Rust means the defaults are stated
//           in the same language a user would override them in.
//
// In TS you'd write (pseudocode):
// ```ts
// import DEFAULT_CONFIG from "../default.toml" with { type: "text" };
// ```
/// Built-in configuration applied beneath every discovered file.
const DEFAULT_CONFIG: &str = include_str!("../default.toml");

// What:     `pub struct Config { .. }` is what a rule receives: the settings that
//           apply to the file being linted right now.
// Why:      Rules should not have to resolve globs or walk override lists; the
//           runner does that once and hands down the answer.
//
// In TS you'd write (pseudocode):
// ```ts
// type Config = { maxLines: number };
// ```
/// Runtime settings shared by all lint rules.
pub struct Config {
    /// Maximum nonblank, noncomment Rust code lines allowed per enforced file.
    pub max_lines: usize,
}

/// Constructors for runtime linter settings.
impl Config {
    /// Build repository-default linter settings.
    pub fn with_defaults() -> Self {
        // 300 code lines, blanks and comments already excluded, is the same
        // budget oxlint's eslint/max-lines enforces for TypeScript here.
        return Self { max_lines: 300 };
    }
}

// What:     `pub fn default_config() -> ConfigFile`. Parses the embedded TOML.
// Why:      Every entry point needs the built-in policy as its bottom layer.
// Gotcha:   This panics rather than returning a `Result`, because the text is
//           compiled in: a parse failure is a bug in this crate that every run
//           would hit, not a user error some runs would. Failing loudly at the
//           first call is better than threading an impossible error everywhere.
//
// In TS you'd write (pseudocode):
// ```ts
// function defaultConfig(): ConfigFile { return parseToml(DEFAULT_CONFIG); }
// ```
/// Parse the built-in configuration compiled into this binary.
pub fn default_config() -> ConfigFile {
    // `.expect("message")` unwraps the success value or panics with that text.
    return toml::from_str(DEFAULT_CONFIG)
        .expect("the built-in default.toml must parse; this is a bug in this crate");
}

/// Unit tests for command-line severity overrides.
#[cfg(test)]
mod cli_override_tests;
/// Unit tests for configuration merging and rule resolution.
#[cfg(test)]
mod resolve_tests;
/// Unit tests for configuration loading and discovery.
#[cfg(test)]
mod load_tests;
