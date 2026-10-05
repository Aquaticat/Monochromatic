//! What: Consumer-level controls that start the built native executable.
//! Why: Forwarding, self-exclusion and fail-closed behaviour are promises about the
//!      program a caller runs as `git`, so they are checked through that program
//!      against real Git 2.56.0, never only through library functions.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // const wrapped = spawnSync(join(fixture, 'bin/git'), ['--version'], { env });
//! ```
#![cfg(unix)]

/// Fixtures and bounded process helpers shared by every binary-level control.
#[path = "binary_support.rs"]
mod support;

/// Exact forwarding of arguments, streams, exit codes, signals and environment.
#[path = "binary_forwarding_tests.rs"]
mod forwarding;

/// Wrapper self-exclusion and recursion prevention on PATH.
#[path = "binary_resolution_tests.rs"]
mod resolution;

/// Configuration loading and the fail-closed policy stage.
#[path = "binary_policy_tests.rs"]
mod policy;
