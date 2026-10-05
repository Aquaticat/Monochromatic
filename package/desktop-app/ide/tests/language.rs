//! Language module sessions against the scripted server: one child process per test, because
//! Helix roots servers at the process working directory.

/// What: `#[path = "..."]` names the file a module is read from. A test crate's root file looks
///       for its modules beside itself, so the modules kept under `tests/language/` are named
///       explicitly.
/// Why:  One test crate links the application library once and lets every test share the
///       support code without unused-code warnings.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import * as support from './language/support';
/// ```
#[path = "language/support.rs"]
mod support;

/// Start states, the readiness gate, and the start deadline.
#[path = "language/start.rs"]
mod start;
