// What:     `use std::path::{Component, Path};` imports two standard-library
//           types for filesystem paths:
//             - `Path`: a borrowed, OS-aware path (sibling: owned `PathBuf`).
//             - `Component`: one piece of a path when you iterate it; its
//               variants include `Normal(&OsStr)` for an ordinary name segment.
// Why:      The exemption check inspects path segments and the file name.
// TS map:   no real equivalent; closest is splitting a string on "/" plus
//           Node's `path` module helpers.
//
// In TS you'd write (pseudocode):
// ```ts
// import path from "node:path";
// ```
use std::path::{Component, Path};

// What:     `pub struct Config { pub max_lines: usize }` is the linter's settings
//           record. `usize` is the pointer-wide unsigned integer (siblings:
//           `u32`/`u64`); used because it is a count compared against a line
//           count.
// Why:      Hold tunable knobs; today just the per-file code-line budget.
// TS map:   `type Config = { maxLines: number };`
//
// In TS you'd write (pseudocode):
// ```ts
// type Config = { maxLines: number };
// ```
pub struct Config {
    pub max_lines: usize,
}

// What:     `impl Config { ... }` attaches a constructor of default settings.
// Why:      One source of truth for the defaults that mirror oxlint.
// TS map:   `const DEFAULT_CONFIG: Config = { maxLines: 300 };`
//
// In TS you'd write (pseudocode):
// ```ts
// function withDefaults(): Config { return { maxLines: 300 }; }
// ```
impl Config {
    // What:     `pub fn with_defaults() -> Self`. Returns a fresh `Config` (no
    //           `self` parameter, so it is an associated function / static method).
    // Why:      Default the budget to 300, matching oxlint's eslint/max-lines.
    // TS map:   `static withDefaults(): Config { return { maxLines: 300 }; }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // static withDefaults(): Config { return { maxLines: 300 }; }
    // ```
    pub fn with_defaults() -> Self {
        // What:     `Self { max_lines: 300 }`. Builds the struct; the literal 300
        //           is the budget. Tail expression, so it is returned.
        // Why:      300 code lines (blanks and comments already excluded) is the
        //           same generous budget oxlint uses for TypeScript.
        // TS map:   `return { maxLines: 300 };`
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
//           (`fuzz/`), and the cargo build script (`build.rs`). (`target/` never
//           reaches us; the file walker already drops gitignored paths.)
// TS map:   `function maxLinesExempt(p: string): boolean`.
//
// In TS you'd write (pseudocode):
// ```ts
// function maxLinesExempt(p: string): boolean { /* ... */ }
// ```
pub fn max_lines_exempt(path: &Path) -> bool {
    // What:     `if let Some(name) = path.file_name().and_then(|n| n.to_str())`.
    //           `path.file_name()` returns `Option<&OsStr>` (the last segment, or
    //           the absent variant `None` for paths ending in `..`). `.and_then(
    //           |n| n.to_str())` runs the closure only when a name is present;
    //           `n.to_str()` returns `Option<&str>` (None if the bytes are not
    //           valid UTF-8). `if let Some(name) = ...` runs the block only when
    //           the final result is present, binding the `&str` to `name`.
    // Why:      Get the file's base name as text to test its suffix.
    // TS map:   `const name = path.basename(p); if (name) { ... }`
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
        // TS map:   `if (name === "build.rs") return true;`
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
        // TS map:   `if (name.endsWith("_tests.rs")) return true;`
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
    // Why:      Detect whether the file lives under a `tests/` or `fuzz/` folder.
    // TS map:   `for (const component of p.split("/"))`.
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
        // TS map:   plain string segments; TS has no special root/`..` variants.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const segment = component; // already a plain string
        // ```
        if let Component::Normal(segment) = component {
            // What:     `if let Some(text) = segment.to_str()`. Convert the
            //           OS string segment to UTF-8 `&str`, present only if valid.
            // Why:      Compare it as ordinary text.
            // TS map:   `const text = segment; if (text) { ... }`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const text = segment; if (text) { /* ... */ }
            // ```
            if let Some(text) = segment.to_str() {
                // What:     `if text == "tests" || text == "fuzz" { return true; }`.
                //           Logical OR of two equality tests; early-return on a hit.
                // Why:      A `tests/` or `fuzz/` ancestor means non-production code.
                // TS map:   `if (text === "tests" || text === "fuzz") return true;`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (text === "tests" || text === "fuzz") return true;
                // ```
                if text == "tests" || text == "fuzz" {
                    return true;
                }
            }
        }
    }

    // What:     `false`. Bare tail expression: nothing matched, so the file is not
    //           exempt.
    // Why:      Default to enforcing the budget.
    // TS map:   `return false;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return false;
    // ```
    false
}
