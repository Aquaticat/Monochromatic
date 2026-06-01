// What:     `pub mod max_lines;` declares a public submodule named `max_lines`,
//           whose code lives in the sibling file `max_lines.rs`. `mod` is Rust's
//           way of pulling another file into the module tree (there is no
//           per-file auto-import like TS).
// Why:      Expose the max-lines rule to the rest of the crate.
// TS map:   roughly `export * as maxLines from "./max-lines";` — except `mod`
//           is what makes the file part of the build at all.
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
// TS map:   a `max-lines.test.ts` file the bundler excludes from production.
//
// In TS you'd write (pseudocode):
// ```ts
// // max-lines.test.ts, run only by the test runner
// ```
#[cfg(test)]
mod max_lines_tests;
