//! What: Consumer-level controls that start the built native executable.
//! Why: Forwarding, self-exclusion, policy decisions and refusals are promises about the
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

/// Configuration loading and the read-only fast path.
#[path = "binary_policy_tests.rs"]
mod policy;

/// Wrapper controls, escape hatches and commands Git refuses.
#[path = "binary_controls_tests.rs"]
mod controls;

/// The refusal frontier: commands that need work this executable does not do.
#[path = "binary_frontier_tests.rs"]
mod frontier;

/// The pre-forward built-in policies and the fixed transforms.
#[path = "binary_builtin_tests.rs"]
mod builtin;

/// The `git cli-git` management namespace.
#[path = "binary_management_tests.rs"]
mod management;

/// The dependent-version policy on direct check and fix.
#[path = "binary_dependent_version_tests.rs"]
mod dependent_version;
