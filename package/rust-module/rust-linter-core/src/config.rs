//! Runtime settings shared by every lint rule.

// What:     `pub struct Config { .. }` is the settings record. `usize` is the
//           pointer-wide unsigned integer, chosen over `u32`/`u64` because it is
//           a count compared against a line count, and Rust's collection APIs
//           express counts and indices as `usize`.
// Why:      Hold tunable knobs in one value the runner lends to every rule.
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
    // What:     `pub fn with_defaults() -> Self`. No `self` parameter, so this is
    //           an associated function called as `Config::with_defaults()`, which
    //           TS would call a static method. `Self` names the type being
    //           implemented.
    // Why:      One source of truth for the defaults that mirror oxlint.
    /// Build repository-default linter settings.
    pub fn with_defaults() -> Self {
        // 300 code lines, blanks and comments already excluded, is the same
        // budget oxlint's eslint/max-lines enforces for TypeScript here.
        return Self { max_lines: 300 }
    }
}
