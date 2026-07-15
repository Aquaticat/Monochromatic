//! Configuration defaults and path-based lint exemptions.

// What:     `use std::path::{Component, Path};` imports two standard-library
//           types for filesystem paths:
//             - `Path`: a borrowed, OS-aware path (sibling: owned `PathBuf`).
//             - `Component`: one piece of a path when you iterate it; its
//               variants include `Normal(&OsStr)` for an ordinary name segment.
// Why:      The exemption check inspects path segments and the file name.
//
// In TS you'd write (pseudocode):
// ```ts
// import path from "node:path";
// ```
/// Imports filesystem path types used by exemption predicates.
use std::path::{Component, Path};

// What:     `pub struct Config { pub max_lines: usize }` is the linter's settings
//           record. `usize` is the pointer-wide unsigned integer (siblings:
//           `u32`/`u64`); used because it is a count compared against a line
//           count.
// Why:      Hold tunable knobs; today just the per-file code-line budget.
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

// What:     `impl Config { ... }` attaches a constructor of default settings.
// Why:      One source of truth for the defaults that mirror oxlint.
//
// In TS you'd write (pseudocode):
// ```ts
// function withDefaults(): Config { return { maxLines: 300 }; }
// ```
/// Constructors for runtime linter settings.
impl Config {
    // What:     `pub fn with_defaults() -> Self`. Returns a fresh `Config` (no
    //           `self` parameter, so it is an associated function / static method).
    // Why:      Default the budget to 300, matching oxlint's eslint/max-lines.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // static withDefaults(): Config { return { maxLines: 300 }; }
    // ```
    /// Build repository-default linter settings.
    pub fn with_defaults() -> Self {
        // What:     `Self { max_lines: 300 }`. Builds the struct; the literal 300
        //           is the budget. Tail expression, so it is returned.
        // Why:      300 code lines (blanks and comments already excluded) is the
        //           same generous budget oxlint uses for TypeScript.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { maxLines: 300 };
        // ```
        Self { max_lines: 300 }
    }
}

// What:     `pub fn max_lines_exempt(path: &Path) -> bool`. Borrows a path
//           read-only and answers whether the max-lines rule should skip it.
// Why:      Mirror oxlint's overrides that turn max-lines OFF for test, fixture,
//           and config-equivalent files. Here: integration tests (`tests/`),
//           the repo's unit-test module convention (`*_tests.rs`), fuzz harnesses
//           (`fuzz/`), the cargo build script (`build.rs`), and the linter's own
//           deliberate samples under a `fixture/`, `fixture/`, `test-fixture/`,
//           or `invalid/` directory (matching oxlint's `ignorePatterns` globs
//           `**/fixture/**`, `**/fixture/**`, `**/test-fixture/**`,
//           `**/invalid/**`). (`target/` never reaches us; the file walker already
//           drops gitignored paths.)
//
// In TS you'd write (pseudocode):
// ```ts
// function maxLinesExempt(p: string): boolean { /* ... */ }
// ```
/// Return whether the max-lines rule should skip `path`.
pub fn max_lines_exempt(path: &Path) -> bool {
    // What:     `if let Some(name) = path.file_name().and_then(|n| n.to_str())`.
    //           `path.file_name()` returns `Option<&OsStr>` (the last segment, or
    //           the absent variant `None` for paths ending in `..`). `.and_then(
    //           |n| n.to_str())` runs the closure only when a name is present;
    //           `n.to_str()` returns `Option<&str>` (None if the bytes are not
    //           valid UTF-8). `if let Some(name) = ...` runs the block only when
    //           the final result is present, binding the `&str` to `name`.
    // Why:      Get the file's base name as text to test its suffix.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const name = path.basename(p);
    // if (name) { /* ... */ }
    // ```
    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
        // What:     `if name == "build.rs" { return true; }`. Plain string
        //           equality and an early return.
        // Why:      The cargo build script is configuration-like; exempt it (it
        //           is also tiny in practice).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (name === "build.rs") return true;
        // ```
        if name == "build.rs" {
            return true;
        }

        // What:     `if name.ends_with("_tests.rs") { return true; }`.
        //           `.ends_with(...)` is a plain suffix test on the `&str`.
        // Why:      This repo keeps unit tests in sibling `*_tests.rs` files;
        //           treat them like oxlint's exempted `*.test.ts`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (name.endsWith("_tests.rs")) return true;
        // ```
        if name.ends_with("_tests.rs") {
            return true;
        }
    }

    // What:     `for component in path.components()`. Iterates the path piece by
    //           piece, yielding `Component` values.
    // Why:      Detect whether the file lives under a `tests/`, `fuzz/`, `fixture/`,
    //           `fixture/`, `test-fixture/`, or `invalid/` folder.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const component of p.split("/")) { /* ... */ }
    // ```
    for component in path.components() {
        // What:     `if let Component::Normal(segment) = component`. Matches only
        //           the ordinary-name variant, binding its `&OsStr` to `segment`
        //           (skips root `/`, `.`, `..`, drive prefixes).
        // Why:      We only compare real directory names.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const segment = component; // already a plain string
        // ```
        if let Component::Normal(segment) = component {
            // What:     `if let Some(text) = segment.to_str()`. Convert the
            //           OS string segment to UTF-8 `&str`, present only if valid.
            // Why:      Compare it as ordinary text.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const text = segment; if (text) { /* ... */ }
            // ```
            if let Some(text) = segment.to_str() {
                // What:     `if text == "tests" || text == "fuzz" || text == "fixture"
                //           || text == "fixture" || text == "test-fixture" || text ==
                //           "invalid" { return true; }`. A chain of equality tests
                //           joined by logical OR (`||`); the block runs (early-returning
                //           `true`) when the segment equals any of the six names.
                // Why:      A `tests/` or `fuzz/` ancestor is non-production code, and a
                //           `fixture/`, `fixture/`, `test-fixture/`, or `invalid/`
                //           ancestor is a deliberate linter sample; both are off-budget,
                //           matching oxlint's `ignorePatterns`.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (["tests", "fuzz", "fixture", "fixture", "test-fixture", "invalid"]
                //   .includes(text)) return true;
                // ```
                if text == "tests"
                    || text == "fuzz"
                    || text == "fixture"
                    || text == "fixture"
                    || text == "test-fixture"
                    || text == "invalid"
                {
                    return true;
                }
            }
        }
    }

    // What:     `false`. Bare tail expression: nothing matched, so the file is not
    //           exempt.
    // Why:      Default to enforcing the budget.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return false;
    // ```
    false
}

