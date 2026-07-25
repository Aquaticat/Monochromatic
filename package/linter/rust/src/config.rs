//! Configuration for this binary, re-exported from the shared core crate.
//!
//! This module used to hold two hardcoded exemption predicates,
//! `max_lines_exempt` and `missing_rustdoc_exempt`, each walking a path's
//! segments against a fixed list of directory names. Both are gone. Which files
//! a rule runs on is a glob `overrides` question now, answered by
//! `rust-linter.toml` and by the built-in defaults compiled into the core crate
//! from `package/rust-module/rust-linter-core/default.toml`.

// What:     `pub use other_crate::path::Type;` re-exports a name from a
//           DEPENDENCY under this crate's own path. A plain `use` would import
//           it for this file only; the `pub` makes `crate::config::Config` a
//           valid path for every other module here, and for outside consumers.
// Why:      The settings record lives in `monochromatic-rust-linter-core` so
//           rule packages can depend on it without depending on this CLI crate.
//           Re-exporting it under the path it already had means no rule, test,
//           or consumer had to be rewritten when it moved.
//
// In TS you'd write (pseudocode):
// ```ts
// export { Config } from "@monochromatic-dev/rust-linter-core/config";
// ```
/// Re-exports the shared settings record under this crate's original path.
pub use monochromatic_rust_linter_core::config::Config;

/// Re-exports the built-in configuration compiled into the core crate.
pub use monochromatic_rust_linter_core::config::default_config;

/// Re-exports the on-disk configuration shapes.
pub use monochromatic_rust_linter_core::config::file;

/// Re-exports configuration loading, `extends` resolution and nested discovery.
pub use monochromatic_rust_linter_core::config::load;

/// Re-exports configuration merging and per-file rule resolution.
pub use monochromatic_rust_linter_core::config::resolve;
