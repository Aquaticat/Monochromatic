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
