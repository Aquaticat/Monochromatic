// What:     `pub mod max_lines;` declares a public submodule named `max_lines`,
//           whose code lives in the sibling file `max_lines.rs`. `mod` is Rust's
//           way of pulling another file into the module tree (there is no
//           per-file auto-import like TS).
// Why:      Expose the max-lines rule to the rest of the crate.
//
// In TS you'd write (pseudocode):
// ```ts
// export * as maxLines from "./max-lines";
// ```
pub mod max_lines;

// What:     `#[cfg(test)] mod max_lines_tests;`. `#[cfg(test)]` is a conditional-
//           compilation attribute: the module compiles ONLY during `cargo test`,
//           never in the release binary. `mod max_lines_tests;` pulls in the
//           sibling file `max_lines_tests.rs`.
// Why:      Keep the rule's tests beside it without shipping them.
//
// In TS you'd write (pseudocode):
// ```ts
// // max-lines.test.ts, run only by the test runner
// ```
#[cfg(test)]
mod max_lines_tests;

// What:     `pub mod require_rustdoc;` declares the public submodule for the
//           rustdoc-presence rule, whose code lives in `require_rustdoc.rs`.
// Why:      Expose the require-rustdoc rule to the rest of the crate.
//
// In TS you'd write (pseudocode):
// ```ts
// export * as requireRustdoc from "./require-rustdoc";
// ```
pub mod require_rustdoc;

// What:     `#[cfg(test)] mod require_rustdoc_tests;`. Compiles the sibling test
//           module only during `cargo test`, never in the release binary.
// Why:      Keep the rule's tests beside it without shipping them.
//
// In TS you'd write (pseudocode):
// ```ts
// // require-rustdoc.test.ts, run only by the test runner
// ```
#[cfg(test)]
mod require_rustdoc_tests;