// What:     `pub fn missing_rustdoc_exempt(path: &Path) -> bool`. Borrows a path
//           read-only and answers whether the require-rustdoc rule should skip it.
//           Kept as its own function (not a call to `max_lines_exempt`) so the two
//           rules' skip lists can drift apart later without entangling them.
// Why:      Documentation is pointless on throwaway code: unit/integration test
//           files (`tests/`, `*_tests.rs`), fuzz harnesses (`fuzz/`), the cargo
//           build script (`build.rs`), and the linter's own deliberate samples
//           under a `fixture/`, `fixture/`, `test-fixture/`, or `invalid/`
//           directory. Those fixtures (such as `fixture/undocumented.rs`) exist
//           precisely to violate the rule, so scanning them is self-defeating;
//           this mirrors oxlint's `ignorePatterns` (`**/fixture/**`,
//           `**/fixture/**`, `**/test-fixture/**`, `**/invalid/**`).
//
// In TS you'd write (pseudocode):
// ```ts
// function missingRustdocExempt(p: string): boolean { /* ... */ }
// ```
/// Return whether the require-rustdoc rule should skip `path`.
pub fn missing_rustdoc_exempt(path: &Path) -> bool {
    // What:     `if let Some(name) = path.file_name().and_then(|n| n.to_str())`.
    //           `path.file_name()` returns `Option<&OsStr>` (the last segment, or
    //           `None`); `.and_then(|n| n.to_str())` converts it to `Option<&str>`
    //           when the bytes are valid UTF-8; `if let Some(name) = ...` runs the
    //           block only when a name is present, binding the `&str` to `name`.
    // Why:      Get the file's base name as text to test its suffix.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const name = path.basename(p);
    // if (name) { /* ... */ }
    // ```
    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
        // What:     `if name == "build.rs" { return true; }`. Plain string equality
        //           and an early return.
        // Why:      The cargo build script is generated glue, not documented API.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (name === "build.rs") return true;
        // ```
        if name == "build.rs" {
            return true;
        }

        // What:     `if name.ends_with("_tests.rs") { return true; }`.
        //           `.ends_with(...)` is a plain suffix test on the `&str`.
        // Why:      This repo keeps unit tests in sibling `*_tests.rs` files; test
        //           code does not need rustdoc.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (name.endsWith("_tests.rs")) return true;
        // ```
        if name.ends_with("_tests.rs") {
            return true;
        }
    }

    // What:     `for component in path.components()`. Iterates the path piece by
    //           piece, yielding `Component` values.
    // Why:      Detect whether the file lives under a `tests/`, `fuzz/`, `fixture/`,
    //           `fixture/`, `test-fixture/`, or `invalid/` folder.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const component of p.split("/")) { /* ... */ }
    // ```
    for component in path.components() {
        // What:     `if let Component::Normal(segment) = component`. Matches only
        //           the ordinary-name variant, binding its `&OsStr` to `segment`
        //           (skips root `/`, `.`, `..`, drive prefixes).
        // Why:      We only compare real directory names.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const segment = component;
        // ```
        if let Component::Normal(segment) = component {
            // What:     `if let Some(text) = segment.to_str()`. Convert the OS
            //           string segment to UTF-8 `&str`, present only if valid.
            // Why:      Compare it as ordinary text.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const text = segment; if (text) { /* ... */ }
            // ```
            if let Some(text) = segment.to_str() {
                // What:     `if text == "tests" || text == "fuzz" || text == "fixture"
                //           || text == "fixture" || text == "test-fixture" || text ==
                //           "invalid" { return true; }`. A chain of equality tests
                //           joined by logical OR (`||`); the block runs (early-returning
                //           `true`) when the segment equals any of the six names.
                // Why:      A `tests/` or `fuzz/` ancestor is non-production code, and a
                //           `fixture/`, `fixture/`, `test-fixture/`, or `invalid/`
                //           ancestor is a deliberate linter sample; neither needs
                //           rustdoc, matching oxlint's `ignorePatterns`.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (["tests", "fuzz", "fixture", "fixture", "test-fixture", "invalid"]
                //   .includes(text)) return true;
                // ```
                if text == "tests"
                    || text == "fuzz"
                    || text == "fixture"
                    || text == "fixture"
                    || text == "test-fixture"
                    || text == "invalid"
                {
                    return true;
                }
            }
        }
    }

    // What:     `false`. Bare tail expression: nothing matched, so the file is not
    //           exempt.
    // Why:      Default to requiring rustdoc.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return false;
    // ```
    false
}
