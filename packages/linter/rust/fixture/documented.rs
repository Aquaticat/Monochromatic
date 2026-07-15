//! Fully documented fixture, not part of the crate build.
//!
//! Every item carries a rustdoc comment, so require-rustdoc reports nothing and
//! the linter exits zero with empty output over this file.

/// Pulled in only to exercise the `use` kind under the rule.
use std::fmt::Debug;

/// A documented constant.
const LIMIT: u8 = 10;

/// A documented struct with a documented field.
struct Config {
    /// Whether verbose output is on.
    verbose: bool,
}

/// A documented enum with a documented variant.
enum Mode {
    /// The quiet mode.
    Quiet,
}

/// A documented function.
fn run() {
    let active = true;
}
