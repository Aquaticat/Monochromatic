//! Linter test input, not part of the crate build.
//!
//! It has exactly three code lines (comments and blanks do not count): the `fn`
//! signature line, the `let` line, and the closing brace. The `//!` here and the
//! `///` below also keep it clean for the require-rustdoc rule, so the only
//! finding it can produce is from max-lines at a tiny budget.

/// A sample function used only as linter input.
fn sample() {
    let value = 1;
}
